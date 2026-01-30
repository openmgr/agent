#!/usr/bin/env node

import { program } from "commander";
import { registerAllCommands } from "./cli/commands/index.js";

program
  .name("openmgr-agent")
  .description("OpenMgr AI coding agent")
  .version("0.1.0");

// Register all CLI commands from modular command files
registerAllCommands(program);

program.parse();
