import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";
import * as schema from "./schema.js";

const CONFIG_DIR = join(homedir(), ".config", "openmgr");
const DB_PATH = join(CONFIG_DIR, "agent.db");

let db: BetterSQLite3Database<typeof schema> | null = null;
let sqlite: Database.Database | null = null;

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    ensureConfigDir();
    sqlite = new Database(DB_PATH);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export function getDbPath(): string {
  return DB_PATH;
}

export { schema };
export type { BetterSQLite3Database };
