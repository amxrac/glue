import { useEffect, useRef } from "react";
import { MAP_WIDTH, MAP_HEIGHT } from "../lib/anchor";


export const BOT_COLORS = [
  "#378ADD", // blue
  "#1D9E75", // teal
  "#D85A30", // coral
  "#D4537E", // pink
  "#7F77DD", // purple
  "#888780", // gray
];

const BOARD_BG = "#141412";
const RESOURCE = "#EF9F27";

export function Grid({ arena, myIndex }: { arena: any; myIndex?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !arena) return;

    const draw = () => {
      const cssW = wrap.clientWidth;
      if (cssW === 0) return;

      const cssH = Math.round((cssW * MAP_HEIGHT) / MAP_WIDTH);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cell = cssW / MAP_WIDTH;

      ctx.fillStyle = BOARD_BG;
      ctx.fillRect(0, 0, cssW, cssH);

      const resSize = Math.max(3, cell * 0.6);
      ctx.fillStyle = RESOURCE;
      for (const r of arena.resources) {
        if (!r.active) continue;
        ctx.fillRect(
          r.x * cell + (cell - resSize) / 2,
          r.y * cell + (cell - resSize) / 2,
          resSize,
          resSize
        );
      }

      const botR = Math.max(4, cell * 1.3);
      arena.bots.forEach((b: any, i: number) => {
        if (!b.active) return;
        const cx = b.x * cell + cell / 2;
        const cy = b.y * cell + cell / 2;

        ctx.beginPath();
        ctx.arc(cx, cy, botR, 0, Math.PI * 2);
        ctx.fillStyle = BOT_COLORS[i % BOT_COLORS.length];
        ctx.fill();

        if (i === myIndex) {
          ctx.beginPath();
          ctx.arc(cx, cy, botR + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    };

    draw();

    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [arena, myIndex]);

  if (!arena) return null;

  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        lineHeight: 0,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
    </div>
  );
}
