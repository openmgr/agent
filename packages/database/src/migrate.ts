import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb, getDbPath, closeDb } from "./database.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Migrations folder is at package root, one level up from dist
const MIGRATIONS_PATH = join(__dirname, "../drizzle");

export interface MigrationResult {
  success: boolean;
  migrationsRun: number;
  message: string;
}

/**
 * Run database migrations from the drizzle migrations folder.
 */
export async function runMigrations(dbPath?: string): Promise<MigrationResult> {
  if (!existsSync(MIGRATIONS_PATH)) {
    return {
      success: true,
      migrationsRun: 0,
      message: `Migrations directory not found at ${MIGRATIONS_PATH}. Skipping migrations.`,
    };
  }

  const db = getDb(dbPath ? { path: dbPath } : undefined);
  
  try {
    migrate(db, { migrationsFolder: MIGRATIONS_PATH });
    return {
      success: true,
      migrationsRun: -1, // Unknown count
      message: "Database migrations completed successfully.",
    };
  } catch (error) {
    const err = error as Error;
    if (err.message.includes("no migration files found")) {
      return {
        success: true,
        migrationsRun: 0,
        message: "No migrations to run.",
      };
    }
    return {
      success: false,
      migrationsRun: 0,
      message: `Migration failed: ${err.message}`,
    };
  }
}

/**
 * Initialize the database by running migrations.
 */
export async function initializeDatabase(dbPath?: string): Promise<MigrationResult> {
  const path = dbPath ?? getDbPath();
  console.log(`Initializing database at ${path}`);
  return runMigrations(dbPath);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then((result) => {
      console.log(result.message);
      closeDb();
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error("Database initialization failed:", err);
      closeDb();
      process.exit(1);
    });
}
