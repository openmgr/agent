import { Command } from "commander";
import chalk from "chalk";
import { loadConfig } from "../../config.js";

export function registerMcpCommands(program: Command): void {
  const mcpCmd = program
    .command("mcp")
    .description("MCP server management");

  mcpCmd
    .command("list")
    .description("List configured MCP servers")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const config = await loadConfig(options.directory);

      if (!config.mcp || Object.keys(config.mcp).length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ servers: [] }, null, 2));
        } else {
          console.log(chalk.gray("No MCP servers configured."));
        }
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({ servers: Object.entries(config.mcp).map(([name, cfg]) => ({ name, ...cfg })) }, null, 2));
        return;
      }

      console.log(chalk.cyan(`Configured MCP servers:\n`));
      for (const [name, serverConfig] of Object.entries(config.mcp)) {
        const transport = serverConfig.transport ?? "stdio";
        console.log(`  ${chalk.white(name)}`);
        console.log(`    Transport: ${chalk.gray(transport)}`);
        if (transport === "stdio" && "command" in serverConfig) {
          console.log(`    Command:   ${chalk.gray(serverConfig.command)}`);
          if (serverConfig.args?.length) {
            console.log(`    Args:      ${chalk.gray(serverConfig.args.join(" "))}`);
          }
        } else if (transport === "sse" && "url" in serverConfig) {
          console.log(`    URL:       ${chalk.gray(serverConfig.url)}`);
        }
        console.log();
      }
    });

  mcpCmd
    .command("status")
    .description("Show status of MCP servers (connect and list tools)")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const { McpManager } = await import("../../mcp/manager.js");
      const config = await loadConfig(options.directory);

      if (!config.mcp || Object.keys(config.mcp).length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ servers: [] }, null, 2));
        } else {
          console.log(chalk.gray("No MCP servers configured."));
        }
        return;
      }

      const manager = new McpManager();

      console.log(chalk.cyan("Connecting to MCP servers...\n"));

      for (const [name, serverConfig] of Object.entries(config.mcp)) {
        try {
          process.stdout.write(`  ${name}: `);
          await manager.addServer(name, serverConfig);
          console.log(chalk.green("connected"));
        } catch (err) {
          console.log(chalk.red(`failed - ${(err as Error).message}`));
        }
      }

      const servers = manager.getServers();

      if (options.json) {
        console.log(JSON.stringify({ servers }, null, 2));
        await manager.shutdown();
        return;
      }

      console.log(chalk.cyan("\nServer Status:\n"));

      for (const server of servers) {
        const status = server.connected ? chalk.green("connected") : chalk.red("disconnected");
        console.log(`  ${chalk.white(server.name)}: ${status}`);
        console.log(`    Transport: ${chalk.gray(server.transport)}`);
        console.log(`    Tools:     ${chalk.gray(server.toolCount)}`);
        console.log();
      }

      await manager.shutdown();
    });

  mcpCmd
    .command("tools")
    .description("List all tools from configured MCP servers")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("-s, --server <name>", "Filter by server name")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const { McpManager } = await import("../../mcp/manager.js");
      const config = await loadConfig(options.directory);

      if (!config.mcp || Object.keys(config.mcp).length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ tools: [] }, null, 2));
        } else {
          console.log(chalk.gray("No MCP servers configured."));
        }
        return;
      }

      const manager = new McpManager();
      await manager.loadFromConfig(config.mcp);

      let tools = manager.getTools();
      if (options.server) {
        tools = tools.filter((t) => t.serverName === options.server);
      }

      if (options.json) {
        console.log(JSON.stringify({ tools }, null, 2));
        await manager.shutdown();
        return;
      }

      if (tools.length === 0) {
        console.log(chalk.gray("No tools available."));
        await manager.shutdown();
        return;
      }

      console.log(chalk.cyan(`Available MCP tools (${tools.length}):\n`));

      const byServer = new Map<string, typeof tools>();
      for (const tool of tools) {
        const existing = byServer.get(tool.serverName) ?? [];
        existing.push(tool);
        byServer.set(tool.serverName, existing);
      }

      for (const [serverName, serverTools] of byServer) {
        console.log(`  ${chalk.white(serverName)}:`);
        for (const tool of serverTools) {
          console.log(`    ${chalk.green(tool.name)}`);
          if (tool.description) {
            const desc = tool.description.length > 60
              ? tool.description.slice(0, 60) + "..."
              : tool.description;
            console.log(`      ${chalk.gray(desc)}`);
          }
        }
        console.log();
      }

      await manager.shutdown();
    });

  mcpCmd
    .command("test")
    .description("Test connection to an MCP server")
    .argument("<name>", "Server name from config")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .action(async (name, options) => {
      const { McpManager } = await import("../../mcp/manager.js");
      const config = await loadConfig(options.directory);

      if (!config.mcp || !config.mcp[name]) {
        console.error(chalk.red(`MCP server not found in config: ${name}`));
        process.exit(1);
      }

      const manager = new McpManager();
      console.log(chalk.cyan(`Testing connection to ${name}...`));

      try {
        await manager.addServer(name, config.mcp[name]);
        const servers = manager.getServers();
        const server = servers.find((s) => s.name === name);

        if (server?.connected) {
          console.log(chalk.green(`\nSuccess! Connected to ${name}`));
          console.log(`  Transport: ${chalk.gray(server.transport)}`);
          console.log(`  Tools:     ${chalk.gray(server.toolCount)}`);

          const tools = manager.getTools().filter((t) => t.serverName === name);
          if (tools.length > 0) {
            console.log(`\n  Available tools:`);
            for (const tool of tools.slice(0, 10)) {
              console.log(`    - ${chalk.green(tool.name)}`);
            }
            if (tools.length > 10) {
              console.log(`    ... and ${tools.length - 10} more`);
            }
          }
        } else {
          console.log(chalk.red(`Failed to connect to ${name}`));
        }
      } catch (err) {
        console.error(chalk.red(`Connection failed: ${(err as Error).message}`));
        process.exit(1);
      } finally {
        await manager.shutdown();
      }
    });

  // --- Resources commands ---

  mcpCmd
    .command("resources")
    .description("List all resources from configured MCP servers")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("-s, --server <name>", "Filter by server name")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const { McpManager } = await import("../../mcp/manager.js");
      const config = await loadConfig(options.directory);

      if (!config.mcp || Object.keys(config.mcp).length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ resources: [] }, null, 2));
        } else {
          console.log(chalk.gray("No MCP servers configured."));
        }
        return;
      }

      const manager = new McpManager();
      await manager.loadFromConfig(config.mcp);

      let resources = manager.getResources();
      if (options.server) {
        resources = resources.filter((r) => r.serverName === options.server);
      }

      if (options.json) {
        console.log(JSON.stringify({ resources }, null, 2));
        await manager.shutdown();
        return;
      }

      if (resources.length === 0) {
        console.log(chalk.gray("No resources available."));
        await manager.shutdown();
        return;
      }

      console.log(chalk.cyan(`Available MCP resources (${resources.length}):\n`));

      const byServer = new Map<string, typeof resources>();
      for (const resource of resources) {
        const existing = byServer.get(resource.serverName) ?? [];
        existing.push(resource);
        byServer.set(resource.serverName, existing);
      }

      for (const [serverName, serverResources] of byServer) {
        console.log(`  ${chalk.white(serverName)}:`);
        for (const resource of serverResources) {
          console.log(`    ${chalk.green(resource.name)}`);
          console.log(`      URI: ${chalk.gray(`mcp://${serverName}/${resource.uri}`)}`);
          if (resource.description) {
            console.log(`      ${chalk.gray(resource.description)}`);
          }
          if (resource.mimeType) {
            console.log(`      Type: ${chalk.gray(resource.mimeType)}`);
          }
        }
        console.log();
      }

      await manager.shutdown();
    });

  mcpCmd
    .command("read-resource")
    .description("Read content from an MCP resource")
    .argument("<uri>", "Resource URI (e.g., mcp://server-name/resource-uri)")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("--json", "Output as JSON")
    .action(async (uri, options) => {
      const { McpManager } = await import("../../mcp/manager.js");
      const config = await loadConfig(options.directory);

      if (!config.mcp || Object.keys(config.mcp).length === 0) {
        console.error(chalk.red("No MCP servers configured."));
        process.exit(1);
      }

      const manager = new McpManager();
      await manager.loadFromConfig(config.mcp);

      try {
        const content = await manager.readResource(uri);
        const resource = manager.getResource(uri);

        if (options.json) {
          console.log(JSON.stringify({ 
            uri, 
            content,
            name: resource?.name,
            mimeType: resource?.mimeType,
          }, null, 2));
        } else {
          if (resource) {
            console.log(chalk.cyan(`Resource: ${resource.name}`));
            if (resource.mimeType) {
              console.log(chalk.gray(`Type: ${resource.mimeType}`));
            }
            console.log();
          }
          console.log(content);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      } finally {
        await manager.shutdown();
      }
    });

  // --- Prompts commands ---

  mcpCmd
    .command("prompts")
    .description("List all prompts from configured MCP servers")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("-s, --server <name>", "Filter by server name")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const { McpManager } = await import("../../mcp/manager.js");
      const config = await loadConfig(options.directory);

      if (!config.mcp || Object.keys(config.mcp).length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ prompts: [] }, null, 2));
        } else {
          console.log(chalk.gray("No MCP servers configured."));
        }
        return;
      }

      const manager = new McpManager();
      await manager.loadFromConfig(config.mcp);

      let prompts = manager.getPrompts();
      if (options.server) {
        prompts = prompts.filter((p) => p.serverName === options.server);
      }

      if (options.json) {
        console.log(JSON.stringify({ prompts }, null, 2));
        await manager.shutdown();
        return;
      }

      if (prompts.length === 0) {
        console.log(chalk.gray("No prompts available."));
        await manager.shutdown();
        return;
      }

      console.log(chalk.cyan(`Available MCP prompts (${prompts.length}):\n`));

      const byServer = new Map<string, typeof prompts>();
      for (const prompt of prompts) {
        const existing = byServer.get(prompt.serverName) ?? [];
        existing.push(prompt);
        byServer.set(prompt.serverName, existing);
      }

      for (const [serverName, serverPrompts] of byServer) {
        console.log(`  ${chalk.white(serverName)}:`);
        for (const prompt of serverPrompts) {
          console.log(`    ${chalk.green(prompt.name)}`);
          if (prompt.description) {
            console.log(`      ${chalk.gray(prompt.description)}`);
          }
          if (prompt.arguments && prompt.arguments.length > 0) {
            console.log(`      Arguments:`);
            for (const arg of prompt.arguments) {
              const required = arg.required ? chalk.red("*") : "";
              console.log(`        - ${arg.name}${required}${arg.description ? `: ${chalk.gray(arg.description)}` : ""}`);
            }
          }
        }
        console.log();
      }

      await manager.shutdown();
    });

  mcpCmd
    .command("invoke-prompt")
    .description("Invoke an MCP prompt template")
    .argument("<name>", "Prompt name (e.g., mcp_server_prompt-name)")
    .option("-d, --directory <dir>", "Working directory", process.cwd())
    .option("-a, --arg <key=value>", "Prompt argument (can be used multiple times)", (val, acc: string[]) => {
      acc.push(val);
      return acc;
    }, [])
    .option("--json", "Output as JSON")
    .action(async (name, options) => {
      const { McpManager } = await import("../../mcp/manager.js");
      const config = await loadConfig(options.directory);

      if (!config.mcp || Object.keys(config.mcp).length === 0) {
        console.error(chalk.red("No MCP servers configured."));
        process.exit(1);
      }

      const manager = new McpManager();
      await manager.loadFromConfig(config.mcp);

      // Parse arguments
      const args: Record<string, string> = {};
      for (const arg of options.arg) {
        const [key, ...valueParts] = arg.split("=");
        args[key] = valueParts.join("=");
      }

      // Ensure full name
      const fullName = name.startsWith("mcp_") ? name : `mcp_${name}`;

      try {
        const result = await manager.invokePrompt(fullName, Object.keys(args).length > 0 ? args : undefined);

        if (options.json) {
          console.log(JSON.stringify({ 
            prompt: fullName, 
            arguments: args,
            result,
          }, null, 2));
        } else {
          console.log(chalk.cyan(`Prompt: ${fullName}\n`));
          console.log(result);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        
        // Show available prompts
        const prompts = manager.getPrompts();
        if (prompts.length > 0) {
          console.log(chalk.gray("\nAvailable prompts:"));
          for (const p of prompts) {
            console.log(chalk.gray(`  - ${p.name}`));
          }
        }
        
        process.exit(1);
      } finally {
        await manager.shutdown();
      }
    });
}
