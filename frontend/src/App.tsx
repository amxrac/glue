import { useMemo, useState } from "react";
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
import { RPC_BASE } from "./lib/anchor";
import { PublicKey } from "@solana/web3.js";
import { useArena } from "./hooks/useArena";
import { Arena } from "./screens/Arena";
import { Lobby } from "./screens/Lobby";
import { Result } from "./screens/Result";

function Home() {
  const [pda, setPda] = useState<PublicKey | null>(() => {
    const p = new URLSearchParams(location.search).get("arena");
    return p ? new PublicKey(p) : null;
  });
  const [starting, setStarting] = useState(false);

  const wallet = useAnchorWallet();
  const { arena, error, closed } = useArena(pda, 1500);

  if (!wallet) return <WalletMultiButton />;

  const status = arena ? Object.keys(arena.status)[0] : null;
  const box: React.CSSProperties = { maxWidth: 480, margin: "0 auto", padding: 12 };

  function reset() {
    history.replaceState(null, "", location.pathname);
    setPda(null);
  }

  if (closed) {
    return (
      <div style={box}>
        <p>Match complete — prize claimed and arena closed.</p>
        <button onClick={reset}>New arena</button>
      </div>
    );
  }

  if (status === "running" && !starting) {
    return <Arena arena={arena} me={wallet.publicKey} />;
  }
  if (status === "finished") {
    return <Result arena={arena} pda={pda!} wallet={wallet} onDone={() => {}} />;
  }
  if (pda && !arena && error) {
    return (
      <div style={box}>
        <p style={{ color: "crimson" }}>Can't reach the network. Retrying…</p>
        <p style={{ fontSize: 12, opacity: 0.6 }}>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <WalletMultiButton />
      <p>{wallet.publicKey.toBase58()}</p>
      <Lobby
        arena={arena}
        pda={pda}
        wallet={wallet}
        onCreated={setPda}
        onStarting={setStarting}
      />
    </div>
  );
}

export default function App() {
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={RPC_BASE}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Home />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
