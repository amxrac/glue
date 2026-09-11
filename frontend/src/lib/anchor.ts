import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import type { Glue } from "../idl/glue";
import idl from "../idl/glue.json";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

export const RPC_BASE = "https://api.devnet.solana.com";
export const RPC_ER = "https://devnet-eu.magicblock.app";
export const DELEGATION_PROGRAM = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);
export const ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
export const VALIDATOR = new PublicKey("MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e");

export const ENTRY_FEE = new anchor.BN(0.01 * LAMPORTS_PER_SOL);
export const MAX_TICKS = 550;

export const TASK_ID = new anchor.BN(1);
export const INTERVAL_MS = new anchor.BN(100);
export const ITERATIONS = new anchor.BN(MAX_TICKS);

export const connBase = new Connection(RPC_BASE, "confirmed");
export const connEr = new Connection(RPC_ER, {
  wsEndpoint: RPC_ER.replace("http", "ws"),
  commitment: "confirmed",
});
export function arenaPda(host: PublicKey, id: anchor.BN, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("arena"), host.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    programId
  )[0];
}

export function getPrograms(wallet: AnchorWallet) {
  const providerBase = new anchor.AnchorProvider(connBase, wallet, { commitment: "confirmed" });
  const providerEr   = new anchor.AnchorProvider(connEr,   wallet, { commitment: "confirmed" });
  return {
    programBase: new Program<Glue>(idl as Glue, providerBase),
    programEr:   new Program<Glue>(idl as Glue, providerEr),
  };
}
