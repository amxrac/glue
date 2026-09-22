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

const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
const MAGIC_PROGRAM = new PublicKey("Magic11111111111111111111111111111111111111");
const ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
const VALIDATOR = new PublicKey("MEUGGrYPxKk17hCr7wpT6s8dtNokZj5U2L57vjYMS8e");

const ARENA_ID = new anchor.BN(Date.now() % 1_000_000);
const CANCEL_ARENA_ID = ARENA_ID.addn(1);
const ENTRY_FEE = new anchor.BN(0.01 * LAMPORTS_PER_SOL);
const MAX_TICKS = 550;
const PLAYERS = 2;

const TASK_ID = new anchor.BN(1);
const INTERVAL_MS = new anchor.BN(100);
const ITERATIONS = new anchor.BN(MAX_TICKS);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// poll `check` until it returns true. resolves with elapsed ms
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
      // account unreadable mid-transition; keep polling
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

(async () => {
  const latencies: Record<string, number> = {};
  const host = anchor.AnchorProvider.env().wallet;

  const connBase = new Connection(RPC_BASE, "confirmed");
  const connEr = new Connection(RPC_ER, {
    wsEndpoint: RPC_ER.replace("http", "ws"),
    commitment: "confirmed",
  });

  const programBase = new Program<Glue>(
    idl as Glue,
    new anchor.AnchorProvider(connBase, host, { commitment: "confirmed" })
  );
  const programEr = new Program<Glue>(
    idl as Glue,
    new anchor.AnchorProvider(connEr, host, { commitment: "confirmed" })
  );
  const PROGRAM_ID = programBase.programId;

  const pda = arenaPda(host.publicKey, ARENA_ID, PROGRAM_ID);
  console.log(`arena pda: ${pda.toBase58()}  id: ${ARENA_ID.toString()}`);

  const player2 = Keypair.generate();
  await programBase.provider.sendAndConfirm!(
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: host.publicKey,
        toPubkey: player2.publicKey,
        lamports: ENTRY_FEE.toNumber() * 2 + 0.02 * LAMPORTS_PER_SOL,
      })
    )
  );
  console.log(`player2 funded: ${player2.publicKey.toBase58()}`);

  {
    const cancelPda = arenaPda(host.publicKey, CANCEL_ARENA_ID, PROGRAM_ID);

    await programBase.methods
      .initArena(CANCEL_ARENA_ID, ENTRY_FEE)
      .accounts({ host: host.publicKey })
      .rpc();

    await programBase.methods
      .joinArena(CANCEL_ARENA_ID)
      .accountsPartial({ player: player2.publicKey, arenaAccount: cancelPda })
      .signers([player2])
      .rpc();

    const before = await connBase.getBalance(player2.publicKey);
    await programBase.methods
      .cancelArena(CANCEL_ARENA_ID)
      .accountsPartial({ host: host.publicKey, arenaAccount: cancelPda })
      .remainingAccounts([
        { pubkey: host.publicKey, isWritable: true, isSigner: false },
        { pubkey: player2.publicKey, isWritable: true, isSigner: false },
      ])
      .rpc();
    const refunded = (await connBase.getBalance(player2.publicKey)) - before;

    assert(
      refunded === ENTRY_FEE.toNumber(),
      `player2 refund wrong: got ${refunded}, want ${ENTRY_FEE.toNumber()}`
    );
    assert((await connBase.getAccountInfo(cancelPda)) === null, "cancelled arena pda was not closed");
    console.log(`cancel_arena ok (refunded ${refunded / LAMPORTS_PER_SOL} SOL)`);
  }

  // probe A: ER slot rate
  const slot0 = await connEr.getSlot();
  await sleep(1000);
  console.log(`[probe A] ER slots/sec ≈ ${(await connEr.getSlot()) - slot0}\n`);

  // base layer
  await programBase.methods
    .initArena(ARENA_ID, ENTRY_FEE)
    .accounts({ host: host.publicKey })
    .rpc();
  console.log("init_arena ok");

  await programBase.methods
    .joinArena(ARENA_ID)
    .accountsPartial({ player: player2.publicKey, arenaAccount: pda })
    .signers([player2])
    .rpc();
  console.log("join_arena ok");

  await programBase.methods
    .requestRandomness(ARENA_ID)
    .accountsPartial({ host: host.publicKey, arenaAccount: pda, oracleQueue: ORACLE_QUEUE })
    .rpc();

  latencies.vrf = await waitFor("vrf_seed", async () =>
    (await programBase.account.arenaAccount.fetch(pda)).vrfSeed !== null
  );
  console.log(`vrf fulfilled in ${latencies.vrf}ms`);

  await programBase.methods
    .startArena(ARENA_ID)
    .accountsPartial({ host: host.publicKey, arenaAccount: pda })
    .rpc();
  console.log("start_arena ok");

  // delegate
  await programBase.methods
    .delegate(ARENA_ID)
    .accountsPartial({ host: host.publicKey, validator: VALIDATOR })
    .rpc();

  latencies.delegate = await waitFor("delegation", async () => {
    const info = await connBase.getAccountInfo(pda);
    return info !== null && info.owner.equals(DELEGATION_PROGRAM);
  });
  console.log(`delegated in ${latencies.delegate}ms`);

  // er
  let tickStart = 0;
  {
    const tx = await programEr.methods
      .scheduleAdvance(ARENA_ID, {
        taskId: TASK_ID,
        executionIntervalMillis: INTERVAL_MS,
        iterations: ITERATIONS,
      })
      .accountsPartial({
        magicProgram: MAGIC_PROGRAM,
        host: host.publicKey,
        arenaAccount: pda,
        program: PROGRAM_ID,
      })
      .transaction();

    const bh = await connEr.getLatestBlockhash();
    tx.feePayer = host.publicKey;
    tx.recentBlockhash = bh.blockhash;
    const signed = await host.signTransaction(tx);

    const sim = await connEr.simulateTransaction(signed);
    if (sim.value.err) {
      console.log(sim.value.logs);
      throw new Error(`schedule_advance simulation failed: ${JSON.stringify(sim.value.err)}`);
    }

    const sig = await connEr.sendRawTransaction(signed.serialize(), { skipPreflight: true });
    await connEr.confirmTransaction(
      { signature: sig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
      "confirmed"
    );
    tickStart = Date.now();
    console.log("schedule_advance ok");
  }

  // a player must not be able to advance the match
  // must fail on the crank-signer constraint
  {
    let rejected = false;
    try {
      await programEr.methods
        .advanceSimulation(ARENA_ID)
        .accountsPartial({ arenaAccount: pda, crankSigner: host.publicKey })
        .rpc();
    } catch (e: any) {
      const logs: string[] = (await e.getLogs?.(connEr)) ?? e?.logs ?? [];
      const msg = String(e) + logs.join("\n");
      const ok =
        e?.error?.errorCode?.code === "UnauthorizedSigner" ||
        msg.includes("Unauthorized Signer") ||
        msg.includes("ConstraintAddress");
      if (!ok) throw new Error(`advance_simulation failed for the wrong reason:\n${msg}`);
      rejected = true;
    }
    assert(rejected, "advance_simulation accepted a non-crank signer");
    console.log("advance_simulation rejects players: ok\n");
  }

  // buy one upgrade mid-match
  let lastTick = new anchor.BN(-1);
  let upgraded = false;
  let speedBefore = 0;

  try {
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
              .accountsPartial({ player: host.publicKey, arenaAccount: pda })
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
  } catch (e) {
    const sigs = await connEr.getSignaturesForAddress(pda, { limit: 20 });
    for (const s of sigs.filter((s) => s.err)) {
      const t = await connEr.getTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
      const signer = t?.transaction.message.staticAccountKeys[0]?.toBase58();
      if (signer === host.publicKey.toBase58()) continue;
      console.log(`[crank] ${s.signature.slice(0, 8)} signer=${signer} err=${JSON.stringify(s.err)}`);
      console.log(t?.meta?.logMessages);
    }
    throw e;
  }
  latencies.match = Date.now() - tickStart;
  console.log(`match ran in ${latencies.match}ms\n`);

  assert(upgraded, "upgrade_bot never succeeded");
  const post = await programEr.account.arenaAccount.fetch(pda);
  assert(
    post.bots[0].speed > speedBefore,
    `speed did not increase: ${speedBefore} -> ${post.bots[0].speed}`
  );

  // probe B: tx-level signer of the latest crank tx
  {
    const [latest] = await connEr.getSignaturesForAddress(pda, { limit: 1 });
    if (latest) {
      const t = await connEr.getTransaction(latest.signature, { maxSupportedTransactionVersion: 0 });
      const keys = t?.transaction.message.staticAccountKeys ?? [];
      const n = t?.transaction.message.header.numRequiredSignatures ?? 0;
      console.log("[probe B] crank tx-level signers (validator):");
      keys.slice(0, n).forEach((k) => console.log(`  ${k.toBase58()}`));
    }
  }

  await programEr.methods
    .settleArena(ARENA_ID)
    .accountsPartial({ host: host.publicKey, arenaAccount: pda })
    .rpc();

  latencies.undelegate = await waitFor("undelegation", async () => {
    const info = await connBase.getAccountInfo(pda);
    return info !== null && info.owner.equals(PROGRAM_ID);
  });
  console.log(`\nundelegated in ${latencies.undelegate}ms`);

  // base layer
  const settled = await programBase.account.arenaAccount.fetch(pda);
  assert(settled.winner, "no winner recorded on the settled arena");
  const winner = settled.winner as PublicKey;
  assert(
    winner.equals(host.publicKey) || winner.equals(player2.publicKey),
    `winner ${winner.toBase58()} is not a player`
  );
  console.log(`winner: ${winner.toBase58()}`);

  const arenaLamports = await connBase.getBalance(pda);
  const prizePool = ENTRY_FEE.toNumber() * PLAYERS;

  const before = await connBase.getBalance(winner);
  const claimSig = await programBase.methods
    .claimPrize(ARENA_ID)
    .accountsPartial({ caller: host.publicKey, arenaAccount: pda, winner })
    .rpc();
  const after = await connBase.getBalance(winner);

  const claimTx = await connBase.getTransaction(claimSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const fee = claimTx?.meta?.fee ?? 0;
  const received = after - before + (winner.equals(host.publicKey) ? fee : 0);

  console.log(
    `received: ${received / LAMPORTS_PER_SOL} SOL ` +
      `(prize pool ${prizePool / LAMPORTS_PER_SOL}, arena held ${arenaLamports / LAMPORTS_PER_SOL}, fee ${fee})`
  );
  assert(received >= prizePool, `winner got ${received}, less than prize pool ${prizePool}`);
  assert(received <= arenaLamports, `winner got ${received}, more than arena held ${arenaLamports}`);
  assert((await connBase.getAccountInfo(pda)) === null, "arena pda was not closed");

  console.log("\n--- latencies (ms) ---");
  console.table(latencies);
  console.log("PASS");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
