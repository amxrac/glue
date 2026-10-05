import { useEffect, useRef } from "react";
import { MAP_WIDTH, MAP_HEIGHT } from "../lib/anchor";
import { BOT_COLOURS } from "../lib/colours";

const BOARD_BG = "#141412";
const RESOURCE = "#EF9F27";
const PULSE_MS = 450;
const GLIDE_MIN_MS = 60;
const GLIDE_MAX_MS = 300;

type Glide = { x0: number; y0: number; x1: number; y1: number; start: number; dur: number };

function positionAt(g: Glide, now: number): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, (now - g.start) / g.dur));
  return { x: g.x0 + (g.x1 - g.x0) * t, y: g.y0 + (g.y1 - g.y0) * t };
}

function targetOf(bot: any, resources: any[]) {
  const v2 = bot.vision * bot.vision;
  let best: any = null, bestD = Infinity;
  for (const r of resources) {
    if (!r.active) continue;
    const dx = r.x - bot.x, dy = r.y - bot.y, d = dx * dx + dy * dy;
    if (d <= v2 && d < bestD) { bestD = d; best = r; }
  }
  return best;
}

export function Grid({ arena, myIndex }: { arena: any; myIndex?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef(arena);
  const prevResRef = useRef<any[] | null>(null);
  const pulsesRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const glidesRef = useRef<(Glide | null)[]>([]);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const prev = prevResRef.current;
    if (prev && arena) {
      arena.resources.forEach((r: any, i: number) => {
        const p = prev[i];
        if (p?.active && (!r.active || r.x !== p.x || r.y !== p.y)) {
          pulsesRef.current.push({ x: p.x, y: p.y, t: performance.now() });
        }
      });
    }
    prevResRef.current = arena?.resources ?? null;

    if (arena) {
      const now = performance.now();
      const dur = lastUpdateRef.current === 0
        ? GLIDE_MIN_MS
        : Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MIN_MS, now - lastUpdateRef.current));
      lastUpdateRef.current = now;

      arena.bots.forEach((b: any, i: number) => {
        const g = glidesRef.current[i];
        if (!b.active || !g) {
          glidesRef.current[i] = b.active
            ? { x0: b.x, y0: b.y, x1: b.x, y1: b.y, start: now, dur }
            : null;
          return;
        }
        const from = positionAt(g, now);
        glidesRef.current[i] = { x0: from.x, y0: from.y, x1: b.x, y1: b.y, start: now, dur };
      });
    }

    arenaRef.current = arena;
  }, [arena]);

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const canvas = canvasRef.current, wrap = wrapRef.current, a = arenaRef.current;
      if (!canvas || !wrap || !a) return;

      const cssW = wrap.clientWidth;
      if (cssW === 0) return;
      const cssH = Math.round((cssW * MAP_HEIGHT) / MAP_WIDTH);
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(cssW * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.height = `${cssH}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const now = performance.now();
      const cell = cssW / MAP_WIDTH;
      const px = (g: number) => g * cell + cell / 2;

      ctx.fillStyle = BOARD_BG;
      ctx.fillRect(0, 0, cssW, cssH);

      // Resources
      const resSize = Math.max(3, cell * 0.6);
      ctx.fillStyle = RESOURCE;
      for (const r of a.resources) {
        if (!r.active) continue;
        ctx.fillRect(px(r.x) - resSize / 2, px(r.y) - resSize / 2, resSize, resSize);
      }

      a.bots.forEach((b: any, i: number) => {
        if (!b.active) return;
        const color = BOT_COLOURS[i % BOT_COLOURS.length];
        const g = glidesRef.current[i];
        const pos = g ? positionAt(g, now) : { x: b.x, y: b.y };
        const cx = px(pos.x), cy = px(pos.y);
        const mine = i === myIndex;

        // vision radius that grows when vision is upgraded
        ctx.beginPath();
        ctx.arc(cx, cy, b.vision * cell, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = mine ? 0.35 : 0.12;
        ctx.lineWidth = 1;
        ctx.stroke();

        const t = targetOf({ ...b, x: pos.x, y: pos.y }, a.resources);
        if (t) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(px(t.x), px(t.y));
          ctx.globalAlpha = mine ? 0.6 : 0.25;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Bot
        const botR = Math.max(4, cell * 1.3);
        ctx.beginPath();
        ctx.arc(cx, cy, botR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        if (mine) {
          ctx.beginPath();
          ctx.arc(cx, cy, botR + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      pulsesRef.current = pulsesRef.current.filter((p) => now - p.t < PULSE_MS);
      for (const p of pulsesRef.current) {
        const k = (now - p.t) / PULSE_MS;
        ctx.beginPath();
        ctx.arc(px(p.x), px(p.y), cell * (1 + k * 4), 0, Math.PI * 2);
        ctx.strokeStyle = RESOURCE;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [myIndex]);

  if (!arena) return null;
  return (
    <div ref={wrapRef} style={{ width: "100%", borderRadius: 10, overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.08)", lineHeight: 0 }}>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%" }} />
    </div>
  );
}
