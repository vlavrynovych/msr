---
layout: default
title: CompositeLogger
parent: Loggers
nav_order: 4
---

# CompositeLogger
{: .no_toc }

Forward log messages to multiple destinations simultaneously
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

CompositeLogger implements the [Composite Pattern](https://en.wikipedia.org/wiki/Composite_pattern) to forward log messages to multiple logger implementations simultaneously. This allows you to log to several destinations (console + file, file + cloud service, etc.) without managing each logger separately.

**Key Features:**
- Forward to multiple loggers simultaneously
- Dynamic logger management (add/remove at runtime)
- Support for nested composites
- Zero-configuration default behavior
- Type-safe logger interface

---

## Basic Usage

### Log to Console and File

```typescript
import {
  CompositeLogger,
  ConsoleLogger,
  FileLogger,
  MigrationScriptExecutor
} from '@migration-script-runner/core';

// Create composite with multiple loggers
const logger = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/var/log/migrations.log' })
]);

const executor = new MigrationScriptExecutor(handler, config, { logger });
await executor.migrate();
```

Every log message will be written to both the console and the file.

### Log to Multiple Files

```typescript
const logger = new CompositeLogger([
  new FileLogger({ logPath: '/var/log/migrations.log' }),
  new FileLogger({ logPath: '/var/log/audit.log' }),
  new FileLogger({ logPath: '/tmp/debug.log' })
]);
```

---

## Dynamic Logger Management

### Adding Loggers at Runtime

```typescript
const logger = new CompositeLogger([
  new ConsoleLogger()
]);

// Later, enable file logging
logger.addLogger(new FileLogger({ logPath: '/var/log/app.log' }));

// Now logs to both console and file
logger.info('This goes to console AND file');
```

### Removing Loggers at Runtime

```typescript
const fileLogger = new FileLogger({ logPath: '/tmp/temp.log' });
const logger = new CompositeLogger([
  new ConsoleLogger(),
  fileLogger
]);

// Later, disable file logging
const removed = logger.removeLogger(fileLogger);
console.log(`Removed: ${removed}`); // true

// Now only logs to console
logger.info('This only goes to console');
```

### Querying Registered Loggers

```typescript
const logger = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/var/log/app.log' })
]);

const loggers = logger.getLoggers();
console.log(`Logging to ${loggers.length} destinations`);
```

---

## Advanced Patterns

### Nested Composite Loggers

CompositeLogger can contain other CompositeLoggers:

```typescript
// Create specialized composites
const localLoggers = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/var/log/local.log' })
]);

const cloudLoggers = new CompositeLogger([
  new CloudWatchLogger(),
  new DatadogLogger()
]);

// Combine them in a top-level composite
const logger = new CompositeLogger([
  localLoggers,
  cloudLoggers
]);

// Logs to ALL four destinations
logger.info('Migration started');
```

### Conditional Logging

Enable/disable specific loggers based on environment:

```typescript
const logger = new CompositeLogger([
  new ConsoleLogger()
]);

// Enable file logging in production
if (process.env.NODE_ENV === 'production') {
  logger.addLogger(new FileLogger({
    logPath: '/var/log/production.log',
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 30
  }));
}

// Enable debug logging in development
if (process.env.NODE_ENV === 'development') {
  logger.addLogger(new FileLogger({
    logPath: '/tmp/debug.log',
    includeTimestamp: true
  }));
}
```

### Silent Mode for Testing

Disable all output during tests:

```typescript
import { CompositeLogger, SilentLogger } from '@migration-script-runner/core';

describe('Migration Tests', () => {
  it('should migrate successfully', async () => {
    // Use empty composite (no loggers)
    const logger = new CompositeLogger();

    // Or use SilentLogger explicitly
    const silentLogger = new CompositeLogger([new SilentLogger()]);

    const executor = new MigrationScriptExecutor(handler, config, { logger });
    const result = await executor.migrate();

    expect(result.success).to.be.true;
  });
});
```

---

## API Reference

### Constructor

```typescript
constructor(loggers?: ILogger[])
```

Creates a new CompositeLogger instance.

**Parameters:**
- `loggers` (optional) - Array of logger instances to forward messages to

**Example:**
```typescript
// Empty composite
const logger1 = new CompositeLogger();

// With initial loggers
const logger2 = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/var/log/app.log' })
]);
```

---

### addLogger()

```typescript
addLogger(logger: ILogger): void
```

Add a logger to the composite. The logger will start receiving all subsequent log messages.

**Parameters:**
- `logger` - Logger instance to add

**Example:**
```typescript
const composite = new CompositeLogger();
composite.addLogger(new ConsoleLogger());
composite.addLogger(new FileLogger({ logPath: '/var/log/app.log' }));
```

---

### removeLogger()

```typescript
removeLogger(logger: ILogger): boolean
```

Remove a logger from the composite. The logger will stop receiving log messages.

**Parameters:**
- `logger` - Logger instance to remove

**Returns:**
- `true` if logger was found and removed
- `false` if logger was not found

**Example:**
```typescript
const fileLogger = new FileLogger({ logPath: '/tmp/temp.log' });
const composite = new CompositeLogger([fileLogger]);

if (composite.removeLogger(fileLogger)) {
  console.log('File logging disabled');
}
```

---

### getLoggers()

```typescript
getLoggers(): ILogger[]
```

Get all registered loggers. Returns a copy of the loggers array to prevent external modification.

**Returns:**
- Array of registered logger instances

**Example:**
```typescript
const composite = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/var/log/app.log' })
]);

const count = composite.getLoggers().length;
console.log(`Logging to ${count} destinations`);
```

---

### Log Methods

All standard ILogger methods forward to all registered loggers:

```typescript
info(message: string, ...args: unknown[]): void
warn(message: string, ...args: unknown[]): void
error(message: string, ...args: unknown[]): void
debug(message: string, ...args: unknown[]): void
log(message: string, ...args: unknown[]): void
```

**Example:**
```typescript
const logger = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/var/log/app.log' })
]);

// Goes to both console and file
logger.info('Migration started');
logger.warn('Schema mismatch detected');
logger.error('Migration failed', new Error('Connection lost'));
```

---

## Use Cases

### Development Environment

```typescript
// Console + debug file
const logger = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({
    logPath: '/tmp/debug.log',
    includeTimestamp: true
  })
]);
```

### Production Environment

```typescript
// File + cloud service
const logger = new CompositeLogger([
  new FileLogger({
    logPath: '/var/log/migrations.log',
    maxFileSize: 100 * 1024 * 1024,
    maxFiles: 30
  }),
  new CloudWatchLogger({
    logGroupName: '/app/migrations',
    logStreamName: process.env.INSTANCE_ID
  })
]);
```

### CI/CD Pipeline

```typescript
// Console + file for artifact collection
const logger = new CompositeLogger([
  new ConsoleLogger(), // For real-time viewing
  new FileLogger({
    logPath: '/ci/artifacts/migration.log'
  }) // For build artifacts
]);
```

### Multi-Tenant Application

```typescript
// Separate log per tenant
const logger = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: `/var/log/tenant-${tenantId}.log` }),
  new CloudWatchLogger({ logStreamName: `tenant-${tenantId}` })
]);
```

---

## Best Practices

### Keep References to Removable Loggers

```typescript
// ✅ Good - can remove later
const fileLogger = new FileLogger({ logPath: '/tmp/temp.log' });
const logger = new CompositeLogger([
  new ConsoleLogger(),
  fileLogger
]);

// Later...
logger.removeLogger(fileLogger);
```

```typescript
// ❌ Bad - can't remove without reference
const logger = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/tmp/temp.log' })
]);

// No way to remove the FileLogger!
```

### Use Meaningful Logger Groups

```typescript
// Group related loggers
const persistentLoggers = new CompositeLogger([
  new FileLogger({ logPath: '/var/log/app.log' }),
  new CloudWatchLogger()
]);

const ephemeralLoggers = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/tmp/debug.log' })
]);

// Combine or use separately based on needs
const logger = process.env.DEBUG
  ? new CompositeLogger([persistentLoggers, ephemeralLoggers])
  : persistentLoggers;
```

### Handle Logger Failures Gracefully

CompositeLogger doesn't catch exceptions from individual loggers. If one logger throws, the rest won't receive the message. Wrap loggers that might fail:

```typescript
class SafeCloudLogger implements ILogger {
  constructor(private cloudLogger: CloudWatchLogger) {}

  info(message: string, ...args: unknown[]): void {
    try {
      this.cloudLogger.info(message, ...args);
    } catch (error) {
      console.error('Cloud logging failed:', error);
    }
  }

  // ... implement other methods similarly
}

const logger = new CompositeLogger([
  new ConsoleLogger(),
  new SafeCloudLogger(new CloudWatchLogger())
]);
```

---

## Performance Considerations

### Logger Count Impact

Each logger adds processing overhead. For high-throughput applications:

```typescript
// ✅ Good - reasonable number of loggers
const logger = new CompositeLogger([
  new ConsoleLogger(),
  new FileLogger({ logPath: '/var/log/app.log' })
]);

// ⚠️ Consider - many loggers may impact performance
const logger = new CompositeLogger([
  logger1, logger2, logger3, logger4,
  logger5, logger6, logger7, logger8
]);
```

### Empty Composite

An empty CompositeLogger is extremely efficient (no-op):

```typescript
// Negligible performance impact
const logger = new CompositeLogger();
logger.info('message'); // Does nothing
```

---

## Example: Complete Setup

```typescript
import {
  CompositeLogger,
  ConsoleLogger,
  FileLogger,
  MigrationScriptExecutor
} from '@migration-script-runner/core';

// Create loggers based on environment
const createLogger = (): CompositeLogger => {
  const loggers = [];

  // Always log to console in development
  if (process.env.NODE_ENV !== 'production') {
    loggers.push(new ConsoleLogger());
  }

  // Always log to file
  loggers.push(new FileLogger({
    logPath: process.env.LOG_PATH || '/var/log/migrations.log',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    includeTimestamp: true
  }));

  // Add cloud logging in production
  if (process.env.NODE_ENV === 'production') {
    loggers.push(new CloudWatchLogger({
      logGroupName: '/app/migrations',
      logStreamName: process.env.INSTANCE_ID || 'default'
    }));
  }

  return new CompositeLogger(loggers);
};

// Use the logger
const logger = createLogger();
const executor = new MigrationScriptExecutor(handler, config, { logger });

const result = await executor.migrate();

if (result.success) {
  logger.info(`✅ Migrated ${result.executed.length} scripts`);
} else {
  logger.error('❌ Migration failed', result.errors);
}
```
