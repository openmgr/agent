import { Command } from "commander";
import chalk from "chalk";
import * as readline from "readline";
import { SessionManager } from "../../session/index.js";
import { loadGlobalConfig } from "../../config.js";
import type { AgentEvent } from "../../types.js";
import { Spinner, debug } from "../utils.js";

export function registerReplCommand(program: Command): void {
  program
    .command("repl")
    .description("Start an interactive REPL session")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--provider <provider>", "LLM provider (anthropic|openai)")
    .option("--model <model>", "Model name")
    .option("-s, --session <id>", "Resume an existing session")
    .option("--debug", "Enable debug logging")
    .action(async (options) => {
      debug.setEnabled(!!options.debug);
      debug.log("init", "Starting REPL", { options });

      const sessionManager = new SessionManager({
        agentOptions: {
          workingDirectory: options.directory,
          provider: options.provider,
          model: options.model,
        },
        enablePersistence: true,
      });

      let sessionId: string;
      let isNewSession = false;

      if (options.session) {
        debug.log("session", "Resuming session", options.session);
        const sessions = await sessionManager.listStored({ limit: 100 });
        const matchingSession = sessions.find((s) => s.id.startsWith(options.session));
        if (!matchingSession) {
          console.error(chalk.red(`Session not found: ${options.session}`));
          process.exit(1);
        }
        const restored = await sessionManager.restore(matchingSession.id);
        if (!restored) {
          console.error(chalk.red(`Failed to restore session: ${matchingSession.id}`));
          process.exit(1);
        }
        sessionId = matchingSession.id;
        console.log(chalk.gray(`Resumed session: ${sessionId}`));
      } else {
        debug.log("session", "Creating new session");
        const session = await sessionManager.create({
          workingDirectory: options.directory,
        });
        sessionId = session.id;
        isNewSession = true;
        debug.log("session", "Session created", sessionId);
      }

      const state = sessionManager.getState(sessionId);
      if (!state) {
        console.error(chalk.red("Failed to initialize session"));
        process.exit(1);
      }

      const agent = state.agent;
      const config = agent.getConfig();
      debug.log("config", "Agent configuration", config);

      console.log(chalk.cyan("OpenMgr Agent REPL"));
      console.log(chalk.gray(`Session: ${sessionId}`));
      console.log(chalk.gray(`Working directory: ${config.workingDirectory}`));
      console.log(chalk.gray(`Provider: ${config.provider} (${config.model})`));
      console.log(chalk.gray(`Auth: ${config.auth.type}`));
      if (!isNewSession) {
        const messages = agent.getMessages();
        console.log(chalk.gray(`Messages: ${messages.length}`));
      }
      if (options.debug) {
        console.log(chalk.magenta(`Debug mode enabled`));
      }
      console.log(chalk.gray('Type /help for commands, /exit to quit\n'));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const handleSlashCommand = async (input: string): Promise<boolean> => {
        const parts = input.slice(1).split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(" ");

        if (command === "exit" || command === "quit") {
          console.log(chalk.gray("Goodbye!"));
          rl.close();
          process.exit(0);
        }

        if (command === "clear") {
          agent.clearMessages();
          console.log(chalk.gray("Conversation cleared.\n"));
          return true;
        }

        if (command === "help") {
          console.log(chalk.cyan("\nAvailable commands:\n"));
          console.log(chalk.white("  /models [provider|all]") + chalk.gray(" - List available models"));
          console.log(chalk.white("  /model [model-id]") + chalk.gray("      - Show or set the current model"));
          console.log(chalk.white("  /session") + chalk.gray("               - Show current session ID"));
          console.log(chalk.white("  /clear") + chalk.gray("                 - Clear conversation history"));
          console.log(chalk.white("  /exit") + chalk.gray("                  - Exit the REPL"));
          console.log(chalk.white("  /help") + chalk.gray("                  - Show this help message"));
          console.log();
          return true;
        }

        if (command === "models") {
          const { PROVIDER_MODELS, getProviderModels, getConfiguredProviders, hasProviderCredentials } = await import("../../llm/models.js");
          const { loadCachedModels } = await import("../../llm/model-fetcher.js");
          
          const showAll = args === "all";
          const specificProvider = args && args !== "all" ? args : null;
          const cachedModels = await loadCachedModels();

          const getModelsForProvider = (providerId: string) => {
            if (cachedModels?.providers[providerId]) {
              return cachedModels.providers[providerId];
            }
            return getProviderModels(providerId);
          };

          if (specificProvider) {
            const models = getModelsForProvider(specificProvider);
            if (models.length === 0) {
              console.log(chalk.red(`\nUnknown provider: ${specificProvider}`));
              console.log(chalk.gray(`Valid providers: ${PROVIDER_MODELS.map(p => p.id).join(", ")}\n`));
              return true;
            }
            const provider = PROVIDER_MODELS.find(p => p.id === specificProvider)!;
            const isConfigured = hasProviderCredentials(specificProvider);
            const isCached = !!cachedModels?.providers[specificProvider];
            const status = isConfigured ? chalk.green(" [configured]") : chalk.yellow(" [not configured]");
            const cacheStatus = isCached ? chalk.blue(" [cached]") : "";
            console.log(chalk.cyan(`\n${provider.name} Models${status}${cacheStatus}:\n`));
            for (const model of models) {
              console.log(`  ${chalk.green(model.id)} - ${model.name}`);
            }
            console.log();
          } else {
            const apiKeys = (await loadGlobalConfig())?.apiKeys;
            const providers = showAll ? PROVIDER_MODELS : getConfiguredProviders(apiKeys);
            
            if (providers.length === 0) {
              console.log(chalk.yellow("\nNo providers configured."));
              console.log(chalk.gray("Use /models all to see all available providers.\n"));
            } else {
              const title = showAll ? "All Available Models" : "Configured Models";
              console.log(chalk.cyan(`\n${title}:\n`));
              for (const provider of providers) {
                const isConfigured = hasProviderCredentials(provider.id, apiKeys);
                const isCached = !!cachedModels?.providers[provider.id];
                const status = showAll ? (isConfigured ? chalk.green(" [configured]") : chalk.gray(" [not configured]")) : "";
                const cacheStatus = isCached ? chalk.blue(" [cached]") : "";
                console.log(chalk.white(`${provider.name}${status}${cacheStatus}:`));
                const models = getModelsForProvider(provider.id);
                for (const model of models) {
                  console.log(`  ${chalk.green(model.id)}`);
                }
                console.log();
              }
            }
          }
          console.log(chalk.gray("Use /model <model-id> to set the model for this session.\n"));
          return true;
        }

        if (command === "model") {
          const { findModel, PROVIDER_MODELS } = await import("../../llm/models.js");
          const { loadCachedModels } = await import("../../llm/model-fetcher.js");
          
          if (!args) {
            const currentConfig = agent.getConfig();
            console.log(chalk.cyan(`\nCurrent model: ${chalk.white(currentConfig.model)}`));
            console.log(chalk.gray(`Provider: ${currentConfig.provider}\n`));
            console.log(chalk.gray("Use /model <model-id> to change the model.\n"));
            return true;
          }

          let found = findModel(args);
          
          if (!found) {
            const cachedModels = await loadCachedModels();
            if (cachedModels) {
              for (const [providerId, models] of Object.entries(cachedModels.providers)) {
                const model = models.find(m => m.id === args);
                if (model) {
                  found = { provider: providerId, model };
                  break;
                }
              }
            }
          }

          if (!found) {
            console.log(chalk.red(`\nUnknown model: ${args}`));
            console.log(chalk.gray("Use /models to list available models.\n"));
            return true;
          }

          await sessionManager.updateSessionModel(sessionId, found.provider, found.model.id);
          console.log(chalk.green(`\nModel set to ${chalk.white(found.model.name)} (${found.model.id})`));
          console.log(chalk.gray(`Provider: ${found.provider}\n`));
          return true;
        }

        if (command === "session") {
          console.log(chalk.cyan(`\nSession ID: ${chalk.white(sessionId)}`));
          console.log(chalk.gray(`Use this ID with --session to resume later.\n`));
          return true;
        }

        console.log(chalk.red(`\nUnknown command: /${command}`));
        console.log(chalk.gray("Type /help for available commands.\n"));
        return true;
      };

      const promptUser = () => {
        rl.question(chalk.green("You: "), async (input) => {
          const trimmed = input.trim();

          if (!trimmed) {
            promptUser();
            return;
          }

          if (trimmed.startsWith("/")) {
            await handleSlashCommand(trimmed);
            promptUser();
            return;
          }

          if (trimmed.toLowerCase() === "exit") {
            console.log(chalk.gray("Goodbye!"));
            rl.close();
            process.exit(0);
          }

          if (trimmed.toLowerCase() === "clear") {
            agent.clearMessages();
            console.log(chalk.gray("Conversation cleared.\n"));
            promptUser();
            return;
          }

          debug.log("prompt", "Sending prompt", trimmed);

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
                  process.stdout.write(chalk.blue("Assistant: "));
                }
                break;
              case "message.delta":
                if (!streamStarted) {
                  spinner.stop();
                  streamStarted = true;
                  process.stdout.write(chalk.blue("Assistant: "));
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
              case "tool.complete":
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
              case "error":
                debug.log("error", "Agent error", event.error);
                break;
            }
          };

          try {
            const startTime = Date.now();
            await sessionManager.prompt(sessionId, trimmed, onEvent);
            spinner.stop();
            debug.log("prompt", `Completed in ${Date.now() - startTime}ms`);
            console.log("\n");
          } catch (err) {
            spinner.stop();
            debug.log("error", "Prompt error", (err as Error).message);
            console.log(chalk.red(`\nError: ${(err as Error).message}\n`));
          }

          promptUser();
        });
      };

      promptUser();
    });
}
