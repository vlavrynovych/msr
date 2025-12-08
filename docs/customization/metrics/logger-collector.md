---
layout: default
title: LoggerMetricsCollector
parent: Metrics Collection
grand_parent: Extending MSR
nav_order: 2
---

# LoggerMetricsCollector
{: .no_toc }

Production-ready metrics integrated with your logging infrastructure.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

`LoggerMetricsCollector` sends metrics through any `ILogger` implementation, integrating seamlessly with your existing logging infrastructure. Use it with FileLogger, CloudLogger, CompositeLogger, or your custom logger for production-ready metrics collection.

**Perfect for:**
- ✅ Production deployments
- ✅ Cloud logging services (Datadog, CloudWatch, etc.)
- ✅ File-based metrics
- ✅ Multi-destination output
- ✅ Log level control

**Key advantage:** Metrics follow the same path as your application logs, appearing in the same destinations with the same formatting.

---

## Quick Start

LoggerMetricsCollector works with **any** `ILogger` implementation. Choose based on your environment:

### Production: Cloud Logging

Send metrics directly to cloud monitoring services:

```typescript
import {
  MigrationScriptExecutor,
  LoggerMetricsCollector,
  CloudLogger
} from '@vlavrynovych/msr';

// Datadog, CloudWatch, or any cloud logger
const logger = new CloudLogger({
  service: 'datadog',
  apiKey: process.env.DD_API_KEY
});

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new LoggerMetricsCollector({ logger })
  ], 
  config
});

await executor.up();
```

**Result:** Metrics sent to Datadog in real-time for monitoring and alerting

---

### Production: File-based Metrics

Write metrics to log files for aggregation:

```typescript
import {
  MigrationScriptExecutor,
  LoggerMetricsCollector,
  FileLogger
} from '@vlavrynovych/msr';

const logger = new FileLogger('./logs/metrics.log');

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new LoggerMetricsCollector({ logger })
  ], 
  config
});

await executor.up();
```

**Result:** Metrics written to `./logs/metrics.log` for log aggregation tools

---

### Development: Console Output

For local development (or just use [ConsoleMetricsCollector](console-collector)):

```typescript
import { ConsoleLogger } from '@vlavrynovych/msr';

const logger = new ConsoleLogger();

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new LoggerMetricsCollector({ logger })
  ], 
  config
});
```

**Note:** For development, [ConsoleMetricsCollector](console-collector) is simpler (zero config)

---

## API

### Constructor

```typescript
new LoggerMetricsCollector(config: LoggerMetricsCollectorConfig)
```

### Configuration

```typescript
interface LoggerMetricsCollectorConfig {
  /** Logger instance to use for output */
  logger: ILogger;

  /** Message prefix (default: '[METRICS]') */
  prefix?: string;
}
```

---

## Configuration Options

### Required: logger

The `ILogger` implementation to use:

```typescript
// FileLogger - Write to file
new LoggerMetricsCollector({
  logger: new FileLogger('./logs/metrics.log')
})

// ConsoleLogger - Console output
new LoggerMetricsCollector({
  logger: new ConsoleLogger()
})

// CloudLogger - Cloud service
new LoggerMetricsCollector({
  logger: new CloudLogger({ service: 'datadog' })
})

// CompositeLogger - Multiple destinations
new LoggerMetricsCollector({
  logger: new CompositeLogger([
    new FileLogger('./logs/app.log'),
    new CloudLogger({ service: 'datadog' })
  ])
})
```

---

### Optional: prefix

Customize the metrics prefix (default: `[METRICS]`):

```typescript
// Custom prefix
new LoggerMetricsCollector({
  logger,
  prefix: '[PERF]'
})

// Output:
// [PERF] Migration started - 3 pending scripts
// [PERF] V1_CreateUsers completed in 823ms
```

**Common prefixes:**
- `[METRICS]` - Default, clear and standard
- `[PERF]` - Focus on performance
- `[TIMING]` - Emphasize duration tracking
- `[MSR]` - Brand with library name

---

## Examples

### Production Setup with FileLogger

```typescript
import {
  LoggerMetricsCollector,
  FileLogger
} from '@vlavrynovych/msr';

const logger = new FileLogger('./logs/production-metrics.log');

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new LoggerMetricsCollector({ logger })
  ], 
  config
});
```

---

### Multi-Destination with CompositeLogger

```typescript
import {
  LoggerMetricsCollector,
  CompositeLogger,
  FileLogger,
  CloudLogger
} from '@vlavrynovych/msr';

const logger = new CompositeLogger([
  new FileLogger('./logs/app.log'),
  new FileLogger('./logs/metrics-only.log'),
  new CloudLogger({
    service: 'cloudwatch',
    region: 'us-east-1',
    logGroup: '/aws/lambda/migrations'
  })
]);

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new LoggerMetricsCollector({ logger })
  ], 
  config
});
```

**Result:** Metrics sent to local files AND CloudWatch

---

### Development vs Production

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';

const logger = isDevelopment
  ? new ConsoleLogger()
  : new CompositeLogger([
      new FileLogger('./logs/app.log'),
      new CloudLogger({ service: 'datadog' })
    ]);

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new LoggerMetricsCollector({ logger })
  ], 
  config 
});
```

---

### Custom Prefix per Environment

```typescript
const prefix = {
  development: '[DEV-METRICS]',
  staging: '[STG-METRICS]',
  production: '[PROD-METRICS]'
}[process.env.NODE_ENV] || '[METRICS]';

new LoggerMetricsCollector({
  logger,
  prefix
});
```

---

### With Level-Aware Logger

```typescript
import { LevelAwareLogger, FileLogger } from '@vlavrynovych/msr';

// Only log 'info' and above
const logger = new LevelAwareLogger(
  new FileLogger('./logs/metrics.log'),
  'info'
);

new LoggerMetricsCollector({ logger });
```

---

## Architecture

### Base Class for ConsoleMetricsCollector

LoggerMetricsCollector is the base implementation:

```typescript
// ConsoleMetricsCollector extends LoggerMetricsCollector
export class ConsoleMetricsCollector extends LoggerMetricsCollector {
  constructor() {
    super({ logger: new ConsoleLogger() });
  }
}
```

This means:
- **Shared logic** - Single implementation
- **Consistent behavior** - Same across all logger-based collectors
- **Easy maintenance** - Fix once, works everywhere

---

## Output Format

### Log Levels Used

LoggerMetricsCollector uses appropriate log levels:

```typescript
// Info level - Normal operation
logger.info('[METRICS] Migration started...')
logger.info('[METRICS] V1_CreateUsers completed in 823ms')
logger.info('[METRICS] Backup created in 3200ms...')

// Error level - Failures
logger.error('[METRICS] V2_AddIndex failed: Index already exists')
logger.error('[METRICS] Migration failed - 2 succeeded, 1 failed...')
logger.error('[METRICS] Error: Database connection failed')

// Warn level - Warnings
logger.warn('[METRICS] Validation errors: 2 issues found')
logger.warn('[METRICS] Warning: 1 scripts never completed')
```

---

### Example Output

**File output** (`./logs/metrics.log`):
```
2025-01-15T10:30:00.000Z [INFO] [METRICS] Migration started - 3 pending scripts, 0 already executed
2025-01-15T10:30:00.100Z [INFO] [METRICS] V1_CreateUsers started
2025-01-15T10:30:00.923Z [INFO] [METRICS] V1_CreateUsers completed in 823ms
2025-01-15T10:30:00.923Z [INFO] [METRICS] V2_AddEmail started
2025-01-15T10:30:01.568Z [INFO] [METRICS] V2_AddEmail completed in 645ms
2025-01-15T10:30:01.568Z [INFO] [METRICS] V3_AddIndex started
2025-01-15T10:30:01.802Z [ERROR] [METRICS] V3_AddIndex failed: Index already exists
2025-01-15T10:30:02.453Z [ERROR] [METRICS] Migration failed - 2 succeeded, 1 failed in 2453ms
```

---

## Integration Patterns

### Pattern 1: Unified Application Logging

```typescript
// Single logger for app and metrics
const appLogger = new CompositeLogger([
  new FileLogger('./logs/application.log'),
  new CloudLogger({ service: 'datadog' })
]);

// Application uses logger
const service = new MyService(appLogger);

// Metrics use same logger
const executor = new MigrationScriptExecutor({
  handler,
  logger: appLogger,  // App logging
  metricsCollectors: [
    new LoggerMetricsCollector({ logger: appLogger })  // Metrics
  ], 
  config
});
```

**Benefit:** All logs (app + metrics) in same destinations

---

### Pattern 2: Separate Metrics Logger

```typescript
// Separate loggers for app and metrics
const appLogger = new FileLogger('./logs/app.log');
const metricsLogger = new FileLogger('./logs/metrics-only.log');

const executor = new MigrationScriptExecutor({
  handler,
  logger: appLogger,  // Application logs
  metricsCollectors: [
    new LoggerMetricsCollector({
      logger: metricsLogger  // Metrics only
    })
  ], 
  config
});
```

**Benefit:** Metrics isolated for analysis

---

### Pattern 3: Conditional Metrics Logging

```typescript
// Only log metrics errors in production
const logger = process.env.NODE_ENV === 'production'
  ? new LevelAwareLogger(fileLogger, 'error')  // Errors only
  : new ConsoleLogger();  // All levels

new LoggerMetricsCollector({ logger });
```

---

## Performance

### Non-Blocking Async Operations

LoggerMetricsCollector uses async logging:

```typescript
// Doesn't block migration execution
recordScriptComplete(script: MigrationScript, duration: number): void {
  this.logger.info(`[METRICS] ${script.name} completed in ${duration}ms`);
  // Logger handles async writes
}
```

### Overhead Comparison

| Logger Type | Overhead per Call | Typical Use |
|:------------|:------------------|:------------|
| ConsoleLogger | ~1-2ms | Development |
| FileLogger | ~5-10ms | Production |
| CloudLogger | ~20-50ms | Monitoring |
| CompositeLogger | Sum of all | Multi-dest |

**Note:** All overhead is async and doesn't block migrations

---

## Troubleshooting

### Metrics not appearing in logs

**Problem:** Logger configured but no metrics output

**Solutions:**

1. **Verify logger is working:**
   ```typescript
   logger.info('Test message');  // Should appear
   ```

2. **Check file path:**
   ```typescript
   // Ensure directory exists
   import * as fs from 'fs';
   fs.mkdirSync('./logs', { recursive: true });

   new LoggerMetricsCollector({
     logger: new FileLogger('./logs/metrics.log')
   });
   ```

3. **Verify log level:**
   ```typescript
   // LevelAwareLogger might filter out messages
   const logger = new LevelAwareLogger(fileLogger, 'debug');
   // Use 'debug' or 'info' to see metrics
   ```

---

### Duplicate metrics

**Problem:** Same metric logged multiple times

**Cause:** Multiple collectors or loggers pointing to same destination

**Solution:**
```typescript
// Don't do this
metricsCollectors: [
  new ConsoleMetricsCollector(),           // Logs to console
  new LoggerMetricsCollector({             // Also logs to console
    logger: new ConsoleLogger()
  })
]

// Instead, use one
metricsCollectors: [
  new LoggerMetricsCollector({
    logger: new ConsoleLogger()
  })
]
```

---

### Cloud logger errors

**Problem:** Metrics failing to send to cloud service

**Solutions:**

1. **Check credentials:**
   ```typescript
   const logger = new CloudLogger({
     service: 'datadog',
     apiKey: process.env.DD_API_KEY  // Verify this exists
   });
   ```

2. **Handle failures gracefully:**
   ```typescript
   // CloudLogger should catch its own errors
   // Metrics failures don't stop migrations
   ```

3. **Test cloud logger independently:**
   ```typescript
   const logger = new CloudLogger(config);
   await logger.info('Test message');
   ```

---

### Performance impact

**Problem:** Logging slowing down migrations

**Solutions:**

1. **Use buffered logger:**
   ```typescript
   class BufferedLogger implements ILogger {
     private buffer: string[] = [];

     info(msg: string) {
       this.buffer.push(msg);
       if (this.buffer.length > 100) {
         this.flush();
       }
     }

     flush() {
       // Write all at once
       fs.appendFileSync('./logs/metrics.log', this.buffer.join('\n'));
       this.buffer = [];
     }
   }
   ```

2. **Reduce logging frequency:**
   ```typescript
   class ThrottledCollector extends LoggerMetricsCollector {
     recordScriptStart() {
       // Skip - only log completions
     }
   }
   ```

---

## Comparison with ConsoleMetricsCollector

| Feature | LoggerMetricsCollector | ConsoleMetricsCollector |
|:--------|:-----------------------|:------------------------|
| Configuration | Required logger | Zero config |
| Output destinations | Any logger | Console only |
| Production | ✅ Recommended | Not recommended |
| Log levels | Full control | No control |
| File output | ✅ Yes | No |
| Cloud services | ✅ Yes | No |
| Setup time | ~1 minute | Instant |

**When to use which:**

```typescript
// Development
new ConsoleMetricsCollector()  // Quick and easy

// Production
new LoggerMetricsCollector({   // Flexible and powerful
  logger: cloudLogger
})
```

[← ConsoleMetricsCollector](console-collector){: .btn }
[JsonMetricsCollector →](json-collector){: .btn .btn-primary }
