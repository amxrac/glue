import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import type { Glue } from "../idl/glue";
import idl from "../idl/glue.json";
import { PROGRAM_ID, connBase, connEr } from "./anchor";

export const SESSION_PROGRAM_ID = new PublicKey("KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5");
const SESSION_SEED = "session_token_v2";

export const SESSION_SECS = 20 * 60;
const TOP_UP_LAMPORTS = 2_000_000;
const EXPIRY_MARGIN_SECS = 10;
const SWEEP_GRACE_SECS = 60;
const STORAGE_PREFIX = "glue-session:";

type StoredSession = {
  secret: number[];
  validUntil: number;
  authority: string;
  arena: string;
};

export type ActiveSession = { key: string; kp: Keypair; validUntil: number };

const nowSec = () => Math.floor(Date.now() / 1000);


function storageKey(arena: PublicKey, authority: PublicKey, signer: PublicKey): string {
  return `${STORAGE_PREFIX}${arena.toBase58()}:${authority.toBase58()}:${signer.toBase58()}`;
}

function saveSession(arena: PublicKey, authority: PublicKey, kp: Keypair, validUntil: number): string {
  const key = storageKey(arena, authority, kp.publicKey);
  const record: StoredSession = {
    secret: Array.from(kp.secretKey),
    validUntil,
    authority: authority.toBase58(),
    arena: arena.toBase58(),
  };
  localStorage.setItem(key, JSON.stringify(record));
  return key;
}

export function removeSession(key: string): void {
  localStorage.removeItem(key);
}

function readAll(): { key: string; record: StoredSession }[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
  }
  const out: { key: string; record: StoredSession }[] = [];
  for (const key of keys) {
    try {
      out.push({ key, record: JSON.parse(localStorage.getItem(key) ?? "") as StoredSession });
    } catch {
      localStorage.removeItem(key);
    }
  }
  return out;
}

export function loadActiveSession(arena: PublicKey, authority: PublicKey): ActiveSession | null {
  const a = arena.toBase58();
  const w = authority.toBase58();
  let best: ActiveSession | null = null;
  for (const { key, record } of readAll()) {
    if (record.arena !== a || record.authority !== w) continue;
    if (!best || record.validUntil > best.validUntil) {
      best = { key, kp: Keypair.fromSecretKey(Uint8Array.from(record.secret)), validUntil: record.validUntil };
    }
  }
  return best;
}

export function isSessionUsable(validUntil: number, now: number): boolean {
  return now < validUntil - EXPIRY_MARGIN_SECS;
}

export function sessionTokenPda(signer: PublicKey, authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SESSION_SEED), PROGRAM_ID.toBuffer(), signer.toBuffer(), authority.toBuffer()],
    SESSION_PROGRAM_ID
  )[0];
}

export function keypairWallet(kp: Keypair): AnchorWallet {
  return {
    publicKey: kp.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (tx instanceof VersionedTransaction) tx.sign([kp]);
      else tx.partialSign(kp);
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
      for (const tx of txs) {
        if (tx instanceof VersionedTransaction) tx.sign([kp]);
        else tx.partialSign(kp);
      }
      return txs;
    },
  };
}

function gplSession(wallet: AnchorWallet): any {
  const provider = new AnchorProvider(connBase, wallet, { commitment: "confirmed" });
  return new SessionTokenManager(provider as any, connBase).program;
}

export function sessionProgramEr(kp: Keypair): Program<Glue> {
  const provider = new AnchorProvider(connEr, keypairWallet(kp), { commitment: "confirmed" });
  return new Program<Glue>(idl as Glue, provider);
}

async function buildCreateSessionIx(
  wallet: AnchorWallet,
  signer: PublicKey,
  validUntil: number
): Promise<TransactionInstruction> {
  return gplSession(wallet)
    .methods.createSessionV2(true, new anchor.BN(validUntil), new anchor.BN(TOP_UP_LAMPORTS))
    .accounts({
      targetProgram: PROGRAM_ID,
      sessionSigner: signer,
      feePayer: wallet.publicKey,
      authority: wallet.publicKey,
    })
    .instruction();
}

export async function prepareSession(wallet: AnchorWallet, arena: PublicKey) {
  const kp = Keypair.generate();
  const validUntil = nowSec() + SESSION_SECS;
  const ix = await buildCreateSessionIx(wallet, kp.publicKey, validUntil);
  const key = saveSession(arena, wallet.publicKey, kp, validUntil);
  return { kp, ix, key, validUntil };
}

export async function renewSession(wallet: AnchorWallet, arena: PublicKey): Promise<ActiveSession> {
  const { kp, ix, key, validUntil } = await prepareSession(wallet, arena);
  try {
    const { blockhash, lastValidBlockHeight } = await connBase.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(ix);
    tx.partialSign(kp);
    const signed = await wallet.signTransaction(tx);
    const sig = await connBase.sendRawTransaction(signed.serialize());
    const res = await connBase.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    if (res.value.err) throw new Error(`session creation failed: ${JSON.stringify(res.value.err)}`);
    return { key, kp, validUntil };
  } catch (e) {
    removeSession(key);
    throw e;
  }
}

async function sweepOne(record: StoredSession): Promise<void> {
  const kp = Keypair.fromSecretKey(Uint8Array.from(record.secret));
  const authority = new PublicKey(record.authority);
  const tokenPda = sessionTokenPda(kp.publicKey, authority);

  const ixs: TransactionInstruction[] = [];
  if (await connBase.getAccountInfo(tokenPda)) {
    ixs.push(
      await gplSession(keypairWallet(kp))
        .methods.revokeSessionV2()
        .accountsPartial({ sessionToken: tokenPda, feePayer: authority, authority })
        .instruction()
    );
  }

  const balance = await connBase.getBalance(kp.publicKey);
  const { blockhash, lastValidBlockHeight } = await connBase.getLatestBlockhash("confirmed");

  const draft = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight })
    .add(...ixs, SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: authority, lamports: 1 }));
  const fee = (await connBase.getFeeForMessage(draft.compileMessage(), "confirmed")).value ?? 5000;

  if (balance <= fee) return;

  const tx = new Transaction({ feePayer: kp.publicKey, blockhash, lastValidBlockHeight })
    .add(...ixs, SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: authority, lamports: balance - fee }));
  tx.sign(kp);
  const sig = await connBase.sendRawTransaction(tx.serialize());
  const res = await connBase.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  if (res.value.err) throw new Error(`sweep failed: ${JSON.stringify(res.value.err)}`);
}

let sweeping = false;

export async function sweepExpiredSessions(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    const now = nowSec();
    for (const { key, record } of readAll()) {
      if (now <= record.validUntil + SWEEP_GRACE_SECS) continue;
      try {
        await sweepOne(record);
        removeSession(key);
      } catch {
        // next sweep retries
      }
    }
  } finally {
    sweeping = false;
  }
}
