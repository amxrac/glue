import { useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  connBase,
  readBase,
  getPrograms,
  vaultPda,
  DELEGATION_PROGRAM,
  EMERGENCY_REFUND_SECS,
} from "../lib/anchor";

const REFRESH_MS = 30_000;

export function EmergencyRefund({ pda, wallet }: { pda: PublicKey; wallet?: AnchorWallet }) {
  const vaultAddress = useMemo(() => vaultPda(pda), [pda]);
  const [vault, setVault] = useState<any>(null);
  const [delegated, setDelegated] = useState<boolean | null>(null);
  const [nowSec, setNowSec] = useState(0);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [info, v] = await Promise.all([
          connBase.getAccountInfo(pda),
          readBase.account.vaultAccount.fetch(vaultAddress).catch(() => null),
        ]);
        if (cancelled) return;
        setDelegated(info !== null && info.owner.equals(DELEGATION_PROGRAM));
        setVault(v);
      } catch {
        //
      }
    };
    load();
    const id = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
      load();
    }, REFRESH_MS);
    const first = setTimeout(() => setNowSec(Math.floor(Date.now() / 1000)), 0);
    return () => { cancelled = true; clearInterval(id); clearTimeout(first); };
  }, [pda, vaultAddress]);

  if (!vault || delegated !== true || vault.startedAt.toNumber() === 0 || nowSec === 0) return null;

  if (vault.refunded) {
    return <p className="muted small" style={{ margin: "12px 0 0" }}>Entry fees have been refunded.</p>;
  }

  const deadline = vault.startedAt.toNumber() + EMERGENCY_REFUND_SECS;

  if (nowSec < deadline) {
    return (
      <p className="muted small" style={{ margin: "12px 0 0" }}>
        If the match stays unreachable, refunds open at {new Date(deadline * 1000).toLocaleString()}.
      </p>
    );
  }

  if (!wallet) {
    return (
      <div style={{ marginTop: 12 }}>
        <p className="muted small" style={{ margin: "0 0 8px" }}>Connect a wallet to refund all players.</p>
        <WalletMultiButton />
      </div>
    );
  }

  async function refund() {
    setPending(true);
    setErr(null);
    try {
      const { programBase } = getPrograms(wallet!);
      await programBase.methods
        .emergencyRefund()
        .accountsPartial({ arenaAccount: pda, vaultAccount: vaultAddress })
        .remainingAccounts(
          (vault.players as PublicKey[]).map((p) => ({ pubkey: p, isWritable: true, isSigner: false }))
        )
        .rpc();
      setVault({ ...vault, refunded: true });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setErr(
        /EmergencyRefundNotReady/.test(msg) ? "Not available on-chain yet. Try again in a minute."
        : /AlreadyRefunded/.test(msg) ? "Already refunded."
        : /ArenaNotDelegated/.test(msg) ? "The match is reachable again. Use the normal claim instead."
        : msg
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p className="muted small" style={{ margin: "0 0 8px" }}>
        The match has been unreachable for over 5 hours. Anyone can refund every entry fee.
      </p>
      <button className="btn-primary" style={{ width: "100%" }} disabled={pending} onClick={refund}>
        {pending ? "Refunding…" : "Refund all players"}
      </button>
      {err && <p className="error">{err}</p>}
    </div>
  );
}
