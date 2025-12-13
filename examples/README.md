# Examples

This directory contains example implementations demonstrating various MSR features.

## Available Examples

### [simple-cli.ts](./simple-cli.ts)

A minimal, runnable example showing how to create a CLI with `createCLI()`.

**What it demonstrates:**
- Basic CLI structure with `createCLI()`
- All built-in commands (migrate, list, down, validate, backup)
- How to add custom commands
- Global CLI options

**Run it:**
```bash
# Show help menu
npx ts-node examples/simple-cli.ts --help

# Show what the CLI provides
npx ts-node examples/simple-cli.ts demo:show-features

# Show command-specific help
npx ts-node examples/simple-cli.ts migrate --help
npx ts-node examples/simple-cli.ts backup --help
```

**Note:** This example doesn't have a real database implementation. It's designed to show the CLI structure without complexity.

### [cli-example.ts](./cli-example.ts)

A more complete example with a mock database handler (needs TypeScript fixes).

## Using Examples in Your Project

These examples show patterns you can copy into your own adapter implementation. See the [CLI Adapter Development Guide](../docs/guides/cli-adapter-development.md) for detailed documentation.

## Creating Your Own CLI

```typescript
import {createCLI} from '@migration-script-runner/core';
import {YourAdapter} from './YourAdapter';

const program = createCLI({
  name: 'your-cli',
  version: '1.0.0',
  createExecutor: (config) => new YourAdapter({config}),
});

program.parse(process.argv);
```

That's it! You now have a full-featured CLI with all migration commands.
