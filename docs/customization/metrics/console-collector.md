---
layout: default
title: ConsoleMetricsCollector
parent: Metrics Collection
grand_parent: Extending MSR
nav_order: 1
---

# ConsoleMetricsCollector
{: .no_toc }

Zero-configuration metrics output for development and debugging.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

`ConsoleMetricsCollector` provides real-time metrics output directly to the console. It's designed for development and debugging, requiring absolutely zero configuration - just instantiate and start collecting metrics.

**Perfect for:**
- ✅ Local development
- ✅ Debugging migration issues
- ✅ Quick feedback on migration performance
- ✅ Learning and experimentation

**Not recommended for:**
- ❌ Production deployments (use [LoggerMetricsCollector](logger-collector) instead)
- ❌ Log level control
- ❌ Persistent metrics storage

---

## Quick Start

```typescript
import {
  MigrationScriptExecutor,
  ConsoleMetricsCollector
} from '@vlavrynovych/msr';

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new ConsoleMetricsCollector()  // That's it!
  ]
}, config);

await executor.up();
```

**Output:**
```
[METRICS] Migration started - 3 pending scripts, 0 already executed
[METRICS] V1_CreateUsers started
[METRICS] V1_CreateUsers completed in 823ms
[METRICS] V2_AddEmail started
[METRICS] V2_AddEmail completed in 645ms
[METRICS] V3_AddIndex started
[METRICS] V3_AddIndex completed in 234ms
[METRICS] Migration completed - 3 scripts in 1702ms (success)
```

---

## API

### Constructor

```typescript
new ConsoleMetricsCollector()
```

**No parameters** - it just works!

---

## Output Format

### Migration Start

```
[METRICS] Migration started - {pending} pending scripts, {executed} already executed
```

Example:
```
[METRICS] Migration started - 5 pending scripts, 2 already executed
```

---

### Script Execution

```
[METRICS] {scriptName} started
[METRICS] {scriptName} completed in {duration}ms
```

Example:
```
[METRICS] V1_CreateUsers started
[METRICS] V1_CreateUsers completed in 823ms
```

---

### Script Errors

```
[METRICS] {scriptName} failed: {errorMessage}
```

Example:
```
[METRICS] V3_AddIndex failed: Index already exists
```

---

### Migration Complete

**Success:**
```
[METRICS] Migration completed - {count} scripts in {duration}ms (success)
```

**Failure:**
```
[METRICS] Migration failed - {succeeded} succeeded, {failed} failed in {duration}ms
```

Examples:
```
[METRICS] Migration completed - 5 scripts in 3450ms (success)
[METRICS] Migration failed - 2 succeeded, 1 failed in 1800ms
```

---

### Rollback

```
[METRICS] Rollback ({strategy}) {status} in {duration}ms
```

Example:
```
[METRICS] Rollback (backup) succeeded in 1500ms
[METRICS] Rollback (down) failed in 800ms
```

---

### Validation Errors

```
[METRICS] Validation errors: {count} issues found
[METRICS]   - {errorMessage}
```

Example:
```
[METRICS] Validation errors: 2 issues found
[METRICS]   - Duplicate migration timestamp
[METRICS]   - Invalid migration name
```

---

### Backup Operations

```
[METRICS] Backup created in {duration}ms: {path}
```

Example:
```
[METRICS] Backup created in 3200ms: ./backups/migration-20250115.bkp
```

---

### General Errors

```
[METRICS] Error: {errorMessage}
```

Example:
```
[METRICS] Error: Database connection failed
```

---

### Incomplete Scripts Warning

```
[METRICS] Warning: {count} scripts never completed
[METRICS]   - {scriptName} (running for {duration}ms)
```

Example:
```
[METRICS] Warning: 2 scripts never completed
[METRICS]   - V1_CreateUsers (running for 15432ms)
[METRICS]   - V2_AddEmail (running for 8765ms)
```

---

## Architecture

### Built on LoggerMetricsCollector

`ConsoleMetricsCollector` extends [LoggerMetricsCollector](logger-collector) internally:

```typescript
export class ConsoleMetricsCollector extends LoggerMetricsCollector {
  constructor() {
    super({
      logger: new ConsoleLogger(),
      prefix: '[METRICS]'
    });
  }
}
```

This means:
- **Zero code duplication** - all logic in base class
- **Consistent behavior** - same as LoggerMetricsCollector
- **Easy to maintain** - single implementation

---

## Examples

### Basic Usage

```typescript
import { ConsoleMetricsCollector } from '@vlavrynovych/msr';

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [new ConsoleMetricsCollector()]
}, config);

await executor.up();
```

---

### With Other Collectors

```typescript
const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new ConsoleMetricsCollector(),  // Real-time feedback
    new JsonMetricsCollector({      // Detailed analysis
      filePath: './metrics/migration.json'
    })
  ]
}, config);
```

---

### Environment-Based

```typescript
const collectors: IMetricsCollector[] = [];

// Only use console in development
if (process.env.NODE_ENV === 'development') {
  collectors.push(new ConsoleMetricsCollector());
}

// Always collect JSON for debugging
collectors.push(new JsonMetricsCollector({
  filePath: `./metrics/${process.env.NODE_ENV}.json`
}));

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: collectors
}, config);
```

---

## Performance

### Minimal Overhead

- **~1-2ms** per metric call
- **Non-blocking** - uses async ConsoleLogger internally
- **Isolated failures** - errors don't stop migrations

### Example Performance

```typescript
// Running 100 migrations with ConsoleMetricsCollector
// Total overhead: ~200ms (2ms × 100 migrations)
// Typical migration duration: 50-100 seconds
// Performance impact: <0.4%
```

---

## Comparison with LoggerMetricsCollector

| Feature | ConsoleMetricsCollector | LoggerMetricsCollector |
|:--------|:------------------------|:-----------------------|
| Configuration | Zero | Logger required |
| Output | Console only | Any logger |
| Log levels | No control | Full control |
| Production | Not recommended | ✅ Recommended |
| Setup time | Instant | ~1 minute |
| Use case | Development | Production |

**When to upgrade:**
```typescript
// Development - use ConsoleMetricsCollector
new ConsoleMetricsCollector()

// Production - upgrade to LoggerMetricsCollector
new LoggerMetricsCollector({
  logger: new FileLogger('./logs/metrics.log')
})
```

---

## Troubleshooting

### No output appearing

**Problem:** Metrics not showing in console

**Solutions:**

1. **Check logging is enabled:**
   ```typescript
   config.logging.enabled = true;
   ```

2. **Verify collector is added:**
   ```typescript
   metricsCollectors: [new ConsoleMetricsCollector()]
   ```

3. **Check console isn't suppressed:**
   ```typescript
   // Don't suppress console output
   console.log = () => {};  // ❌ This will hide metrics
   ```

---

### Output appears twice

**Problem:** Metrics logged twice

**Cause:** Both ConsoleMetricsCollector and LoggerMetricsCollector with ConsoleLogger

**Solution:**
```typescript
// Don't use both with console output
metricsCollectors: [
  new ConsoleMetricsCollector(),           // ✅
  new LoggerMetricsCollector({             // ❌
    logger: new ConsoleLogger()            // Duplicate console output
  })
]

// Instead, use one or the other
metricsCollectors: [
  new ConsoleMetricsCollector()  // ✅ Simple choice
]
```

---

### Colors not showing

**Problem:** Plain text instead of colored output

**Cause:** ConsoleLogger doesn't add colors, relies on terminal

**Note:** ConsoleMetricsCollector uses plain text with `[METRICS]` prefix. For colored output, customize LoggerMetricsCollector:

```typescript
class ColoredLogger implements ILogger {
  info(msg: string) {
    console.log(`\x1b[32m${msg}\x1b[0m`);  // Green
  }
  error(msg: string) {
    console.error(`\x1b[31m${msg}\x1b[0m`);  // Red
  }
  // ... other methods
}

new LoggerMetricsCollector({ logger: new ColoredLogger() });
```

[← Back to Metrics Overview](./){: .btn }
[LoggerMetricsCollector →](logger-collector){: .btn .btn-primary }
