import { Command } from "commander";
import chalk from "chalk";

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

interface ProviderConfig {
  name: string;
  models: ModelInfo[];
}

// Hard-coded model configurations for the CLI
// In a full implementation, these would come from the providers package
const PROVIDER_MODELS: Record<string, ProviderConfig> = {
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Latest Claude model" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Previous generation" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Highest capability model" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fast and efficient" },
    ],
  },
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Multimodal flagship model" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Previous generation" },
    ],
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Latest Gemini model" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "High capability" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fast and efficient" },
    ],
  },
  openrouter: {
    name: "OpenRouter",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet via OpenRouter" },
      { id: "openai/gpt-4o", name: "GPT-4o via OpenRouter" },
    ],
  },
  groq: {
    name: "Groq",
    models: [
      { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", description: "Fast inference" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "MoE model" },
    ],
  },
  xai: {
    name: "xAI",
    models: [
      { id: "grok-2", name: "Grok 2", description: "Latest Grok model" },
      { id: "grok-beta", name: "Grok Beta", description: "Beta release" },
    ],
  },
};

export function registerModelsCommands(program: Command): void {
  const modelsCmd = program
    .command("models")
    .description("List and manage available models");

  modelsCmd
    .command("list")
    .description("List available models")
    .option("-p, --provider <provider>", "Filter by provider")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const providers = Object.entries(PROVIDER_MODELS);

      if (options.provider) {
        const config = PROVIDER_MODELS[options.provider as keyof typeof PROVIDER_MODELS];
        if (!config) {
          console.error(chalk.red(`Unknown provider: ${options.provider}`));
          console.log(chalk.gray(`Valid providers: ${Object.keys(PROVIDER_MODELS).join(", ")}`));
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify({ provider: options.provider, models: config.models }, null, 2));
          return;
        }

        console.log(chalk.cyan(`\n${config.name} Models:\n`));
        for (const model of config.models) {
          console.log(`  ${chalk.green(model.id)}`);
          console.log(`    ${chalk.white(model.name)}`);
          if (model.description) {
            console.log(`    ${chalk.gray(model.description)}`);
          }
          console.log();
        }
        return;
      }

      if (options.json) {
        const result = providers.map(([id, config]) => ({
          id,
          name: config.name,
          models: config.models,
        }));
        console.log(JSON.stringify({ providers: result }, null, 2));
        return;
      }

      console.log(chalk.cyan("\nAvailable Models by Provider:\n"));

      for (const [id, config] of providers) {
        console.log(chalk.white(`${config.name} (${id}):`));
        for (const model of config.models) {
          console.log(`  ${chalk.green(model.id)}`);
          if (model.description) {
            console.log(`    ${chalk.gray(model.description)}`);
          }
        }
        console.log();
      }

      console.log(chalk.gray("Use 'openmgr-agent models list --provider <name>' for details"));
    });

  modelsCmd
    .command("set")
    .description("Set the default model")
    .argument("<model>", "Model ID (e.g., claude-sonnet-4-20250514, gpt-4o)")
    .option("--provider <provider>", "Provider for the model")
    .option("--local", "Save to local project config")
    .action(async (model, _options) => {
      // Note: Full implementation would require config save functions
      console.log(chalk.yellow(`Setting model to ${model}`));
      console.log(chalk.gray("Note: Model saving requires full integration with @openmgr/agent-core config module."));
    });

  modelsCmd
    .command("current")
    .description("Show the current model configuration")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (_options) => {
      // Would load config and show current model
      console.log(chalk.gray("Use 'openmgr-agent config show' to see current configuration."));
    });
}
