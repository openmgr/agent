import { Command } from "commander";
import { startServer } from "../../server/index.js";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the HTTP server")
    .option("-p, --port <port>", "Port to listen on", "3000")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--provider <provider>", "LLM provider (anthropic|openai)")
    .option("--model <model>", "Model name")
    .action(async (options) => {
      await startServer({
        port: parseInt(options.port, 10),
        agentOptions: {
          workingDirectory: options.directory,
          provider: options.provider,
          model: options.model,
        },
      });
    });
}
