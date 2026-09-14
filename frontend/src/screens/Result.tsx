import { useEffect, useRef, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getPrograms, readBase, connBase, PROGRAM_ID, ENTRY_FEE } from "../lib/anchor";
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

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      connBase.getAccountInfo(pda).then((i) => {
        if (!cancelled) setDelegated(i !== null && !i.owner.equals(PROGRAM_ID));
      }).catch(() => { /* closed or RPC blip. last known value is kept */ });
    };
    check();
    const t = setInterval(check, 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [pda.toBase58()]);

  async function settleAndClaim() {
    setErr(null);
    try {
      const { programBase, programEr } = getPrograms(wallet);


      const info = await connBase.getAccountInfo(pda);
      const stillDelegated = info !== null && !info.owner.equals(PROGRAM_ID);

      if (stillDelegated) {
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

      setStepBoth("claiming prize");
      const settled = await readBase.account.arenaAccount.fetch(pda);
      if (!settled.winner) throw new Error("no winner recorded on the settled arena");
      await programBase.methods.claimPrize(arena.id)
        .accountsPartial({
          caller: wallet.publicKey,
          arenaAccount: pda,
          winner: settled.winner,
        })
        .rpc();

      history.replaceState(null, "", location.pathname);
      onDone();
    } catch (e: any) {
      setErr(`${stepRef.current ?? "claim"}: ${String(e.message ?? e)}`);
    } finally {
      setStepBoth(null);
    }
  }

  const winner = arena.winner?.toBase58();
  const box: React.CSSProperties = { maxWidth: 480, margin: "0 auto", padding: 12 };

  return (
    <div style={box}>
      <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>
        {winner === me ? "You won" : "Match over"}
      </h2>

      {winner && winner !== me && (
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
        pot {((ENTRY_FEE.toNumber() * players.length) / 1e9).toFixed(4)} SOL
      </p>

      {delegated && !isHost ? (
        <p style={{ fontSize: 13, opacity: 0.7 }}>Waiting for host to settle…</p>
      ) : (
        <button
          style={{ width: "100%" }}
          disabled={!!step || delegated === null}
          onClick={settleAndClaim}
        >
          {step ?? (delegated ? "Settle & claim" : "Claim prize")}
        </button>
      )}

      {err && <p style={{ color: "crimson", fontSize: 13 }}>{err}</p>}
    </div>
  );
}
