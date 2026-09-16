import type { PublicKey } from "@solana/web3.js";
import { Grid, BOT_COLORS } from "../components/Grid";

function statusOf(arena: any): string {
  return Object.keys(arena.status)[0];
}

export function Arena({ arena, me }: { arena: any; me?: PublicKey }) {
  if (!arena) return <p>loading…</p>;

  const status = statusOf(arena);
  const myKey = me?.toBase58();

  const myIndex = arena.players.findIndex(
    (p: PublicKey) => p.toBase58() === myKey
  );
  //
  console.log(arena.tick.toNumber(), arena.bots.map((b: any) => [b.x, b.y]));
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
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderTop: "1px solid #ddd",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: BOT_COLORS[i % BOT_COLORS.length],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13 }}>
              {key === myKey ? "you" : key.slice(0, 4) + "…" + key.slice(-4)}
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "monospace" }}>
              {bot.score.toNumber()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
