import type { PublicKey } from "@solana/web3.js";

export const MAX_NAME_LEN = 32;

const enc = new TextEncoder();
const dec = new TextDecoder();

export const nameByteLength = (s: string) => enc.encode(s).length;

export const short = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

export function decodeName(bytes: number[]): string {
  const end = bytes.indexOf(0);
  return dec.decode(Uint8Array.from(end === -1 ? bytes : bytes.slice(0, end)));
}

export function displayName(arena: any, i: number): string {
  const name = decodeName(arena.names[i]);
  return name || short((arena.players[i] as PublicKey).toBase58());
}
