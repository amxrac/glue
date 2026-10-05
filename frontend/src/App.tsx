import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import type { PublicKey } from "@solana/web3.js";
import { RPC_BASE } from "./lib/anchor";
import { useArena } from "./hooks/useArena";
import { Arena } from "./screens/Arena";
import { Lobby } from "./screens/Lobby";
import { Result } from "./screens/Result";
import { Landing, parseArenaInput } from "./screens/Landing";
import { sweepExpiredSessions } from "./lib/session";

function useSessionSweep() {
  useEffect(() => {
    const sweep = () => { sweepExpiredSessions().catch(() => {}); };
    sweep();
    const id = setInterval(sweep, 60_000);
    return () => clearInterval(id);
  }, []);
}

function readArenaParam(): { pda: PublicKey | null; invalid: boolean } {
  const raw = new URLSearchParams(location.search).get("arena");
  if (!raw) return { pda: null, invalid: false };
  const pda = parseArenaInput(raw);
  return { pda, invalid: pda === null };
}

function Notice({ children, onBack, action }: {
  children: ReactNode;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="card" style={{ maxWidth: 480, margin: "0 auto" }}>
      <p style={{ marginTop: 0 }}>{children}</p>
      <div className="actions">
        {action}
        <button onClick={onBack}>Back to home</button>
      </div>
    </div>
  );
}

function TopBar() {
  const wallet = useAnchorWallet();
  return (
    <header className="topbar">
      <span className="brand">glue</span>
      {wallet && <WalletMultiButton />}
    </header>
  );
}

function Home() {
  const [initial] = useState(readArenaParam);
  const [pda, setPda] = useState<PublicKey | null>(initial.pda);
  const [invalidLink, setInvalidLink] = useState(initial.invalid);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);

  const wallet = useAnchorWallet();
  const { arena, error, closed, lastStatus, delegated } = useArena(pda, 1500);
  const status = arena ? Object.keys(arena.status)[0] : null;

  function goHome() {
    history.replaceState(null, "", location.pathname);
    setPda(null);
    setCreating(false);
    setInvalidLink(false);
  }

  function openArena(p: PublicKey) {
    history.replaceState(null, "", `?arena=${p.toBase58()}`);
    setPda(p);
  }

  if (invalidLink) {
    return <Notice onBack={goHome}>That invite link isn't valid.</Notice>;
  }

  if (!pda && !creating) {
    return <Landing onCreate={() => setCreating(true)} onJoin={openArena} />;
  }

  if (closed) {
    const text =
      lastStatus === "finished" ? "Match complete. Prize claimed and arena closed."
      : lastStatus ? "Arena cancelled. Entry fees refunded."
      : "This arena doesn't exist or has already closed.";
    return <Notice onBack={goHome}>{text}</Notice>;
  }

  if (pda && !arena && error) {
    return (
      <Notice onBack={goHome}>
        Can't reach the network. Retrying…
        <br />
        <span className="muted small">{error}</span>
      </Notice>
    );
  }

  if (!wallet) {
    return (
      <Notice onBack={goHome} action={<WalletMultiButton />}>
        {pda
          ? "You've been invited to an arena. Connect a wallet to continue."
          : "Connect a wallet to create an arena."}
      </Notice>
    );
  }

  if (status === "running" && !starting) {
    return <Arena arena={arena} pda={pda!} wallet={wallet} delegated={delegated} />;
  }
  if (status === "finished") {
    return <Result arena={arena} pda={pda!} wallet={wallet} onDone={() => {}} />;
  }

  return (
    <div>
      {!pda && (
        <button onClick={goHome} style={{ marginBottom: 12 }}>Back</button>
      )}
      <Lobby
        arena={arena}
        pda={pda}
        wallet={wallet}
        onCreated={(p) => {
          if (p) { setCreating(false); setPda(p); } else { goHome(); }
        }}
        onStarting={setStarting}
      />
    </div>
  );
}

export default function App() {
  const wallets = useMemo(() => [], []);
  useSessionSweep();

  return (
    <ConnectionProvider endpoint={RPC_BASE}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="glue">
            <TopBar />
            <Home />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
