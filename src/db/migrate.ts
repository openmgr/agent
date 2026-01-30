import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getDb, getDbPath, closeDb } from "./index.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_PATH = join(__dirname, "../../drizzle");

export async function runMigrations(): Promise<void> {
  if (!existsSync(MIGRATIONS_PATH)) {
    console.warn(`Migrations directory not found at ${MIGRATIONS_PATH}. Skipping migrations.`);
    return;
  }

  const db = getDb();
  
  try {
    migrate(db, { migrationsFolder: MIGRATIONS_PATH });
    console.log("Database migrations completed successfully.");
  } catch (error) {
    const err = error as Error;
    if (err.message.includes("no migration files found")) {
      console.log("No migrations to run.");
    } else {
      throw error;
    }
  }
}

export async function initializeDatabase(): Promise<void> {
  console.log(`Initializing database at ${getDbPath()}`);
  await runMigrations();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(() => {
      console.log("Database initialization complete.");
      closeDb();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Database initialization failed:", err);
      closeDb();
      process.exit(1);
    });
}
