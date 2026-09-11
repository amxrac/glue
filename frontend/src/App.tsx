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

function Home() {
  const [pda, setPda] = useState<PublicKey | null>(null);

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
    console.log("arena", id.toString(), sig);
  }

  return (
    <div>
      <WalletMultiButton />
      <p>{wallet.publicKey.toBase58()}</p>
      <button onClick={createArena}>Create arena</button>
      <pre>{error ?? JSON.stringify(arena, null, 2)}</pre>
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
