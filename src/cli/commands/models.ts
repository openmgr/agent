import { Command } from "commander";
import chalk from "chalk";
import { loadConfig, saveGlobalConfig } from "../../config.js";

export function registerModelsCommands(program: Command): void {
  const modelsCmd = program
    .command("models")
    .description("List and manage available models");

  modelsCmd
    .command("list")
    .description("List available models (only configured providers by default)")
    .option("-p, --provider <provider>", "Filter by provider (anthropic, openai, google, openrouter, groq, xai)")
    .option("-a, --all", "Show all providers, including unconfigured ones")
    .option("-c, --cached", "Show cached models from last refresh (if available)")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const { PROVIDER_MODELS, getProviderModels, getConfiguredProviders, hasProviderCredentials } = await import("../../llm/models.js");
      const { loadGlobalConfig, loadLocalConfig } = await import("../../config.js");
      const { loadCachedModels, getCacheAge } = await import("../../llm/model-fetcher.js");

      const globalConfig = await loadGlobalConfig();
      const localConfig = await loadLocalConfig(options.directory);
      const apiKeys = { ...globalConfig?.apiKeys, ...localConfig?.apiKeys };

      const cachedModels = options.cached ? await loadCachedModels() : null;
      const cacheAge = cachedModels ? await getCacheAge() : null;

      const getModelsForProvider = (providerId: string) => {
        if (cachedModels?.providers[providerId]) {
          return cachedModels.providers[providerId];
        }
        return getProviderModels(providerId);
      };

      if (options.provider) {
        const models = getModelsForProvider(options.provider);
        if (models.length === 0) {
          console.error(chalk.red(`Unknown provider: ${options.provider}`));
          console.log(chalk.gray(`Valid providers: ${PROVIDER_MODELS.map(p => p.id).join(", ")}`));
          process.exit(1);
        }

        const isConfigured = hasProviderCredentials(options.provider, apiKeys);
        const isCached = !!cachedModels?.providers[options.provider];

        if (options.json) {
          console.log(JSON.stringify({ provider: options.provider, models, configured: isConfigured, cached: isCached }, null, 2));
          return;
        }

        const provider = PROVIDER_MODELS.find(p => p.id === options.provider)!;
        const statusBadge = isConfigured ? chalk.green(" [configured]") : chalk.yellow(" [not configured]");
        const cacheBadge = isCached ? chalk.blue(" [cached]") : "";
        console.log(chalk.cyan(`\n${provider.name} Models${statusBadge}${cacheBadge}:\n`));
        for (const model of models) {
          console.log(`  ${chalk.white(model.id)}`);
          console.log(`    ${chalk.green(model.name)}`);
          if (model.description) {
            console.log(`    ${chalk.gray(model.description)}`);
          }
          if (model.contextWindow) {
            console.log(`    ${chalk.gray(`Context: ${(model.contextWindow / 1000).toFixed(0)}K tokens`)}`);
          }
          console.log();
        }
        return;
      }

      let providers = options.all ? PROVIDER_MODELS : getConfiguredProviders(apiKeys);

      if (providers.length === 0) {
        console.log(chalk.yellow("\nNo providers configured."));
        console.log(chalk.gray("\nSet up credentials using environment variables or config:"));
        console.log(chalk.gray("  ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, etc."));
        console.log(chalk.gray("  Or: openmgr-agent config set-key <provider> <key>"));
        console.log(chalk.gray("\nUse --all to see all available providers."));
        return;
      }

      if (options.json) {
        const result = providers.map(p => ({
          ...p,
          models: getModelsForProvider(p.id),
          configured: hasProviderCredentials(p.id, apiKeys),
          cached: !!cachedModels?.providers[p.id],
        }));
        console.log(JSON.stringify({ providers: result }, null, 2));
        return;
      }

      const title = options.all ? "All Available Models" : "Configured Models";
      console.log(chalk.cyan(`\n${title} by Provider:\n`));

      if (cacheAge !== null) {
        const hours = Math.floor(cacheAge / (1000 * 60 * 60));
        const mins = Math.floor((cacheAge % (1000 * 60 * 60)) / (1000 * 60));
        const ageStr = hours > 0 ? `${hours}h ${mins}m ago` : `${mins}m ago`;
        console.log(chalk.gray(`(Using cached models from ${ageStr})\n`));
      }

      for (const provider of providers) {
        const isConfigured = hasProviderCredentials(provider.id, apiKeys);
        const isCached = !!cachedModels?.providers[provider.id];
        const statusBadge = isConfigured ? chalk.green(" [configured]") : chalk.gray(" [not configured]");
        const cacheBadge = isCached ? chalk.blue(" [cached]") : "";
        console.log(chalk.white(`${provider.name} (${provider.id})${options.all ? statusBadge : ""}${cacheBadge}:`));
        const models = getModelsForProvider(provider.id);
        for (const model of models) {
          console.log(`  ${chalk.green(model.id)}`);
          if (model.description) {
            console.log(`    ${chalk.gray(model.description)}`);
          }
        }
        console.log();
      }

      console.log(chalk.gray("Use 'openmgr-agent models set <model>' to set your default model"));
      if (!options.all) {
        console.log(chalk.gray("Use 'openmgr-agent models list --all' to see all providers"));
      }
      if (!options.cached) {
        console.log(chalk.gray("Use 'openmgr-agent models refresh' to fetch latest models from providers"));
      }
    });

  modelsCmd
    .command("set")
    .description("Set the default model")
    .argument("<model>", "Model ID (e.g., claude-sonnet-4-20250514, gpt-4o)")
    .option("--provider <provider>", "Provider for the model (auto-detected if not specified)")
    .option("--local", "Save to local project config")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (model, options) => {
      const { findModel, PROVIDER_MODELS } = await import("../../llm/models.js");

      let provider = options.provider;

      if (!provider) {
        const found = findModel(model);
        if (found) {
          provider = found.provider;
        } else {
          console.error(chalk.red(`Unknown model: ${model}`));
          console.log(chalk.gray("\nAvailable models:"));
          for (const p of PROVIDER_MODELS) {
            console.log(`  ${chalk.white(p.name)}: ${p.models.map(m => m.id).join(", ")}`);
          }
          process.exit(1);
        }
      }

      const validProviders = ["anthropic", "openai", "google", "openrouter", "groq", "xai"];
      if (!validProviders.includes(provider)) {
        console.error(chalk.red(`Invalid provider: ${provider}. Valid: ${validProviders.join(", ")}`));
        process.exit(1);
      }

      const config = { provider: provider as "anthropic" | "openai" | "google" | "openrouter" | "groq" | "xai", model };

      if (options.local) {
        const { saveLocalConfig } = await import("../../config.js");
        await saveLocalConfig(options.directory, config);
        console.log(chalk.green(`Set model to ${model} (provider: ${provider}) in local config`));
      } else {
        await saveGlobalConfig(config);
        console.log(chalk.green(`Set model to ${model} (provider: ${provider}) in global config`));
      }
    });

  modelsCmd
    .command("current")
    .description("Show the current model configuration")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (options) => {
      const config = await loadConfig(options.directory);
      const { findModel, getDefaultModel } = await import("../../llm/models.js");

      console.log(chalk.cyan("\nCurrent Model Configuration:\n"));
      console.log(`  Provider: ${chalk.white(config.provider)}`);
      console.log(`  Model:    ${chalk.white(config.model)}`);

      const modelInfo = findModel(config.model);
      if (modelInfo) {
        console.log(`  Name:     ${chalk.green(modelInfo.model.name)}`);
        if (modelInfo.model.description) {
          console.log(`  Info:     ${chalk.gray(modelInfo.model.description)}`);
        }
      }

      const defaultModel = getDefaultModel(config.provider);
      if (config.model === defaultModel) {
        console.log(chalk.gray("\n  (This is the default model for this provider)"));
      }
    });

  modelsCmd
    .command("refresh")
    .description("Fetch latest models from providers (requires API credentials)")
    .option("-p, --provider <provider>", "Only refresh specific provider (anthropic)")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (options) => {
      const { fetchAnthropicModels, saveCachedModels, loadCachedModels, getCacheFilePath } = await import("../../llm/model-fetcher.js");
      const { loadGlobalConfig, loadLocalConfig } = await import("../../config.js");

      const globalConfig = await loadGlobalConfig();
      const localConfig = await loadLocalConfig(options.directory);
      const apiKeys = { ...globalConfig?.apiKeys, ...localConfig?.apiKeys };

      const existingCache = await loadCachedModels();
      const providers: Record<string, Array<{ id: string; name: string; description?: string; contextWindow?: number; maxOutput?: number }>> = 
        existingCache?.providers ?? {};

      console.log(chalk.cyan("Fetching latest models...\n"));

      if (!options.provider || options.provider === "anthropic") {
        const anthropicApiKey = typeof apiKeys?.anthropic === "string" 
          ? apiKeys.anthropic 
          : apiKeys?.anthropic?.apiKey;
        const hasAnthropicKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;

        if (hasAnthropicKey) {
          try {
            console.log(chalk.gray("Fetching Anthropic models..."));
            const models = await fetchAnthropicModels({ apiKey: anthropicApiKey || process.env.ANTHROPIC_API_KEY! });
            providers["anthropic"] = models;
            console.log(chalk.green(`  ✓ Found ${models.length} Anthropic models`));
          } catch (err) {
            console.log(chalk.yellow(`  ✗ Failed to fetch Anthropic models: ${(err as Error).message}`));
          }
        } else {
          console.log(chalk.gray("  Skipping Anthropic (no API key)"));
        }
      }

      await saveCachedModels(providers);
      console.log(chalk.green(`\nModels cached to ${getCacheFilePath()}`));
    });
}
