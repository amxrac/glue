import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { INTERVAL_MS, MAX_TICKS } from "../lib/anchor";

const REWARD = 10;
const UPGRADE_COST = 10;
const TIMEOUT_SECS = 200;
const MATCH_SECS = Math.round((MAX_TICKS * INTERVAL_MS.toNumber()) / 1000);

export function parseArenaInput(input: string): PublicKey | null {
  const s = input.trim();
  if (!s) return null;
  let candidate = s;
  try {
    candidate = new URL(s).searchParams.get("arena") ?? "";
  } catch {
    // not a URL
  }
  try {
    return new PublicKey(candidate);
  } catch {
    return null;
  }
}

const PREVIEW_BOTS = [
  { left: "20%", top: "30%", color: "#378ADD", delay: "0s" },
  { left: "62%", top: "22%", color: "#D85A30", delay: "-2s" },
  { left: "45%", top: "68%", color: "#1D9E75", delay: "-4s" },
  { left: "76%", top: "58%", color: "#7F77DD", delay: "-1s" },
];
const PREVIEW_RES = [
  ["30%", "42%"], ["55%", "36%"], ["70%", "80%"], ["15%", "75%"], ["85%", "15%"], ["38%", "12%"],
];

function BoardPreview() {
  return (
    <div className="board-preview" aria-hidden="true">
      {PREVIEW_RES.map(([left, top]) => (
        <span key={`${left}-${top}`} className="res" style={{ left, top }} />
      ))}
      {PREVIEW_BOTS.map((b) => (
        <span
          key={b.color}
          className="bot"
          style={{ left: b.left, top: b.top, background: b.color, animationDelay: b.delay }}
        />
      ))}
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="how card" id="how-it-works">
      <h2>How a match works</h2>
      <ol>
        <li>The host sets an entry fee and shares the invite link.</li>
        <li>Up to 6 players can join. Each entry fee goes into the pot.</li>
        <li>Bots spawn and hunt resources on their own; you never steer.</li>
        <li>After about {MATCH_SECS} seconds, the highest score takes the pot.</li>
      </ol>
      <p className="muted" style={{ fontSize: 14, margin: "8px 0 0" }}>
        Switch your bot's mode: <strong>Gather</strong> collects resources.{" "}
        <strong>Hunt</strong> chases other bots and steals 20 points from them, but collects nothing.{" "}
        <strong>Defend</strong> can't be robbed, but moves slower and collects half rewards.
        A bot that's just been robbed is protected, and can't rob, for 5 seconds.
      </p>
      <p className="muted" style={{ fontSize: 14, margin: 0 }}>
        The circle around each bot is its field of vision: it heads for the nearest resource
        inside it, and wanders when nothing is in sight. Each resource is worth {REWARD} points
        and {REWARD} credits. Upgrades cost {UPGRADE_COST} credits and never lower your score.
        Ties split the pot. If a match stalls for {TIMEOUT_SECS} seconds, anyone can end it and
        the pot is split equally.
      </p>
    </section>
  );
}

export function Landing({ onCreate, onJoin }: {
  onCreate: () => void;
  onJoin: (pda: PublicKey) => void;
}) {
  const [showHow, setShowHow] = useState(false);
  const [link, setLink] = useState("");
  const [linkErr, setLinkErr] = useState<string | null>(null);

  function join() {
    const pda = parseArenaInput(link);
    if (!pda) {
      setLinkErr("That isn't a valid invite link.");
      return;
    }
    onJoin(pda);
  }

  return (
    <div>
      <div className="landing">
        <div>
          <span className="pill">About 90 seconds per match</span>
          <h1>Up to six bots, One pot</h1>
          <p className="muted" style={{ margin: 0 }}>
            Bots move by themselves. Your only move is when to spend: more speed, or a wider
            field of vision.
          </p>
          <ul className="facts">
            <li><strong>Score</strong> never drops</li>
            <li><strong>Credits</strong> drop when you spend</li>
            <li><strong>Speed</strong> makes the bot move faster</li>
            <li><strong>Gather</strong> resources, Hunt to steal 20 points, or Defend to stay safe</li>
            <li><strong>Vision</strong> is the circle around your bot. It goes after the nearest resource inside it</li>
          </ul>
          <div className="actions">
            <button className="btn-primary" onClick={onCreate}>Create arena</button>
            <button
              onClick={() => setShowHow((v) => !v)}
              aria-expanded={showHow}
              aria-controls="how-it-works"
            >
              {showHow ? "Hide how it works" : "How it works"}
            </button>
          </div>
          <p className="muted small" style={{ margin: "10px 0 0" }}>
            glue needs a Solana wallet (e.g. Phantom or Solflare) set to devnet, with some devnet SOL (free from a <a href="https://faucet.solana.com/" target="_blank" rel="noopener noreferrer">faucet</a>). On a phone, open this site in your wallet's built-in browser.
          </p>
        </div>
        <BoardPreview />
      </div>

      {showHow && <HowItWorks />}

      <div className="join-row">
        <input
          value={link}
          onChange={(e) => { setLink(e.target.value); setLinkErr(null); }}
          placeholder="Paste an invite link"
          aria-label="Invite link"
        />
        <button onClick={join}>Join</button>
      </div>
      {linkErr && <p className="error">{linkErr}</p>}
    </div>
  );
}
