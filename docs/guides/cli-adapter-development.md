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

### Async Adapter (Recommended Pattern)

Most database adapters require async initialization. Use the `createInstance` helper for clean, standardized adapters:

{: .important }
> **Best Practice:** Use this pattern for MongoDB, PostgreSQL, Firebase, MySQL, and most production databases.

```typescript
import {createCLI, MigrationScriptExecutor, IExecutorOptions} from '@migration-script-runner/core';
import {MongoHandler} from './MongoHandler';
import {IMongoDb} from './types';

// Define your adapter with async initialization
class MongoAdapter extends MigrationScriptExecutor<IMongoDb, MongoHandler> {
  private constructor(deps: any) {
    super(deps);
  }

  static async getInstance(options: IExecutorOptions<IMongoDb>): Promise<MongoAdapter> {
    return MigrationScriptExecutor.createInstance(
      MongoAdapter,
      options,
      async (config) => MongoHandler.connect(config.mongoUri || 'mongodb://localhost')
    );
  }
}

// Create CLI with async executor
const program = createCLI({
  name: 'msr-mongodb',
  description: 'MongoDB Migration Runner',
  version: '1.0.0',
  createExecutor: async (config) => {
    return MongoAdapter.getInstance({config});
  }
});

program.parse(process.argv);
```

**Benefits:**
- ✅ Handles async connections, authentication, pooling
- ✅ Standardized pattern across ecosystem
- ✅ Type-safe with zero boilerplate
- ✅ Consistent with other MSR adapters

### With Custom Commands

Add database-specific commands using the `extendCLI` callback:

```typescript
import {createCLI} from '@migration-script-runner/core';
import {MongoAdapter} from './MongoAdapter';

const program = createCLI({
  name: 'msr-mongodb',
  createExecutor: async (config) => MongoAdapter.getInstance({config}),

  // Add custom commands with full type safety
  extendCLI: (program, createExecutor) => {
    program
      .command('mongo:stats')
      .description('Show database statistics')
      .action(async () => {
        const adapter = await createExecutor(); // ✓ Typed as MongoAdapter!
        const stats = await adapter.getHandler().getStats(); // ✓ Type-safe!
        console.table(stats);
        process.exit(0);
      });
  }
});

program.parse(process.argv);
```

### Sync Adapter (For Simple Cases)

For handlers without async initialization needs (in-memory databases, file-based storage):

```typescript
import {createCLI, MigrationScriptExecutor} from '@migration-script-runner/core';
import {SimpleHandler} from './SimpleHandler';

const program = createCLI({
  name: 'msr-simple',
  createExecutor: (config) => {
    const handler = new SimpleHandler();  // Synchronous
    return new MigrationScriptExecutor({handler, config});
  }
});

program.parse(process.argv);
```

{: .note }
> Use sync pattern only when your handler doesn't need async initialization. See [examples/simple-cli.ts](../../examples/simple-cli.ts) for a runnable example.

---

## Custom Configuration Types

{: .new }
> **NEW in v0.8.2:** Type-safe custom configuration with `TConfig` generic parameter

MSR allows you to extend the base `Config` class with adapter-specific properties, providing full type safety throughout your adapter implementation.

### Why Custom Config?

Database adapters often need additional configuration beyond MSR's base settings:

- **Connection Strings**: Database URLs, host/port combinations
- **Pool Settings**: Connection pool size, timeout settings
- **Authentication**: API keys, OAuth tokens, service account paths
- **Database-Specific Options**: Region, cluster name, replica set name

Instead of casting or using workarounds, v0.8.2 enables proper type-safe configuration.

### Basic Example

```typescript
import { Config, MigrationScriptExecutor, IDB, IDatabaseMigrationHandler } from '@migration-script-runner/core';

// 1. Extend Config with adapter-specific properties
class AppConfig extends Config {
  databaseUrl?: string;
  connectionPoolSize?: number;
  apiKey?: string;
}

// 2. Use TConfig generic in your adapter
class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler, AppConfig> {
  // this.config is now typed as AppConfig!

  async initializeConnection(): Promise<void> {
    // Full IDE autocomplete for custom properties
    const url = this.config.databaseUrl;
    const poolSize = this.config.connectionPoolSize ?? 10;
    const apiKey = this.config.apiKey;

    // Use properties to configure connection
    await this.handler.connect(url, { poolSize, apiKey });
  }
}

// 3. Pass config instance to executor
const config = new AppConfig();
config.databaseUrl = 'https://my-db.example.com';
config.connectionPoolSize = 20;
config.apiKey = process.env.API_KEY;

const adapter = new MyAdapter({
  handler: new MyHandler(),
  config: config  // Typed as AppConfig
});
```

### CLI Integration

Use custom config with `createCLI()`:

```typescript
import { createCLI, IExecutorOptions } from '@migration-script-runner/core';

class FirebaseConfig extends Config {
  databaseUrl?: string;
  projectId?: string;
  serviceAccountPath?: string;
}

const program = createCLI<IDB, MyHandler, FirebaseConfig>({
  name: 'msr-firebase',
  version: '1.0.0',
  createExecutor: (config: FirebaseConfig) => {
    // config is typed as FirebaseConfig
    const handler = new MyHandler({
      databaseUrl: config.databaseUrl,
      projectId: config.projectId,
      serviceAccountPath: config.serviceAccountPath
    });

    return new MyAdapter({
      handler,
      config  // No casting needed!
    });
  }
});

program.parse(process.argv);
```

### Loading Custom Config from Files

Users can define custom properties in configuration files:

**msr.config.json:**
```json
{
  "migrationsPath": "./migrations",
  "databaseUrl": "https://my-project.firebaseio.com",
  "projectId": "my-project-id",
  "connectionPoolSize": 15,
  "apiKey": "${API_KEY}"
}
```

**msr.config.js:**
```javascript
module.exports = {
  migrationsPath: './migrations',
  databaseUrl: process.env.DATABASE_URL,
  projectId: 'my-project',
  connectionPoolSize: 15
};
```

The config loader automatically picks up custom properties when loading from files.

### Advanced: Custom Config Loader

For complex config needs, implement a custom `IConfigLoader<TConfig>`:

```typescript
import { IConfigLoader, ConfigLoader } from '@migration-script-runner/core';

class FirebaseConfigLoader implements IConfigLoader<FirebaseConfig> {
  load(): FirebaseConfig {
    // Load base config
    const baseLoader = new ConfigLoader<FirebaseConfig>();
    const config = baseLoader.load();

    // Add Firebase-specific defaults
    if (!config.databaseUrl) {
      config.databaseUrl = process.env.FIREBASE_DATABASE_URL;
    }
    if (!config.projectId) {
      config.projectId = process.env.FIREBASE_PROJECT_ID;
    }

    // Validate Firebase-specific config
    if (!config.databaseUrl) {
      throw new TypeError('databaseUrl is required for Firebase adapter');
    }

    return config;
  }
}

// Use custom loader in executor
const adapter = new MyAdapter({
  handler: new MyHandler(),
  configLoader: new FirebaseConfigLoader()  // Custom loader
});
```

### Type Safety Benefits

**Before v0.8.2** (without TConfig):
```typescript
class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
  initializeConnection() {
    // Need to cast or use 'any' ❌
    const url = (this.config as any).databaseUrl;
    // OR create wrapper interface ❌
  }
}
```

**After v0.8.2** (with TConfig):
```typescript
class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler, AppConfig> {
  initializeConnection() {
    // Full type safety ✅
    const url = this.config.databaseUrl;
    // IDE autocomplete works ✅
    // Compile-time validation ✅
  }
}
```

### Common Patterns

#### 1. Connection Configuration
```typescript
class MongoConfig extends Config {
  mongoUri?: string;
  replicaSet?: string;
  authDatabase?: string;
}
```

#### 2. Cloud Service Configuration
```typescript
class FirebaseConfig extends Config {
  databaseUrl?: string;
  projectId?: string;
  serviceAccountPath?: string;
  storageBucket?: string;
}
```

#### 3. Performance Tuning
```typescript
class PostgresConfig extends Config {
  connectionString?: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  statementTimeout?: number;
}
```

#### 4. Multi-Environment Configuration
```typescript
class AppConfig extends Config {
  environment?: 'development' | 'staging' | 'production';
  databaseUrl?: string;
  enableDebugLogging?: boolean;
  metricsEndpoint?: string;
}
```

### Best Practices

1. **Optional Properties**: Make custom properties optional (`?`) with sensible defaults
2. **Environment Variables**: Support env vars for sensitive data (API keys, connection strings)
3. **Validation**: Validate required custom properties in your handler constructor
4. **Documentation**: Document custom config properties in your adapter's README
5. **Type Safety**: Leverage TypeScript - avoid `any` or type assertions

### Backward Compatibility

The `TConfig` generic parameter is **fully backward compatible**:

```typescript
// Still works - defaults to base Config
class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
  // this.config is typed as Config (base class)
}

// Or explicitly use base Config
class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler, Config> {
  // Same as above
}
```

Existing adapters continue to work without changes.

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

### Accessing the Handler Directly (v0.8.1+)

{: .new }
> **NEW in v0.8.1:** The `getHandler()` method provides direct access to the database handler for custom CLI commands without needing adapter wrapper methods.

Starting in v0.8.1, you can access the handler directly using the `getHandler()` public method. This is especially useful for database operations that don't need adapter abstraction:

```typescript
import {createCLI, MigrationScriptExecutor} from '@migration-script-runner/core';

// Define handler interface with specific properties
interface PostgresHandler extends IDatabaseMigrationHandler<IDB> {
  config: { host: string; port: number; database: string };
}

// Create adapter with THandler generic for type-safe handler access
class PostgresAdapter extends MigrationScriptExecutor<IPostgresDB, PostgresHandler> {
  // Adapter methods can use this.handler internally...
}

const program = createCLI({
  name: 'msr-postgres',
  createExecutor: (config) => new PostgresAdapter({handler: postgresHandler, config}),

  extendCLI: (program, createExecutor) => {
    program
      .command('vacuum')
      .description('Run VACUUM ANALYZE')
      .action(async () => {
        const adapter = createExecutor();
        const handler = adapter.getHandler(); // ✓ Typed as PostgresHandler!

        // Direct database operation without adapter method
        await handler.db.query('VACUUM ANALYZE');
        console.log('✓ Vacuum completed');
        process.exit(0);
      });

    program
      .command('connection-info')
      .description('Display database connection details')
      .action(async () => {
        const adapter = createExecutor();
        const handler = adapter.getHandler();

        // Access handler properties with full type safety
        console.log(`Database: ${handler.getName()}`);
        console.log(`Version: ${handler.getVersion()}`);
        console.log(`Host: ${handler.config.host}:${handler.config.port}`);
        console.log(`Database: ${handler.config.database}`);
        process.exit(0);
      });

    program
      .command('query <sql>')
      .description('Execute a raw SQL query')
      .action(async (sql: string) => {
        const adapter = createExecutor();
        const handler = adapter.getHandler();

        try {
          // Direct database query
          const result = await handler.db.query(sql);
          console.table(result.rows);
          process.exit(0);
        } catch (error) {
          console.error('Query failed:', error.message);
          process.exit(1);
        }
      });
  }
});

program.parse(process.argv);
```

**When to use `getHandler()` vs adapter methods:**

| Scenario | Recommended Approach | Reason |
|----------|---------------------|---------|
| Simple database operations | `getHandler()` | No need for adapter abstraction |
| Handler metadata access | `getHandler()` | Direct access to getName(), getVersion() |
| One-off CLI commands | `getHandler()` | Less code, more direct |
| Reusable business logic | Adapter method | Better abstraction, testable |
| Complex operations | Adapter method | Encapsulation, separation of concerns |
| Multiple related operations | Adapter method | Group related functionality |

**Example comparing both approaches:**

```typescript
// Approach 1: Using adapter methods (better for reusable logic)
class PostgresAdapter extends MigrationScriptExecutor<IPostgresDB, PostgresHandler> {
  async vacuum(options: {full?: boolean; analyze?: boolean}): Promise<void> {
    const sql = `VACUUM ${options.full ? 'FULL' : ''} ${options.analyze ? 'ANALYZE' : ''}`.trim();
    await this.handler.db.query(sql);
  }

  async getStats(): Promise<DatabaseStats> {
    const result = await this.handler.db.query('SELECT * FROM pg_stat_database');
    return this.formatStats(result); // Additional processing
  }

  private formatStats(result: any): DatabaseStats {
    // Complex formatting logic...
    return formatted;
  }
}

// Approach 2: Using getHandler() (better for simple CLI operations)
extendCLI: (program, createExecutor) => {
  program
    .command('vacuum')
    .action(async () => {
      const adapter = createExecutor();
      const handler = adapter.getHandler();

      // Direct operation - no adapter method needed
      await handler.db.query('VACUUM ANALYZE');
      console.log('✓ Done');
      process.exit(0);
    });
}
```

{: .tip }
> **Best Practice:** Use `getHandler()` for simple CLI commands that don't need business logic. Use adapter methods when operations are reusable, complex, or need testing.

---

## Async Adapter Initialization (v0.8.2)

Many database adapters require asynchronous initialization - connecting to a database, authenticating, setting up connection pools, etc. MSR Core v0.8.2 provides a standardized factory pattern to eliminate boilerplate code and ensure consistency across adapters.

### The Problem

Without the factory pattern, every adapter must implement the same boilerplate:

```typescript
export class FirebaseRunner extends MigrationScriptExecutor<IFirebaseDB, FirebaseHandler> {
    private constructor(deps: IMigrationExecutorDependencies<IFirebaseDB, FirebaseHandler>) {
        super(deps);
    }

    static async getInstance(options: IFirebaseRunnerOptions): Promise<FirebaseRunner> {
        // Boilerplate: Create handler async
        const handler = await FirebaseHandler.getInstance(options.config);
        // Boilerplate: Construct with handler + options
        return new FirebaseRunner({ handler, ...options });
    }
}
```

**Problems:**
- ❌ Code duplication across every async adapter
- ❌ Easy to forget spreading `...options`
- ❌ Inconsistent patterns between adapters

### The Solution: `createInstance` Factory Method

MSR Core v0.8.2 provides a `protected static createInstance()` helper that standardizes the pattern:

```typescript
export class FirebaseRunner extends MigrationScriptExecutor<IFirebaseDB, FirebaseHandler> {
    private constructor(deps: IMigrationExecutorDependencies<IFirebaseDB, FirebaseHandler>) {
        super(deps);
    }

    static async getInstance(options: IFirebaseRunnerOptions): Promise<FirebaseRunner> {
        return MigrationScriptExecutor.createInstance(
            FirebaseRunner,                                    // Executor class
            options,                                           // Options (IExecutorOptions or extension)
            (config) => FirebaseHandler.getInstance(config)    // Handler factory function
        );
    }
}
```

**Benefits:**
- ✅ Reduces boilerplate to 3 lines
- ✅ Consistent pattern across all adapters
- ✅ Type-safe with full generic support
- ✅ Handles option spreading automatically

### Type Parameters

The `createInstance` method supports all executor generics:

```typescript
protected static async createInstance<
    DB extends IDB,                                           // Your database interface
    THandler extends IDatabaseMigrationHandler<DB>,           // Your handler type
    TExecutor extends MigrationScriptExecutor<DB, THandler, TConfig>,  // Your executor subclass
    TConfig extends Config = Config,                          // Custom config type
    TOptions extends IExecutorOptions<DB, TConfig> = IExecutorOptions<DB, TConfig>  // Custom options
>(
    ExecutorClass: new (deps: IMigrationExecutorDependencies<DB, THandler, TConfig>) => TExecutor,
    options: TOptions,
    createHandler: (config: TConfig) => Promise<THandler>
): Promise<TExecutor>
```

### Example: Firebase Adapter

```typescript
// Firebase-specific config
export class FirebaseConfig extends Config {
    credential?: string;
    databaseURL?: string;
}

// Firebase-specific options (optional - can extend IExecutorOptions)
export interface IFirebaseRunnerOptions extends IExecutorOptions<IFirebaseDB, FirebaseConfig> {
    // Can add Firebase-specific options here if needed
}

export class FirebaseRunner extends MigrationScriptExecutor<IFirebaseDB, FirebaseHandler, FirebaseConfig> {
    private constructor(deps: IMigrationExecutorDependencies<IFirebaseDB, FirebaseHandler, FirebaseConfig>) {
        super(deps);
    }

    static async getInstance(options: IFirebaseRunnerOptions): Promise<FirebaseRunner> {
        return MigrationScriptExecutor.createInstance(
            FirebaseRunner,
            options,
            async (config) => {
                // Your async initialization logic
                const app = await initializeApp(config.credential);
                return new FirebaseHandler(app, config);
            }
        );
    }
}

// Usage
const runner = await FirebaseRunner.getInstance({
    config: new FirebaseConfig({
        credential: './serviceAccount.json',
        databaseURL: 'https://my-app.firebaseio.com'
    })
});

await runner.up();
```

### Example: MongoDB Adapter

```typescript
export class MongoRunner extends MigrationScriptExecutor<IMongoDb, MongoHandler> {
    private constructor(deps: IMigrationExecutorDependencies<IMongoDb, MongoHandler>) {
        super(deps);
    }

    static async getInstance(options: IExecutorOptions<IMongoDb>): Promise<MongoRunner> {
        return MigrationScriptExecutor.createInstance(
            MongoRunner,
            options,
            async (config) => {
                // Connect to MongoDB
                const client = await MongoClient.connect(config.connectionString);
                const db = client.db(config.database);
                return new MongoHandler(db, config);
            }
        );
    }
}
```

### When to Use

**Use `createInstance` when:**
- ✅ Handler requires async initialization (database connections, authentication, etc.)
- ✅ You want consistency with other async adapters
- ✅ You want to reduce boilerplate code

**Don't use `createInstance` when:**
- ⛔ Handler is synchronous (no async initialization needed)
- ⛔ You need custom constructor logic before handler creation
- ⛔ Your initialization pattern doesn't fit the factory approach

### Synchronous Adapters

Synchronous adapters don't need the factory pattern - just use the regular constructor:

```typescript
export class SimpleAdapter extends MigrationScriptExecutor<IDB, SimpleHandler> {
    constructor(options: IExecutorOptions<IDB>) {
        const handler = new SimpleHandler(options.config);  // Synchronous
        super({ handler, ...options });
    }
}

// Usage
const adapter = new SimpleAdapter({ config });
await adapter.up();
```

### Error Handling

The factory method propagates errors from handler creation:

```typescript
static async getInstance(options: IExecutorOptions<IDB>): Promise<MyRunner> {
    return MigrationScriptExecutor.createInstance(
        MyRunner,
        options,
        async (config) => {
            try {
                const client = await DatabaseClient.connect(config.connectionString);
                return new MyHandler(client, config);
            } catch (error) {
                throw new Error(`Failed to connect to database: ${error.message}`);
            }
        }
    );
}
```

### CLI Integration

Use the factory method with async executor support (v0.8.2):

```typescript
import {createCLI} from '@migration-script-runner/core';
import {FirebaseRunner} from './FirebaseRunner';
import {FirebaseConfig} from './FirebaseConfig';

const program = createCLI({
    name: 'firebase-migrations',
    createExecutor: async (config) => {
        return FirebaseRunner.getInstance({
            config: config as FirebaseConfig
        });
    }
});

program.parse(process.argv);
```

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
import {
  MigrationScriptExecutor,
  IMigrationExecutorDependencies,
  IExecutorOptions
} from '@migration-script-runner/core';
import {MongoHandler, MongoDBInterface} from './MongoHandler';

export class MongoAdapter extends MigrationScriptExecutor<MongoDBInterface, MongoHandler> {
  private constructor(deps: IMigrationExecutorDependencies<MongoDBInterface, MongoHandler>) {
    super(deps);
  }

  // Async factory method using createInstance helper
  static async getInstance(options: IExecutorOptions<MongoDBInterface>): Promise<MongoAdapter> {
    return MigrationScriptExecutor.createInstance(
      MongoAdapter,
      options,
      async (config) => {
        const handler = new MongoHandler(config.mongoUri || 'mongodb://localhost');
        await handler.connect();  // Async initialization
        return handler;
      }
    );
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
import {MongoDBInterface} from './MongoHandler';

// Create CLI with custom MongoDB commands using extendCLI
const program = createCLI<MongoDBInterface, MongoAdapter>({
  name: 'msr-mongodb',
  description: 'MongoDB Migration Runner',
  version: '1.0.0',

  // Default config merged before CLI flags
  config: {
    folder: './migrations',
    tableName: '_schema_versions',
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mydb'
  },

  // Async factory using getInstance (v0.8.2+)
  createExecutor: async (config) => {
    return MongoAdapter.getInstance({config});
  },

  // Add MongoDB-specific commands with full type safety
  extendCLI: (program, createExecutor) => {
    program
      .command('mongo:indexes')
      .description('Show all indexes in database')
      .action(async () => {
        try {
          const adapter = await createExecutor(); // ✓ Typed as MongoAdapter!
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
          const adapter = await createExecutor(); // ✓ Async executor support!
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

## Troubleshooting

### Error: "Property 'handler' is missing"

**Full Error:**
```
TypeError: Handler is required in IMigrationExecutorDependencies.
```

**Cause:** You're likely using `IExecutorOptions` in your constructor instead of `IMigrationExecutorDependencies`, or forgetting to create the handler before calling `super()`.

**Solution (Async Initialization):**
```typescript
// ✅ CORRECT
export class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
    private constructor(deps: IMigrationExecutorDependencies<IDB, MyHandler>) {
        super(deps);  // ✅ Has handler
    }

    static async getInstance(options: IExecutorOptions<IDB>): Promise<MyAdapter> {
        const handler = await MyHandler.connect(options.config);
        return new MyAdapter({ handler, ...options });  // Spread options
    }
}
```

**Solution (Sync Initialization):**
```typescript
// ✅ CORRECT
export class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
    constructor(options: IExecutorOptions<IDB>) {
        const handler = new MyHandler(options.config);  // Create handler first
        super({ handler, ...options });  // Pass to parent
    }
}
```

**Wrong Pattern:**
```typescript
// ❌ WRONG
export class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
    constructor(options: IExecutorOptions<IDB>) {  // Missing handler!
        super(options);  // ❌ Error
    }
}
```

---

### Error: Generic Type Mismatch

**Full Error:**
```
Type 'IMigrationExecutorDependencies<IDB>' is not assignable to parameter of type 'IMigrationExecutorDependencies<IDB, MyHandler>'
```

**Cause:** You didn't specify the handler type in your constructor parameter.

**Solution:**
```typescript
// ❌ WRONG - Missing THandler generic
constructor(deps: IMigrationExecutorDependencies<IDB>) {
    super(deps);
}

// ✅ CORRECT - Include THandler
constructor(deps: IMigrationExecutorDependencies<IDB, MyHandler>) {
    super(deps);
}
```

---

### IExecutorOptions vs IMigrationExecutorDependencies

**When to use each:**

| Interface | Use In | Includes Handler? | Purpose |
|-----------|--------|-------------------|---------|
| `IExecutorOptions` | Public factory methods (`getInstance()`) | ❌ No | Public API for users |
| `IMigrationExecutorDependencies` | Private constructor | ✅ Yes (required) | Internal API for construction |

**Pattern:**
```typescript
export class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
    // Private constructor - uses IMigrationExecutorDependencies
    private constructor(deps: IMigrationExecutorDependencies<IDB, MyHandler>) {
        super(deps);
    }

    // Public factory - uses IExecutorOptions
    static async getInstance(options: IExecutorOptions<IDB>): Promise<MyAdapter> {
        const handler = await MyHandler.connect(options.config);
        // Spread IExecutorOptions into IMigrationExecutorDependencies
        return new MyAdapter({ handler, ...options });
    }
}
```

---

### TypeScript Errors with Custom Config

**Issue:** You want to use a custom config type but getting type errors.

**Solution (v0.8.2+):**
```typescript
// Define custom config
class AppConfig extends Config {
    databaseUrl?: string;
    poolSize?: number;
}

// Use TConfig generic parameter
export class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler, AppConfig> {
    private constructor(deps: IMigrationExecutorDependencies<IDB, MyHandler, AppConfig>) {
        super(deps);
        // this.config is now typed as AppConfig
        console.log(this.config.databaseUrl);  // ✅ Type-safe!
    }

    static async getInstance(options: IExecutorOptions<IDB, AppConfig>): Promise<MyAdapter> {
        const handler = await MyHandler.connect(options.config.databaseUrl);
        return new MyAdapter({ handler, ...options });
    }
}
```

---

### Async Initialization Not Working

**Issue:** Your adapter requires async initialization but getting type errors or runtime issues.

**Solution:** Use the `createInstance` helper (v0.8.2+):

```typescript
export class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
    private constructor(deps: IMigrationExecutorDependencies<IDB, MyHandler>) {
        super(deps);
    }

    static async getInstance(options: IExecutorOptions<IDB>): Promise<MyAdapter> {
        return MigrationScriptExecutor.createInstance(
            MyAdapter,
            options,
            async (config) => MyHandler.connect(config)
        );
    }
}
```

**Benefits:**
- ✅ Standardized pattern
- ✅ Reduces boilerplate
- ✅ Type-safe
- ✅ Handles option spreading automatically

See [Async Adapter Initialization](#async-adapter-initialization-v082) for details.

---

### CLI Commands Not Working

**Issue:** Custom commands not appearing or getting type errors.

**Solution:** Use `extendCLI` callback with proper typing:

```typescript
const program = createCLI<IDB, MyAdapter>({
    name: 'my-cli',
    createExecutor: async (config) => MyAdapter.getInstance({ config }),

    extendCLI: (program, createExecutor) => {
        program
            .command('custom:command')
            .action(async () => {
                const adapter = await createExecutor();  // ✅ Typed!
                const handler = adapter.getHandler();    // ✅ Access handler
                // Your custom logic
            });
    }
});
```

---

## Next Steps

- [Writing Migrations](./writing-migrations.html)
- [Configuration](../configuration/)
- [Environment Variables](./environment-variables.html)
- [Transaction Management](./transaction-management.html)
