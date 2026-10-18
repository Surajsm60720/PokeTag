import { buildDemoSnapshot } from "./demo-parsed";
import { getDb, type ParsedSnapshotRow } from "./db";
import type {
  ParsedBadge,
  ParsedBox,
  ParsedDex,
  ParsedInventory,
  ParsedPokemon,
  ParsedSnapshot,
  ParsedStoryProgress,
  ParsedTrainer,
} from "./parsed";
import {
  emptyInventory,
  emptyProgress,
  withPokemonDefaults,
} from "./parsed";

function parseInventoryJson(raw: string | null | undefined): ParsedInventory {
  if (!raw) return emptyInventory();
  try {
    const v = JSON.parse(raw) as Partial<ParsedInventory>;
    return {
      bag: Array.isArray(v.bag) ? v.bag : [],
      pc: Array.isArray(v.pc) ? v.pc : [],
    };
  } catch {
    return emptyInventory();
  }
}

function parseProgressJson(raw: string | null | undefined): ParsedStoryProgress {
  if (!raw) return emptyProgress();
  try {
    const v = JSON.parse(raw) as Partial<ParsedStoryProgress>;
    return {
      eliteFourDefeated: v.eliteFourDefeated ?? null,
      championDefeated: v.championDefeated ?? null,
      note: typeof v.note === "string" ? v.note : "",
    };
  } catch {
    return emptyProgress();
  }
}

function normalizeParty(party: ParsedPokemon[]): ParsedPokemon[] {
  return party.map((p) => withPokemonDefaults(p));
}

function normalizeBoxes(boxes: ParsedBox[]): ParsedBox[] {
  return boxes.map((b) => ({
    ...b,
    pokemon: b.pokemon.map((p) => (p ? withPokemonDefaults(p) : null)),
  }));
}

function rowToSnapshot(
  row: ParsedSnapshotRow,
  gameVersion: string
): ParsedSnapshot {
  return {
    versionId: row.version_id,
    gameVersion,
    parserVersion: row.parser_version,
    isDemo: Boolean(row.is_demo),
    trainer: JSON.parse(row.trainer_json) as ParsedTrainer,
    party: normalizeParty(JSON.parse(row.party_json) as ParsedPokemon[]),
    boxes: normalizeBoxes(JSON.parse(row.boxes_json) as ParsedBox[]),
    dex: JSON.parse(row.dex_json) as ParsedDex,
    badges: JSON.parse(row.badges_json) as ParsedBadge[],
    playTimeSeconds: row.play_time_seconds,
    location: row.location,
    locationMapId: row.location_map_id,
    inventory: parseInventoryJson(row.inventory_json),
    progress: parseProgressJson(row.progress_json),
  };
}

export async function saveParsedSnapshot(
  snapshot: ParsedSnapshot
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT OR REPLACE INTO parsed_snapshots (
      version_id, trainer_json, party_json, boxes_json, dex_json, badges_json,
      location, location_map_id, play_time_seconds, parser_version, is_demo, created_at,
      inventory_json, progress_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      snapshot.versionId,
      JSON.stringify(snapshot.trainer),
      JSON.stringify(snapshot.party),
      JSON.stringify(snapshot.boxes),
      JSON.stringify(snapshot.dex),
      JSON.stringify(snapshot.badges),
      snapshot.location,
      snapshot.locationMapId,
      snapshot.playTimeSeconds,
      snapshot.parserVersion,
      snapshot.isDemo ? 1 : 0,
      now,
      JSON.stringify(snapshot.inventory ?? emptyInventory()),
      JSON.stringify(snapshot.progress ?? emptyProgress())
    );
}

export async function getParsedSnapshot(
  versionId: string | null | undefined,
  gameVersion: string
): Promise<ParsedSnapshot | null> {
  if (!versionId) return null;

  const row = await (
    await getDb()
  )
    .prepare(`SELECT * FROM parsed_snapshots WHERE version_id = ?`)
    .get(versionId) as ParsedSnapshotRow | undefined;

  if (row) return rowToSnapshot(row, gameVersion);

  if (versionId.startsWith("demo-")) {
    return buildDemoSnapshot(gameVersion, versionId);
  }

  return null;
}

export function snapshotShelfFields(snapshot: ParsedSnapshot | null): {
  playTimeSeconds: number | null;
  badgeCount: number | null;
  partyIcons: Array<{
    speciesId: number;
    speciesName: string;
    types: string[];
    shiny: boolean;
    level: number;
  }>;
  trainerName: string | null;
  location: string | null;
} {
  if (!snapshot) {
    return {
      playTimeSeconds: null,
      badgeCount: null,
      partyIcons: [],
      trainerName: null,
      location: null,
    };
  }
  return {
    playTimeSeconds: snapshot.playTimeSeconds,
    badgeCount: snapshot.badges.filter((b) => b.earned).length,
    partyIcons: snapshot.party.map((p) => ({
      speciesId: p.speciesId,
      speciesName: p.speciesName,
      types: p.types,
      shiny: p.shiny,
      level: p.level,
    })),
    trainerName: snapshot.trainer.name,
    location: snapshot.location,
  };
}
