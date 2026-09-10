import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { Glue } from "../target/types/glue";
import idl from "../target/idl/glue.json";
import "dotenv/config";

const RPC_BASE = "https://api.devnet.solana.com";
const RPC_ER = "https://devnet-eu.magicblock.app";
const DELEGATION_PROGRAM = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);
const ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
const VALIDATOR = new PublicKey("MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e");

const ARENA_ID = new anchor.BN(Date.now() % 1_000_000);
const ENTRY_FEE = new anchor.BN(0.01 * LAMPORTS_PER_SOL);
const MAX_TICKS = 60;

const TASK_ID = new anchor.BN(1);
const INTERVAL_MS = new anchor.BN(100);
const ITERATIONS = new anchor.BN(MAX_TICKS);

// helpers
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(
  label: string,
  check: () => Promise<boolean>,
  timeoutMs = 300_000,
  intervalMs = 1000
): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) return Date.now() - start;
    } catch {
    }
    await sleep(intervalMs);
  }
  throw new Error(`timeout waiting for ${label} after ${timeoutMs}ms`);
}

function arenaPda(host: PublicKey, id: anchor.BN, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("arena"), host.toBuffer(), id.toArrayLike(Buffer, "le", 8)],
    programId
  )[0];
}

(async () => {
  const latencies: Record<string, number> = {};
  const walletProvider = anchor.AnchorProvider.env();
  const host = walletProvider.wallet;

  const connBase = new Connection(RPC_BASE, "confirmed");
  const connEr = new Connection(RPC_ER, { wsEndpoint: RPC_ER.replace("http", "ws") });

  const providerBase = new anchor.AnchorProvider(connBase, host, {
    commitment: "confirmed",
  });
  const providerEr = new anchor.AnchorProvider(connEr, host, {
    commitment: "confirmed",
  });

  const programBase = new Program<Glue>(idl as Glue, providerBase);
  const programEr = new Program<Glue>(idl as Glue, providerEr);
  const PROGRAM_ID = programBase.programId;

  const pda = arenaPda(host.publicKey, ARENA_ID, PROGRAM_ID);
  console.log(`arena pda: ${pda.toBase58()}  id: ${ARENA_ID.toString()}`);

  const player2 = Keypair.generate();
    await providerBase.sendAndConfirm(
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: host.publicKey,
          toPubkey: player2.publicKey,
          lamports: ENTRY_FEE.toNumber() + 0.02 * LAMPORTS_PER_SOL,
        })
      )
    );
  console.log(`player2 funded: ${player2.publicKey.toBase58()}`);

  const slot0 = await connEr.getSlot();
  await sleep(1000);
  const slot1 = await connEr.getSlot();
  console.log(`\n[probe A] ER slots/sec ≈ ${slot1 - slot0}`);

  await programBase.methods
    .initArena(ARENA_ID, ENTRY_FEE)
    .accounts({
      host: host.publicKey,
    })
    .rpc();
  console.log("init_arena ok");

  await programBase.methods
    .joinArena(ARENA_ID)
    .accountsPartial({
      player: player2.publicKey,
      arenaAccount: pda,
    })
    .signers([player2])
    .rpc();
  console.log("join_arena ok");

  await programBase.methods
    .requestRandomness(ARENA_ID)
    .accountsPartial({
      host: host.publicKey,
      arenaAccount: pda,
      oracleQueue: ORACLE_QUEUE,
    })
    .rpc();
  console.log("request_randomness ok");

  latencies.vrf = await waitFor("vrf_seed", async () => {
    const a = await programBase.account.arenaAccount.fetch(pda);
    return a.vrfSeed !== null;
  });
  console.log(`vrf fulfilled in ${latencies.vrf}ms`);

  await programBase.methods
    .startArena(ARENA_ID)
    .accounts({ host: host.publicKey, arenaAccount: pda })
    .rpc();
  console.log("start_arena ok");

  // delegate
  await programBase.methods
    .delegate(ARENA_ID)
    .accounts({
      host: host.publicKey,
      validator: VALIDATOR,
    })
    .rpc();

  latencies.delegate = await waitFor("delegation", async () => {
    const info = await connBase.getAccountInfo(pda);
    return info !== null && info.owner.equals(DELEGATION_PROGRAM);
  });
  console.log(`delegated in ${latencies.delegate}ms`);

  // er
  await programEr.methods
      .scheduleAdvance(ARENA_ID, {
        taskId: TASK_ID,
        executionIntervalMillis: INTERVAL_MS,
        iterations: ITERATIONS,
      })
      .accounts({
        magicProgram: new PublicKey("Magic11111111111111111111111111111111111111"),
        host: host.publicKey,
        program: PROGRAM_ID,
      })
      .rpc();
  console.log("schedule_advance ok — watching ticks\n");

  const tickStart = Date.now();
  let lastTick = new anchor.BN(-1);

  let upgraded = false;
  let speedBefore = 0;

  await waitFor(
    "arena finished",
    async () => {
      const a = await programEr.account.arenaAccount.fetch(pda);
      if (!a.tick.eq(lastTick)) {
        lastTick = a.tick;
        const rate = (a.tick.toNumber() / ((Date.now() - tickStart) / 1000)).toFixed(2);
        console.log(`  tick ${a.tick}/${MAX_TICKS}  (${rate} ticks/sec)`);
      }
      if (!upgraded && a.bots[0].credits.gt(new anchor.BN(0))) {
        speedBefore = a.bots[0].speed;
        try {
          const t0 = Date.now();
          await programEr.methods
            .upgradeBot(ARENA_ID, { speed: {} })
            .accountsPartial({
              player: host.publicKey,
              arenaAccount: pda,
            })
            .rpc();
          latencies.upgrade = Date.now() - t0;
          upgraded = true;
          console.log(`  upgrade_bot ok (${latencies.upgrade}ms)`);
        } catch (e: any) {
          if (!String(e).includes("InsufficientCredits")) throw e;
        }
      }
      return "finished" in a.status;
    },
    120_000,
    500
  );
  latencies.match = Date.now() - tickStart;
  console.log(`match ran in ${latencies.match}ms\n`);

  if (!upgraded) throw new Error("upgrade_bot failed");
  const post = await programEr.account.arenaAccount.fetch(pda);
  if (post.bots[0].speed <= speedBefore) {
    throw new Error(`speed did not increase: ${speedBefore} -> ${post.bots[0].speed}`);
  }
  console.log(`speed ${speedBefore} -> ${post.bots[0].speed}`);

  const sigs = await connEr.getSignaturesForAddress(pda, { limit: 10 });
  console.log(sigs.map(s => ({ sig: s.signature, err: s.err })));
   if (sigs.length) {
     const tx = await connEr.getTransaction(sigs[0].signature, {
       maxSupportedTransactionVersion: 0,
     });
     const keys = tx?.transaction.message.staticAccountKeys ?? [];
     const n = tx?.transaction.message.header.numRequiredSignatures ?? 0;
     console.log("[probe B] crank tx signers:");
     keys.slice(0, n).forEach((k) => console.log(`  ${k.toBase58()}`));
   }

  // undelegate
  await programEr.methods
    .settleArena(ARENA_ID)
    .accounts({ host: host.publicKey, arenaAccount: pda })
    .rpc();

  latencies.undelegate = await waitFor("undelegation", async () => {
    const info = await connBase.getAccountInfo(pda);
    return info !== null && info.owner.equals(PROGRAM_ID);
  });
  console.log(`\nundelegated in ${latencies.undelegate}ms`);

  // l1
  const settled = await programBase.account.arenaAccount.fetch(pda);
  const winner = settled.winner as PublicKey;
  console.log(`winner: ${winner.toBase58()}`);

  const before = await connBase.getBalance(winner);
  await programBase.methods
    .claimPrize(ARENA_ID)
    .accountsPartial({
      caller: host.publicKey,
      arenaAccount: pda,
      winner,
    })
    .rpc();
  const after = await connBase.getBalance(winner);

  console.log(`payout: ${(after - before) / LAMPORTS_PER_SOL} SOL`);
  if (after <= before) throw new Error("claim_prize did not increase winner balance");

  const closed = await connBase.getAccountInfo(pda);
  if (closed !== null) throw new Error("arena pda was not closed");

  console.log("\n--- latencies (ms) ---");
  console.table(latencies);
  console.log("PASS");
})().catch((e) => {
  console.error(e);
  process.exit(1);
})
