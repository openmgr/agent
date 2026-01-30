import { Command } from "commander";
import chalk from "chalk";
import { getDbPath, closeDb } from "../../db/index.js";
import { runMigrations } from "../../db/migrate.js";

export function registerDbCommands(program: Command): void {
  const dbCmd = program
    .command("db")
    .description("Database management commands");

  dbCmd
    .command("path")
    .description("Show database file path")
    .action(() => {
      console.log(getDbPath());
    });

  dbCmd
    .command("migrate")
    .description("Run database migrations")
    .action(async () => {
      await runMigrations();
      closeDb();
      console.log(chalk.green("Migrations complete."));
    });
}
