import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { readBase, readEr, connBase, DELEGATION_PROGRAM } from "../lib/anchor";

export function useArena(pda: PublicKey | null, intervalMs = 400) {
  const [arena, setArena] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const pdaKey = pda?.toBase58();

  useEffect(() => {
    if (!pda) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const info = await connBase.getAccountInfo(pda);
        const delegated = info !== null && info.owner.equals(DELEGATION_PROGRAM);
        const program = delegated ? readEr : readBase;
        const a = await program.account.arenaAccount.fetch(pda);
        if (cancelled) return;
        setArena(a); setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      await poll();
      if (!cancelled) timer = setTimeout(loop, intervalMs);
    };
    loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pdaKey, intervalMs]);

  return { arena, error };
}
