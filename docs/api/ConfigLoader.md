---
layout: default
title: ConfigLoader
parent: API Reference
nav_order: 10
---

# ConfigLoader API
{: .no_toc }

Utility class for loading configuration using environment variables and config files
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

`ConfigLoader` is a utility class that provides waterfall configuration loading with support for:
- Environment variables (`MSR_*`)
- Configuration files (`msr.config.js`, `msr.config.json`)
- Built-in defaults
- Constructor overrides

**New in v0.5.0**

**Import:**
```typescript
import { ConfigLoader } from '@migration-script-runner/core';
```

---

## EnvironmentVariables Enum

`ConfigLoader` uses the [`EnvironmentVariables`](../../src/model/EnvironmentVariables.ts) enum internally for type-safe access to environment variable names. This enum is also exported for your use:

```typescript
import { EnvironmentVariables as ENV } from '@migration-script-runner/core';

// Type-safe access to environment variables
const folder = process.env[ENV.MSR_FOLDER];
const dryRun = process.env[ENV.MSR_DRY_RUN];
const tableName = process.env[ENV.MSR_TABLE_NAME];
```

**Benefits:**
- **Type safety** - Compile-time checking prevents typos
- **Auto-completion** - IDEs can suggest all available variable names
- **Refactoring** - Rename safely across your codebase
- **Documentation** - Each enum value has JSDoc comments with defaults

**See Also:**
- [EnvironmentVariables.ts Source](../../src/model/EnvironmentVariables.ts) - Complete enum definition
- [Environment Variables Reference](../reference/environment-variables) - Table of all MSR_* variables

---

## Static Methods

### load()

Load configuration using waterfall approach.

**Signature:**
```typescript
static load(
    overrides?: Partial<Config>,
    baseDir?: string
): Config
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `overrides` | `Partial<Config>` | `undefined` | Optional configuration overrides (highest priority) |
| `baseDir` | `string` | `process.cwd()` | Base directory to search for config files |

**Returns:** `Config` - Fully loaded configuration object

**Priority Order:**
1. Built-in defaults (lowest)
2. Config file
3. Environment variables
4. Constructor overrides (highest)

**Examples:**

```typescript
// Basic usage - load with waterfall
const config = ConfigLoader.load();

// With overrides (highest priority)
const config = ConfigLoader.load({
    folder: './migrations',
    dryRun: true
});

// From specific directory
const config = ConfigLoader.load({}, '/app');

// Use with MigrationScriptExecutor
const executor = new MigrationScriptExecutor(handler, config);
```

**Error Handling:**
- Invalid config files are logged as warnings but don't stop loading
- Falls back to defaults + environment variables if file loading fails

---

### loadFromEnv()

Load a single property from environment variable with automatic type coercion.

**Signature:**
```typescript
static loadFromEnv<T extends string | number | boolean>(
    envVarName: string,
    defaultValue: T
): T
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `envVarName` | `string` | Name of the environment variable |
| `defaultValue` | `T` | Default value if env var not set (determines return type) |

**Returns:** `T` - Value from env var (coerced to type) or default value

**Type Coercion:**
- **boolean**: `'true'/'1'/'yes'/'on'` → `true`, anything else → `false`
- **number**: Parsed as float (returns `NaN` with warning if invalid)
- **string**: Returned as-is

**Examples:**

```typescript
// String value
const folder = ConfigLoader.loadFromEnv('MSR_FOLDER', './migrations');
// Returns: string from MSR_FOLDER or './migrations'

// Boolean value
const dryRun = ConfigLoader.loadFromEnv('MSR_DRY_RUN', false);
// MSR_DRY_RUN=true → true
// MSR_DRY_RUN=1 → true
// MSR_DRY_RUN=false → false
// MSR_DRY_RUN not set → false (default)

// Number value
const limit = ConfigLoader.loadFromEnv('MSR_DISPLAY_LIMIT', 0);
// MSR_DISPLAY_LIMIT=20 → 20
// MSR_DISPLAY_LIMIT not set → 0 (default)

// In adapters (custom env vars)
class PostgreSQLConfig extends Config {
    host: string = ConfigLoader.loadFromEnv('PG_HOST', 'localhost');
    port: number = ConfigLoader.loadFromEnv('PG_PORT', 5432);
    ssl: boolean = ConfigLoader.loadFromEnv('PG_SSL', false);
}
```

---

### loadObjectFromEnv()

Load a complex object from a JSON environment variable.

**Signature:**
```typescript
static loadObjectFromEnv<T extends object>(
    envVarName: string,
    defaultValue: T
): T
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `envVarName` | `string` | Name of the environment variable containing JSON |
| `defaultValue` | `T` | Default object if env var not set or invalid |

**Returns:** `T` - Parsed object merged with default value

**Examples:**

```typescript
// Pool configuration from JSON
const poolConfig = ConfigLoader.loadObjectFromEnv('PG_POOL', {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000
});

// Environment:
// PG_POOL='{"max":20,"idleTimeoutMillis":60000}'
// Result: { min: 2, max: 20, idleTimeoutMillis: 60000 }

// Invalid JSON falls back to default
// PG_POOL='invalid json'
// Result: { min: 2, max: 10, idleTimeoutMillis: 30000 }
```

**Error Handling:**
- Invalid JSON logs warning and returns default value
- Missing env var returns default value
- Parsed JSON is merged with default (not replaced)

---

### loadNestedFromEnv()

Load a nested object from dot-notation environment variables (recommended).

**Signature:**
```typescript
static loadNestedFromEnv<T extends Record<string, any>>(
    prefix: string,
    defaultValue: T
): T
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `prefix` | `string` | Prefix for environment variables (e.g., 'MSR_LOGGING') |
| `defaultValue` | `T` | Default object structure with types |

**Returns:** `T` - Object built from env vars or default value

**Naming Convention:**
- `camelCase` properties → `SNAKE_CASE` env vars
- `maxFiles` → `MAX_FILES`
- `logSuccessful` → `LOG_SUCCESSFUL`

**Examples:**

```typescript
// Logging configuration
const logging = ConfigLoader.loadNestedFromEnv('MSR_LOGGING', {
    enabled: false,
    path: './logs',
    maxFiles: 10
});

// Environment:
// MSR_LOGGING_ENABLED=true
// MSR_LOGGING_PATH=./custom/logs
// MSR_LOGGING_MAX_FILES=20
// Result: { enabled: true, path: './custom/logs', maxFiles: 20 }

// Backup configuration
const backup = ConfigLoader.loadNestedFromEnv('MSR_BACKUP', {
    folder: './backups',
    timestamp: true,
    deleteBackup: true
});

// Environment:
// MSR_BACKUP_FOLDER=/var/backups
// MSR_BACKUP_TIMESTAMP=false
// Result: { folder: '/var/backups', timestamp: false, deleteBackup: true }
```

**Type Coercion:**
- Automatic type coercion based on default value types
- Boolean, number, and string types supported
- Missing env vars keep default values

---

### loadFromFile()

Load configuration from a JSON or JavaScript file.

**Signature:**
```typescript
static loadFromFile<T = any>(filePath: string): T
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | Path to configuration file (absolute or relative) |

**Returns:** `T` - Configuration object from file

**Throws:** `Error` if file not found or invalid

**Supported Formats:**
- `.json` files
- `.js` files (CommonJS: `module.exports`)
- ES modules with `default` export

**Examples:**

```typescript
// Load from JSON file
const config = ConfigLoader.loadFromFile('./config/production.json');

// Load from JS file
const config = ConfigLoader.loadFromFile('./config/production.js');

// With type parameter
const config = ConfigLoader.loadFromFile<Partial<Config>>('./msr.config.js');

// Handle ES module default export automatically
// File: module.exports = { default: { ... } }
// Returns: { ... } (unwraps default)
```

**Error Handling:**
- Throws `Error` with detailed message if file not found
- Throws `Error` if file cannot be parsed

---

### findConfigFile()

Find config file using search priority.

**Signature:**
```typescript
static findConfigFile(baseDir?: string): string | undefined
```

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `baseDir` | `string` | `process.cwd()` | Base directory to search |

**Returns:** `string | undefined` - Path to config file if found, `undefined` otherwise

**Search Priority:**
1. `MSR_CONFIG_FILE` environment variable (if set)
2. `./msr.config.js` (if exists)
3. `./msr.config.json` (if exists)

**Examples:**

```typescript
// Find config in current directory
const configPath = ConfigLoader.findConfigFile();
if (configPath) {
    console.log(`Using config: ${configPath}`);
}

// Find config in specific directory
const configPath = ConfigLoader.findConfigFile('/app');

// Check for custom config location
process.env.MSR_CONFIG_FILE = './config/custom.config.js';
const configPath = ConfigLoader.findConfigFile();
// Returns: '/absolute/path/to/config/custom.config.js' (if exists)
```

**Warnings:**
- Logs warning if `MSR_CONFIG_FILE` points to non-existent file
- Returns `undefined` silently if no config files found

---

### applyEnvironmentVariables()

Apply MSR_* environment variables to config object.

**Signature:**
```typescript
static applyEnvironmentVariables(config: Config): void
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `config` | `Config` | Config object to apply env vars to (modified in-place) |

**Returns:** `void` (modifies config in-place)

**Environment Variables Applied:**
- Simple properties: `MSR_FOLDER`, `MSR_TABLE_NAME`, etc.
- Boolean flags: `MSR_DRY_RUN`, `MSR_RECURSIVE`, etc.
- Nested objects: `MSR_LOGGING_*`, `MSR_BACKUP_*`
- File patterns: `MSR_FILE_PATTERNS` (JSON array)

**Examples:**

```typescript
const config = new Config();
ConfigLoader.applyEnvironmentVariables(config);

// Environment:
// MSR_FOLDER=./migrations
// MSR_DRY_RUN=true
// MSR_LOGGING_ENABLED=true
// Result: config.folder = './migrations', config.dryRun = true, etc.
```

**Type Coercion:**
- Uses type coercion based on existing config property types
- See [loadFromEnv()](#loadfromenv) for coercion rules

---

### validateRequired()

Validate that required environment variables are set.

**Signature:**
```typescript
static validateRequired(requiredVars: string[]): void
```

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `requiredVars` | `string[]` | Array of required environment variable names |

**Returns:** `void`

**Throws:** `Error` with list of missing variables if any are not set

**Examples:**

```typescript
// Validate required variables
ConfigLoader.validateRequired([
    'DATABASE_URL',
    'MSR_FOLDER',
    'MSR_TABLE_NAME'
]);

// If missing, throws error like:
// Error: Missing required environment variables:
//   - DATABASE_URL
//   - MSR_FOLDER
// Please set these variables before running.

// In adapter, ensure critical env vars are set
class PostgreSQLAdapter {
    constructor() {
        ConfigLoader.validateRequired([
            'PG_HOST',
            'PG_DATABASE',
            'PG_USER',
            'PG_PASSWORD'
        ]);
    }
}
```

**Use Cases:**
- Validate deployment configuration
- Ensure required secrets are set
- Fail-fast with clear error messages
- Database adapter initialization

---

## Usage Patterns

### Automatic Loading

**Recommended:** Let MSR load configuration automatically:

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';

// Automatically loads: defaults → file → env vars
const executor = new MigrationScriptExecutor(handler);
await executor.up();
```

---

### Manual Loading

**Advanced:** Load configuration explicitly:

```typescript
import { ConfigLoader, MigrationScriptExecutor } from '@migration-script-runner/core';

// Load with waterfall
const config = ConfigLoader.load();

// Or load with overrides
const config = ConfigLoader.load({
    dryRun: true,
    strictValidation: true
});

const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

---

### Adapter Configuration

**For Database Adapters:** Load adapter-specific environment variables:

```typescript
import { ConfigLoader, Config } from '@migration-script-runner/core';

export class PostgreSQLConfig extends Config {
    // Adapter-specific properties
    host: string = ConfigLoader.loadFromEnv('PG_HOST', 'localhost');
    port: number = ConfigLoader.loadFromEnv('PG_PORT', 5432);
    database: string = ConfigLoader.loadFromEnv('PG_DATABASE', 'postgres');
    user: string = ConfigLoader.loadFromEnv('PG_USER', 'postgres');
    password: string = ConfigLoader.loadFromEnv('PG_PASSWORD', '');
    ssl: boolean = ConfigLoader.loadFromEnv('PG_SSL', false);

    // Pool configuration
    pool = ConfigLoader.loadNestedFromEnv('PG_POOL', {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000
    });

    constructor() {
        super();

        // Validate required variables
        ConfigLoader.validateRequired([
            'PG_HOST',
            'PG_DATABASE',
            'PG_USER',
            'PG_PASSWORD'
        ]);
    }
}
```

---

## Type Definitions

### Config

```typescript
class Config {
    // Migration settings
    folder: string;
    tableName: string;
    beforeMigrateName: string;
    displayLimit: number;
    recursive: boolean;
    filePatterns: RegExp[];

    // Validation settings
    validateBeforeRun: boolean;
    strictValidation: boolean;
    downMethodPolicy: DownMethodPolicy;
    customValidators: IValidator[];

    // Rollback settings
    rollbackStrategy: RollbackStrategy;

    // Logging configuration
    logging: IExecutionSummaryConfig;

    // Backup configuration
    backup?: BackupConfig;

    // Dry run mode
    dryRun: boolean;
}
```

---

## Design Principles

### Database-Agnostic

ConfigLoader is database-agnostic and does not parse database-specific connection strings:

```typescript
// ❌ NOT in ConfigLoader
ConfigLoader.parseDatabaseUrl('postgres://...');

// ✅ Use in database adapters
class PostgreSQLAdapter {
    parseConnectionString(url: string) {
        // Database-specific parsing
    }
}
```

---

### Adapter-Friendly

Helper methods designed for database adapters to use:

```typescript
class MyDatabaseConfig extends Config {
    // Use ConfigLoader helpers for your own env vars
    dbHost = ConfigLoader.loadFromEnv('DB_HOST', 'localhost');
    dbPort = ConfigLoader.loadFromEnv('DB_PORT', 5432);

    connection = ConfigLoader.loadNestedFromEnv('DB_CONNECTION', {
        timeout: 5000,
        retries: 3
    });
}
```

---

### Type-Safe

Automatic type coercion based on default values:

```typescript
// Type inferred from default value
const enabled = ConfigLoader.loadFromEnv('ENABLED', false);
// Type: boolean

const port = ConfigLoader.loadFromEnv('PORT', 5432);
// Type: number

const host = ConfigLoader.loadFromEnv('HOST', 'localhost');
// Type: string
```

---

## See Also

- **[Environment Variables Guide](../user-guides/environment-variables)** - How-to guide with examples
- **[Environment Variables Reference](../reference/environment-variables)** - Complete table of all MSR_* variables
- **[Configuration Overview](../configuration/)** - Config class documentation
- **[Getting Started](../getting-started)** - Quick start guide

---

## Examples

### Complete Production Setup

```typescript
import { ConfigLoader, MigrationScriptExecutor } from '@migration-script-runner/core';
import { PostgreSQLHandler } from '@migration-script-runner/postgresql';

// Validate required environment variables
ConfigLoader.validateRequired([
    'DATABASE_URL',
    'MSR_FOLDER'
]);

// Load configuration
const config = ConfigLoader.load({
    // Override for this specific run
    strictValidation: process.env.CI === 'true'
});

// Create executor
const handler = new PostgreSQLHandler(process.env.DATABASE_URL);
const executor = new MigrationScriptExecutor(handler, config);

// Run migrations
await executor.migrate();
```

### Development with .env File

```bash
# .env.development
MSR_FOLDER=./migrations
MSR_DRY_RUN=false
MSR_LOGGING_ENABLED=true
MSR_LOGGING_PATH=./logs
MSR_BACKUP_DELETE_BACKUP=true
```

```typescript
import 'dotenv/config';  // Load .env file
import { MigrationScriptExecutor } from '@migration-script-runner/core';

// Automatically uses environment variables from .env
const executor = new MigrationScriptExecutor(handler);
await executor.up();
```

### Custom Config Directory

```typescript
import { ConfigLoader } from '@migration-script-runner/core';

// Load from custom directory
const config = ConfigLoader.load({}, '/app/config');

// Or use MSR_CONFIG_FILE
process.env.MSR_CONFIG_FILE = './config/production.config.js';
const config = ConfigLoader.load();
```
