/**
 * Seeds demo save slots for every Gen 3–9 game, plus Phase 2 parsed snapshots.
 *
 *   npm run seed:demo
 *
 * Requires object storage: local MinIO (docker compose up -d) or R2 via .env.local
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoSnapshot } from "../src/lib/demo-parsed.ts";
import { describeDatabase, getDb } from "../src/lib/db.ts";
import {
  describeStorage,
  ensureBucket,
  putObject,
  resetStorageClient,
} from "../src/lib/storage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(webRoot, ".env.local"));
loadEnvFile(path.join(webRoot, "../../.env"));
resetStorageClient();

const GBA = 0x20000;
const DS = 0x80000;
const MODERN = 0x100000;

const GEN3_CODES = {
  ruby: "AXVE",
  sapphire: "AXPE",
  emerald: "BPEE",
  firered: "BPRE",
  leafgreen: "BPGE",
};

const LABELS = {
  ruby: "Pokémon Ruby",
  sapphire: "Pokémon Sapphire",
  emerald: "Pokémon Emerald",
  firered: "Pokémon FireRed",
  leafgreen: "Pokémon LeafGreen",
  diamond: "Pokémon Diamond",
  pearl: "Pokémon Pearl",
  platinum: "Pokémon Platinum",
  heartgold: "Pokémon HeartGold",
  soulsilver: "Pokémon SoulSilver",
  black: "Pokémon Black",
  white: "Pokémon White",
  black2: "Pokémon Black 2",
  white2: "Pokémon White 2",
  x: "Pokémon X",
  y: "Pokémon Y",
  omegaruby: "Pokémon Omega Ruby",
  alphasapphire: "Pokémon Alpha Sapphire",
  sun: "Pokémon Sun",
  moon: "Pokémon Moon",
  ultrasun: "Pokémon Ultra Sun",
  ultramoon: "Pokémon Ultra Moon",
  sword: "Pokémon Sword",
  shield: "Pokémon Shield",
  brilliantdiamond: "Pokémon Brilliant Diamond",
  shiningpearl: "Pokémon Shining Pearl",
  legendsarceus: "Pokémon Legends: Arceus",
  scarlet: "Pokémon Scarlet",
  violet: "Pokémon Violet",
};

/** @type {Array<{
 *  id: string,
 *  gameVersion: string,
 *  generation: 3|4|5,
 *  runLabel: string,
 *  filename: string,
 *  size: number,
 *  emulator: string,
 *  device: string,
 *  versions: number,
 *  note: string
 * }>} */
const DEMOS = [
  {
    id: "demo-firered",
    gameVersion: "firered",
    generation: 3,
    runLabel: "Pokémon FireRed",
    filename: "firered.sav",
    size: GBA,
    emulator: "mGBA",
    device: "laptop",
    versions: 2,
    note: "Demo GBA run",
  },
  {
    id: "demo-leafgreen",
    gameVersion: "leafgreen",
    generation: 3,
    runLabel: "Pokémon LeafGreen",
    filename: "leafgreen.sav",
    size: GBA,
    emulator: "mGBA",
    device: "laptop",
    versions: 1,
    note: "Demo GBA run",
  },
  {
    id: "demo-ruby",
    gameVersion: "ruby",
    generation: 3,
    runLabel: "Pokémon Ruby",
    filename: "ruby.sav",
    size: GBA,
    emulator: "mGBA",
    device: "steamdeck",
    versions: 1,
    note: "Demo GBA run",
  },
  {
    id: "demo-sapphire",
    gameVersion: "sapphire",
    generation: 3,
    runLabel: "Pokémon Sapphire",
    filename: "sapphire.sav",
    size: GBA,
    emulator: "mGBA",
    device: "laptop",
    versions: 1,
    note: "Demo GBA run",
  },
  {
    id: "demo-emerald",
    gameVersion: "emerald",
    generation: 3,
    runLabel: "Pokémon Emerald",
    filename: "emerald.sav",
    size: GBA,
    emulator: "mGBA",
    device: "laptop",
    versions: 3,
    note: "Demo GBA run with history",
  },
  {
    id: "demo-diamond",
    gameVersion: "diamond",
    generation: 4,
    runLabel: "Pokémon Diamond",
    filename: "diamond.sav",
    size: DS,
    emulator: "melonDS",
    device: "laptop",
    versions: 2,
    note: "Demo DS Gen 4",
  },
  {
    id: "demo-pearl",
    gameVersion: "pearl",
    generation: 4,
    runLabel: "Pokémon Pearl",
    filename: "pearl.sav",
    size: DS,
    emulator: "DeSmuME",
    device: "desktop",
    versions: 1,
    note: "Demo DS Gen 4",
  },
  {
    id: "demo-platinum",
    gameVersion: "platinum",
    generation: 4,
    runLabel: "Pokémon Platinum",
    filename: "platinum.sav",
    size: DS,
    emulator: "melonDS",
    device: "laptop",
    versions: 2,
    note: "Demo DS Gen 4",
  },
  {
    id: "demo-heartgold",
    gameVersion: "heartgold",
    generation: 4,
    runLabel: "Pokémon HeartGold",
    filename: "heartgold.sav",
    size: DS,
    emulator: "melonDS",
    device: "steamdeck",
    versions: 2,
    note: "Demo DS Gen 4",
  },
  {
    id: "demo-soulsilver",
    gameVersion: "soulsilver",
    generation: 4,
    runLabel: "Pokémon SoulSilver",
    filename: "soulsilver.sav",
    size: DS,
    emulator: "DeSmuME",
    device: "laptop",
    versions: 1,
    note: "Demo DS Gen 4",
  },
  {
    id: "demo-black",
    gameVersion: "black",
    generation: 5,
    runLabel: "Pokémon Black",
    filename: "black.sav",
    size: DS,
    emulator: "melonDS",
    device: "laptop",
    versions: 2,
    note: "Demo DS Gen 5",
  },
  {
    id: "demo-white",
    gameVersion: "white",
    generation: 5,
    runLabel: "Pokémon White",
    filename: "white.sav",
    size: DS,
    emulator: "melonDS",
    device: "desktop",
    versions: 1,
    note: "Demo DS Gen 5",
  },
  {
    id: "demo-black2",
    gameVersion: "black2",
    generation: 5,
    runLabel: "Pokémon Black 2",
    filename: "black2.sav",
    size: DS,
    emulator: "melonDS",
    device: "steamdeck",
    versions: 2,
    note: "Demo DS Gen 5",
  },
  {
    id: "demo-white2",
    gameVersion: "white2",
    generation: 5,
    runLabel: "Pokémon White 2",
    filename: "white2.sav",
    size: DS,
    emulator: "melonDS",
    device: "laptop",
    versions: 1,
    note: "Demo DS Gen 5",
  },
  {
    id: "demo-x",
    gameVersion: "x",
    generation: 6,
    runLabel: "Pokémon X",
    filename: "x.sav",
    size: MODERN,
    emulator: "Citra",
    device: "laptop",
    versions: 2,
    note: "Demo 3DS Gen 6",
  },
  {
    id: "demo-y",
    gameVersion: "y",
    generation: 6,
    runLabel: "Pokémon Y",
    filename: "y.sav",
    size: MODERN,
    emulator: "Citra",
    device: "desktop",
    versions: 1,
    note: "Demo 3DS Gen 6",
  },
  {
    id: "demo-omegaruby",
    gameVersion: "omegaruby",
    generation: 6,
    runLabel: "Pokémon Omega Ruby",
    filename: "omegaruby.sav",
    size: MODERN,
    emulator: "Citra",
    device: "laptop",
    versions: 1,
    note: "Demo 3DS Gen 6",
  },
  {
    id: "demo-alphasapphire",
    gameVersion: "alphasapphire",
    generation: 6,
    runLabel: "Pokémon Alpha Sapphire",
    filename: "alphasapphire.sav",
    size: MODERN,
    emulator: "Citra",
    device: "steamdeck",
    versions: 1,
    note: "Demo 3DS Gen 6",
  },
  {
    id: "demo-sun",
    gameVersion: "sun",
    generation: 7,
    runLabel: "Pokémon Sun",
    filename: "sun.sav",
    size: MODERN,
    emulator: "Citra",
    device: "laptop",
    versions: 2,
    note: "Demo 3DS Gen 7",
  },
  {
    id: "demo-moon",
    gameVersion: "moon",
    generation: 7,
    runLabel: "Pokémon Moon",
    filename: "moon.sav",
    size: MODERN,
    emulator: "Citra",
    device: "desktop",
    versions: 1,
    note: "Demo 3DS Gen 7",
  },
  {
    id: "demo-ultrasun",
    gameVersion: "ultrasun",
    generation: 7,
    runLabel: "Pokémon Ultra Sun",
    filename: "ultrasun.sav",
    size: MODERN,
    emulator: "Citra",
    device: "laptop",
    versions: 1,
    note: "Demo 3DS Gen 7",
  },
  {
    id: "demo-ultramoon",
    gameVersion: "ultramoon",
    generation: 7,
    runLabel: "Pokémon Ultra Moon",
    filename: "ultramoon.sav",
    size: MODERN,
    emulator: "Citra",
    device: "steamdeck",
    versions: 1,
    note: "Demo 3DS Gen 7",
  },
  {
    id: "demo-sword",
    gameVersion: "sword",
    generation: 8,
    runLabel: "Pokémon Sword",
    filename: "sword.sav",
    size: MODERN,
    emulator: "Yuzu",
    device: "desktop",
    versions: 2,
    note: "Demo Switch Gen 8",
  },
  {
    id: "demo-shield",
    gameVersion: "shield",
    generation: 8,
    runLabel: "Pokémon Shield",
    filename: "shield.sav",
    size: MODERN,
    emulator: "Ryujinx",
    device: "laptop",
    versions: 1,
    note: "Demo Switch Gen 8",
  },
  {
    id: "demo-brilliantdiamond",
    gameVersion: "brilliantdiamond",
    generation: 8,
    runLabel: "Pokémon Brilliant Diamond",
    filename: "brilliantdiamond.sav",
    size: MODERN,
    emulator: "Yuzu",
    device: "laptop",
    versions: 1,
    note: "Demo Switch Gen 8",
  },
  {
    id: "demo-shiningpearl",
    gameVersion: "shiningpearl",
    generation: 8,
    runLabel: "Pokémon Shining Pearl",
    filename: "shiningpearl.sav",
    size: MODERN,
    emulator: "Yuzu",
    device: "desktop",
    versions: 1,
    note: "Demo Switch Gen 8",
  },
  {
    id: "demo-legendsarceus",
    gameVersion: "legendsarceus",
    generation: 8,
    runLabel: "Pokémon Legends: Arceus",
    filename: "legendsarceus.sav",
    size: MODERN,
    emulator: "Ryujinx",
    device: "steamdeck",
    versions: 2,
    note: "Demo Switch Gen 8",
  },
  {
    id: "demo-scarlet",
    gameVersion: "scarlet",
    generation: 9,
    runLabel: "Pokémon Scarlet",
    filename: "scarlet.sav",
    size: MODERN,
    emulator: "Ryujinx",
    device: "laptop",
    versions: 2,
    note: "Demo Switch Gen 9",
  },
  {
    id: "demo-violet",
    gameVersion: "violet",
    generation: 9,
    runLabel: "Pokémon Violet",
    filename: "violet.sav",
    size: MODERN,
    emulator: "Yuzu",
    device: "desktop",
    versions: 1,
    note: "Demo Switch Gen 9",
  },
];

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function buildSaveBytes(game, versionIndex) {
  const buf = Buffer.alloc(game.size, 0);
  randomBytes(32).copy(buf, 16);
  buf.write(`POKETAG-DEMO:${game.gameVersion}:v${versionIndex}`, 48, "utf8");
  const code = GEN3_CODES[game.gameVersion];
  if (code) buf.write(code, 0x0ff0, "ascii");
  return buf;
}

function detectionJson(game, sizeBytes) {
  return JSON.stringify({
    format: "sav",
    generation: game.generation,
    gameVersion: game.gameVersion,
    recognized: true,
    sizeBytes,
    hasDesmumeFooter: false,
    rawPayloadSize: sizeBytes,
    label: LABELS[game.gameVersion] ?? game.runLabel,
    notes: ["Seeded demo save for UI walkthrough."],
  });
}

async function main() {
  const db = await getDb();
  console.log(`DB: ${describeDatabase()}`);
  console.log(`Storage: ${describeStorage()}`);

  try {
    await ensureBucket();
  } catch (err) {
    console.error(
      "\nObject storage is not reachable.\n" +
        "  Local: docker compose up -d\n" +
        "  R2:    set STORAGE_DRIVER=r2 + R2_* in apps/web/.env.local (docs/storage.md)\n"
    );
    throw err;
  }

  const demoIds = DEMOS.map((d) => d.id);
  const ph = demoIds.map(() => "?").join(",");
  const versionIds = await db
    .prepare(`SELECT id FROM save_versions WHERE slot_id IN (${ph})`)
    .all(...demoIds);
  if (versionIds.length) {
    const vph = versionIds.map(() => "?").join(",");
    await db
      .prepare(`DELETE FROM parsed_snapshots WHERE version_id IN (${vph})`)
      .run(...versionIds.map((v) => v.id as string));
  }
  await db
    .prepare(`DELETE FROM save_versions WHERE slot_id IN (${ph})`)
    .run(...demoIds);
  await db
    .prepare(`DELETE FROM device_state WHERE slot_id IN (${ph})`)
    .run(...demoIds);
  await db.prepare(`DELETE FROM save_slots WHERE id IN (${ph})`).run(...demoIds);

  const baseTime = Date.now() - DEMOS.length * 3600_000;

  for (let i = 0; i < DEMOS.length; i++) {
    const game = DEMOS[i];
    const createdAt = new Date(baseTime + i * 3600_000).toISOString();
    let currentVersionId = null;
    let parentVersionId = null;

    await db
      .prepare(
        `INSERT INTO save_slots (id, game_version, generation, run_label, created_at, current_version_id)
       VALUES (?, ?, ?, ?, ?, NULL)`
      )
      .run(
        game.id,
        game.gameVersion,
        game.generation,
        game.runLabel,
        createdAt
      );

    for (let v = 0; v < game.versions; v++) {
      const versionId = `${game.id}-v${v + 1}`;
      const data = buildSaveBytes(game, v + 1);
      const hash = sha256(data);
      const storageKey = `saves/${versionId}/${game.filename}`;
      const uploadedAt = new Date(
        baseTime + i * 3600_000 + (v + 1) * 600_000
      ).toISOString();

      await putObject(storageKey, data);

      await db
        .prepare(
          `INSERT INTO save_versions (
          id, slot_id, parent_version_id, storage_key, sha256, size_bytes,
          original_filename, source_format, source_emulator, source_device,
          uploaded_at, note, recognized, detection_json,
          parse_status, parse_error, parsed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'done', '', ?)`
        )
        .run(
          versionId,
          game.id,
          parentVersionId,
          storageKey,
          hash,
          data.length,
          game.filename,
          "sav",
          game.emulator,
          game.device,
          uploadedAt,
          v === 0 ? game.note : `Autosave checkpoint ${v + 1}`,
          detectionJson(game, data.length),
          uploadedAt
        );

      parentVersionId = versionId;
      currentVersionId = versionId;
    }

    await db
      .prepare(`UPDATE save_slots SET current_version_id = ? WHERE id = ?`)
      .run(currentVersionId, game.id);

    if (currentVersionId) {
      const snap = buildDemoSnapshot(game.gameVersion, currentVersionId);
      if (snap) {
        await db
          .prepare(
            `INSERT INTO parsed_snapshots (
            version_id, trainer_json, party_json, boxes_json, dex_json, badges_json,
            location, location_map_id, play_time_seconds, parser_version, is_demo, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
          )
          .run(
            snap.versionId,
            JSON.stringify(snap.trainer),
            JSON.stringify(snap.party),
            JSON.stringify(snap.boxes),
            JSON.stringify(snap.dex),
            JSON.stringify(snap.badges),
            snap.location,
            snap.locationMapId,
            snap.playTimeSeconds,
            snap.parserVersion,
            new Date().toISOString()
          );
      }
    }

    console.log(
      `  ✓ ${game.gameVersion.padEnd(12)} Gen ${game.generation}  ${String(game.versions).padStart(1)} ver  ${game.runLabel}`
    );
  }

  console.log(
    `\nSeeded ${DEMOS.length} demo slots + parsed dashboards (Gen 3–9). Refresh http://localhost:3000`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
