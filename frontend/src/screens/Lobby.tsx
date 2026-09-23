import { useRef, useState } from "react";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import {
  getPrograms, arenaPda, readBase, readEr, connBase,
  ENTRY_FEE, PROGRAM_ID, ORACLE_QUEUE, VALIDATOR, DELEGATION_PROGRAM, INTERVAL_MS,
} from "../lib/anchor";
import { waitFor } from "../lib/waitFor";

const MAGIC_PROGRAM = new PublicKey("Magic11111111111111111111111111111111111111");

export function Lobby({
  arena, pda, wallet, onCreated, onStarting,
}: {
  arena: any;
  pda: PublicKey | null;
  wallet: AnchorWallet;
  onCreated: (pda: PublicKey | null) => void;
  onStarting: (v: boolean) => void;
}) {
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const stepRef = useRef<string | null>(null);
  const me = wallet.publicKey.toBase58();

  const setStepBoth = (s: string | null) => { stepRef.current = s; setStep(s); };

  const run = async (label: string, fn: () => Promise<void>) => {
    setErr(null);
    setStepBoth(label);
    try { await fn(); }
    catch (e: any) { setErr(`${stepRef.current ?? label}: ${String(e.message ?? e)}`); }
    finally { setStepBoth(null); }
  };

  async function create() {
    const { programBase } = getPrograms(wallet);
    const id = new anchor.BN(Date.now() % 1_000_000);
    await programBase.methods
      .initArena(id, ENTRY_FEE)
      .accounts({ host: wallet.publicKey })
      .rpc();
    const p = arenaPda(wallet.publicKey, id, PROGRAM_ID);
    history.replaceState(null, "", `?arena=${p.toBase58()}`);
    onCreated(p);
  }

  async function join() {
    const { programBase } = getPrograms(wallet);
    await programBase.methods
      .joinArena(arena.id)
      .accountsPartial({ player: wallet.publicKey, arenaAccount: pda! })
      .rpc();
  }

  async function leave() {
    const { programBase } = getPrograms(wallet);
    await programBase.methods.leaveArena(arena.id)
      .accountsPartial({ player: wallet.publicKey, arenaAccount: pda! })
      .rpc();
  }

  async function start() {
    onStarting(true);
    try {
      const { programBase, programEr } = getPrograms(wallet);
      const id = arena.id;
      const isDelegated = async () => {
        const info = await connBase.getAccountInfo(pda!);
        return info !== null && info.owner.equals(DELEGATION_PROGRAM);
      };

      if (!(await isDelegated())) {
        let a = await readBase.account.arenaAccount.fetch(pda!);

        if (a.vrfSeed === null) {
          setStepBoth("requesting randomness");
          await programBase.methods.requestRandomness(id)
            .accountsPartial({ host: wallet.publicKey, arenaAccount: pda!, oracleQueue: ORACLE_QUEUE })
            .rpc();
          setStepBoth("waiting for VRF");
          await waitFor("vrf_seed", async () =>
            (await readBase.account.arenaAccount.fetch(pda!)).vrfSeed !== null);
          a = await readBase.account.arenaAccount.fetch(pda!);
        }

        if ("waiting" in a.status) {
          setStepBoth("placing bots");
          await programBase.methods.startArena(id)
            .accountsPartial({ host: wallet.publicKey, arenaAccount: pda! })
            .rpc();
        }

        setStepBoth("delegating to rollup");
        await programBase.methods.delegate(id)
          .accounts({ host: wallet.publicKey, validator: VALIDATOR })
          .rpc();
        await waitFor("delegation", isDelegated);
      }

      const live = await readEr.account.arenaAccount.fetch(pda!).catch(() => null);
      if (!live || live.tick.isZero()) {
        setStepBoth("starting simulation");
        await programEr.methods
          .scheduleAdvance(id, {
            taskId: id,
            executionIntervalMillis: INTERVAL_MS,
            iterations: arena.maxTicks.addn(50),
          })
          .accounts({ magicProgram: MAGIC_PROGRAM, host: wallet.publicKey, program: PROGRAM_ID })
          .rpc();
      }
    } finally {
      onStarting(false);
    }
  }

  async function cancel() {
    const { programBase } = getPrograms(wallet);
    await programBase.methods.cancelArena(arena.id)
      .accountsPartial({ host: wallet.publicKey, arenaAccount: pda! })
      .remainingAccounts(
        arena.players.map((p: PublicKey) => ({ pubkey: p, isWritable: true, isSigner: false }))
      )
      .rpc();
    history.replaceState(null, "", location.pathname);
    onCreated(null);
  }

  const box: React.CSSProperties = { maxWidth: 480, margin: "0 auto", padding: 12 };

  if (!pda) {
    return (
      <div style={box}>
        <button disabled={!!step} onClick={() => run("creating", create)}>
          {step ?? "Create arena"}
        </button>
        {err && <p style={{ color: "crimson", fontSize: 13 }}>{err}</p>}
      </div>
    );
  }

  if (!arena) return <div style={box}><p>loading arena…</p></div>;

  const players: PublicKey[] = arena.players;
  const isHost = arena.host.toBase58() === me;
  const joined = players.some((p) => p.toBase58() === me);
  const maxPlayers = arena.bots.length;
  const full = players.length >= maxPlayers;
  const feeSol = arena.entryFee.toNumber() / 1e9;
  const link = `${location.origin}${import.meta.env.BASE_URL}?arena=${pda.toBase58()}`;

  function copyLink() {
    navigator.clipboard.writeText(link)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => setErr("couldn't copy. copy the URL from the address bar"));
  }

  return (
    <div style={box}>
      <h2 style={{ margin: "0 0 2px", fontSize: 18 }}>Arena #{arena.id.toNumber()}</h2>
      <p style={{ margin: "0 0 12px", fontSize: 12, opacity: 0.7 }}>
        Entry {feeSol.toFixed(3)} SOL · pot {(feeSol * players.length).toFixed(3)} SOL
      </p>

      {players.map((p) => {
        const k = p.toBase58();
        return (
          <div key={k} style={{ display: "flex", gap: 8, padding: "7px 0", borderTop: "1px solid #ddd", fontSize: 13 }}>
            <span style={{ fontFamily: "monospace" }}>{k.slice(0, 4)}…{k.slice(-4)}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.6 }}>
              {}
              {p.equals(arena.host) ? "host" : "joined"}{k === me ? " · you" : ""}
            </span>
          </div>
        );
      })}
      <p style={{ fontSize: 12, opacity: 0.7, margin: "10px 0" }}>
        {players.length} of {maxPlayers} joined
      </p>

      <button style={{ width: "100%", marginBottom: 6 }} onClick={copyLink}>
        {copied ? "Copied" : "Copy invite link"}
      </button>

      {!joined && (
        <button style={{ width: "100%", marginBottom: 6 }}
          disabled={full || !!step}
          onClick={() => run("joining", join)}>
          {full ? "Arena full" : `Join · ${feeSol.toFixed(3)} SOL`}
        </button>
      )}

      {isHost && (
        <>
          <button style={{ width: "100%", marginBottom: 6 }}
            disabled={players.length < 2 || !!step}
            onClick={() => run("starting", start)}>
            {step ?? (players.length < 2 ? "Need 2+ players" : "Start match")}
          </button>
          <button style={{ width: "100%", fontSize: 13 }}
            disabled={!!step} onClick={() => run("cancelling", cancel)}>
            Cancel and refund
          </button>
        </>
      )}

      {joined && !isHost && (
        <>
          <p style={{ fontSize: 12, opacity: 0.7 }}>Waiting for host to start…</p>
          <button style={{ width: "100%", fontSize: 13 }} disabled={!!step}
            onClick={() => run("leaving", leave)}>
            Leave and refund
          </button>
        </>
      )}
      {err && <p style={{ color: "crimson", fontSize: 13 }}>{err}</p>}
    </div>
  );
}
