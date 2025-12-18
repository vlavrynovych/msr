---
layout: page
title: CLI Adapter Development
permalink: /guides/cli-adapter-development/
parent: Guides
nav_order: 8
---

# CLI Adapter Development

Learn how to create command-line interfaces for your database adapters using MSR's CLI factory.

{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR Core provides a `createCLI()` factory function that creates a fully-featured command-line interface for your database adapter. The CLI includes all standard migration commands and can be extended with custom commands specific to your database.

### Key Features

- **Built-in Commands**: migrate, list, down, validate, backup (create/restore/delete)
- **Configuration Waterfall**: Merges config from defaults → file → environment → options → CLI flags
- **Extensible**: Add custom database-specific commands with full type safety via `extendCLI` callback
- **Type-Safe**: Full TypeScript support with generics - no type casting needed
- **Logger Integration**: Support for console, file, and silent loggers

---

## Quick Start

### Basic CLI Creation

```typescript
import {createCLI} from '@migration-script-runner/core';
import {MongoAdapter} from './MongoAdapter';
import {MongoHandler} from './MongoHandler';

// Create CLI with your adapter
const program = createCLI({
  name: 'msr-mongodb',
  description: 'MongoDB Migration Runner',
  version: '1.0.0',
  createExecutor: (config) => {
    const handler = new MongoHandler(config.mongoUri || 'mongodb://localhost');
    return new MongoAdapter({handler, config});
  },
});

// Parse command-line arguments
program.parse(process.argv);
```

{: .note }
> See [examples/simple-cli.ts](../../examples/simple-cli.ts) for a runnable example showing the CLI structure without a full database implementation.

### With Custom Commands (Recommended)

Add database-specific commands using the `extendCLI` callback for full type safety:

```typescript
import {createCLI} from '@migration-script-runner/core';
import {MongoAdapter} from './MongoAdapter';

const program = createCLI({
  name: 'msr-mongodb',
  createExecutor: (config) => new MongoAdapter({handler, config}),

  // Add custom commands with full type safety
  extendCLI: (program, createExecutor) => {
    program
      .command('mongo:stats')
      .description('Show database statistics')
      .action(async () => {
        const adapter = createExecutor(); // ✓ Typed as MongoAdapter!
        const stats = await adapter.getStats(); // ✓ No casting needed!
        console.table(stats);
        process.exit(0);
      });
  }
});

program.parse(process.argv);
```

### Minimal Example

```typescript
import {createCLI} from '@migration-script-runner/core';
import {MyAdapter} from './MyAdapter';

const program = createCLI({
  createExecutor: (config) => new MyAdapter({config}),
});

program.parse(process.argv);
```

---

## CLI Options

The `createCLI()` function accepts a `CLIOptions` object:

### Required Options

#### `createExecutor`

Factory function that receives the final merged configuration and returns a `MigrationScriptExecutor` instance (your adapter).

**Type**: `(config: Config) => MigrationScriptExecutor<DB>`

**Example**:
```typescript
createExecutor: (config) => {
  // Initialize your database handler with the merged config
  const handler = new PostgresHandler({
    connectionString: config.postgresUri,
    ssl: config.ssl,
  });

  // Return your adapter instance
  return new PostgresAdapter({handler, config});
}
```

{: .important-title }
> Configuration Waterfall
>
> The `config` parameter contains the final merged configuration with this priority:
> 1. Built-in defaults
> 2. Config file (if `--config-file` flag provided)
> 3. Environment variables (`MSR_*`)
> 4. `options.config` (if provided)
> 5. CLI flags (highest priority)

### Optional Options

#### `name`

CLI program name. Defaults to `'msr'`.

```typescript
name: 'msr-postgres'
```

#### `description`

CLI program description. Defaults to `'Migration Script Runner'`.

```typescript
description: 'PostgreSQL Migration Runner'
```

#### `version`

CLI program version. Defaults to `'1.0.0'`.

```typescript
version: '2.1.0'
```

#### `config`

Partial configuration to merge with defaults. This is merged after file/environment config but before CLI flags.

```typescript
config: {
  folder: './migrations',
  tableName: 'schema_versions',
  displayLimit: 20,
}
```

#### `configLoader`

Custom configuration loader implementing `IConfigLoader<Config>`. If not provided, uses the default `ConfigLoader`.

```typescript
import {ConfigLoader} from '@migration-script-runner/core';

const customLoader = new ConfigLoader<Config>();
// Customize loader as needed

const program = createCLI({
  createExecutor: (config) => new MyAdapter({config}),
  configLoader: customLoader,
});
```

#### `extendCLI` (Recommended for custom commands)

Optional callback to add custom commands with full type safety. Called after base commands are registered.

**Type**: `(program: Command, createExecutor: () => TExecutor) => void`

**Benefits**:
- ✅ Full TypeScript type inference - no casting needed
- ✅ Config already merged with CLI flags
- ✅ Clean API - all custom commands in one place
- ✅ Type-safe access to adapter methods

**Example**:
```typescript
// v0.8.0+: Type-safe handler access with second generic parameter
class PostgresAdapter extends MigrationScriptExecutor<IPostgresDB, PostgresHandler> {
  async vacuum(): Promise<void> {
    // ✓ this.handler is typed as PostgresHandler (full IDE autocomplete!)
    await this.handler.db.query('VACUUM ANALYZE');
  }

  getConnectionInfo() {
    // ✓ Access handler-specific properties without casting
    return {
      host: this.handler.config.host,
      port: this.handler.config.port
    };
  }
}

const program = createCLI({
  createExecutor: (config) => new PostgresAdapter({handler, config}),

  extendCLI: (program, createExecutor) => {
    program
      .command('vacuum')
      .description('Run VACUUM ANALYZE')
      .action(async () => {
        const adapter = createExecutor(); // ✓ Typed as PostgresAdapter!
        await adapter.vacuum(); // ✓ TypeScript knows about vacuum()
        console.log('✓ Vacuum completed');
        process.exit(0);
      });

    program
      .command('connection-info')
      .description('Display connection information')
      .action(async () => {
        const adapter = createExecutor();
        const info = adapter.getConnectionInfo(); // ✓ Full type safety
        console.log(`Host: ${info.host}:${info.port}`);
        process.exit(0);
      });
  }
});
```

{: .tip }
> **v0.8.0+**: Use the second generic parameter (`THandler`) for type-safe handler access in your adapter. This eliminates the need for casting and provides full IDE autocomplete for handler-specific properties.

{: .note }
> The `createExecutor` function passed to `extendCLI` returns your adapter with the exact type you specified, enabling full IntelliSense and compile-time checking.

---

## Built-in Commands

The CLI automatically includes these commands:

### `migrate [targetVersion]`

Runs pending migrations up to an optional target version.

**Aliases**: `up`

```bash
# Run all pending migrations
msr migrate

# Migrate to specific version
msr migrate 202501220100

# With options
msr migrate --dry-run --logger console --log-level debug
```

### `list`

Lists all migrations with their execution status.

```bash
# List all migrations
msr list

# List only last 10 migrations
msr list --number 10
msr list -n 10
```

### `down <targetVersion>`

Rolls back migrations to a specific target version.

**Aliases**: `rollback`

```bash
# Roll back to version
msr down 202501220100

# With options
msr down 202501220100 --dry-run
```

### `validate`

Validates all migration scripts without executing them.

```bash
# Validate all migrations
msr validate

# With logging
msr validate --logger console --log-level debug
```

### `backup`

Backup and restore operations (subcommands).

#### `backup create`

Creates a database backup.

```bash
msr backup create
```

#### `backup restore [backupPath]`

Restores from a backup file. Uses most recent backup if path not provided.

```bash
# Restore from specific backup
msr backup restore ./backups/backup-2025-01-22.bkp

# Restore from most recent backup
msr backup restore
```

#### `backup delete`

Deletes backup file.

```bash
msr backup delete
```

---

## Common CLI Flags

All commands support these common flags:

| Flag | Short | Description | Type | Example |
|------|-------|-------------|------|---------|
| `--config-file` | `-c` | Configuration file path | string | `--config-file ./config.json` |
| `--folder` | | Migrations folder | string | `--folder ./db/migrations` |
| `--table-name` | | Schema version table name | string | `--table-name _versions` |
| `--display-limit` | | Max migrations to display | number | `--display-limit 50` |
| `--dry-run` | | Simulate without executing | boolean | `--dry-run` |
| `--logger` | | Logger type | console\|file\|silent | `--logger file` |
| `--log-level` | | Log level | error\|warn\|info\|debug | `--log-level debug` |
| `--log-file` | | Log file path (required with --logger file) | string | `--log-file ./logs/msr.log` |
| `--format` | | Output format | table\|json | `--format json` |

### Configuration Priority

CLI flags have the highest priority in the configuration waterfall:

```
Built-in defaults
    ↓
Config file (if --config-file provided)
    ↓
Environment variables (MSR_*)
    ↓
options.config (from createCLI)
    ↓
CLI flags (highest priority)
```

---

## Extending with Custom Commands

Add database-specific commands to your CLI using the `extendCLI` callback for full type safety.

### Preferred Approach: Using `extendCLI` Callback

The `extendCLI` callback provides access to your adapter with full TypeScript type inference, eliminating the need for type casting:

```typescript
import {createCLI} from '@migration-script-runner/core';

// Define adapter with custom methods
class PostgresAdapter extends MigrationScriptExecutor<IPostgresDB> {
  async vacuum(options: {full?: boolean; analyze?: boolean}): Promise<void> {
    const sql = `VACUUM ${options.full ? 'FULL' : ''} ${options.analyze ? 'ANALYZE' : ''}`;
    await this.handler.db.query(sql);
  }

  async getStats(): Promise<any[]> {
    return await this.handler.db.query('SELECT * FROM pg_stat_database');
  }
}

const program = createCLI({
  name: 'msr-postgres',
  createExecutor: (config) => new PostgresAdapter({handler, config}),

  // Add custom commands with full type safety
  extendCLI: (program, createExecutor) => {
    program
      .command('vacuum')
      .description('Run VACUUM on database')
      .option('--full', 'Run VACUUM FULL')
      .option('--analyze', 'Run VACUUM ANALYZE')
      .action(async (options) => {
        const adapter = createExecutor(); // ✓ Typed as PostgresAdapter!
        await adapter.vacuum(options); // ✓ TypeScript knows about vacuum()
        console.log('✓ VACUUM completed');
        process.exit(0);
      });

    program
      .command('stats')
      .description('Show database statistics')
      .action(async () => {
        const adapter = createExecutor(); // Config already merged
        const stats = await adapter.getStats();
        console.table(stats);
        process.exit(0);
      });
  }
});

program.parse(process.argv);
```

**Benefits of `extendCLI`:**
- ✅ **Full type safety** - No type casting needed, TypeScript infers your adapter type
- ✅ **Config merging** - `createExecutor()` already has CLI flags merged
- ✅ **Clean API** - All custom commands in one place
- ✅ **Reusability** - `createExecutor` function handles all config loading

### Alternative: Manual Command Registration

You can also add commands to the returned program manually, but you'll need to handle config loading yourself:

```typescript
const program = createCLI({
  name: 'msr-postgres',
  createExecutor: (config) => new PostgresAdapter({handler, config}),
});

// Manually add command after createCLI
program
  .command('vacuum')
  .description('Run VACUUM on database')
  .action(async () => {
    // Need to manually load config and create adapter
    const config = new ConfigLoader<Config>().load();
    const adapter = new PostgresAdapter({handler, config}) as PostgresAdapter;
    await adapter.vacuum(); // ⚠️ Requires type casting
  });

program.parse(process.argv);
```

{: .note }
> The `extendCLI` approach is recommended because it provides better type safety and automatic config merging.

---

## Complete Example

Here's a complete example of a MongoDB adapter CLI:

### Project Structure

```
msr-mongodb/
├── src/
│   ├── MongoHandler.ts       # Database handler
│   ├── MongoAdapter.ts        # Adapter extending MigrationScriptExecutor
│   └── cli.ts                 # CLI entry point
├── package.json
└── tsconfig.json
```

### `src/MongoHandler.ts`

```typescript
import {MongoClient, Db} from 'mongodb';
import {IDatabaseMigrationHandler, IDB} from '@migration-script-runner/core';

export interface MongoDBInterface extends IDB {
  db: Db;
  client: MongoClient;
}

export class MongoHandler implements IDatabaseMigrationHandler<MongoDBInterface> {
  private client!: MongoClient;
  private db!: Db;

  constructor(private uri: string) {}

  async connect(): Promise<MongoDBInterface> {
    this.client = await MongoClient.connect(this.uri);
    this.db = this.client.db();
    return {db: this.db, client: this.client};
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  // Implement other required methods...
}
```

### `src/MongoAdapter.ts`

```typescript
import {MigrationScriptExecutor, Config} from '@migration-script-runner/core';
import {MongoHandler, MongoDBInterface} from './MongoHandler';

export class MongoAdapter extends MigrationScriptExecutor<MongoDBInterface> {
  constructor({handler, config}: {handler: MongoHandler; config: Config}) {
    super({handler, config});
  }

  // Custom MongoDB-specific methods
  async getIndexes(): Promise<any[]> {
    const db = this.handler.db.db;
    const collections = await db.listCollections().toArray();
    const indexes = [];

    for (const coll of collections) {
      const collIndexes = await db.collection(coll.name).indexes();
      indexes.push({collection: coll.name, indexes: collIndexes});
    }

    return indexes;
  }

  async getCollections(): Promise<any[]> {
    const db = this.handler.db.db;
    const collections = await db.listCollections().toArray();
    return collections.map(c => ({name: c.name, type: c.type}));
  }
}
```

### `src/cli.ts`

```typescript
import {createCLI} from '@migration-script-runner/core';
import {MongoAdapter} from './MongoAdapter';
import {MongoHandler, MongoDBInterface} from './MongoHandler';

// Create CLI with custom MongoDB commands using extendCLI
const program = createCLI<MongoDBInterface, MongoAdapter>({
  name: 'msr-mongodb',
  description: 'MongoDB Migration Runner',
  version: '1.0.0',

  // Default config merged before CLI flags
  config: {
    folder: './migrations',
    tableName: '_schema_versions',
  },

  // Factory receives final merged config
  createExecutor: (config) => {
    const mongoUri = process.env.MONGO_URI || config.mongoUri || 'mongodb://localhost:27017/mydb';
    const handler = new MongoHandler(mongoUri);
    return new MongoAdapter({handler, config});
  },

  // Add MongoDB-specific commands with full type safety
  extendCLI: (program, createExecutor) => {
    program
      .command('mongo:indexes')
      .description('Show all indexes in database')
      .action(async () => {
        try {
          const adapter = createExecutor(); // ✓ Typed as MongoAdapter!
          const indexes = await adapter.getIndexes(); // ✓ TypeScript knows this method!

          for (const {collection, indexes: collIndexes} of indexes) {
            console.log(`\n${collection}:`);
            console.table(collIndexes);
          }

          process.exit(0);
        } catch (error) {
          console.error('Error:', error);
          process.exit(1);
        }
      });

    program
      .command('mongo:collections')
      .description('List all collections')
      .action(async () => {
        try {
          const adapter = createExecutor(); // Config already merged!
          const collections = await adapter.getCollections();
          console.table(collections);
          process.exit(0);
        } catch (error) {
          console.error('Error:', error);
          process.exit(1);
        }
      });
  }
});

// Parse arguments
program.parse(process.argv);
```

### `package.json`

```json
{
  "name": "msr-mongodb",
  "version": "1.0.0",
  "main": "dist/index.js",
  "bin": {
    "msr-mongodb": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@migration-script-runner/core": "^0.6.0",
    "commander": "^12.0.0",
    "mongodb": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## Error Handling

The CLI automatically handles errors and exits with appropriate exit codes:

| Exit Code | Description |
|-----------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Validation error |
| 3 | Migration failed |
| 4 | Rollback failed |
| 5 | Backup failed |
| 6 | Restore failed |
| 7 | Database connection error |

### Custom Error Handling

```typescript
const program = createCLI({
  createExecutor: (config) => new MyAdapter({config}),
});

// Add custom error handling
program.exitOverride((err) => {
  console.error('Custom error handler:', err.message);
  process.exit(err.exitCode);
});

program.parse(process.argv);
```

---

## Testing Your CLI

### Unit Testing

Test your CLI by mocking the executor:

```typescript
import {expect} from 'chai';
import sinon from 'sinon';
import {createCLI} from '@migration-script-runner/core';

describe('CLI', () => {
  it('should create program with custom commands', () => {
    const createExecutorStub = sinon.stub();

    const program = createCLI({
      createExecutor: createExecutorStub,
    });

    program.command('custom').action(() => {});

    const commands = program.commands.map(cmd => cmd.name());
    expect(commands).to.include('custom');
  });
});
```

### Integration Testing

Test actual command execution:

```typescript
import {createCLI} from '@migration-script-runner/core';

describe('CLI Integration', () => {
  it('should execute migrate command', async () => {
    const mockExecutor = {
      migrate: sinon.stub().resolves({success: true, executed: []}),
    };

    const program = createCLI({
      createExecutor: () => mockExecutor as any,
    });

    program.exitOverride(); // Prevent process.exit in tests

    await program.parseAsync(['node', 'test', 'migrate']);

    expect(mockExecutor.migrate.calledOnce).to.be.true;
  });
});
```

---

## Best Practices

1. **Initialize Handlers in createExecutor**: Use the config parameter to initialize your database handler with the correct settings.

2. **Provide Sensible Defaults**: Use the `config` option to set default values for your adapter.

3. **Document Custom Commands**: Add clear descriptions to custom commands.

4. **Handle Database Errors**: Ensure your handler properly propagates errors to the CLI.

5. **Version Your CLI**: Keep the CLI version in sync with your adapter package version.

6. **Test CLI Commands**: Write both unit and integration tests for your CLI.

7. **Use Environment Variables**: Support environment variables for sensitive data like connection strings.

---

## Next Steps

- [Writing Migrations](./writing-migrations.html)
- [Configuration](../configuration/)
- [Environment Variables](./environment-variables.html)
- [Transaction Management](./transaction-management.html)
