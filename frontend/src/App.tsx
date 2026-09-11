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
import { RPC_BASE, getPrograms, ENTRY_FEE, arenaPda, PROGRAM_ID } from "./lib/anchor";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { useArena } from "./hooks/useArena";
import { Arena } from "./screens/Arena";

function Home() {
  const [pda, setPda] = useState<PublicKey | null>(null);
  const [arenaId, setArenaId] = useState<anchor.BN | null>(null);

  const wallet = useAnchorWallet();

  const { arena, error } = useArena(pda);
  if (!wallet) return <WalletMultiButton />;

  async function createArena() {
    const { programBase } = getPrograms(wallet!);
    const id = new anchor.BN(Date.now() % 1_000_000);
    const sig = await programBase.methods
      .initArena(id, ENTRY_FEE)
      .accounts({ host: wallet!.publicKey })
      .rpc();
    setPda(arenaPda(wallet!.publicKey, id, PROGRAM_ID));
    setArenaId(id);
    console.log("arena", id.toString(), sig);
  }

  return (
    <div>
      <WalletMultiButton />
      <p>{wallet.publicKey.toBase58()}</p>
      {!arena && <button onClick={createArena}>Create arena</button>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {arena && <Arena arena={arena} me={wallet.publicKey} />}
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
