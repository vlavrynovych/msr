---
layout: default
title: Cloud Logger Guide
parent: Loggers
nav_order: 4
---

# Cloud Logger Implementation Guide
{: .no_toc }

Learn how to integrate MSR with cloud logging services for centralized log management, monitoring, and alerting.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Cloud logging services provide centralized log management, powerful search capabilities, alerting, and long-term retention. This guide shows you how to implement custom loggers for popular cloud platforms.

**Note:** These implementations are not included in MSR. This guide provides patterns and inspiration for building your own cloud loggers.

### Why Cloud Logging?

- **Centralize logs** from multiple application instances
- **Search and analyze** migration patterns across environments
- **Set up alerts** for migration failures
- **Maintain audit trails** for compliance
- **Correlate** migration logs with application logs

---

## Basic Pattern

All cloud loggers follow the same basic pattern:

```typescript
import { ILogger } from '@migration-script-runner/core';

export class CloudLogger implements ILogger {
    private client: CloudServiceClient;

    constructor(config: CloudLoggerConfig) {
        // Initialize cloud service client
        this.client = new CloudServiceClient(config);
    }

    private async writeLog(level: string, message: string, ...args: unknown[]): Promise<void> {
        // Format log message
        const formattedMessage = this.formatMessage(level, message, args);

        // Send to cloud service
        try {
            await this.client.log(formattedMessage);
        } catch (error) {
            // Fallback to console if cloud logging fails
            console.error('Cloud logging failed:', error);
            console.log(`[${level}] ${message}`);
        }
    }

    // Implement ILogger interface
    info(message: string, ...args: unknown[]): void {
        this.writeLog('INFO', message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.writeLog('WARN', message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        this.writeLog('ERROR', message, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        this.writeLog('DEBUG', message, ...args);
    }

    log(message: string, ...args: unknown[]): void {
        this.writeLog('LOG', message, ...args);
    }
}
```

---

## Implementation Steps

### Step 1: Install SDK

Install the cloud provider's logging SDK:

```bash
# AWS CloudWatch
npm install @aws-sdk/client-cloudwatch-logs

# Google Cloud
npm install @google-cloud/logging

# Azure
npm install applicationinsights

# Datadog
npm install winston-datadog-logs
```

### Step 2: Implement ILogger

Create a class that implements the `ILogger` interface:

```typescript
import { ILogger } from '@migration-script-runner/core';

export class MyCloudLogger implements ILogger {
    // Your implementation
}
```

### Step 3: Initialize Client

Set up the cloud service client in the constructor:

```typescript
constructor(config: { apiKey: string; region: string }) {
    this.client = new CloudServiceClient({
        apiKey: config.apiKey,
        region: config.region
    });
}
```

### Step 4: Handle Arguments

Convert various argument types to strings:

```typescript
private stringify(arg: unknown): string {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
    if (arg instanceof Error) return `${arg.message}\n${arg.stack}`;

    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
}
```

### Step 5: Add Error Handling

Always include fallback logging:

```typescript
try {
    await this.client.log(message);
} catch (error) {
    console.error('Cloud logging failed:', error);
    console.log(`[${level}] ${message}`);
}
```

---

## Cloud Service Example

Here's an example using AWS CloudWatch Logs. The same pattern applies to other cloud providers (Google Cloud Logging, Azure Application Insights, Datadog, etc.) - just replace the SDK and adapt the API calls.

### AWS CloudWatch Logs

**Key concepts:**
- Log groups organize logs by application
- Log streams separate logs by instance/time
- Sequence tokens ensure ordering
- Batching reduces API calls

**Installation:**
```bash
npm install @aws-sdk/client-cloudwatch-logs
```

**Basic structure:**
```typescript
import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

export class CloudWatchLogger implements ILogger {
    private client: CloudWatchLogsClient;
    private logGroupName: string;
    private logStreamName: string;

    constructor(config: { region: string; logGroupName: string; logStreamName: string }) {
        this.client = new CloudWatchLogsClient({ region: config.region });
        this.logGroupName = config.logGroupName;
        this.logStreamName = config.logStreamName;
    }

    private async writeLog(level: string, message: string): Promise<void> {
        const command = new PutLogEventsCommand({
            logGroupName: this.logGroupName,
            logStreamName: this.logStreamName,
            logEvents: [{
                timestamp: Date.now(),
                message: `[${level}] ${message}`
            }]
        });

        await this.client.send(command);
    }

    // Implement other ILogger methods...
}
```

**Usage:**
```typescript
const logger = new CloudWatchLogger({
    region: 'us-east-1',
    logGroupName: '/a../version-migration/production',
    logStreamName: `instance-${process.env.INSTANCE_ID}`
});
```

---

## Advanced Patterns

### Batching Logs

Reduce API calls by batching multiple log events:

```typescript
export class BatchedCloudLogger implements ILogger {
    private buffer: LogEvent[] = [];
    private batchSize = 10;
    private flushInterval = 5000;

    constructor(config: CloudLoggerConfig) {
        // Initialize client

        // Set up periodic flush
        setInterval(() => this.flush(), this.flushInterval);
    }

    private writeLog(level: string, message: string): void {
        this.buffer.push({ level, message, timestamp: Date.now() });

        if (this.buffer.length >= this.batchSize) {
            this.flush();
        }
    }

    private async flush(): Promise<void> {
        if (this.buffer.length === 0) return;

        const events = this.buffer.splice(0, this.batchSize);
        await this.client.sendBatch(events);
    }
}
```

### Combined Logging

Log to multiple destinations:

```typescript
export class CombinedLogger implements ILogger {
    constructor(private loggers: ILogger[]) {}

    info(message: string, ...args: unknown[]): void {
        this.loggers.forEach(logger => logger.info(message, ...args));
    }

    // Implement other methods...
}

// Usage
const logger = new CombinedLogger([
    new ConsoleLogger(),          // Local visibility
    new FileLogger({ ... }),      // Local persistence
    new CloudWatchLogger({ ... }) // Centralized monitoring
]);
```

### Structured Logging

Add context for better searching:

```typescript
info(message: string, ...args: unknown[]): void {
    const context = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        instanceId: process.env.INSTANCE_ID,
        version: process.env.APP_VERSION
    };

    this.client.log({
        message,
        level: 'INFO',
        ...context,
        args
    });
}
```

---

## Best Practices

### 1. Always Include Fallback

```typescript
try {
    await this.client.log(message);
} catch (error) {
    // Don't lose logs if cloud service fails
    console.error('Cloud logging failed:', error);
    console.log(`[${level}] ${message}`);
}
```

### 2. Graceful Shutdown

```typescript
async close(): Promise<void> {
    await this.flush(); // Send remaining logs
    this.client.destroy();
}

// In your app
process.on('SIGTERM', async () => {
    await logger.close();
    process.exit(0);
});
```

### 3. Environment-Based Configuration

```typescript
function createLogger(): ILogger {
    switch (process.env.NODE_ENV) {
        case 'production':
            return new CloudWatchLogger({ ... });
        case 'staging':
            return new CombinedLogger([
                new ConsoleLogger(),
                new CloudWatchLogger({ ... })
            ]);
        default:
            return new ConsoleLogger();
    }
}
```

### 4. Cost Optimization

```typescript
// Sample debug logs to reduce costs
export class SampledLogger implements ILogger {
    constructor(private baseLogger: ILogger, private sampleRate: number = 0.1) {}

    debug(message: string, ...args: unknown[]): void {
        if (Math.random() < this.sampleRate) {
            this.baseLogger.debug(message, ...args);
        }
    }

    // Always log important messages
    error(message: string, ...args: unknown[]): void {
        this.baseLogger.error(message, ...args);
    }
}
```

### 5. Testing

Mock cloud loggers for testing:

```typescript
export class MockCloudLogger implements ILogger {
    public logs: Array<{ level: string; message: string }> = [];

    info(message: string): void {
        this.logs.push({ level: 'INFO', message });
    }

    // Test helper
    getLogsByLevel(level: string) {
        return this.logs.filter(log => log.level === level);
    }
}
```

---

## Common Pitfalls

### ❌ Synchronous Operations

```typescript
// Don't block the event loop
info(message: string): void {
    this.client.logSync(message); // Blocks!
}
```

```typescript
// Use async operations
info(message: string): void {
    this.client.log(message).catch(err => {
        console.error('Logging failed:', err);
    });
}
```

### ❌ Missing Error Handling

```typescript
// Don't let logging errors crash your app
await this.client.log(message); // Throws if service is down!
```

```typescript
// Always catch errors
try {
    await this.client.log(message);
} catch (error) {
    console.error('Logging failed, but app continues:', error);
}
```

### ❌ No Resource Cleanup

```typescript
// Don't forget to flush logs on shutdown
process.exit(0); // Loses buffered logs!
```

```typescript
// Flush before exit
await logger.flush();
process.exit(0);
```

---

## Example: Complete Implementation

Here's a minimal, complete example:

```typescript
import { ILogger } from '@migration-script-runner/core';

interface CloudConfig {
    apiKey: string;
    endpoint: string;
}

export class SimpleCloudLogger implements ILogger {
    private buffer: string[] = [];

    constructor(private config: CloudConfig) {
        // Flush every 5 seconds
        setInterval(() => this.flush(), 5000);
    }

    private formatMessage(level: string, message: string, args: unknown[]): string {
        const argsStr = args.map(a => String(a)).join(' ');
        return `[${level}] ${message} ${argsStr}`;
    }

    private async flush(): Promise<void> {
        if (this.buffer.length === 0) return;

        const messages = this.buffer.splice(0);

        try {
            await fetch(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ logs: messages })
            });
        } catch (error) {
            console.error('Failed to send logs:', error);
            // Re-add to buffer for retry
            this.buffer.unshift(...messages);
        }
    }

    info(message: string, ...args: unknown[]): void {
        this.buffer.push(this.formatMessage('INFO', message, args));
    }

    warn(message: string, ...args: unknown[]): void {
        this.buffer.push(this.formatMessage('WARN', message, args));
    }

    error(message: string, ...args: unknown[]): void {
        this.buffer.push(this.formatMessage('ERROR', message, args));
    }

    debug(message: string, ...args: unknown[]): void {
        this.buffer.push(this.formatMessage('DEBUG', message, args));
    }

    log(message: string, ...args: unknown[]): void {
        this.buffer.push(this.formatMessage('LOG', message, args));
    }
}
```

**Usage:**
```typescript
import { MigrationService } from '@migration-script-runner/core';
import { SimpleCloudLogger } from './loggers/SimpleCloudLogger';

const logger = new SimpleCloudLogger({
    apiKey: process.env.CLOUD_API_KEY!,
    endpoint: 'https://logs.example.com/api/logs'
});

const service = new MigrationService(logger);
await service.executeMigrations(config);
```

---

## Related Documentation

- [ConsoleLogger](console-logger.md) - Default console output
- [SilentLogger](silent-logger.md) - Suppress all output
- [FileLogger](file-logger.md) - File-based logging with rotation
- [Custom Logging Guide](../customization/custom-logging.md) - ILogger interface basics

---

## Next Steps

1. Choose your cloud provider
2. Install the SDK
3. Implement the `ILogger` interface
4. Add error handling and fallbacks
5. Test with your migrations
6. Monitor logs in your cloud console

For questions or to share your implementation, visit [github.com/migration-script-runner/msr-core](https://github.com/migration-script-runner/msr-core).
