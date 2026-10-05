import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { getPrograms, INTERVAL_MS, PROGRAM_ID } from "../lib/anchor";
import { Grid } from "../components/Grid";
import { BOT_COLOURS } from "../lib/colours";
import { displayName } from "../lib/names";
import {
  isSessionUsable,
  loadActiveSession,
  renewSession,
  sessionProgramEr,
  sessionTokenPda,
  type ActiveSession,
} from "../lib/session";
import { EmergencyRefund } from "../components/EmergencyRefund";

const SPEED_COST = 10;
const VISION_COST = 10;
const SPEED_AMOUNT = 1;
const VISION_AMOUNT = 1;
const MATCH_TIMEOUT_SECS = 200;
const CLOCK_MARGIN_SECS = 10;
const MS_PER_TICK = INTERVAL_MS.toNumber();
const STALL_MS = 3000;
const CLOCK_TICK_MS = 500;

const SESSION_FAILURE =
  /InvalidSessionToken|InvalidToken|NoToken|AccountNotInitialized|AccountDiscriminatorMismatch|prior credit|insufficient (funds|lamports)/i;

type Pending = "speed" | "vision" | "force" | "renew" | null;

function statusOf(arena: any): string {
  return Object.keys(arena.status)[0];
}

function formatClock(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function UpgradeCard({ name, cost, credits, effect, pending, disabled, onClick }: {
  name: string;
  cost: number;
  credits: number;
  effect: string;
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const short = cost - credits;
  const affordable = short <= 0;
  return (
    <button className="upgrade" disabled={disabled || !affordable} onClick={onClick}>
      <span className="upgrade-top">
        <span className="upgrade-name">{name}</span>
        <span className="cost">{cost} cr</span>
      </span>
      <span className="muted small">
        {pending ? "Upgrading…" : affordable ? effect : `Need ${short} more credits`}
      </span>
    </button>
  );
}

export function Arena({ arena, pda, wallet, delegated }: {
  arena: any; pda: PublicKey; wallet: AnchorWallet; delegated: boolean;
}) {
  const { programBase, programEr } = useMemo(() => getPrograms(wallet), [wallet]);
  const [pending, setPending] = useState<Pending>(null);
  const [err, setErr] = useState<string | null>(null);

  const [session, setSession] = useState<ActiveSession | null>(() =>
    loadActiveSession(pda, wallet.publicKey)
  );
  const programSession = useMemo(
    () => (session ? sessionProgramEr(session.kp) : null),
    [session]
  );

  const [nowSec, setNowSec] = useState(0);
  const [stalled, setStalled] = useState(false);

  const tick = arena ? arena.tick.toNumber() : 0;
  const lastAdvanceAt = useRef(0);
  useEffect(() => {
    lastAdvanceAt.current = Date.now();
  }, [tick]);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNowSec(Math.floor(t / 1000));
      setStalled(lastAdvanceAt.current > 0 && t - lastAdvanceAt.current > STALL_MS);
    }, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!arena) return <p className="muted">Loading…</p>;

  const status = statusOf(arena);
  const running = status === "running";
  const myKey = wallet.publicKey.toBase58();

  const myIndex = arena.players.findIndex(
    (p: PublicKey) => p.toBase58() === myKey
  );
  const myBot = myIndex >= 0 ? arena.bots[myIndex] : null;
  const credits = myBot ? myBot.credits.toNumber() : 0;

  const maxTicks = arena.maxTicks.toNumber();
  const ticksLeft = Math.max(0, maxTicks - tick);
  const secsLeft = Math.ceil((ticksLeft * MS_PER_TICK) / 1000);
  const progressPct = Math.min(100, (tick / maxTicks) * 100);

  const deadline = arena.startedAt.toNumber() + MATCH_TIMEOUT_SECS + CLOCK_MARGIN_SECS;
  const canForce = running && nowSec > 0 && nowSec >= deadline;

  const sessionOn = session !== null && nowSec > 0 && isSessionUsable(session.validUntil, nowSec);
  const showEnable = !!myBot && running && nowSec > 0 && !sessionOn;

  async function run(kind: Exclude<Pending, null>, fn: () => Promise<unknown>) {
    setPending(kind);
    setErr(null);
    try {
      await fn();
    } catch (e: any) {
      const msg = String(e.message ?? e);
      setErr(
        /MatchNotTimedOut/.test(msg) ? "Not timed out on-chain yet. Try again in a few seconds."
        : /InsufficientCredits/.test(msg) ? "Not enough credits yet."
        : msg
      );
    } finally {
      setPending(null);
    }
  }

  const upgrade = (kind: "speed" | "vision") =>
    run(kind, async () => {
      const now = Math.floor(Date.now() / 1000);
      if (session && programSession && isSessionUsable(session.validUntil, now)) {
        try {
          await programSession.methods
            .upgradeBot(arena.id, kind === "speed" ? { speed: {} } : { vision: {} })
            .accountsPartial({
              signer: session.kp.publicKey,
              playerWallet: wallet.publicKey,
              sessionToken: sessionTokenPda(session.kp.publicKey, wallet.publicKey),
              arenaAccount: pda,
            })
            .rpc();
          return;
        } catch (e: any) {
          if (!SESSION_FAILURE.test(String(e?.message ?? e))) throw e;
        }
      }
      await programEr.methods
        .upgradeBot(arena.id, kind === "speed" ? { speed: {} } : { vision: {} })
        .accountsPartial({
          signer: wallet.publicKey,
          playerWallet: wallet.publicKey,
          sessionToken: PROGRAM_ID,
          arenaAccount: pda,
        })
        .rpc();
    });

  const enableSession = () =>
    run("renew", async () => {
      setSession(await renewSession(wallet, pda));
    });

  const forceFinish = () =>
    run("force", () =>
      (delegated ? programEr : programBase).methods
        .forceFinish(arena.id)
        .accountsPartial({ arenaAccount: pda })
        .rpc()
    );

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="timer">
        <span className="timer-value">{formatClock(secsLeft)}</span>
        <span className="muted small">{running && stalled ? "Waiting for the network…" : "left in match"}</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Match progress"
        aria-valuemin={0}
        aria-valuemax={maxTicks}
        aria-valuenow={tick}
      >
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <Grid arena={arena} myIndex={myIndex} />
      <p className="muted small" style={{ margin: "6px 0 0" }}>
        Circles show each bot's field of vision.
      </p>

      <div className="list-head">
        <span>Player</span>
        <span style={{ marginLeft: "auto" }}>Score</span>
      </div>
      {arena.players.map((p: PublicKey, i: number) => {
        const key = p.toBase58();
        return (
          <div key={key} className="player-row">
            <span className="swatch" style={{ background: BOT_COLOURS[i % BOT_COLOURS.length] }} />
            <span>{displayName(arena, i)}{key === myKey ? " (you)" : ""}</span>
            <span style={{ marginLeft: "auto", fontFamily: "monospace" }}>
              {arena.bots[i].score.toNumber()}
            </span>
          </div>
        );
      })}

      {myBot && running && (
        <>
          <div className="upgrade-head">
            <span className="muted small">{sessionOn ? "Instant upgrades on" : "Your bot"}</span>
            <span><strong>{credits}</strong> <span className="muted small">credits</span></span>
          </div>
          <div className="upgrades">
            <UpgradeCard
              name="Speed"
              cost={SPEED_COST}
              credits={credits}
              effect={`${myBot.speed} → ${myBot.speed + SPEED_AMOUNT}`}
              pending={pending === "speed"}
              disabled={pending !== null}
              onClick={() => upgrade("speed")}
            />
            <UpgradeCard
              name="Vision"
              cost={VISION_COST}
              credits={credits}
              effect={`${myBot.vision} → ${myBot.vision + VISION_AMOUNT}`}
              pending={pending === "vision"}
              disabled={pending !== null}
              onClick={() => upgrade("vision")}
            />
          </div>
          {showEnable && (
            <button style={{ width: "100%", marginTop: 8 }} disabled={pending !== null} onClick={enableSession}>
              {pending === "renew"
                ? "Enabling…"
                : session ? "Renew instant upgrades" : "Enable instant upgrades"}
            </button>
          )}
        </>
      )}

      {canForce && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted small" style={{ margin: "0 0 8px" }}>
            Match stalled. Anyone can end it, and every entry fee is refunded.
          </p>
          <button className="btn-primary" style={{ width: "100%" }} disabled={pending !== null} onClick={forceFinish}>
            {pending === "force" ? "Ending match…" : "Force finish"}
          </button>
        </div>
      )}
      {canForce && stalled && <EmergencyRefund pda={pda} wallet={wallet} />}

      {err && <p className="error">{err}</p>}
    </div>
  );
}
