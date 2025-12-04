---
layout: default
title: Metrics Collection
parent: Extending MSR
nav_order: 5
has_children: true
---

# Metrics Collection
{: .no_toc }

Track migration performance, monitor execution times, and collect detailed metrics about your database migrations.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR provides a flexible metrics collection system that allows you to track and monitor migration execution in real-time. Metrics collectors capture detailed information about:

- **Migration execution times** - Total duration and per-script timings
- **Success/failure rates** - Track which migrations succeed or fail
- **Backup operations** - Monitor backup creation and restore
- **Rollback attempts** - Track rollback execution and success
- **Validation errors** - Capture validation issues before they cause failures

---

## Quick Start

Add metrics collection to your executor in under 30 seconds:

```typescript
import {
  MigrationScriptExecutor,
  ConsoleMetricsCollector,
  JsonMetricsCollector
} from '@vlavrynovych/msr';

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new ConsoleMetricsCollector(),           // Real-time console output
    new JsonMetricsCollector({               // Detailed JSON reports
      filePath: './metrics/migration.json'
    })
  ]
}, config);

await executor.up();
```

**Console output:**
```
[METRICS] Migration started - 3 pending scripts
[METRICS] V1_CreateUsers started
[METRICS] V1_CreateUsers completed in 823ms
[METRICS] V2_AddEmail completed in 645ms
[METRICS] V3_AddIndex completed in 234ms
[METRICS] Migration completed - 3 scripts in 1702ms (success)
```

---

## Built-in Collectors

MSR includes four production-ready collectors:

### [ConsoleMetricsCollector](console-collector)

**Zero-configuration metrics for development.**

Real-time console output perfect for local development. No configuration needed, just instantiate and go.

```typescript
new ConsoleMetricsCollector()
```

**Best for:** Local development, debugging, immediate feedback
{: .label .label-green }

[View ConsoleMetricsCollector docs →](console-collector){: .btn .btn-primary }

---

### [LoggerMetricsCollector](logger-collector)

**Production-ready metrics with logger integration.**

Send metrics through any `ILogger` implementation - FileLogger, CloudLogger, CompositeLogger, or your custom logger. Perfect for production deployments.

```typescript
new LoggerMetricsCollector({
  logger: new FileLogger('./logs/metrics.log')
})
```

**Best for:** Production, cloud logging, multi-destination output
{: .label .label-blue }

[View LoggerMetricsCollector docs →](logger-collector){: .btn .btn-primary }

---

### [JsonMetricsCollector](json-collector)

**Detailed structured metrics for analysis.**

Comprehensive JSON output with full migration details. Perfect for performance analysis, debugging, and building dashboards.

```typescript
new JsonMetricsCollector({
  filePath: './metrics/migration.json',
  pretty: true
})
```

**Best for:** Analysis, debugging, dashboards, reporting
{: .label .label-purple }

[View JsonMetricsCollector docs →](json-collector){: .btn .btn-primary }

---

### [CsvMetricsCollector](csv-collector)

**Spreadsheet-friendly metrics for Excel.**

CSV format for easy import into Excel, Google Sheets, or data analysis tools. Track migration history over time.

```typescript
new CsvMetricsCollector({
  filePath: './metrics/migrations.csv'
})
```

**Best for:** Excel analysis, charts, historical tracking
{: .label .label-yellow }

[View CsvMetricsCollector docs →](csv-collector){: .btn .btn-primary }

---

## Console vs Logger: When to Use Which?

A common question: **"Should I use ConsoleMetricsCollector or LoggerMetricsCollector?"**

### The Key Difference

**ConsoleMetricsCollector** is a convenience wrapper:
```typescript
// ConsoleMetricsCollector internally does this:
new LoggerMetricsCollector({
  logger: new ConsoleLogger()
})
```

This means **ConsoleMetricsCollector** is just **LoggerMetricsCollector** with ConsoleLogger pre-configured.

---

### Decision Guide

```
┌─────────────────────────────────────────────────────────────┐
│                    Which Collector to Use?                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Development or  │
                    │   Production?    │
                    └──────────────────┘
                     /                 \
                    /                   \
          Development                Production
                │                         │
                ▼                         ▼
     ┌─────────────────────┐   ┌─────────────────────┐
     │ConsoleMetricsCollector│   │LoggerMetricsCollector│
     │                      │   │  + FileLogger       │
     │✅ Zero config        │   │  + CloudLogger      │
     │✅ Instant feedback   │   │  + CompositeLogger  │
     │✅ Simple             │   │                     │
     │                      │   │✅ Log levels        │
     │❌ Console only       │   │✅ Multi-destination │
     │❌ No log levels      │   │✅ Persistent logs   │
     └─────────────────────┘   └─────────────────────┘
```

---

### Quick Decision Table

| Scenario | Use This | Why |
|:---------|:---------|:----|
| **Local development** | `ConsoleMetricsCollector` | Zero config, instant feedback |
| **Production server** | `LoggerMetricsCollector` + `FileLogger` | Persistent logs, easier debugging |
| **Cloud deployments** | `LoggerMetricsCollector` + `CloudLogger` | Send to Datadog, CloudWatch, etc. |
| **Multi-environment** | `LoggerMetricsCollector` with conditional logger | Different logger per environment |
| **Need log levels** | `LoggerMetricsCollector` | Control verbosity (info vs error only) |
| **CI/CD pipeline** | `ConsoleMetricsCollector` + `JsonMetricsCollector` | Console output + detailed JSON |

---

### Anti-Pattern: Don't Duplicate Console Output

**❌ WRONG - Duplicate console output:**
```typescript
metricsCollectors: [
  new ConsoleMetricsCollector(),           // Outputs to console
  new LoggerMetricsCollector({             // ALSO outputs to console
    logger: new ConsoleLogger()            // ← Duplication!
  })
]

// Result: Every metric appears TWICE in console
// [METRICS] V1_CreateUsers completed in 823ms
// [METRICS] V1_CreateUsers completed in 823ms  ← Duplicate!
```

**✅ CORRECT - Choose one:**
```typescript
// Option 1: Simple development
metricsCollectors: [
  new ConsoleMetricsCollector()  // ✅ Just this
]

// Option 2: Production-ready
metricsCollectors: [
  new LoggerMetricsCollector({
    logger: new FileLogger('./logs/metrics.log')  // ✅ File, not console
  })
]

// Option 3: Multi-destination (OK to have console + others)
metricsCollectors: [
  new ConsoleMetricsCollector(),           // ✅ Console for development
  new JsonMetricsCollector({               // ✅ JSON for analysis
    filePath: './metrics/detailed.json'
  })
]
```

---

### When to Upgrade from Console to Logger

**Start with ConsoleMetricsCollector** in development:
```typescript
// Phase 1: Development
metricsCollectors: [
  new ConsoleMetricsCollector()
]
```

**Upgrade to LoggerMetricsCollector** when:
- ✅ Moving to staging/production
- ✅ Need to save metrics to files
- ✅ Integrating with cloud logging (Datadog, CloudWatch)
- ✅ Need log level control (error-only in production)
- ✅ Want multi-destination output (file + cloud)

```typescript
// Phase 2: Production
const logger = process.env.NODE_ENV === 'production'
  ? new CompositeLogger([
      new FileLogger('./logs/app.log'),
      new CloudLogger({ service: 'datadog' })
    ])
  : new ConsoleLogger();

metricsCollectors: [
  new LoggerMetricsCollector({ logger })
]
```

---

### Both Use Same Interface

Since ConsoleMetricsCollector extends LoggerMetricsCollector, upgrading is seamless:

```typescript
// Development code
new ConsoleMetricsCollector()

// Production code - same API, different logger
new LoggerMetricsCollector({
  logger: new FileLogger('./logs/metrics.log')
})
```

**No code changes needed** - just swap the collector!

---

## Use Multiple Collectors

Send metrics to multiple destinations simultaneously:

```typescript
const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    // Development feedback
    new ConsoleMetricsCollector(),

    // Production monitoring
    new LoggerMetricsCollector({
      logger: new CloudLogger({ service: 'datadog' })
    }),

    // Detailed analysis
    new JsonMetricsCollector({
      filePath: './metrics/detailed.json'
    }),

    // Historical tracking
    new CsvMetricsCollector({
      filePath: './metrics/history.csv'
    })
  ]
}, config);
```

**Benefits:**
- ✅ Real-time feedback during development
- ✅ Production monitoring in cloud services
- ✅ Historical analysis in spreadsheets
- ✅ Detailed debugging with JSON

---

## Custom Collectors

Build collectors for your monitoring service:

```typescript
import { IMetricsCollector } from '@vlavrynovych/msr';

class DatadogCollector implements IMetricsCollector {
  recordScriptComplete(script, duration) {
    // Send timing to Datadog
  }
  // Implement other methods...
}
```

**Popular collectors like Datadog, CloudWatch, and Prometheus** are documented with full implementations in the custom collector guide. They will be added as built-in collectors in future releases:
- [#118 - DatadogCollector](https://github.com/migration-script-runner/msr-core/issues/118)
- [#119 - CloudWatchCollector](https://github.com/migration-script-runner/msr-core/issues/119)
- [#120 - PrometheusCollector](https://github.com/migration-script-runner/msr-core/issues/120)

[View custom collector guide →](custom-collectors){: .btn }

---

## Comparison

Choose the right collector for your needs:

| Collector | Output | Use Case | Configuration |
|:----------|:-------|:---------|:--------------|
| **Console** | Terminal | Development | Zero config |
| **Logger** | Any logger | Production | Flexible |
| **Json** | JSON file | Analysis | Simple |
| **Csv** | CSV file | Spreadsheets | Simple |
| **Custom** | Anywhere | Integration | Full control |

---

## Common Patterns

### Pattern 1: Development Setup

```typescript
metricsCollectors: [
  new ConsoleMetricsCollector()
]
```

**When:** Local development, immediate feedback needed

---

### Pattern 2: Production Setup

```typescript
const logger = new CompositeLogger([
  new FileLogger('./logs/app.log'),
  new CloudLogger({ service: 'datadog' })
]);

metricsCollectors: [
  new LoggerMetricsCollector({ logger }),
  new JsonMetricsCollector({
    filePath: `./metrics/${new Date().toISOString()}.json`
  })
]
```

**When:** Production deployment, need monitoring and debugging capability

---

### Pattern 3: Historical Tracking

```typescript
metricsCollectors: [
  new ConsoleMetricsCollector(),
  new CsvMetricsCollector({
    filePath: './metrics/history.csv',
    includeHeader: false  // Append to existing file
  })
]
```

**When:** Track migration performance over time, trend analysis

---

### Pattern 4: Environment-Based

```typescript
const collectors: IMetricsCollector[] = [];

if (process.env.NODE_ENV === 'development') {
  collectors.push(new ConsoleMetricsCollector());
}

if (process.env.NODE_ENV === 'production') {
  collectors.push(new LoggerMetricsCollector({
    logger: cloudLogger
  }));
}

// Always collect detailed metrics
collectors.push(new JsonMetricsCollector({
  filePath: `./metrics/${process.env.NODE_ENV}.json`
}));
```

**When:** Different metrics for different environments

---

## Future Enhancement: Config-Based Metrics

**Coming in a future release:** Enable metrics through configuration instead of code ([#121](https://github.com/migration-script-runner/msr-core/issues/121))

```javascript
// msr.config.js - Future feature
export default {
  folder: './migrations',

  metrics: {
    prometheus: {
      enabled: true,
      port: 9090
    },
    datadog: {
      enabled: true,
      apiKey: process.env.DD_API_KEY
    },
    console: {
      enabled: process.env.NODE_ENV === 'development'
    },
    json: {
      enabled: true,
      filePath: './metrics/migration.json'
    }
  }
};
```

**Benefits:**
- Zero code changes needed
- 12-factor app compliant (environment variables)
- Easier adoption for new users
- Backward compatible with manual setup

[Track progress on #121](https://github.com/migration-script-runner/msr-core/issues/121)

---

## Performance

### Minimal Overhead

Metrics collection is designed to be non-intrusive:

- **~1-2ms** per script for console output
- **~5-10ms** per script for file writes
- **Async operations** don't block migration execution
- **Isolated failures** - collector errors don't stop migrations

### Non-Blocking Execution

All collectors run via `Promise.allSettled()`:
```typescript
// If one fails, others continue
await Promise.allSettled(
  collectors.map(c => c.recordScriptComplete(script, duration))
);
```

---

## IMetricsCollector Interface

All collectors implement this interface:

```typescript
interface IMetricsCollector {
  recordMigrationStart?(context: IMigrationContext): void;
  recordMigrationComplete?(result: IMigrationResult, duration: number): void;
  recordScriptStart?(script: MigrationScript): void;
  recordScriptComplete?(script: MigrationScript, duration: number): void;
  recordScriptError?(script: MigrationScript, error: Error): void;
  recordRollback?(strategy: RollbackStrategy, success: boolean, duration?: number): void;
  recordValidationErrors?(errors: ValidationError[]): void;
  recordBackup?(backupPath: string, duration: number): void;
  recordError?(error: Error): void;
  close?(): Promise<void>;
}
```

**All methods are optional** - implement only what you need.

---

## Troubleshooting

### Metrics not appearing

**Problem:** No metrics output

**Solutions:**
1. Verify collector is added to `metricsCollectors` array
2. Check if logging is disabled in config
3. Ensure collector methods are implemented correctly

### Performance impact

**Problem:** Metrics slowing down migrations

**Solutions:**
1. Use async collectors that don't block
2. Reduce number of collectors
3. Batch writes instead of per-script writes

### File permission errors

**Problem:** Cannot write metrics files

**Solutions:**
1. Ensure directory exists: `fs.mkdirSync('./metrics', { recursive: true })`
2. Check file permissions
3. Verify path is writable

[Get started with ConsoleMetricsCollector →](console-collector){: .btn .btn-primary .fs-5 }
