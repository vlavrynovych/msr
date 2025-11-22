---
layout: default
title: Custom Logging
parent: Guides
nav_order: 2
---

# Custom Logging
{: .no_toc }

MSR provides flexible logging through the `ILogger` interface, allowing you to customize or suppress all output from the migration system.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

By default, MSR uses `ConsoleLogger` which outputs all messages to the console using standard `console.*` methods. However, you can customize this behavior by:

- Using `SilentLogger` to suppress all output (useful for testing or library usage)
- Creating custom logger implementations for files, cloud services, or other destinations

All services that produce output accept an optional `ILogger` parameter in their constructors.

---

## The ILogger Interface

The `ILogger` interface defines five logging methods:

```typescript
interface ILogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
}
```

---

## Built-in Logger Implementations

MSR provides three built-in logger implementations. For detailed documentation on each, see the [Logger Documentation](/msr-core/loggers).

### Quick Overview

- **[ConsoleLogger](/msr-core/loggers/console-logger)** - Default logger that outputs to console. Perfect for development and debugging.
- **[SilentLogger](/msr-core/loggers/silent-logger)** - Suppresses all output. Ideal for testing and silent operations.
- **[FileLogger](/msr-core/loggers/file-logger)** - Writes to files with automatic rotation. Best for production environments.

### ConsoleLogger (Default)

```typescript
import { MigrationScriptExecutor, ConsoleLogger } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor(handler, new ConsoleLogger());
```

[→ Full ConsoleLogger Documentation](/msr-core/loggers/console-logger)

### SilentLogger

```typescript
import { MigrationScriptExecutor, SilentLogger } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor(handler, new SilentLogger());
```

[→ Full SilentLogger Documentation](/msr-core/loggers/silent-logger)

### FileLogger

```typescript
import { MigrationService, FileLogger } from '@migration-script-runner/core';

const logger = new FileLogger({
    logPath: '/var/log/migrations.log',
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    maxFiles: 10
});

const service = new MigrationService(logger);
```

[→ Full FileLogger Documentation](/msr-core/loggers/file-logger)

---

## Creating Custom Loggers

### File Logger Example

Log all migration activity to a file:

```typescript
import { ILogger } from '@migration-script-runner/core';
import fs from 'fs';

class FileLogger implements ILogger {
  constructor(private logPath: string) {}

  private writeToFile(level: string, message: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message} ${args.join(' ')}\n`;
    fs.appendFileSync(this.logPath, logMessage);
  }

  info(message: string, ...args: unknown[]): void {
    this.writeToFile('INFO', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.writeToFile('WARN', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.writeToFile('ERROR', message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.writeToFile('DEBUG', message, ...args);
  }

  log(message: string, ...args: unknown[]): void {
    this.writeToFile('LOG', message, ...args);
  }
}

// Use the file logger
const executor = new MigrationScriptExecutor(
  handler,
  new FileLogger('/var/log/migrations.log')
);
await executor.migrate();
```

**Output in `/var/log/migrations.log`:**
```
[2025-01-22T01:30:45.123Z] [INFO] Preparing backup...
[2025-01-22T01:30:45.456Z] [INFO] Backup prepared successfully: /backups/backup.bkp
[2025-01-22T01:30:45.789Z] [INFO] Processing...
[2025-01-22T01:30:46.012Z] [LOG] V202501220100_test.ts: processing...
[2025-01-22T01:30:46.345Z] [INFO] Migration finished successfully!
```

### Cloud Logger Example

Send logs to a cloud service like AWS CloudWatch or Datadog:

```typescript
import { ILogger } from '@migration-script-runner/core';
import { CloudWatchLogs } from '@aws-sdk/client-cloudwatch-logs';

class CloudWatchLogger implements ILogger {
  private client: CloudWatchLogs;
  private logGroupName: string;
  private logStreamName: string;

  constructor(logGroupName: string, logStreamName: string) {
    this.client = new CloudWatchLogs({ region: 'us-east-1' });
    this.logGroupName = logGroupName;
    this.logStreamName = logStreamName;
  }

  private async sendLog(level: string, message: string, ...args: unknown[]): Promise<void> {
    await this.client.putLogEvents({
      logGroupName: this.logGroupName,
      logStreamName: this.logStreamName,
      logEvents: [{
        timestamp: Date.now(),
        message: `[${level}] ${message} ${args.join(' ')}`
      }]
    });
  }

  info(message: string, ...args: unknown[]): void {
    this.sendLog('INFO', message, ...args).catch(console.error);
  }

  warn(message: string, ...args: unknown[]): void {
    this.sendLog('WARN', message, ...args).catch(console.error);
  }

  error(message: string, ...args: unknown[]): void {
    this.sendLog('ERROR', message, ...args).catch(console.error);
  }

  debug(message: string, ...args: unknown[]): void {
    this.sendLog('DEBUG', message, ...args).catch(console.error);
  }

  log(message: string, ...args: unknown[]): void {
    this.sendLog('LOG', message, ...args).catch(console.error);
  }
}

// Use in production
const executor = new MigrationScriptExecutor(
  handler,
  new CloudWatchLogger('/aws/migrations', 'production')
);
```

### Combined Logger Example

Log to both console and file simultaneously:

```typescript
class CombinedLogger implements ILogger {
  constructor(
    private loggers: ILogger[]
  ) {}

  info(message: string, ...args: unknown[]): void {
    this.loggers.forEach(logger => logger.info(message, ...args));
  }

  warn(message: string, ...args: unknown[]): void {
    this.loggers.forEach(logger => logger.warn(message, ...args));
  }

  error(message: string, ...args: unknown[]): void {
    this.loggers.forEach(logger => logger.error(message, ...args));
  }

  debug(message: string, ...args: unknown[]): void {
    this.loggers.forEach(logger => logger.debug(message, ...args));
  }

  log(message: string, ...args: unknown[]): void {
    this.loggers.forEach(logger => logger.log(message, ...args));
  }
}

// Log to both console and file
const executor = new MigrationScriptExecutor(
  handler,
  new CombinedLogger([
    new ConsoleLogger(),
    new FileLogger('/var/log/migrations.log')
  ])
);
```

---

## Use Cases

### Development

Use the default `ConsoleLogger` for immediate visual feedback:

```typescript
const executor = new MigrationScriptExecutor(handler);
// or explicitly: new MigrationScriptExecutor(handler, new ConsoleLogger());
```

### Testing

Use `SilentLogger` to keep test output clean:

```typescript
import { SilentLogger } from '@migration-script-runner/core';

describe('Migration Tests', () => {
  it('should execute migrations successfully', async () => {
    const executor = new MigrationScriptExecutor(handler, new SilentLogger());
    const result = await executor.migrate();
    expect(result.success).toBe(true);
  });
});
```

### Production

Use custom loggers for structured logging and monitoring:

```typescript
// Send to cloud service for centralized logging
const executor = new MigrationScriptExecutor(
  handler,
  new CloudWatchLogger('/prod/migrations', process.env.HOSTNAME)
);

// Or use combined logging
const executor = new MigrationScriptExecutor(
  handler,
  new CombinedLogger([
    new FileLogger('/var/log/migrations.log'),
    new CloudWatchLogger('/prod/migrations', process.env.HOSTNAME)
  ])
);
```

### CI/CD

Format logs for your CI system:

```typescript
class CILogger implements ILogger {
  info(message: string, ...args: unknown[]): void {
    console.log(`::notice::${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.log(`::warning::${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.log(`::error::${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    console.log(`::debug::${message}`, ...args);
  }

  log(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }
}
```

---

## Which Services Accept Logger?

The following services accept an optional `ILogger` parameter:

- **MigrationScriptExecutor** - Main migration executor
- **BackupService** - Backup creation and restoration
- **MigrationService** - Migration script discovery
- **ConsoleRenderer** - Table and status rendering
- **Utils.parseRunnable()** - Migration script parsing

**Example:**
```typescript
import {
  MigrationScriptExecutor,
  BackupService,
  MigrationService,
  SilentLogger
} from '@migration-script-runner/core';

const logger = new SilentLogger();

// All services can use the same logger
const executor = new MigrationScriptExecutor(handler, logger);
const backupService = new BackupService(handler, logger);
const migrationService = new MigrationService(logger);
```

---

## Best Practices

1. **Consistent Logging** - Use the same logger instance across all services for consistent output
2. **Error Handling** - Always handle async logging errors (especially for cloud loggers)
3. **Performance** - Avoid synchronous file I/O in production; use async logging or queues
4. **Structured Logs** - Include timestamps, log levels, and context in your custom loggers
5. **Testing** - Always use `SilentLogger` in test suites to keep output clean
6. **Production** - Use cloud-based logging for centralized monitoring and alerting

---

## Related Documentation

- [Getting Started](../getting-started) - Basic setup and usage
- [Configuration](../configuration) - Configure MSR behavior
- [Testing](../testing) - Testing strategies and best practices
