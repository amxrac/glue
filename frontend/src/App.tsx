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

function Home() {
  const [pda, setPda] = useState<PublicKey | null>(() => {
    const p = new URLSearchParams(location.search).get("arena");
    return p ? new PublicKey(p) : null;
  });
  const [starting, setStarting] = useState(false);

  const wallet = useAnchorWallet();
  const { arena } = useArena(pda);

  if (!wallet) return <WalletMultiButton />;

  const status = arena ? Object.keys(arena.status)[0] : null;

  if (status === "running" && !starting) {
    return <Arena arena={arena} me={wallet.publicKey} />;
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
