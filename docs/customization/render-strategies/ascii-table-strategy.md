---
layout: default
title: AsciiTableRenderStrategy
parent: Render Strategies
nav_order: 1
---

# AsciiTableRenderStrategy

The `AsciiTableRenderStrategy` is the default rendering strategy that outputs formatted ASCII tables to the terminal, providing a rich visual display of migration information.

## Overview

AsciiTableRenderStrategy is perfect for local development and manual migration runs where you want immediate, human-readable feedback. It displays migration information in beautifully formatted tables with borders, alignment, and human-readable timestamps.

## Features

- ✅ Zero configuration required (default strategy)
- ✅ Beautiful ASCII tables with borders and alignment
- ✅ Human-readable timestamps with relative time ("2 hours ago")
- ✅ Color-coded warnings for ignored migrations
- ✅ ASCII art banner for visual appeal
- ✅ Duration formatting in seconds
- ✅ "Found Locally" indicator for missing migrations

## Installation

AsciiTableRenderStrategy is included in the core MSR package:

```typescript
import { AsciiTableRenderStrategy } from '@migration-script-runner/core';
```

## Basic Usage

### With MigrationScriptExecutor (Default)

Since AsciiTableRenderStrategy is the default, you don't need to configure anything:

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';

// Automatically uses AsciiTableRenderStrategy
const config = new Config();
const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

### Explicit Configuration

You can explicitly set the strategy if needed:

```typescript
import {
    MigrationScriptExecutor,
    AsciiTableRenderStrategy,
    ConsoleLogger
} from '@migration-script-runner/core';

const logger = new ConsoleLogger();
const strategy = new AsciiTableRenderStrategy(logger);

const executor = new MigrationScriptExecutor(handler, config, {
    logger,
    renderStrategy: strategy
});

await executor.migrate();
```

### With Custom Logger

Works seamlessly with any logger implementation:

```typescript
import {
    AsciiTableRenderStrategy,
    FileLogger
} from '@migration-script-runner/core';

const logger = new FileLogger({ logPath: './migrations.log' });
const strategy = new AsciiTableRenderStrategy(logger);

const executor = new MigrationScriptExecutor(handler, config, {
    logger,
    renderStrategy: strategy
});
```

## Output Examples

### Banner

```
  __  __ _                 _   _               ____            _       _
 |  \/  (_) __ _ _ __ __ _| |_(_) ___  _ __   / ___|  ___ _ __(_)_ __ | |_
 | |\/| | |/ _` | '__/ _` | __| |/ _ \| '_ \  \___ \ / __| '__| | '_ \| __|
 | |  | | | (_| | | | (_| | |_| | (_) | | | |  ___) | (__| |  | | |_) | |_
 |_|  |_|_|\__, |_|  \__,_|\__|_|\___/|_| |_| |____/ \___|_|  |_| .__/ \__|
           |___/                                                |_| MSR v0.3.0: PostgreSQL Handler
```

### Migrated Table

```
+-------------------------------------------------------------------------------------------------------+
|                                               Migrated                                                |
+-----------+--------------+--------------------------------------+----------+----------+---------------+
| Timestamp |     Name     |               Executed               | Duration | Username | Found Locally |
+-----------+--------------+--------------------------------------+----------+----------+---------------+
|       203 | create_users | 2025/01/22 14:30 (2 hours ago)       |   2.5s   |  admin   | Y             |
|       204 | add_posts    | 2025/01/22 14:35 (2 hours ago)       |   1.8s   |  admin   | Y             |
|       205 | add_comments | 2025/01/22 14:40 (a few seconds ago) |   0.95s  |  admin   | Y             |
+-----------+--------------+--------------------------------------+----------+----------+---------------+
```

### Pending Table

```
+----------------------------------------------------------------------------------------------+
|                                            Pending                                           |
+-----------+------------------+----------------------------------------------------------+
| Timestamp |       Name       |                           Path                           |
+-----------+------------------+----------------------------------------------------------+
|       206 | add_indexes      | /a../version-migration/V202501220206_add_indexes.ts             |
|       207 | optimize_queries | /a../version-migration/V202501220207_optimize_queries.ts        |
+-----------+------------------+----------------------------------------------------------+
```

### Executed Table

```
+------------------------------------------------+
|                   Executed                     |
+-----------+------------------+----------+-------+
| Timestamp |       Name       | Duration | Result|
+-----------+------------------+----------+-------+
|       206 | add_indexes      |   3.2s   | ✓ OK  |
|       207 | optimize_queries |   5.1s   | ✓ OK  |
+-----------+------------------+----------+-------+
```

### Ignored Scripts (Warning)

```
+-------------------------------------------------------------------------------+
|                              Ignored Scripts                                  |
+-----------+------------------+----------------------------------------------+
| Timestamp |       Name       |                    Path                      |
+-----------+------------------+----------------------------------------------+
|       100 | old_migration    | /a../version-migration/V202501220100_old.ts         |
+-----------+------------------+----------------------------------------------+
```

## Table Features

### Column Alignment

- **Timestamp**: Left-aligned
- **Name**: Left-aligned
- **Executed**: Left-aligned
- **Duration**: Center-aligned
- **Username**: Left-aligned
- **Found Locally**: Center-aligned

### Timestamp Formatting

Timestamps are displayed in two formats for convenience:

```
2025/01/22 14:30 (2 hours ago)
```

- **Absolute**: YYYY/MM/DD HH:mm format
- **Relative**: Human-readable "ago" format (e.g., "2 hours ago", "5 minutes ago")

### Duration Formatting

Durations are displayed in seconds with appropriate precision:

```
2.5s    - 2.5 seconds
0.123s  - 123 milliseconds
-3s     - Negative duration (when finish < start)
```

### Found Locally Indicator

Shows whether migration files still exist locally:

- **Y** - File found locally
- **N** - File missing (only in database history)

## Use Cases

### Local Development

Perfect for interactive development with immediate visual feedback:

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';

const config = new Config();
const executor = new MigrationScriptExecutor(handler, config);

// Beautiful table output for quick review
await executor.list();

// Clear visual indication of what will run
await executor.migrate();
```

### Manual Migration Runs

Ideal for manual execution where human readability is important:

```typescript
// DBA reviewing migrations before production deployment
await executor.list(20);  // Last 20 migrations in readable format
```

### CLI Tools

Perfect for command-line interfaces:

```bash
$ npm run migrate
  __  __ _                 _   _               ____            _       _
 |  \/  (_) __ _ _ __ __ _| |_(_) ___  _ __   / ___|  ___ _ __(_)_ __ | |_
 ...

+-------------------------------------------------------------------------------------------------------+
|                                               Migrated                                                |
+-----------+--------------+--------------------------------------+----------+----------+---------------+
...
```

### Interactive Scripts

Great for scripts that require user review:

```typescript
import { AsciiTableRenderStrategy } from '@migration-script-runner/core';

const config = new Config();
const executor = new MigrationScriptExecutor(handler, config);

console.log('Current migration status:');
await executor.list();

const answer = await prompt('Proceed with migration? (y/n): ');
if (answer === 'y') {
    await executor.migrate();
}
```

## Best Practices

### 1. Use for Development and Interactive Scenarios

```typescript
// Good: Local development
const config = new Config();
const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();

// Avoid for CI/CD: Use JsonRenderStrategy instead
// CI/CD systems can't parse ASCII tables effectively
```

### 2. Limit Output for Large Migration Lists

```typescript
// Good: Show recent migrations
await executor.list(20);  // Last 20 migrations

// Avoid: Showing all migrations in production
await executor.list();  // Could be thousands of lines
```

### 3. Combine with Appropriate Logger

```typescript
// Good: Console logger for terminal output
import { ConsoleLogger, AsciiTableRenderStrategy } from '@migration-script-runner/core';

const logger = new ConsoleLogger();
const strategy = new AsciiTableRenderStrategy(logger);

// Avoid: File logger with ASCII tables (creates large files)
// Use JsonRenderStrategy with FileLogger instead
```

## Limitations

- **Not machine-parsable**: Tables are for human reading only
- **Large output**: ASCII borders increase file size significantly
- **Terminal-dependent**: May not display correctly in all environments
- **No color in files**: Color codes appear as escape sequences when piped to files
- **Fixed width**: Long names may be truncated or cause layout issues

For CI/CD and automated scenarios, see [JsonRenderStrategy](json-strategy.md).

## API Reference

### Constructor

```typescript
constructor(logger?: ILogger)
```

Creates a new AsciiTableRenderStrategy instance.

**Parameters:**
- `logger` (optional): Logger instance for output. Defaults to `ConsoleLogger`.

**Example:**
```typescript
const strategy = new AsciiTableRenderStrategy();                    // Uses default ConsoleLogger
const strategy = new AsciiTableRenderStrategy(new FileLogger(...)); // Uses custom logger
```

### Methods

All methods are called internally by `MigrationRenderer`:

#### `renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit?: number): void`

Renders the table of previously executed migrations.

#### `renderPending(scripts: MigrationScript[]): void`

Renders the table of pending migrations.

#### `renderExecuted(scripts: IMigrationInfo[]): void`

Renders the table of migrations executed in the current run.

#### `renderIgnored(scripts: MigrationScript[]): void`

Renders the table of ignored migrations (with warning color).

#### `renderBanner(version: string, handlerName: string): void`

Renders the ASCII art banner with version and handler name.

#### `static getDuration(m: IMigrationInfo): string`

Helper method to calculate and format migration duration.

**Returns:** Duration string in format "{seconds}s" (e.g., "2.5s")

