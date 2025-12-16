---
layout: default
title: IMetricsCollector
parent: Interfaces
grand_parent: API Reference
nav_order: 10
---

# IMetricsCollector
{: .no_toc }

Interface for collecting metrics during migration execution.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

`IMetricsCollector` defines the contract for metrics collection implementations. Collectors receive lifecycle events during migration execution and can send metrics to various destinations (console, files, monitoring services, etc.).

**Added in:** v0.6.0

**Use cases:**
- Track migration performance
- Monitor execution times in production
- Debug slow migrations
- Send metrics to APM tools (Datadog, CloudWatch)
- Create audit trails

---

## Interface Definition

```typescript
interface IMetricsCollector {
  recordMigrationStart?(context: IMigrationContext): void | Promise<void>;
  recordMigrationComplete?(result: IMigrationResult, duration: number): void | Promise<void>;
  recordScriptStart?(script: MigrationScript): void | Promise<void>;
  recordScriptComplete?(script: MigrationScript, duration: number): void | Promise<void>;
  recordScriptError?(script: MigrationScript, error: Error): void | Promise<void>;
  recordRollback?(strategy: RollbackStrategy, success: boolean, duration?: number): void | Promise<void>;
  recordValidationErrors?(errors: ValidationError[]): void | Promise<void>;
  recordBackup?(backupPath: string, duration: number): void | Promise<void>;
  recordError?(error: Error): void | Promise<void>;
  close?(): void | Promise<void>;
}
```

**All methods are optional** - implement only what you need.

---

## Methods

### recordMigrationStart

Called when migration process begins.

```typescript
recordMigrationStart?(context: IMigrationContext): void | Promise<void>
```

**Parameters:**
- `context: IMigrationContext` - Migration context with pending and executed counts

**Example:**
```typescript
recordMigrationStart(context: IMigrationContext): void {
  console.log(`[METRICS] Migration started - ${context.pending} pending scripts`);
}
```

---

### recordMigrationComplete

Called when migration process completes (success or failure).

```typescript
recordMigrationComplete?(result: IMigrationResult, duration: number): void | Promise<void>
```

**Parameters:**
- `result: IMigrationResult` - Migration result with success status and executed scripts
- `duration: number` - Total execution time in milliseconds

**Example:**
```typescript
recordMigrationComplete(result: IMigrationResult, duration: number): void {
  if (result.success) {
    console.log(`[METRICS] Migration completed - ${result.executed.length} scripts in ${duration}ms`);
  } else {
    console.error(`[METRICS] Migration failed after ${duration}ms`);
  }
}
```

---

### recordScriptStart

Called when individual migration script starts executing.

```typescript
recordScriptStart?(script: MigrationScript): void | Promise<void>
```

**Parameters:**
- `script: MigrationScript` - Migration script being executed

**Example:**
```typescript
recordScriptStart(script: MigrationScript): void {
  console.log(`[METRICS] ${script.name} started`);
}
```

---

### recordScriptComplete

Called when individual migration script completes successfully.

```typescript
recordScriptComplete?(script: MigrationScript, duration: number): void | Promise<void>
```

**Parameters:**
- `script: MigrationScript` - Migration script that completed
- `duration: number` - Execution time in milliseconds

**Example:**
```typescript
recordScriptComplete(script: MigrationScript, duration: number): void {
  console.log(`[METRICS] ${script.name} completed in ${duration}ms`);
}
```

---

### recordScriptError

Called when individual migration script fails.

```typescript
recordScriptError?(script: MigrationScript, error: Error): void | Promise<void>
```

**Parameters:**
- `script: MigrationScript` - Migration script that failed
- `error: Error` - Error that caused the failure

**Example:**
```typescript
recordScriptError(script: MigrationScript, error: Error): void {
  console.error(`[METRICS] ${script.name} failed: ${error.message}`);
}
```

---

### recordRollback

Called when rollback is attempted.

```typescript
recordRollback?(strategy: RollbackStrategy, success: boolean, duration?: number): void | Promise<void>
```

**Parameters:**
- `strategy: RollbackStrategy` - Rollback strategy used (BACKUP, DOWN, BOTH, NONE)
- `success: boolean` - Whether rollback succeeded
- `duration?: number` - Optional rollback duration in milliseconds

**Example:**
```typescript
recordRollback(strategy: RollbackStrategy, success: boolean, duration?: number): void {
  const status = success ? 'succeeded' : 'failed';
  console.log(`[METRICS] Rollback (${strategy}) ${status}${duration ? ` in ${duration}ms` : ''}`);
}
```

---

### recordValidationErrors

Called when validation errors are found before migration execution.

```typescript
recordValidationErrors?(errors: ValidationError[]): void | Promise<void>
```

**Parameters:**
- `errors: ValidationError[]` - Array of validation errors

**Example:**
```typescript
recordValidationErrors(errors: ValidationError[]): void {
  console.warn(`[METRICS] Validation errors: ${errors.length} issues found`);
  errors.forEach(err => console.warn(`[METRICS]   - ${err.message}`));
}
```

---

### recordBackup

Called when database backup is created.

```typescript
recordBackup?(backupPath: string, duration: number): void | Promise<void>
```

**Parameters:**
- `backupPath: string` - Path or identifier of created backup
- `duration: number` - Backup creation time in milliseconds

**Example:**
```typescript
recordBackup(backupPath: string, duration: number): void {
  console.log(`[METRICS] Backup created in ${duration}ms: ${backupPath}`);
}
```

---

### recordError

Called when general error occurs (not migration script specific).

```typescript
recordError?(error: Error): void | Promise<void>
```

**Parameters:**
- `error: Error` - Error that occurred

**Example:**
```typescript
recordError(error: Error): void {
  console.error(`[METRICS] Error: ${error.message}`);
}
```

---

### close

Called when metrics collector should clean up resources (e.g., close file handles, flush buffers).

```typescript
close?(): void | Promise<void>
```

**Example:**
```typescript
async close(): Promise<void> {
  await this.fileHandle.close();
  console.log('[METRICS] Collector closed');
}
```

---

## Usage

### Basic Implementation

```typescript
import { IMetricsCollector, MigrationScript, IMigrationResult } from '@migration-script-runner/core';

class SimpleMetricsCollector implements IMetricsCollector {
  recordScriptComplete(script: MigrationScript, duration: number): void {
    console.log(`✓ ${script.name} completed in ${duration}ms`);
  }

  recordScriptError(script: MigrationScript, error: Error): void {
    console.error(`✗ ${script.name} failed: ${error.message}`);
  }
}
```

### With Dependency Injection

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new SimpleMetricsCollector()
  ], 
  config 
});

await executor.up();
```

### Multiple Collectors

```typescript
const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new ConsoleMetricsCollector(),      // Real-time feedback
    new JsonMetricsCollector({          // Detailed analysis
      filePath: './metrics/migration.json'
    }),
    new DatadogCollector({              // Production monitoring
      apiKey: process.env.DD_API_KEY
    })
  ], 
  config 
});
```

---

## Built-in Implementations

MSR includes four production-ready collectors:

### ConsoleMetricsCollector

Zero-config console output for development.

```typescript
import { ConsoleMetricsCollector } from '@migration-script-runner/core';

new ConsoleMetricsCollector()
```

**[View ConsoleMetricsCollector docs →](../../customization/metrics/console-collector)**

---

### LoggerMetricsCollector

Send metrics through any ILogger implementation.

```typescript
import { LoggerMetricsCollector, FileLogger } from '@migration-script-runner/core';

new LoggerMetricsCollector({
  logger: new FileLogger('./logs/metrics.log')
})
```

**[View LoggerMetricsCollector docs →](../../customization/metrics/logger-collector)**

---

### JsonMetricsCollector

Write detailed JSON metrics for analysis.

```typescript
import { JsonMetricsCollector } from '@migration-script-runner/core';

new JsonMetricsCollector({
  filePath: './metrics/migration.json',
  pretty: true
})
```

**[View JsonMetricsCollector docs →](../../customization/metrics/json-collector)**

---

### CsvMetricsCollector

CSV format for Excel and data analysis.

```typescript
import { CsvMetricsCollector } from '@migration-script-runner/core';

new CsvMetricsCollector({
  filePath: './metrics/migrations.csv'
})
```

**[View CsvMetricsCollector docs →](../../customization/metrics/csv-collector)**

---

## Custom Implementation

### Example: Datadog Collector

```typescript
import { IMetricsCollector, MigrationScript, IMigrationResult } from '@migration-script-runner/core';
import StatsD from 'hot-shots';

export class DatadogCollector implements IMetricsCollector {
  private client: StatsD;

  constructor(config: { apiKey: string; host?: string; prefix?: string }) {
    this.client = new StatsD({
      host: config.host || 'localhost',
      port: 8125,
      prefix: config.prefix || 'msr.',
      globalTags: {
        env: process.env.NODE_ENV || 'production'
      }
    });
  }

  recordScriptComplete(script: MigrationScript, duration: number): void {
    this.client.increment('migrations.success', 1, { script: script.name });
    this.client.timing('migrations.duration', duration, { script: script.name });
  }

  recordScriptError(script: MigrationScript, error: Error): void {
    this.client.increment('migrations.failed', 1, {
      script: script.name,
      error: error.constructor.name
    });
  }

  async close(): Promise<void> {
    this.client.close();
  }
}
```

**[View more custom collector examples →](../../customization/metrics/custom-collectors)**

---

## Best Practices

### 1. Implement Only What You Need

All methods are optional - implement only the metrics relevant to your use case:

```typescript
// Minimal implementation - only track failures
class ErrorOnlyCollector implements IMetricsCollector {
  recordScriptError(script: MigrationScript, error: Error): void {
    // Send alert
  }
}
```

### 2. Handle Errors Gracefully

Metrics collection failures should never stop migrations:

```typescript
recordScriptComplete(script: MigrationScript, duration: number): void {
  try {
    this.sendMetric(script, duration);
  } catch (error) {
    console.error('Metrics error:', error);
    // Don't throw - continue with migration
  }
}
```

### 3. Use Async When Needed

Return `Promise<void>` for async operations:

```typescript
async recordScriptComplete(script: MigrationScript, duration: number): Promise<void> {
  await this.apiClient.send({
    metric: 'migration.duration',
    value: duration
  });
}
```

### 4. Clean Up Resources

Implement `close()` to flush buffers and close connections:

```typescript
async close(): Promise<void> {
  await this.flush();
  await this.fileHandle.close();
}
```

[← Back to Interfaces](./){: .btn }
