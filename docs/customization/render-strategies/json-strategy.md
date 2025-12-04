---
layout: default
title: JsonRenderStrategy
parent: Render Strategies
nav_order: 2
---

# JsonRenderStrategy

The `JsonRenderStrategy` renders migration information as structured JSON, perfect for CI/CD pipelines, log aggregators, and automated tools that need to parse migration output programmatically.

## Overview

JsonRenderStrategy provides machine-readable output in JSON format with support for both pretty-printed (indented) and compact modes. This makes it ideal for integrating migrations into automated workflows, monitoring systems, and log analysis tools.

## Features

- ✅ Structured JSON output
- ✅ Pretty-printed (indented) or compact formatting
- ✅ ISO 8601 timestamps for universal parsing
- ✅ Human-readable relative time ("2 hours ago")
- ✅ Duration in seconds (numeric)
- ✅ Boolean flags for easy filtering
- ✅ Machine-parsable format
- ✅ Small file size (compact mode)

## Installation

JsonRenderStrategy is included in the core MSR package:

```typescript
import { JsonRenderStrategy } from '@migration-script-runner/core';
```

## Basic Usage

### Pretty Mode (Default)

Pretty-printed JSON with indentation for readability:

```typescript
import { MigrationScriptExecutor, JsonRenderStrategy } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new JsonRenderStrategy(true)  // pretty: true
});

await executor.migrate();
```

### Compact Mode

Compact JSON for log aggregation and minimal file size:

```typescript
import { MigrationScriptExecutor, JsonRenderStrategy } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new JsonRenderStrategy(false)  // pretty: false
});

await executor.migrate();
```

### With Custom Logger

```typescript
import {
    MigrationScriptExecutor,
    JsonRenderStrategy,
    FileLogger
} from '@migration-script-runner/core';

const logger = new FileLogger({ logPath: './migrations.json' });
const strategy = new JsonRenderStrategy(true);

const executor = new MigrationScriptExecutor({ handler, 
    logger,
    renderStrategy: strategy
});
```

## Output Examples

### Banner (Pretty)

```json
{
  "banner": {
    "application": "Migration Script Runner",
    "version": "v.0.3.0",
    "handler": "PostgreSQL Handler"
  }
}
```

### Migrated (Pretty)

```json
{
  "migrated": [
    {
      "timestamp": 202501220100,
      "name": "add_users_table",
      "executed": "2025-01-22T01:00:00.000Z",
      "executedAgo": "2 hours ago",
      "duration": 2.5,
      "username": "admin",
      "foundLocally": true
    },
    {
      "timestamp": 202501220200,
      "name": "add_posts_table",
      "executed": "2025-01-22T02:00:00.000Z",
      "executedAgo": "1 hour ago",
      "duration": 1.8,
      "username": "admin",
      "foundLocally": true
    }
  ]
}
```

### Pending (Compact)

```json
{"pending":[{"timestamp":202501220300,"name":"add_indexes","path":"/a../version-migration/V202501220300_add_indexes.ts"},{"timestamp":202501220400,"name":"optimize_queries","path":"/a../version-migration/V202501220400_optimize_queries.ts"}]}
```

### Executed (Pretty)

```json
{
  "executed": [
    {
      "timestamp": 202501220300,
      "name": "add_indexes",
      "duration": 3.2,
      "result": "Indexes created successfully"
    },
    {
      "timestamp": 202501220400,
      "name": "optimize_queries",
      "duration": 5.1,
      "result": "Query optimization complete"
    }
  ]
}
```

### Ignored (Pretty)

```json
{
  "ignored": [
    {
      "timestamp": 202501220050,
      "name": "old_migration",
      "path": "/a../version-migration/V202501220050_old_migration.ts"
    }
  ]
}
```

## JSON Schema

### Migrated Object

```typescript
interface MigratedOutput {
  migrated: Array<{
    timestamp: number;          // Migration timestamp (e.g., 202501220100)
    name: string;               // Migration name without version prefix
    executed: string;           // ISO 8601 timestamp
    executedAgo: string;        // Human-readable relative time
    duration: number;           // Duration in seconds
    username: string;           // User who executed the migration
    foundLocally: boolean;      // Whether file exists locally
  }>;
}
```

### Pending Object

```typescript
interface PendingOutput {
  pending: Array<{
    timestamp: number;          // Migration timestamp
    name: string;               // Migration name
    path: string;               // Full file path
  }>;
}
```

### Executed Object

```typescript
interface ExecutedOutput {
  executed: Array<{
    timestamp: number;          // Migration timestamp
    name: string;               // Migration name
    duration: number;           // Duration in seconds
    result: string | undefined; // Migration result message
  }>;
}
```

### Ignored Object

```typescript
interface IgnoredOutput {
  ignored: Array<{
    timestamp: number;          // Migration timestamp
    name: string;               // Migration name
    path: string;               // Full file path
  }>;
}
```

### Banner Object

```typescript
interface BannerOutput {
  banner: {
    application: string;        // Application name
    version: string;            // Version (e.g., "v.0.3.0")
    handler: string;            // Database handler name
  };
}
```

## Use Cases

### CI/CD Integration

Parse migration results in your CI/CD pipeline:

```typescript
import { MigrationScriptExecutor, JsonRenderStrategy } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new JsonRenderStrategy(false)  // Compact for CI logs
});

const result = await executor.migrate();

// Parse JSON output from logs
const migrations = JSON.parse(output);
if (migrations.executed && migrations.executed.length > 0) {
    console.log(`✓ Applied ${migrations.executed.length} migrations`);
}
```

### Log Aggregation

Send structured logs to aggregation services:

```typescript
import { FileLogger, JsonRenderStrategy } from '@migration-script-runner/core';

const logger = new FileLogger({
    logPath: '/var/l../version-migration/migrations.jsonl'  // JSON Lines format
});

const executor = new MigrationScriptExecutor({ handler, 
    logger,
    renderStrategy: new JsonRenderStrategy(false)  // Compact format
});

// Each migration produces a JSON line that can be ingested by:
// - Elasticsearch
// - Splunk
// - Datadog
// - CloudWatch Logs
```

### Monitoring and Alerts

Monitor migration status programmatically:

```typescript
import { JsonRenderStrategy } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new JsonRenderStrategy(true)
});

// Capture output
const output = captureStdout(() => executor.migrate());
const migrations = JSON.parse(output);

// Check for failures or warnings
if (migrations.ignored && migrations.ignored.length > 0) {
    await sendAlert({
        severity: 'warning',
        message: `${migrations.ignored.length} migrations were ignored`,
        details: migrations.ignored
    });
}

if (migrations.executed && migrations.executed.some(m => m.duration > 60)) {
    await sendAlert({
        severity: 'info',
        message: 'Slow migrations detected',
        details: migrations.executed.filter(m => m.duration > 60)
    });
}
```

### Reporting and Analytics

Generate migration reports:

```typescript
import fs from 'fs';
import { JsonRenderStrategy } from '@migration-script-runner/core';

// Capture migration history
const logger = new FileLogger({ logPath: './migration-report.json' });
const executor = new MigrationScriptExecutor({ handler, 
    logger,
    renderStrategy: new JsonRenderStrategy(true)
});

await executor.list();

// Parse and analyze
const report = JSON.parse(fs.readFileSync('./migration-report.json', 'utf-8'));
const slowMigrations = report.migrated.filter(m => m.duration > 5);
const missingLocally = report.migrated.filter(m => !m.foundLocally);

console.log(`Total migrations: ${report.migrated.length}`);
console.log(`Slow migrations (>5s): ${slowMigrations.length}`);
console.log(`Missing locally: ${missingLocally.length}`);
```

### API Integration

Expose migration status via REST API:

```typescript
import express from 'express';
import { JsonRenderStrategy } from '@migration-script-runner/core';

const app = express();

app.get('/a../version-migration/status', async (req, res) => {
    // Capture JSON output
    const output = await captureOutput(() => executor.list());
    const migrations = JSON.parse(output);

    res.json({
        total: migrations.migrated.length,
        latest: migrations.migrated[0],
        pending: migrations.pending?.length || 0
    });
});
```

## Best Practices

### 1. Use Compact Mode for Production Logs

```typescript
// Good: Minimal log file size
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new JsonRenderStrategy(false)
});

// Avoid: Large indented logs in production
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new JsonRenderStrategy(true)
});
```

### 2. Use Pretty Mode for Development

```typescript
// Good: Readable output during development
if (process.env.NODE_ENV === 'development') {
    strategy = new JsonRenderStrategy(true);
} else {
    strategy = new JsonRenderStrategy(false);
}
```

### 3. Validate JSON Output

```typescript
// Good: Handle parsing errors
try {
    const migrations = JSON.parse(output);
    // Process migrations
} catch (error) {
    console.error('Failed to parse migration output:', error);
}

// Avoid: Assuming valid JSON
const migrations = JSON.parse(output);  // May throw
```

### 4. Filter by Timestamp

```typescript
// Good: Use numeric timestamps for filtering
const recent = migrations.migrated.filter(m =>
    m.timestamp > 202501010000  // After Jan 1, 2025
);

// Avoid: Parsing ISO strings repeatedly
const recent = migrations.migrated.filter(m =>
    new Date(m.executed) > new Date('2025-01-01')
);
```

### 5. Monitor Duration Metrics

```typescript
// Good: Track slow migrations
const avgDuration = migrations.migrated.reduce((sum, m) => sum + m.duration, 0) / migrations.migrated.length;
const maxDuration = Math.max(...migrations.migrated.map(m => m.duration));

if (maxDuration > 60) {
    console.warn(`Slow migration detected: ${maxDuration}s`);
}
```

## Performance Considerations

### File Size Comparison

Example with 100 migrations:

- **Pretty mode**: ~50KB (readable, large)
- **Compact mode**: ~15KB (70% smaller)
- **ASCII tables**: ~80KB (largest, not parsable)

### Parsing Performance

JSON parsing is fast with modern engines:

```typescript
// Typical parsing times for 1000 migrations:
// - Pretty JSON: ~5ms
// - Compact JSON: ~3ms
```

## Limitations

- **Less human-readable**: Requires JSON viewer or parsing
- **No color coding**: Unlike ASCII tables
- **Streaming not supported**: Outputs complete JSON objects
- **No visual tables**: Data is structured but not formatted for display

For human-readable terminal output, see [AsciiTableRenderStrategy](ascii-table-strategy.md).

## API Reference

### Constructor

```typescript
constructor(pretty?: boolean, logger?: ILogger)
```

Creates a new JsonRenderStrategy instance.

**Parameters:**
- `pretty` (optional): Enable pretty-printing with indentation. Default: `true`
- `logger` (optional): Logger instance for output. Default: `ConsoleLogger`

**Examples:**
```typescript
new JsonRenderStrategy()                    // Pretty, default logger
new JsonRenderStrategy(true)                // Pretty, default logger
new JsonRenderStrategy(false)               // Compact, default logger
new JsonRenderStrategy(true, fileLogger)    // Pretty, custom logger
new JsonRenderStrategy(false, fileLogger)   // Compact, custom logger
```

### Methods

All methods are called internally by `MigrationRenderer`:

#### `renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit?: number): void`

Renders migrated scripts as JSON.

#### `renderPending(scripts: MigrationScript[]): void`

Renders pending migrations as JSON.

#### `renderExecuted(scripts: IMigrationInfo[]): void`

Renders executed migrations as JSON.

#### `renderIgnored(scripts: MigrationScript[]): void`

Renders ignored migrations as JSON (uses logger.warn).

#### `renderBanner(version: string, handlerName: string): void`

Renders banner information as JSON.

