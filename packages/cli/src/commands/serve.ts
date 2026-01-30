import type { Command } from "commander";
import chalk from "chalk";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the HTTP server")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--provider <provider>", "LLM provider (anthropic|openai)")
    .option("--model <model>", "Model name")
    .action(async (options) => {
      // Dynamic imports to avoid loading heavy modules unless needed
      const { createServer, startServer } = await import("@openmgr/agent-server");
      const { Agent } = await import("@openmgr/agent-core");

      const agent = await Agent.create({
        workingDirectory: options.directory,
        provider: options.provider,
        model: options.model,
      });

      const app = createServer({ agent });
      
      const { port, hostname } = await startServer(app, {
        port: parseInt(options.port, 10),
        hostname: "localhost",
      });

      console.log(chalk.cyan(`Server listening on http://${hostname}:${port}`));
      console.log(chalk.gray(`Provider: ${options.provider ?? "default"}`));
      console.log(chalk.gray(`Model: ${options.model ?? "default"}`));
      console.log(chalk.gray("\nPress Ctrl+C to stop"));
    });
}
