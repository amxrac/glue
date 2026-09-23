import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getPrograms, readBase, connBase, PROGRAM_ID } from "../lib/anchor";
import { waitFor } from "../lib/waitFor";

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
  const isHost = arena.host.toBase58() === me;
  const winner: string | undefined = arena.winner?.toBase58();
  const isWinner = winner === me;

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      connBase.getAccountInfo(pda).then((i) => {
        if (!cancelled) setDelegated(i !== null && !i.owner.equals(PROGRAM_ID));
      }).catch(() => {});
    };
    check();
    const t = setInterval(check, 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [pda.toBase58()]);

  async function settle() {
    const { programEr } = getPrograms(wallet);
    setStepBoth("settling on rollup");
    await programEr.methods.settleArena(arena.id)
      .accountsPartial({ host: wallet.publicKey, arenaAccount: pda })
      .rpc();
    setStepBoth("returning to Solana");
    await waitFor("undelegation", async () => {
      const i = await connBase.getAccountInfo(pda);
      return i !== null && i.owner.equals(PROGRAM_ID);
    });
  }

  async function claim() {
    const { programBase } = getPrograms(wallet);
    setStepBoth("claiming prize");
    const settled = await readBase.account.arenaAccount.fetch(pda);
    if (!settled.winner) throw new Error("no winner recorded on the settled arena");
    await programBase.methods.claimPrize(arena.id)
      .accountsPartial({ caller: wallet.publicKey, arenaAccount: pda, winner: settled.winner })
      .rpc();
    history.replaceState(null, "", location.pathname);
    onDone();
  }

  async function act(fn: () => Promise<void>) {
    setErr(null);
    try { await fn(); }
    catch (e: any) { setErr(`${stepRef.current ?? "error"}: ${String(e.message ?? e)}`); }
    finally { setStepBoth(null); }
  }

  function renderAction() {
    const muted: React.CSSProperties = { fontSize: 13, opacity: 0.7 };
    const btn = (label: string, fn: () => Promise<void>) => (
      <button style={{ width: "100%" }} disabled={!!step} onClick={() => act(fn)}>
        {step ?? label}
      </button>
    );

    if (delegated === null) return null;

    if (delegated) {
      if (isHost && isWinner) return btn("Settle & claim", async () => { await settle(); await claim(); });
      if (isHost) return btn("Settle", settle);
      return <p style={muted}>Waiting for host to settle…</p>;
    }

    if (isWinner) return btn("Claim prize", claim);
    return <p style={muted}>Settled. Waiting for the winner to claim…</p>;
  }

  const box: React.CSSProperties = { maxWidth: 480, margin: "0 auto", padding: 12 };
  const potSol = (arena.entryFee.toNumber() * players.length) / 1e9;

  return (
    <div style={box}>
      <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>
        {isWinner ? "You won" : "Match over"}
      </h2>

      {winner && !isWinner && (
        <p style={{ fontSize: 13, opacity: 0.8, margin: "0 0 8px" }}>
          {winner.slice(0, 4)}…{winner.slice(-4)} won
        </p>
      )}

      {players.map((p, i) => {
        const k = p.toBase58();
        return (
          <div key={k} style={{ display: "flex", padding: "7px 0", borderTop: "1px solid #ddd", fontSize: 13 }}>
            <span>{k === me ? "you" : `${k.slice(0, 4)}…${k.slice(-4)}`}</span>
            <span style={{ marginLeft: "auto", fontFamily: "monospace" }}>
              {arena.bots[i].score.toNumber()}
            </span>
          </div>
        );
      })}

      <p style={{ fontSize: 13, opacity: 0.8, margin: "12px 0" }}>
        pot {potSol.toFixed(4)} SOL
      </p>

      {renderAction()}

      {err && <p style={{ color: "crimson", fontSize: 13 }}>{err}</p>}
    </div>
  );
}
