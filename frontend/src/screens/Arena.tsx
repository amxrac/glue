import type { PublicKey } from "@solana/web3.js";

function statusOf(arena: any): string {
  return Object.keys(arena.status)[0];
}

export function Arena({ arena, me }: { arena: any; me?: PublicKey }) {
  if (!arena) return <p>loading…</p>;

  const status = statusOf(arena);
  const myKey = me?.toBase58();

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: "monospace", fontSize: 18 }}>
          {arena.tick.toNumber()}
        </span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>/ {arena.maxTicks.toNumber()} ticks</span>
        <span style={{ marginLeft: "auto", fontSize: 12 }}>{status}</span>
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
