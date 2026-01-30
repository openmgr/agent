# Contributing to OpenMgr Agent

Thank you for your interest in contributing to OpenMgr Agent! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- **Node.js** 20.0.0 or higher
- **pnpm** 9.0.0 or higher

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/openmgr/agent.git
   cd agent
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build all packages:
   ```bash
   pnpm build
   ```

4. Run tests:
   ```bash
   pnpm test
   ```

## Project Structure

This is a pnpm monorepo with packages in the `packages/` directory:

| Package | Description |
|---------|-------------|
| `agent` | Meta-package re-exporting all functionality |
| `core` | Agent class, plugins, MCP, skills, compaction |
| `providers` | LLM provider implementations |
| `tools` | Pure code tools (todo, phase, web, skill) |
| `tools-terminal` | Terminal tools (bash, read, write, etc.) |
| `database` | SQLite database with Drizzle ORM |
| `storage` | Session persistence (depends on database) |
| `memory` | Vector memory with local embeddings |
| `auth-anthropic` | Anthropic OAuth authentication |
| `skills-bundled` | Built-in skills collection |
| `lsp` | Language Server Protocol support |
| `server` | HTTP server (Hono-based) |
| `cli` | Command-line interface |

## Development Workflow

### Running Commands

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm --filter @openmgr/agent-core build

# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @openmgr/agent-core test

# Run tests in watch mode
pnpm test:watch

# Run linting
pnpm lint

# Fix lint issues
pnpm lint:fix

# Clean build artifacts
pnpm clean
```

### Package Dependencies

When adding dependencies:

- **Runtime dependencies**: Add to the specific package's `package.json`
- **Dev dependencies**: Add to root `package.json` for shared tools (TypeScript, Vitest, ESLint)
- **Workspace dependencies**: Use `workspace:*` for internal packages

Example:
```bash
# Add a runtime dependency to a package
pnpm --filter @openmgr/agent-core add zod

# Add a dev dependency to root
pnpm add -D -w some-dev-tool
```

## Code Style

### TypeScript

- Use TypeScript for all source files
- Enable strict mode
- Use ES modules (`"type": "module"`)
- Import types with `import type` when possible

### Formatting

- Use consistent indentation (2 spaces)
- Use double quotes for strings
- Add trailing commas in multi-line structures
- Run `pnpm lint:fix` before committing

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

## Testing

We use [Vitest](https://vitest.dev/) for testing.

### Test File Locations

- Unit tests: `packages/*/src/__tests__/*.test.ts`
- Integration tests: `packages/integration-tests/tests/*.test.ts`
- E2E tests: `packages/e2e-tests/tests/*.test.ts`

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Test Coverage

Run tests with coverage:
```bash
pnpm test:coverage
```

## Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the code style guidelines
3. **Add tests** for new functionality
4. **Run the full test suite**: `pnpm test`
5. **Run linting**: `pnpm lint`
6. **Commit your changes** with a clear commit message
7. **Open a Pull Request** with a description of your changes

### Commit Messages

Use clear, descriptive commit messages:

```
Add vector memory search with cosine similarity

- Implement cosine similarity calculation
- Add memory search with threshold filtering
- Include tests for edge cases
```

### PR Description

Include:
- Summary of changes
- Motivation/context
- How to test
- Screenshots (if UI changes)

## Adding a New Package

1. Create the package directory:
   ```bash
   mkdir packages/my-package
   ```

2. Create `package.json`:
   ```json
   {
     "name": "@openmgr/agent-my-package",
     "version": "0.0.1",
     "type": "module",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "exports": {
       ".": {
         "import": "./dist/index.js",
         "types": "./dist/index.d.ts"
       }
     },
     "scripts": {
       "build": "tsc",
       "test": "vitest run",
       "dev": "tsc --watch"
     },
     "dependencies": {},
     "devDependencies": {}
   }
   ```

3. Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "declaration": true,
       "outDir": "dist",
       "rootDir": "src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true
     },
     "include": ["src"],
     "exclude": ["node_modules", "dist"]
   }
   ```

4. Create `src/index.ts` with your exports

5. If needed, add as a dependency to other packages

## Reporting Issues

When reporting bugs, please include:

- Node.js version
- pnpm version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/stack traces

## Getting Help

- Open a [GitHub Issue](https://github.com/openmgr/agent/issues) for bugs/features
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Thank you for contributing to OpenMgr Agent!
