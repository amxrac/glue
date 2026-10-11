import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getPrograms, readBase, connBase, PROGRAM_ID } from "../lib/anchor";
import { waitFor } from "../lib/waitFor";
import { displayName } from "../lib/names";

type Action =
  | { kind: "button"; label: string; fn: () => Promise<void> }
  | { kind: "note"; text: string }
  | null;

const SETTLED_READ_TIMEOUT_MS = 20_000;
const GONE_CHECK_TIMEOUT_MS = 8_000;
const USER_REJECTED = /reject|denied|cancel/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function leadersOf(a: any): PublicKey[] {
  return (a.players as PublicKey[]).filter((_, i) => (a.winners & (1 << i)) !== 0);
}

export function Result({ arena, pda, wallet, onDone }: {
  arena: any; pda: PublicKey; wallet: AnchorWallet; onDone: () => void;
}) {
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const stepRef = useRef<string | null>(null);
  const setStepBoth = (s: string | null) => { stepRef.current = s; setStep(s); };

  const [delegated, setDelegated] = useState<boolean | null>(null);

  const me = wallet.publicKey.toBase58();
  const players: PublicKey[] = arena.players;
  const leaders = leadersOf(arena).map((p) => p.toBase58());
  const leaderIdx = players
    .map((_, i) => i)
    .filter((i) => (arena.winners & (1 << i)) !== 0);
  const isWinner = leaders.includes(me);
  const tie = leaders.length > 1;
  const forced = arena.tick.lt(arena.maxTicks);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      connBase.getAccountInfo(pda).then((i) => {
        if (!cancelled) setDelegated(i !== null && !i.owner.equals(PROGRAM_ID));
      }).catch(() => { });
    };
    check();
    const t = setInterval(check, 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [pda]);

  async function settle() {
    const { programEr } = getPrograms(wallet);
    const backOnBase = async () => {
      const i = await connBase.getAccountInfo(pda);
      return i !== null && i.owner.equals(PROGRAM_ID);
    };

    setStepBoth("Saving results");
    try {
      await programEr.methods.settleArena(arena.id)
        .accountsPartial({ payer: wallet.publicKey, arenaAccount: pda })
        .rpc();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (USER_REJECTED.test(msg) || /ArenaNotFinished/.test(msg)) throw e;
      setStepBoth("Confirming results");
      try { await waitFor("undelegation", backOnBase, 10_000); return; }
      catch { throw e; }
    }

    setStepBoth("Confirming results");
    await waitFor("undelegation", backOnBase);
  }

  async function readSettled(): Promise<any> {
    const deadline = Date.now() + SETTLED_READ_TIMEOUT_MS;
    let lastErr: unknown = null;
    while (Date.now() < deadline) {
      try {
        const info = await connBase.getAccountInfo(pda);
        if (info && info.owner.equals(PROGRAM_ID)) {
          const a = readBase.coder.accounts.decode("arenaAccount", info.data);
          if ("finished" in a.status && a.winners !== 0) return a;
        }
      } catch (e) {
        lastErr = e;
      }
      await sleep(1000);
    }
    throw new Error(
      `results not readable yet, try again in a moment${lastErr ? ` (${String(lastErr)})` : ""}`
    );
  }

  async function arenaGone(): Promise<boolean> {
    const deadline = Date.now() + GONE_CHECK_TIMEOUT_MS;
    let misses = 0;
    while (Date.now() < deadline) {
      try {
        const info = await connBase.getAccountInfo(pda);
        misses = info === null ? misses + 1 : 0;
        if (misses >= 2) return true;
      } catch {
        // unknown
      }
      await sleep(1000);
    }
    return false;
  }

  async function claim() {
    const { programBase } = getPrograms(wallet);
    setStepBoth(forced ? "Sending refunds" : "Sending prize");

    const settled = await readSettled();
    const winners = leadersOf(settled);

    try {
      await programBase.methods.claimPrize(arena.id)
        .accountsPartial({ caller: wallet.publicKey, arenaAccount: pda, host: settled.host })
        .remainingAccounts(winners.map((pubkey) => ({ pubkey, isWritable: true, isSigner: false })))
        .rpc();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (USER_REJECTED.test(msg)) throw e;
      setStepBoth("Checking");
      if (!(await arenaGone())) throw e;
    }

    history.replaceState(null, "", location.pathname);
    onDone();
  }

  async function settleAndClaim() {
    await settle();
    await claim();
  }

  async function act(fn: () => Promise<void>) {
    setErr(null);
    try { await fn(); }
    catch (e: any) { setErr(`${stepRef.current ?? "Error"}: ${String(e.message ?? e)}`); }
    finally { setStepBoth(null); }
  }

  const primaryLabel = forced ? "Refund all players" : "Claim prize";

  const action: Action =
    delegated === null ? null
    : isWinner
      ? { kind: "button", label: primaryLabel, fn: delegated ? settleAndClaim : claim }
      : { kind: "note", text: "Waiting for the winner to claim." };

  const potSol = (arena.entryFee.toNumber() * players.length) / 1e9;

  const heading = forced
    ? "Match ended early"
    : isWinner ? (tie ? "You tied" : "You won") : "Match over";
  const subtitle = forced
    ? "The match stalled, so every entry fee is refunded"
    : tie
      ? `Tie — pot split ${leaders.length} ways`
      : !isWinner && leaderIdx.length > 0 ? `${displayName(arena, leaderIdx[0])} won` : null;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 4px" }}>{heading}</h2>

      {subtitle && (
        <p className="muted" style={{ fontSize: 14, margin: "0 0 12px" }}>{subtitle}</p>
      )}

      <div className="list-head">
        <span>Player</span>
        <span style={{ marginLeft: "auto" }}>Score</span>
      </div>
      {players.map((p, i) => {
        const k = p.toBase58();
        return (
          <div key={k} className="player-row">
            <span>{displayName(arena, i)}{k === me ? " (you)" : ""}</span>
            <span style={{ marginLeft: "auto", fontFamily: "monospace" }}>
              {arena.bots[i].score.toNumber()}
            </span>
          </div>
        );
      })}

      <p className="muted" style={{ fontSize: 14, margin: "12px 0" }}>
        {forced ? "Refunded" : "Pot"} {potSol.toFixed(4)} SOL
      </p>

      {action?.kind === "button" && (
        <button className="btn-primary" style={{ width: "100%" }} disabled={!!step} onClick={() => act(action.fn)}>
          {step ? `${step}…` : action.label}
        </button>
      )}
      {action?.kind === "note" && (
        <p className="muted" style={{ fontSize: 14 }}>{action.text}</p>
      )}

      {err && <p className="error">{err}</p>}
    </div>
  );
}
