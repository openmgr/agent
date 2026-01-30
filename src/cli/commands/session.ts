import { Command } from "commander";
import chalk from "chalk";
import * as readline from "readline";
import * as path from "path";
import { SessionManager } from "../../session/index.js";
import type { StoredSession } from "../../session/storage.js";

export function registerSessionCommands(program: Command): void {
  const sessionCmd = program
    .command("session")
    .description("Manage sessions");

  sessionCmd
    .command("list")
    .description("List stored sessions")
    .option("-l, --limit <limit>", "Maximum number of sessions", "20")
    .option("-a, --all", "Show sessions from all directories")
    .option("-d, --directory <dir>", "Show sessions from specific directory")
    .option("--json", "Output as JSON")
    .option("--no-pager", "Disable pager interface")
    .action(async (options) => {
      const manager = new SessionManager();
      let sessions = await manager.listStored({ limit: parseInt(options.limit, 10) });

      if (!options.all) {
        const targetDir = options.directory ? path.resolve(options.directory) : process.cwd();
        sessions = sessions.filter(session => session.workingDirectory === targetDir);
      }

      if (options.json) {
        console.log(JSON.stringify(sessions, null, 2));
        return;
      }

      if (sessions.length === 0) {
        if (options.all) {
          console.log(chalk.gray("No sessions found."));
        } else {
          const currentDir = options.directory ? path.resolve(options.directory) : process.cwd();
          console.log(chalk.gray(`No sessions found for directory: ${currentDir}`));
          console.log(chalk.gray("Use --all to see sessions from all directories."));
        }
        return;
      }

      if (!options.noPager && sessions.length > 5 && process.stdout.isTTY) {
        await showSessionsWithLess(sessions, options.all ? "all directories" : (options.directory ? path.resolve(options.directory) : process.cwd()));
      } else {
        showSessionsSimple(sessions, options.all ? "all directories" : (options.directory ? path.resolve(options.directory) : process.cwd()));
      }
    });

  sessionCmd
    .command("show")
    .description("Show details of a session")
    .argument("<id>", "Session ID (can be partial)")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      const manager = new SessionManager();
      const sessions = await manager.listStored({ limit: 100 });
      const session = sessions.find((s) => s.id.startsWith(id));

      if (!session) {
        console.error(chalk.red(`Session not found: ${id}`));
        process.exit(1);
      }

      if (options.json) {
        const messages = await manager.getStoredMessages(session.id);
        console.log(JSON.stringify({ session, messages }, null, 2));
        return;
      }

      console.log(chalk.cyan("Session Details:\n"));
      console.log(`  ID:         ${chalk.white(session.id)}`);
      console.log(`  Title:      ${chalk.green(session.title ?? "(untitled)")}`);
      console.log(`  Provider:   ${chalk.white(session.provider)}`);
      console.log(`  Model:      ${chalk.white(session.model)}`);
      console.log(`  Messages:   ${chalk.white(session.messageCount)}`);
      console.log(`  Tokens:     ${chalk.white(session.tokenEstimate)}`);
      console.log(`  Directory:  ${chalk.gray(session.workingDirectory)}`);
      console.log(`  Created:    ${chalk.gray(session.createdAt.toLocaleString())}`);
      console.log(`  Updated:    ${chalk.gray(session.updatedAt.toLocaleString())}`);

      console.log(chalk.cyan("\nCompaction Config:"));
      console.log(`  Enabled:    ${session.compactionConfig.enabled ? chalk.green("yes") : chalk.gray("no")}`);
      if (session.compactionConfig.model) {
        console.log(`  Model:      ${chalk.white(session.compactionConfig.model)}`);
      }
      if (session.compactionConfig.inceptionCount) {
        console.log(`  Inception:  ${chalk.white(session.compactionConfig.inceptionCount)}`);
      }
      if (session.compactionConfig.workingWindowCount) {
        console.log(`  Window:     ${chalk.white(session.compactionConfig.workingWindowCount)}`);
      }
    });

  sessionCmd
    .command("delete")
    .description("Delete a session")
    .argument("<id>", "Session ID (can be partial)")
    .option("-f, --force", "Skip confirmation")
    .action(async (id, options) => {
      const manager = new SessionManager();
      const sessions = await manager.listStored({ limit: 100 });
      const session = sessions.find((s) => s.id.startsWith(id));

      if (!session) {
        console.error(chalk.red(`Session not found: ${id}`));
        process.exit(1);
      }

      if (!options.force) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(
            chalk.yellow(`Delete session "${session.title ?? session.id}"? (y/N) `),
            resolve
          );
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
          console.log(chalk.gray("Cancelled."));
          return;
        }
      }

      await manager.deleteStored(session.id);
      console.log(chalk.green(`Deleted session: ${session.id}`));
    });

  sessionCmd
    .command("messages")
    .description("Show messages in a session")
    .argument("<id>", "Session ID (can be partial)")
    .option("-l, --limit <limit>", "Maximum number of messages")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      const manager = new SessionManager();
      const sessions = await manager.listStored({ limit: 100 });
      const session = sessions.find((s) => s.id.startsWith(id));

      if (!session) {
        console.error(chalk.red(`Session not found: ${id}`));
        process.exit(1);
      }

      const messages = await manager.getStoredMessages(session.id);
      const displayMessages = options.limit
        ? messages.slice(-parseInt(options.limit, 10))
        : messages;

      if (options.json) {
        console.log(JSON.stringify(displayMessages, null, 2));
        return;
      }

      console.log(chalk.cyan(`Messages in session ${session.id.slice(0, 8)}:\n`));

      for (const msg of displayMessages) {
        const roleColor = msg.role === "user" ? chalk.green : chalk.blue;
        const roleLabel = msg.role === "user" ? "You" : "Assistant";
        const timestamp = new Date(msg.createdAt).toLocaleTimeString();

        console.log(`${roleColor(roleLabel)} ${chalk.gray(`(${timestamp})`)}`);

        if (msg.content) {
          const content = msg.content.length > 500
            ? msg.content.slice(0, 500) + "..."
            : msg.content;
          console.log(content);
        }

        if (msg.toolCalls?.length) {
          for (const tc of msg.toolCalls) {
            console.log(chalk.yellow(`  [Tool: ${tc.name}]`));
          }
        }

        if (msg.toolResults?.length) {
          for (const tr of msg.toolResults) {
            const status = tr.isError ? chalk.red("error") : chalk.green("ok");
            console.log(chalk.gray(`  [Result: ${tr.name} - ${status}]`));
          }
        }

        console.log();
      }
    });
}

// Helper functions
function showSessionsSimple(sessions: StoredSession[], context: string) {
  console.log(chalk.cyan(`Found ${sessions.length} session(s) in ${context}:\n`));

  for (const session of sessions) {
    const title = session.title ?? "(untitled)";
    const date = session.updatedAt.toLocaleDateString();
    const time = session.updatedAt.toLocaleTimeString();
    console.log(`  ${chalk.white(session.id.slice(0, 8))}  ${chalk.green(title)}`);
    console.log(`    ${chalk.gray(`${session.provider}/${session.model} | ${session.messageCount} messages | ${date} ${time}`)}`);
    console.log(`    ${chalk.gray(session.workingDirectory)}\n`);
  }
}

async function showSessionsWithLess(sessions: StoredSession[], context: string) {
  const { spawn } = await import("child_process");
  
  let output = chalk.cyan(`Sessions in ${context} (${sessions.length} total):\n\n`);
  
  for (const session of sessions) {
    const title = session.title ?? "(untitled)";
    const date = session.updatedAt.toLocaleDateString();
    const time = session.updatedAt.toLocaleTimeString();
    output += `  ${chalk.white(session.id.slice(0, 8))}  ${chalk.green(title)}\n`;
    output += `    ${chalk.gray(`${session.provider}/${session.model} | ${session.messageCount} messages | ${date} ${time}`)}\n`;
    output += `    ${chalk.gray(session.workingDirectory)}\n\n`;
  }

  try {
    const less = spawn('less', ['-R', '-S', '-F', '-X'], {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    less.stdin.write(output);
    less.stdin.end();

    await new Promise<void>((resolve, reject) => {
      less.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`less exited with code ${code}`));
        }
      });
      less.on('error', reject);
    });
  } catch {
    console.log(output);
  }
}
