import fs from "fs";
import path from "path";
import { createClient, type Client, type InArgs, type Transaction } from "@libsql/client";

/**
 * LibSQL / Turso database access.
 *
 * Local:  DATABASE_URL=file:../../data/poketag.sqlite  (default)
 * Cloud:  TURSO_DATABASE_URL=libsql://… + TURSO_AUTH_TOKEN=…
 */

export type SqlValue = string | number | bigint | ArrayBuffer | null;

type TxLike = Client | Transaction;

let client: Client | null = null;
let migrated: Promise<void> | null = null;

function resolveLocalFileUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:../../data/poketag.sqlite";
  const filePath = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  const abs = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return `file:${abs}`;
}

function createDbClient(): Client {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!authToken) {
      throw new Error("TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set");
    }
    return createClient({ url: tursoUrl, authToken });
  }
  return createClient({ url: resolveLocalFileUrl() });
}

function asArgs(args: SqlValue[]): InArgs {
  return args as InArgs;
}

function mapRow<T extends Record<string, unknown>>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out as T;
}

/** How long SQLite waits for a lock before returning SQLITE_BUSY. */
const BUSY_TIMEOUT_MS = 5000;

/**
 * In-process FIFO for all database work.
 *
 * @libsql/client detaches the connection when a transaction starts
 * (`this.#db = null`), so the next statement opens a *second* connection to
 * the same file. Two overlapping writers then fight over SQLite's single
 * write lock and fail with SQLITE_BUSY — which is what concurrent requests,
 * the background parse job, or a script running alongside `next dev` will do.
 *
 * This app is one process, so queue the work instead of racing the lock: a
 * transaction holds the queue for its whole lifetime, plain statements wait
 * their turn. It also stops a stray statement from being absorbed into (and
 * rolled back with) somebody else's transaction.
 */
let dbQueue: Promise<void> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = dbQueue.then(work);
  dbQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/**
 * Set busy_timeout on the connection libsql will actually use, so a *second
 * process* touching the same file (scripts, a second dev server) waits for
 * the lock instead of erroring. Remote Turso clients have no such pragma.
 * Called once at startup and again after every transaction, because a
 * transaction detaches the connection and the next one is created fresh.
 */
async function applyBusyTimeout(c: Client): Promise<void> {
  if (process.env.TURSO_DATABASE_URL?.trim()) return;
  try {
    await c.execute(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  } catch {
    // A pragma we cannot set must never block startup or a commit.
  }
}

export class Db {
  private readonly conn: TxLike;
  /**
   * True for the connection owned by an open transaction. It already holds
   * the database queue, so its statements run directly — routing them back
   * through the queue would deadlock against itself.
   */
  private readonly exclusive: boolean;

  constructor(conn: TxLike, options?: { exclusive?: boolean }) {
    this.conn = conn;
    this.exclusive = options?.exclusive === true;
  }

  /** Queue behind any in-flight transaction, unless this Db *is* one. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    return this.exclusive ? work() : serialize(work);
  }

  prepare(sql: string) {
    const conn = this.conn;
    const enqueue = <T>(work: () => Promise<T>): Promise<T> =>
      this.enqueue(work);

    return {
      async all<T extends Record<string, unknown> = Record<string, unknown>>(
        ...args: SqlValue[]
      ): Promise<T[]> {
        return enqueue(async () => {
          const result = await conn.execute({ sql, args: asArgs(args) });
          return result.rows.map((r) =>
            mapRow<T>(r as unknown as Record<string, unknown>)
          );
        });
      },
      async get<T extends Record<string, unknown> = Record<string, unknown>>(
        ...args: SqlValue[]
      ): Promise<T | undefined> {
        return enqueue(async () => {
          const result = await conn.execute({ sql, args: asArgs(args) });
          const row = result.rows[0];
          return row
            ? mapRow<T>(row as unknown as Record<string, unknown>)
            : undefined;
        });
      },
      /** Execute a write. Resolves to rows affected so callers can claim rows. */
      async run(...args: SqlValue[]): Promise<number> {
        return enqueue(async () => {
          const result = await conn.execute({ sql, args: asArgs(args) });
          return result.rowsAffected;
        });
      },
    };
  }

  async exec(sql: string): Promise<void> {
    await this.enqueue(async () => {
      await this.conn.execute(sql);
    });
  }

  async batch(
    statements: Array<{ sql: string; args?: SqlValue[] }>
  ): Promise<void> {
    await this.enqueue(async () => {
      if (!("batch" in this.conn) || typeof this.conn.batch !== "function") {
        for (const s of statements) {
          await this.conn.execute({
            sql: s.sql,
            args: asArgs(s.args ?? []),
          });
        }
        return;
      }
      await this.conn.batch(
        statements.map((s) => ({
          sql: s.sql,
          args: asArgs(s.args ?? []),
        })),
        "write"
      );
    });
  }
}

export async function getClient(): Promise<Client> {
  if (!client) {
    client = createDbClient();
    await applyBusyTimeout(client);
  }
  if (!migrated) {
    migrated = migrate(new Db(client));
  }
  await migrated;
  return client;
}

export async function getDb(): Promise<Db> {
  const c = await getClient();
  return new Db(c);
}

/** Run work inside a write transaction with exclusive access to the database. */
export async function withTransaction<T>(
  fn: (db: Db) => Promise<T>
): Promise<T> {
  const c = await getClient();
  return serialize(async () => {
    const tx = await c.transaction("write");
    try {
      const result = await fn(new Db(tx, { exclusive: true }));
      await tx.commit();
      return result;
    } catch (err) {
      try {
        await tx.rollback();
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      // The transaction detached the connection libsql was holding; prime the
      // replacement so cross-process runs keep the busy timeout too.
      await applyBusyTimeout(c);
    }
  });
}

async function columnExists(
  database: Db,
  table: string,
  column: string
): Promise<boolean> {
  const rows = await database
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  return rows.some((r) => r.name === column);
}

async function migrate(database: Db): Promise<void> {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS save_slots (
      id TEXT PRIMARY KEY,
      game_version TEXT NOT NULL,
      generation INTEGER,
      run_label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      current_version_id TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS save_versions (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      parent_version_id TEXT,
      storage_key TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      source_format TEXT NOT NULL,
      source_emulator TEXT NOT NULL DEFAULT '',
      source_device TEXT NOT NULL DEFAULT '',
      uploaded_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      recognized INTEGER NOT NULL DEFAULT 0,
      detection_json TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (slot_id) REFERENCES save_slots(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_versions_slot ON save_versions(slot_id)`,
    `CREATE INDEX IF NOT EXISTS idx_versions_sha ON save_versions(sha256)`,
    `CREATE TABLE IF NOT EXISTS device_state (
      device_label TEXT NOT NULL,
      slot_id TEXT NOT NULL,
      last_downloaded_version_id TEXT,
      PRIMARY KEY (device_label, slot_id),
      FOREIGN KEY (slot_id) REFERENCES save_slots(id)
    )`,
    `CREATE TABLE IF NOT EXISTS parsed_snapshots (
      version_id TEXT PRIMARY KEY,
      trainer_json TEXT NOT NULL DEFAULT '{}',
      party_json TEXT NOT NULL DEFAULT '[]',
      boxes_json TEXT NOT NULL DEFAULT '[]',
      dex_json TEXT NOT NULL DEFAULT '{}',
      badges_json TEXT NOT NULL DEFAULT '[]',
      location TEXT NOT NULL DEFAULT '',
      location_map_id INTEGER,
      play_time_seconds INTEGER NOT NULL DEFAULT 0,
      parser_version TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      inventory_json TEXT NOT NULL DEFAULT '{"bag":[],"pc":[]}',
      progress_json TEXT NOT NULL DEFAULT '{"eliteFourDefeated":null,"championDefeated":null,"note":""}',
      FOREIGN KEY (version_id) REFERENCES save_versions(id)
    )`,
  ];
  for (const sql of ddl) {
    await database.exec(sql);
  }

  if (!(await columnExists(database, "save_versions", "parse_status"))) {
    await database.exec(
      `ALTER TABLE save_versions ADD COLUMN parse_status TEXT NOT NULL DEFAULT 'pending'`
    );
  }
  if (!(await columnExists(database, "save_versions", "parse_error"))) {
    await database.exec(
      `ALTER TABLE save_versions ADD COLUMN parse_error TEXT NOT NULL DEFAULT ''`
    );
  }
  if (!(await columnExists(database, "save_versions", "parsed_at"))) {
    await database.exec(`ALTER TABLE save_versions ADD COLUMN parsed_at TEXT`);
  }
  if (!(await columnExists(database, "save_versions", "parse_attempts"))) {
    await database.exec(
      `ALTER TABLE save_versions ADD COLUMN parse_attempts INTEGER NOT NULL DEFAULT 0`
    );
  }
  if (!(await columnExists(database, "save_versions", "parse_started_at"))) {
    await database.exec(
      `ALTER TABLE save_versions ADD COLUMN parse_started_at TEXT`
    );
  }

  if (!(await columnExists(database, "parsed_snapshots", "inventory_json"))) {
    await database.exec(
      `ALTER TABLE parsed_snapshots ADD COLUMN inventory_json TEXT NOT NULL DEFAULT '{"bag":[],"pc":[]}'`
    );
  }
  if (!(await columnExists(database, "parsed_snapshots", "progress_json"))) {
    await database.exec(
      `ALTER TABLE parsed_snapshots ADD COLUMN progress_json TEXT NOT NULL DEFAULT '{"eliteFourDefeated":null,"championDefeated":null,"note":""}'`
    );
  }

  await database.exec(`
    UPDATE save_versions
    SET parse_status = 'done', parsed_at = COALESCE(parsed_at, uploaded_at)
    WHERE parse_status = 'pending'
      AND (
        id LIKE 'demo-%'
        OR EXISTS (SELECT 1 FROM parsed_snapshots p WHERE p.version_id = save_versions.id)
      )
  `);
}

export function describeDatabase(): string {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) return `turso ${tursoUrl}`;
  return `local ${resolveLocalFileUrl()}`;
}

export type ParseStatus = "pending" | "running" | "done" | "failed";

export interface ParsedSnapshotRow {
  version_id: string;
  trainer_json: string;
  party_json: string;
  boxes_json: string;
  dex_json: string;
  badges_json: string;
  location: string;
  location_map_id: number | null;
  play_time_seconds: number;
  parser_version: string;
  is_demo: number;
  created_at: string;
  inventory_json?: string | null;
  progress_json?: string | null;
}

export interface SaveSlotRow {
  id: string;
  game_version: string;
  generation: number | null;
  run_label: string;
  created_at: string;
  current_version_id: string | null;
}

export interface SaveVersionRow {
  id: string;
  slot_id: string;
  parent_version_id: string | null;
  storage_key: string;
  sha256: string;
  size_bytes: number;
  original_filename: string;
  source_format: string;
  source_emulator: string;
  source_device: string;
  uploaded_at: string;
  note: string;
  recognized: number;
  detection_json: string;
  parse_status: ParseStatus;
  parse_error: string;
  parsed_at: string | null;
  parse_attempts: number;
  parse_started_at: string | null;
}
