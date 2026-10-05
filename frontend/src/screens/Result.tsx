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

    setStepBoth("Settling on rollup");
    try {
      await programEr.methods.settleArena(arena.id)
        .accountsPartial({ payer: wallet.publicKey, arenaAccount: pda })
        .rpc();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/reject|ArenaNotFinished/i.test(msg)) throw e;
      setStepBoth("Returning to Solana");
      try { await waitFor("undelegation", backOnBase, 10_000); return; }
      catch { throw e; }
    }

    setStepBoth("Returning to Solana");
    await waitFor("undelegation", backOnBase);
  }

  async function claim() {
    const { programBase } = getPrograms(wallet);
    setStepBoth(forced ? "Refunding" : "Claiming prize");
    const settled = await readBase.account.arenaAccount.fetch(pda);
    const winners = leadersOf(settled);
    if (winners.length === 0) throw new Error("no winners recorded on the settled arena");
    await programBase.methods.claimPrize(arena.id)
      .accountsPartial({ caller: wallet.publicKey, arenaAccount: pda, host: settled.host })
      .remainingAccounts(winners.map((pubkey) => ({ pubkey, isWritable: true, isSigner: false })))
      .rpc();
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

  const claimLabel = forced ? "Claim refund" : "Claim prize";
  const settleClaimLabel = forced ? "Settle and refund" : "Settle and claim";

  const action: Action =
    delegated === null ? null
    : delegated
      ? isWinner ? { kind: "button", label: settleClaimLabel, fn: settleAndClaim }
      : { kind: "button", label: "Settle", fn: settle }
    : isWinner ? { kind: "button", label: claimLabel, fn: claim }
    : { kind: "note", text: "Settled. Waiting for a winner to claim…" };

  const potSol = (arena.entryFee.toNumber() * players.length) / 1e9;

  const heading = forced
    ? "Match ended early"
    : isWinner ? (tie ? "You tied" : "You won") : "Match over";
  const subtitle = forced
    ? "Match stalled, so every entry fee is refunded"
    : tie
      ? `Tie. Pot split ${leaders.length} ways`
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
