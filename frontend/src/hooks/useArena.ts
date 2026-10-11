import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { readBase, readEr, connBase, PROGRAM_ID } from "../lib/anchor";

const MISSING_IF_NEW = 5;
const MISSING_IF_SEEN = 2;

type Snapshot = {
  key: string;
  arena: any;
  error: string | null;
  closed: boolean;
  lastStatus: string | null;
  delegated: boolean;
};

const blank = (key: string): Snapshot => ({
  key, arena: null, error: null, closed: false, lastStatus: null, delegated: false,
});

export function useArena(pda: PublicKey | null, intervalMs = 400) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const pdaKey = pda?.toBase58();

  useEffect(() => {
    if (!pda) return;
    let cancelled = false;
    const key = pda.toBase58();

    let delegated = false;
    let n = 0;
    let missing = 0;
    let seen = false;

    const update = (patch: Partial<Snapshot>) => {
      if (cancelled) return;
      setSnap((prev) => ({ ...(prev && prev.key === key ? prev : blank(key)), ...patch }));
    };

    const poll = async () => {
      n++;
      try {
        if (!delegated || n % 10 === 0) {
          const info = await connBase.getAccountInfo(pda);
          if (cancelled) return;
          if (info === null) {
            missing++;
            if (missing >= (seen ? MISSING_IF_SEEN : MISSING_IF_NEW)) {
              update({ closed: true, arena: null, error: null });
            }
            return;
          }
          missing = 0;
          delegated = !info.owner.equals(PROGRAM_ID);
          update({ delegated });
        }
        const a = await (delegated ? readEr : readBase).account.arenaAccount.fetch(pda);
        if (cancelled) return;
        seen = true;
        update({ arena: a, closed: false, lastStatus: Object.keys(a.status)[0], error: null });
      } catch (e) {
        update({ error: String(e) });
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      await poll();
      if (!cancelled) timer = setTimeout(loop, delegated ? 150 : intervalMs);
    };
    loop();

    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pdaKey, intervalMs]);

  const s = snap && snap.key === pdaKey ? snap : null;
  return {
    arena: s?.arena ?? null,
    error: s?.error ?? null,
    closed: s?.closed ?? false,
    lastStatus: s?.lastStatus ?? null,
    delegated: s?.delegated ?? false,
  };
}
