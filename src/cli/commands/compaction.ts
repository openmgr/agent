import { Command } from "commander";
import chalk from "chalk";
import { SessionManager } from "../../session/index.js";

export function registerCompactionCommands(program: Command): void {
  const compactionCmd = program
    .command("compaction")
    .description("Context compaction management");

  compactionCmd
    .command("show")
    .description("Show compaction config and history for a session")
    .argument("<session-id>", "Session ID (can be partial)")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      const { sessionStorage } = await import("../../session/storage.js");
      const manager = new SessionManager();
      const sessions = await manager.listStored({ limit: 100 });
      const session = sessions.find((s) => s.id.startsWith(id));

      if (!session) {
        console.error(chalk.red(`Session not found: ${id}`));
        process.exit(1);
      }

      const history = await sessionStorage.getCompactionHistory(session.id);

      if (options.json) {
        console.log(JSON.stringify({ config: session.compactionConfig, history }, null, 2));
        return;
      }

      console.log(chalk.cyan("Compaction Config:\n"));
      console.log(`  Enabled:     ${session.compactionConfig.enabled ? chalk.green("yes") : chalk.gray("no")}`);
      if (session.compactionConfig.model) {
        console.log(`  Model:       ${chalk.white(session.compactionConfig.model)}`);
      }
      if (session.compactionConfig.tokenThreshold) {
        console.log(`  Threshold:   ${chalk.white(session.compactionConfig.tokenThreshold)}`);
      }
      if (session.compactionConfig.inceptionCount) {
        console.log(`  Inception:   ${chalk.white(session.compactionConfig.inceptionCount)} messages`);
      }
      if (session.compactionConfig.workingWindowCount) {
        console.log(`  Window:      ${chalk.white(session.compactionConfig.workingWindowCount)} messages`);
      }

      if (history.length === 0) {
        console.log(chalk.gray("\nNo compaction history."));
        return;
      }

      console.log(chalk.cyan(`\nCompaction History (${history.length}):\n`));
      for (const entry of history) {
        const date = entry.createdAt.toLocaleDateString();
        const time = entry.createdAt.toLocaleTimeString();
        const ratio = ((1 - entry.compactedTokens / entry.originalTokens) * 100).toFixed(0);
        const edited = entry.editedSummary ? chalk.yellow(" (edited)") : "";

        console.log(`  ${chalk.white(entry.id.slice(0, 8))} - ${date} ${time}${edited}`);
        console.log(`    ${chalk.gray(`${entry.messagesPruned} messages | ${entry.originalTokens} → ${entry.compactedTokens} tokens (${ratio}% reduction)`)}`);
      }
    });

  compactionCmd
    .command("history")
    .description("Show detailed compaction history for a session")
    .argument("<session-id>", "Session ID (can be partial)")
    .option("-l, --limit <limit>", "Maximum entries to show", "10")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      const { sessionStorage } = await import("../../session/storage.js");
      const manager = new SessionManager();
      const sessions = await manager.listStored({ limit: 100 });
      const session = sessions.find((s) => s.id.startsWith(id));

      if (!session) {
        console.error(chalk.red(`Session not found: ${id}`));
        process.exit(1);
      }

      const history = await sessionStorage.getCompactionHistory(session.id);
      const limited = history.slice(0, parseInt(options.limit, 10));

      if (options.json) {
        console.log(JSON.stringify({ history: limited }, null, 2));
        return;
      }

      if (limited.length === 0) {
        console.log(chalk.gray("No compaction history."));
        return;
      }

      for (const entry of limited) {
        const date = entry.createdAt.toLocaleDateString();
        const time = entry.createdAt.toLocaleTimeString();
        const edited = entry.editedSummary ? chalk.yellow(" [EDITED]") : "";

        console.log(chalk.cyan(`\n=== ${entry.id.slice(0, 8)} - ${date} ${time}${edited} ===\n`));
        console.log(`Messages pruned: ${entry.messagesPruned}`);
        console.log(`Tokens: ${entry.originalTokens} → ${entry.compactedTokens}`);
        console.log(`\n${chalk.white("Summary:")}`);
        console.log(entry.editedSummary ?? entry.summary);
      }
    });

  compactionCmd
    .command("summary")
    .description("Show or edit a specific compaction summary")
    .argument("<compaction-id>", "Compaction ID (can be partial)")
    .option("--edit <text>", "New summary text to set")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      const { sessionStorage } = await import("../../session/storage.js");

      const compaction = await sessionStorage.getCompaction(id);
      if (!compaction) {
        console.error(chalk.red(`Compaction not found: ${id}`));
        process.exit(1);
      }

      if (options.edit) {
        await sessionStorage.updateCompactionSummary(compaction.id, options.edit);
        console.log(chalk.green("Summary updated successfully."));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({ compaction }, null, 2));
        return;
      }

      const date = compaction.createdAt.toLocaleDateString();
      const time = compaction.createdAt.toLocaleTimeString();

      console.log(chalk.cyan(`Compaction ${compaction.id}`));
      console.log(`Date: ${date} ${time}`);
      console.log(`Messages pruned: ${compaction.messagesPruned}`);
      console.log(`Tokens: ${compaction.originalTokens} → ${compaction.compactedTokens}`);

      if (compaction.editedSummary) {
        console.log(chalk.yellow("\n[EDITED SUMMARY]"));
        console.log(compaction.editedSummary);
        console.log(chalk.gray("\n[ORIGINAL SUMMARY]"));
        console.log(compaction.summary);
      } else {
        console.log(chalk.white("\nSummary:"));
        console.log(compaction.summary);
      }
    });

  compactionCmd
    .command("set")
    .description("Update compaction config for a session")
    .argument("<session-id>", "Session ID (can be partial)")
    .option("--enabled <bool>", "Enable/disable compaction")
    .option("--threshold <number>", "Token threshold (0-1)")
    .option("--inception <number>", "Number of inception messages to keep")
    .option("--window <number>", "Working window size")
    .option("--model <model>", "Model to use for summarization")
    .action(async (id, options) => {
      const { sessionStorage } = await import("../../session/storage.js");
      const manager = new SessionManager();
      const sessions = await manager.listStored({ limit: 100 });
      const session = sessions.find((s) => s.id.startsWith(id));

      if (!session) {
        console.error(chalk.red(`Session not found: ${id}`));
        process.exit(1);
      }

      const updates: Record<string, unknown> = {};
      if (options.enabled !== undefined) {
        updates.enabled = options.enabled === "true";
      }
      if (options.threshold !== undefined) {
        updates.tokenThreshold = parseFloat(options.threshold);
      }
      if (options.inception !== undefined) {
        updates.inceptionCount = parseInt(options.inception, 10);
      }
      if (options.window !== undefined) {
        updates.workingWindowCount = parseInt(options.window, 10);
      }
      if (options.model !== undefined) {
        updates.model = options.model;
      }

      if (Object.keys(updates).length === 0) {
        console.error(chalk.red("No updates specified."));
        process.exit(1);
      }

      const newConfig = { ...session.compactionConfig, ...updates };
      await sessionStorage.updateSession(session.id, { compactionConfig: newConfig });
      console.log(chalk.green("Compaction config updated."));
      console.log(JSON.stringify(newConfig, null, 2));
    });
}
