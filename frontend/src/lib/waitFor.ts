import type { PublicKey } from "@solana/web3.js";
import { connBase, readBase, PROGRAM_ID } from "./anchor";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(
  label: string,
  check: () => Promise<boolean>,
  timeoutMs = 120_000,
  intervalMs = 1000
): Promise<number> {
  const start = Date.now();
  let lastErr: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) return Date.now() - start;
    } catch (e) {
      lastErr = e;
    }
    await sleep(intervalMs);
  }
  throw new Error(
    `timed out waiting for ${label}${lastErr ? ` (last error: ${String(lastErr)})` : ""}`
  );
}

export async function readArenaBase(
  pda: PublicKey,
  until: (arena: any) => boolean = () => true,
  timeoutMs = 20_000
): Promise<any> {
  let found: any = null;
  await waitFor(
    "arena",
    async () => {
      const info = await connBase.getAccountInfo(pda);
      if (!info || !info.owner.equals(PROGRAM_ID)) return false;
      const a = readBase.coder.accounts.decode("arenaAccount", info.data);
      if (!until(a)) return false;
      found = a;
      return true;
    },
    timeoutMs
  );
  return found;
}
