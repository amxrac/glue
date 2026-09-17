import { useMemo, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getPrograms } from "../lib/anchor";
import { Grid, BOT_COLORS } from "../components/Grid";

const SPEED_COST = 10;
const VISION_COST = 10;

function statusOf(arena: any): string {
  return Object.keys(arena.status)[0];
}

export function Arena({ arena, pda, wallet }: {
  arena: any; pda: PublicKey; wallet: AnchorWallet;
}) {
  const { programEr } = useMemo(() => getPrograms(wallet), [wallet]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!arena) return <p>loading…</p>;

  const status = statusOf(arena);
  const myKey = wallet.publicKey.toBase58();

  const myIndex = arena.players.findIndex(
    (p: PublicKey) => p.toBase58() === myKey
  );
  const myBot = myIndex >= 0 ? arena.bots[myIndex] : null;
  const credits = myBot ? myBot.credits.toNumber() : 0;

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
              background: BOT_COLORS[i % BOT_COLORS.length], flexShrink: 0,
            }} />
            <span style={{ fontSize: 13 }}>
              {key === myKey ? "you" : key.slice(0, 4) + "…" + key.slice(-4)}
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
            credits {credits} · speed {myBot.speed} · vision {myBot.vision}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button disabled={busy || credits < SPEED_COST} onClick={() => upgrade("speed")}>
              Speed · {SPEED_COST}
            </button>
            <button disabled={busy || credits < VISION_COST} onClick={() => upgrade("vision")}>
              Vision · {VISION_COST}
            </button>
          </div>
        </>
      )}

      {err && <p style={{ color: "crimson", fontSize: 13 }}>{err}</p>}
    </div>
  );
}
