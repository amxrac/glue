import { useEffect, useMemo, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getPrograms } from "../lib/anchor";
import { Grid } from "../components/Grid";
import { BOT_COLOURS } from "../lib/colours";
import { displayName } from "../lib/names";

const SPEED_COST = 10;
const VISION_COST = 10;
const SPEED_AMOUNT = 1;
const VISION_AMOUNT = 1;
const MATCH_TIMEOUT_SECS = 200;
const CLOCK_MARGIN_SECS = 10;

function statusOf(arena: any): string {
  return Object.keys(arena.status)[0];
}

export function Arena({ arena, pda, wallet, delegated }: {
  arena: any; pda: PublicKey; wallet: AnchorWallet; delegated: boolean;
}) {
  const { programBase, programEr } = useMemo(() => getPrograms(wallet), [wallet]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!arena) return <p>loading…</p>;

  const status = statusOf(arena);
  const myKey = wallet.publicKey.toBase58();

  const myIndex = arena.players.findIndex(
    (p: PublicKey) => p.toBase58() === myKey
  );
  const myBot = myIndex >= 0 ? arena.bots[myIndex] : null;
  const credits = myBot ? myBot.credits.toNumber() : 0;

  const deadline = arena.startedAt.toNumber() + MATCH_TIMEOUT_SECS + CLOCK_MARGIN_SECS;
  const canForce = status === "running" && now >= deadline;

  async function upgrade(kind: "speed" | "vision") {
    setBusy(true);
    setErr(null);
    try {
      const builder =
        kind === "speed"
          ? programEr.methods.upgradeBot(arena.id, { speed: {} })
          : programEr.methods.upgradeBot(arena.id, { vision: {} });

      await builder
        .accountsPartial({ player: wallet.publicKey, arenaAccount: pda })
        .rpc();
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function forceFinish() {
    setBusy(true);
    setErr(null);
    try {
      const program = delegated ? programEr : programBase;
      await program.methods
        .forceFinish(arena.id)
        .accountsPartial({ arenaAccount: pda })
        .rpc();
    } catch (e: any) {
      const msg = String(e.message ?? e);
      setErr(
        /MatchNotTimedOut/.test(msg)
          ? "Not timed out on-chain yet. Try again in a few seconds."
          : msg
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "monospace", fontSize: 18 }}>
          {arena.tick.toNumber()}
        </span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>/ {arena.maxTicks.toNumber()} ticks</span>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>{status}</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Grid arena={arena} myIndex={myIndex} />
      </div>

      <div style={{ display: "flex", fontSize: 11, opacity: 0.6, paddingBottom: 4 }}>
        <span>player</span>
        <span style={{ marginLeft: "auto" }}>score</span>
      </div>

      {arena.players.map((p: PublicKey, i: number) => {
        const key = p.toBase58();
        const bot = arena.bots[i];
        return (
          <div
            key={key}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 0", borderTop: "1px solid #ddd",
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: 5,
              background: BOT_COLOURS[i % BOT_COLOURS.length], flexShrink: 0,
            }} />
            <span style={{ fontSize: 13 }}>
              {displayName(arena, i)}{key === myKey ? " (you)" : ""}
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "monospace" }}>
              {bot.score.toNumber()}
            </span>
          </div>
        );
      })}

      {myBot && status === "running" && (
        <>
          <div style={{ fontSize: 12, opacity: 0.7, margin: "12px 0 6px" }}>
            credits {credits}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button disabled={busy || credits < SPEED_COST} onClick={() => upgrade("speed")}>
              Speed {myBot.speed} → {myBot.speed + SPEED_AMOUNT} · {SPEED_COST} cr
            </button>
            <button disabled={busy || credits < VISION_COST} onClick={() => upgrade("vision")}>
              Vision {myBot.vision} → {myBot.vision + VISION_AMOUNT} · {VISION_COST} cr
            </button>
          </div>
        </>
      )}

      {canForce && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "0 0 6px" }}>
            Match stalled. Anyone can end it; the pot is split equally.
          </p>
          <button style={{ width: "100%" }} disabled={busy} onClick={forceFinish}>
            {busy ? "Ending match…" : "Force finish"}
          </button>
        </div>
      )}

      {err && <p style={{ color: "crimson", fontSize: 13 }}>{err}</p>}
    </div>
  );
}
