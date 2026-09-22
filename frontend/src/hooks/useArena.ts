import { useEffect, useState, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { readBase, readEr, connBase, PROGRAM_ID } from "../lib/anchor";

export function useArena(pda: PublicKey | null, intervalMs = 400) {
  const [arena, setArena] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const pdaKey = pda?.toBase58();
  const delegatedRef = useRef(false);
  useEffect(() => {
    if (!pda) return;
    let cancelled = false;

    let n = 0;
    const poll = async () => {
      n++;
      try {
        if (!delegatedRef.current || n % 10 === 0) {
          const info = await connBase.getAccountInfo(pda);
          if (info === null) {
            if (!cancelled) { setClosedKey(pda.toBase58()); setArena(null); setError(null); }
            return;
          }
          delegatedRef.current = !info.owner.equals(PROGRAM_ID);
        }
        const program = delegatedRef.current ? readEr : readBase;
        const a = await program.account.arenaAccount.fetch(pda);
        if (cancelled) return;
        setArena(a);
        setLastStatus(Object.keys(a.status)[0]);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      await poll();
      const delay = delegatedRef.current ? 150 : intervalMs;
      if (!cancelled) timer = setTimeout(loop, delay);
    };
    loop();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pdaKey, intervalMs]);

  const closed = closedKey !== null && closedKey === pdaKey;

  return {
    arena: pdaKey ? arena : null,
    error: pdaKey ? error : null,
    closed,
    lastStatus: pdaKey ? lastStatus : null,
  };
}
