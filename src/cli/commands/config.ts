import { Command } from "commander";
import chalk from "chalk";
import {
  loadConfig,
  loadGlobalConfig,
  saveGlobalConfig,
  setApiKey,
  setAuthType,
  getGlobalConfigPath,
  getLocalConfigPath,
} from "../../config.js";
import { isLoggedIn } from "../../auth/index.js";

export function registerConfigCommands(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Manage configuration");

  configCmd
    .command("show")
    .description("Show current configuration")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (options) => {
      const config = await loadConfig(options.directory);
      const loggedIn = config.auth.type === "oauth" ? await isLoggedIn() : false;

      console.log(chalk.cyan("Current configuration:\n"));
      console.log(`  Provider:  ${chalk.white(config.provider)}`);
      console.log(`  Model:     ${chalk.white(config.model)}`);
      console.log(`  Auth type: ${chalk.white(config.auth.type)}`);
      if (config.auth.type === "oauth") {
        console.log(`  OAuth:     ${loggedIn ? chalk.green("logged in") : chalk.red("not logged in")}`);
      } else {
        console.log(`  API Key:   ${config.auth.apiKey ? chalk.green("configured") : chalk.red("not set")}`);
      }
      if (config.systemPrompt) {
        console.log(`  System:    ${chalk.gray(config.systemPrompt.slice(0, 50))}...`);
      }
      console.log();
      console.log(chalk.gray(`Global config: ${getGlobalConfigPath()}`));
      console.log(chalk.gray(`Local config:  ${getLocalConfigPath(options.directory)}`));
    });

  configCmd
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Config key (provider, model, auth-type)")
    .argument("<value>", "Config value")
    .option("--global", "Save to global config (default)")
    .option("--local", "Save to local project config")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (key, value, options) => {
      const validKeys = ["provider", "model", "auth-type"];
      if (!validKeys.includes(key)) {
        console.error(chalk.red(`Invalid key: ${key}. Valid keys: ${validKeys.join(", ")}`));
        process.exit(1);
      }

      if (key === "provider" && !["anthropic", "openai"].includes(value)) {
        console.error(chalk.red(`Invalid provider: ${value}. Valid: anthropic, openai`));
        process.exit(1);
      }

      if (key === "auth-type") {
        if (!["oauth", "api-key"].includes(value)) {
          console.error(chalk.red(`Invalid auth-type: ${value}. Valid: oauth, api-key`));
          process.exit(1);
        }
        const scope = options.local ? "local" : "global";
        await setAuthType("anthropic", value as "oauth" | "api-key", scope, options.directory);
        console.log(chalk.green(`Set auth-type=${value} in ${scope} config`));
        return;
      }

      const config: Record<string, string> = { [key]: value };

      if (options.local) {
        const { saveLocalConfig } = await import("../../config.js");
        await saveLocalConfig(options.directory, config);
        console.log(chalk.green(`Set ${key}=${value} in local config`));
      } else {
        await saveGlobalConfig(config);
        console.log(chalk.green(`Set ${key}=${value} in global config`));
      }
    });

  configCmd
    .command("set-key")
    .description("Set an API key (also sets auth-type to api-key)")
    .argument("<provider>", "Provider (anthropic, openai)")
    .argument("<key>", "API key value")
    .option("--local", "Save to local project config")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (provider, key, options) => {
      if (!["anthropic", "openai"].includes(provider)) {
        console.error(chalk.red(`Invalid provider: ${provider}. Valid: anthropic, openai`));
        process.exit(1);
      }

      const scope = options.local ? "local" : "global";
      await setApiKey(provider as "anthropic" | "openai", key, scope, options.directory);
      console.log(chalk.green(`Set ${provider} API key in ${scope} config (auth-type: api-key)`));
    });

  configCmd
    .command("path")
    .description("Show config file paths")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action((options) => {
      console.log(`Global: ${getGlobalConfigPath()}`);
      console.log(`Local:  ${getLocalConfigPath(options.directory)}`);
    });
}
