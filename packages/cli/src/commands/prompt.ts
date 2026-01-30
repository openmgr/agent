import type { Command } from "commander";
import chalk from "chalk";
import { Agent } from "@openmgr/agent-core";
import type { AgentEvent } from "@openmgr/agent-core";
import { Spinner, debug } from "../utils.js";

export function registerPromptCommand(program: Command): void {
  program
    .command("prompt")
    .description("Send a single prompt and exit")
    .argument("<message>", "The prompt message")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--provider <provider>", "LLM provider (anthropic|openai)")
    .option("--model <model>", "Model name")
    .option("--json", "Output as JSON")
    .option("--debug", "Enable debug logging")
    .action(async (message, options) => {
      debug.setEnabled(!!options.debug);
      debug.log("init", "Starting prompt command", { message, options });

      debug.log("agent", "Creating agent...");
      const agent = await Agent.create({
        workingDirectory: options.directory,
        provider: options.provider,
        model: options.model,
      });
      debug.log("agent", "Agent created");
      debug.log("config", "Agent configuration", agent.getConfig());

      if (!options.json) {
        const spinner = new Spinner("Thinking");
        spinner.start();
        let streamStarted = false;

        const onEvent = (event: AgentEvent) => {
          debug.log("event", event.type, event);

          switch (event.type) {
            case "message.start":
              if (!streamStarted) {
                spinner.stop();
                streamStarted = true;
              }
              break;
            case "message.delta":
              if (!streamStarted) {
                spinner.stop();
                streamStarted = true;
              }
              process.stdout.write(event.delta);
              break;
            case "tool.start":
              spinner.stop();
              streamStarted = false;
              process.stdout.write(
                chalk.yellow(`\n[Calling ${event.toolCall.name}...]\n`)
              );
              debug.log("tool", `Tool arguments for ${event.toolCall.name}`, event.toolCall.arguments);
              spinner.update(`Running ${event.toolCall.name}`);
              spinner.start();
              break;
            case "tool.complete": {
              spinner.stop();
              const preview = String(event.toolResult.result).slice(0, 200);
              const truncated =
                String(event.toolResult.result).length > 200 ? "..." : "";
              process.stdout.write(
                chalk.gray(`[${event.toolResult.name} result: ${preview}${truncated}]\n`)
              );
              spinner.update("Thinking");
              spinner.start();
              break;
            }
            case "error":
              debug.log("error", "Agent error", event.error);
              break;
          }
        };

        agent.on("event", onEvent);

        try {
          const startTime = Date.now();
          await agent.prompt(message);
          spinner.stop();
          debug.log("prompt", `Completed in ${Date.now() - startTime}ms`);
          console.log("\n");
        } catch (err) {
          spinner.stop();
          debug.log("error", "Prompt error", (err as Error).message);
          console.error(chalk.red(`Error: ${(err as Error).message}`));
          process.exit(1);
        }
      } else {
        // JSON output mode
        try {
          const response = await agent.prompt(message);
          console.log(JSON.stringify({
            content: response.content,
            toolCalls: response.toolCalls,
          }, null, 2));
        } catch (err) {
          console.error(JSON.stringify({
            error: (err as Error).message,
          }));
          process.exit(1);
        }
      }
    });
}
