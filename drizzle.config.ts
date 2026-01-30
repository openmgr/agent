import { defineConfig } from "drizzle-kit";
import { join } from "path";
import { homedir } from "os";

// Database location: ~/.config/openmgr/agent.db
const dbPath = join(homedir(), ".config", "openmgr", "agent.db");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
