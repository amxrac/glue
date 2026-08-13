import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@anchor-lang/core";

import IDL from "./idl/glue.json";

// -----------------------------
// Config
// -----------------------------

const RPC_URL = "https://devnet-tee.magicblock.app";

const PROGRAM_ID = new PublicKey(
  "EVh92BTdvhGSwQ2tx3wgZftuRfsP2oXfEcUmXoSwP9Hd"
);

const HOST = new PublicKey(
  "6F1ieXtPmkbB4GENUkYkNrcnQq8NEsuc2gVu2S2vRZYL"
);

const ARENA_ID = 1;

const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;


// -----------------------------
// Solana
// -----------------------------

const connection = new Connection(
  RPC_URL,
  "confirmed"
);

// IDL contains the program address.
// If your generated IDL has the correct address,
// you can simply use the IDL here.
const program = new Program(IDL, {
  connection,
});


// -----------------------------
// DOM
// -----------------------------

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");

const statusElement = document.querySelector("#status");
const tickElement = document.querySelector("#tick");
const playersElement = document.querySelector("#players");
const resourcesElement = document.querySelector("#resources");
const errorElement = document.querySelector("#error");


// -----------------------------
// Canvas
// -----------------------------

const SIZE = 800;

canvas.width = SIZE;
canvas.height = SIZE;

const CELL_WIDTH = SIZE / MAP_WIDTH;
const CELL_HEIGHT = SIZE / MAP_HEIGHT;


// -----------------------------
// Arena PDA
// -----------------------------

function getArenaAddress() {
  const idBytes = new ArrayBuffer(8);
  const view = new DataView(idBytes);

  // Rust: id.to_le_bytes()
  view.setBigUint64(0, BigInt(ARENA_ID), true);

  const [address] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode("arena"),
      HOST.toBytes(),
      new Uint8Array(idBytes),
    ],
    PROGRAM_ID
  );

  return address;
}

const arenaAddress = getArenaAddress();

console.log(
  "Arena:",
  arenaAddress.toBase58()
);


// -----------------------------
// Fetch ArenaAccount
// -----------------------------

async function fetchArena() {
  return await program.account.arenaAccount.fetch(
    arenaAddress
  );
}


// -----------------------------
// Drawing
// -----------------------------

function clearCanvas() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;

  for (let x = 0; x <= MAP_WIDTH; x++) {
    const px = x * CELL_WIDTH;

    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, SIZE);
    ctx.stroke();
  }

  for (let y = 0; y <= MAP_HEIGHT; y++) {
    const py = y * CELL_HEIGHT;

    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(SIZE, py);
    ctx.stroke();
  }
}


function drawBot(bot) {
  if (!bot.active) {
    return;
  }

  const x =
    bot.x * CELL_WIDTH +
    CELL_WIDTH / 2;

  const y =
    bot.y * CELL_HEIGHT +
    CELL_HEIGHT / 2;

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    7,
    0,
    Math.PI * 2
  );

  ctx.fillStyle = "#fff";
  ctx.fill();
}


function drawResource(resource) {
  if (!resource.active) {
    return;
  }

  const x =
    resource.x * CELL_WIDTH +
    CELL_WIDTH / 2;

  const y =
    resource.y * CELL_HEIGHT +
    CELL_HEIGHT / 2;

  ctx.fillStyle = "#888";

  ctx.fillRect(
    x - 4,
    y - 4,
    8,
    8
  );
}


function render(arena) {
  clearCanvas();

  for (const bot of arena.bots) {
    drawBot(bot);
  }

  for (const resource of arena.resources) {
    drawResource(resource);
  }

  tickElement.textContent =
    arena.tick.toString();

  playersElement.textContent =
    arena.players.length.toString();

  resourcesElement.textContent =
    arena.resources.filter(
      resource => resource.active
    ).length.toString();

  statusElement.textContent =
    String(arena.status).toUpperCase();
}


// -----------------------------
// Update
// -----------------------------

async function update() {
  try {
    errorElement.textContent = "";

    const arena = await fetchArena();

    render(arena);

  } catch (error) {
    console.error(error);

    errorElement.textContent =
      error.message;
  }
}


// -----------------------------
// Start
// -----------------------------

update();

setInterval(update, 500);
