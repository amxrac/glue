import { useEffect, useState, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { readBase, readEr } from "../lib/anchor";

export function useArena(pda: PublicKey | null, intervalMs = 400) {
  const [arena, setArena] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSource = useRef<"base" | "er">("base");

  const pdaKey = pda?.toBase58();

  useEffect(() => {
    if (!pda) return;
    let cancelled = false;

    const poll = async () => {
      const order = lastSource.current === "er"
        ? [{ p: readEr, s: "er" as const }, { p: readBase, s: "base" as const }]
        : [{ p: readBase, s: "base" as const }, { p: readEr, s: "er" as const }];

      for (let i = 0; i < order.length; i++) {
        try {
          const a = await order[i].p.account.arenaAccount.fetch(pda);
          if (cancelled) return;
          setArena(a);
          setError(null);
          lastSource.current = order[i].s;
          return;
        } catch (e) {
          if (i === order.length - 1 && !cancelled) setError(String(e));
        }
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
