---
layout: default
title: FileLogger
parent: Loggers
nav_order: 3
---

# FileLogger

The `FileLogger` writes all log messages to files with automatic log rotation based on file size. It's designed for production environments where persistent logging and audit trails are required.

## Overview

FileLogger provides enterprise-grade file logging with automatic rotation when files reach a specified size. Old log files are preserved as numbered backups, with configurable retention policies.

## Features

- ✅ Automatic size-based log rotation
- ✅ Configurable backup file retention
- ✅ Optional timestamps with custom formats
- ✅ Automatic directory creation
- ✅ Synchronous writes for reliability
- ✅ Public utility methods for log management
- ✅ Handles edge cases (circular refs, errors, special chars)

## Installation

FileLogger is included in the core MSR package:

```typescript
import { FileLogger } from 'msr-core';
```

## Basic Usage

### Default Configuration

```typescript
import { MigrationService, FileLogger } from 'msr-core';

// Uses default settings:
// - Path: ./logs/migration.log
// - Max size: 10MB
// - Max backup files: 5
// - Timestamps: enabled
const logger = new FileLogger();
const service = new MigrationService(logger);

await service.executeMigrations(config);
```

### Custom Configuration

```typescript
import { FileLogger } from 'msr-core';

const logger = new FileLogger({
    logPath: '/var/log/myapp/migrations.log',
    maxFileSize: 5 * 1024 * 1024,  // 5MB
    maxFiles: 10,                   // Keep 10 backup files
    includeTimestamp: true,
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS'
});
```

## Configuration Options

### `logPath`

Path to the log file.

- **Type:** `string`
- **Default:** `'./logs/migration.log'`

```typescript
const logger = new FileLogger({
    logPath: '/var/log/app/migrations.log'
});
```

The directory will be created automatically if it doesn't exist.

### `maxFileSize`

Maximum file size in bytes before rotation.

- **Type:** `number`
- **Default:** `10485760` (10MB)

```typescript
const logger = new FileLogger({
    maxFileSize: 5 * 1024 * 1024  // 5MB
});
```

### `maxFiles`

Maximum number of rotated backup files to keep.

- **Type:** `number`
- **Default:** `5`

```typescript
const logger = new FileLogger({
    maxFiles: 10  // Keep 10 old log files
});
```

When the limit is reached, the oldest file is deleted.

### `includeTimestamp`

Whether to include timestamps in log messages.

- **Type:** `boolean`
- **Default:** `true`

```typescript
const logger = new FileLogger({
    includeTimestamp: false  // No timestamps
});

logger.info('Migration started');
// Output: [INFO] Migration started
```

```typescript
const logger = new FileLogger({
    includeTimestamp: true  // With timestamps (default)
});

logger.info('Migration started');
// Output: [2023-11-02 00:36:45.123] [INFO] Migration started
```

### `timestampFormat`

Date format for timestamps (used internally, not configurable to match moment.js).

- **Type:** `string`
- **Default:** `'YYYY-MM-DD HH:mm:ss.SSS'`

The current implementation uses a fixed format: `YYYY-MM-DD HH:mm:ss.SSS`

## Log Rotation

### How It Works

FileLogger automatically rotates log files when the current file exceeds `maxFileSize`:

```
Current state:
migration.log (10.5MB - exceeds limit)

After rotation:
migration.log (0 bytes - new file)
migration.log.1 (10.5MB - old file renamed)

After next rotation:
migration.log (0 bytes - new file)
migration.log.1 (10.5MB - previous file)
migration.log.2 (10.5MB - older file)

When maxFiles (5) is reached:
migration.log (current)
migration.log.1 (most recent backup)
migration.log.2
migration.log.3
migration.log.4
migration.log.5 (oldest - will be deleted on next rotation)
```

### Example: Rotation in Action

```typescript
const logger = new FileLogger({
    logPath: './logs/app.log',
    maxFileSize: 1024 * 1024,  // 1MB
    maxFiles: 3
});

// Write logs that trigger rotation
for (let i = 0; i < 10000; i++) {
    logger.info(`Processing record ${i}: ${'x'.repeat(200)}`);
}

// Check log files
const files = logger.getLogFiles();
console.log(files);
// [
//   './logs/app.log',
//   './logs/app.log.1',
//   './logs/app.log.2',
//   './logs/app.log.3'
// ]
```

## Utility Methods

FileLogger provides public methods for log file management:

### `getFileSize()`

Get the current log file size in bytes.

```typescript
const logger = new FileLogger();

logger.info('Test message');

const size = logger.getFileSize();
console.log(`Current log file size: ${size} bytes`);
// Output: Current log file size: 45 bytes
```

Returns `0` if the file doesn't exist yet.

### `getLogFiles()`

Get the list of all log files (current + rotated).

```typescript
const logger = new FileLogger({
    logPath: './logs/app.log',
    maxFiles: 5
});

// After some rotations
const files = logger.getLogFiles();
console.log(files);
// [
//   './logs/app.log',
//   './logs/app.log.1',
//   './logs/app.log.2'
// ]
```

Returns an array of file paths that exist.

### `clearLogs()`

Clear all log files (current + rotated).

```typescript
const logger = new FileLogger();

logger.info('Some logs');
logger.clearLogs();

const files = logger.getLogFiles();
console.log(files);  // []
```

Useful for testing or manual cleanup.

## Use Cases

### 1. Production Logging

```typescript
import { MigrationService, FileLogger } from 'msr-core';

const logger = new FileLogger({
    logPath: '/var/log/myapp/migrations.log',
    maxFileSize: 50 * 1024 * 1024,  // 50MB
    maxFiles: 30,  // Keep 30 days of logs
    includeTimestamp: true
});

const service = new MigrationService(logger);

try {
    await service.executeMigrations(config);
    logger.info('All migrations completed successfully');
} catch (error) {
    logger.error('Migration failed:', error);
    throw error;
}
```

### 2. Audit Trail

```typescript
import { FileLogger } from 'msr-core';

const auditLogger = new FileLogger({
    logPath: '/var/log/audit/migrations.log',
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 100,  // Long retention for compliance
    includeTimestamp: true
});

// Log all migration activities for audit
auditLogger.info('Migration started by user:', userId);
auditLogger.info('Target database:', dbConfig.host);
await runMigrations(auditLogger);
auditLogger.info('Migration completed at:', new Date().toISOString());
```

### 3. Environment-Specific Logging

```typescript
import { MigrationService, FileLogger, ConsoleLogger } from 'msr-core';

function createLogger() {
    if (process.env.NODE_ENV === 'production') {
        return new FileLogger({
            logPath: '/var/log/myapp/migrations.log',
            maxFileSize: 20 * 1024 * 1024,
            maxFiles: 20
        });
    }
    return new ConsoleLogger();
}

const logger = createLogger();
const service = new MigrationService(logger);
```

### 4. Log Monitoring and Rotation Management

```typescript
import { FileLogger } from 'msr-core';
import schedule from 'node-schedule';

const logger = new FileLogger({
    logPath: './logs/app.log',
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 7
});

// Monitor log size daily
schedule.scheduleJob('0 0 * * *', () => {
    const size = logger.getFileSize();
    const files = logger.getLogFiles();

    console.log(`Current log: ${(size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total log files: ${files.length}`);

    // Archive old logs if needed
    if (files.length > 5) {
        // Archive logic here
    }
});
```

### 5. Multi-Environment Configuration

```typescript
import { FileLogger } from 'msr-core';

const loggerConfig = {
    development: {
        logPath: './logs/dev.log',
        maxFileSize: 5 * 1024 * 1024,
        maxFiles: 3
    },
    staging: {
        logPath: '/var/log/staging/app.log',
        maxFileSize: 10 * 1024 * 1024,
        maxFiles: 10
    },
    production: {
        logPath: '/var/log/production/app.log',
        maxFileSize: 50 * 1024 * 1024,
        maxFiles: 30
    }
};

const env = process.env.NODE_ENV || 'development';
const logger = new FileLogger(loggerConfig[env]);
```

## Log Format

### With Timestamps (Default)

```typescript
const logger = new FileLogger({
    includeTimestamp: true  // default
});

logger.info('Migration started');
logger.warn('Table already exists');
logger.error('Connection failed', new Error('Timeout'));

// Output in log file:
// [2023-11-02 00:36:45.123] [INFO] Migration started
// [2023-11-02 00:36:45.456] [WARN] Table already exists
// [2023-11-02 00:36:45.789] [ERROR] Connection failed Error: Timeout
//     at Object.<anonymous> (/path/to/file.js:10:20)
//     ...
```

### Without Timestamps

```typescript
const logger = new FileLogger({
    includeTimestamp: false
});

logger.info('Migration started');
logger.warn('Table already exists');

// Output in log file:
// [INFO] Migration started
// [WARN] Table already exists
```

### Variable Arguments

```typescript
logger.info('Processing user', userId, 'with role', role);
// [2023-11-02 00:36:45.123] [INFO] Processing user 42 with role admin

logger.error('Database error:', error, 'Query:', query);
// [2023-11-02 00:36:45.456] [ERROR] Database error: Error: Connection failed Query: SELECT * FROM users
```

### Object Logging

```typescript
logger.info('User data:', { id: 1, name: 'John', role: 'admin' });
// [2023-11-02 00:36:45.123] [INFO] User data: {"id":1,"name":"John","role":"admin"}

logger.debug('State:', { pending: [1, 2, 3], completed: [4, 5] });
// [2023-11-02 00:36:45.456] [DEBUG] State: {"pending":[1,2,3],"completed":[4,5]}
```

## Best Practices

### 1. Configure Appropriate File Sizes

```typescript
// Good: Reasonable size based on log volume
const logger = new FileLogger({
    maxFileSize: 10 * 1024 * 1024,  // 10MB for moderate logging
    maxFiles: 10
});

// Avoid: Too small (frequent rotations)
const logger = new FileLogger({
    maxFileSize: 10 * 1024,  // 10KB - will rotate constantly
});

// Avoid: Too large (hard to manage)
const logger = new FileLogger({
    maxFileSize: 1000 * 1024 * 1024,  // 1GB - unwieldy files
});
```

### 2. Use Absolute Paths in Production

```typescript
// Good: Absolute path
const logger = new FileLogger({
    logPath: '/var/log/myapp/migrations.log'
});

// Avoid: Relative path in production
const logger = new FileLogger({
    logPath: './logs/migrations.log'  // Where is this?
});
```

### 3. Implement Log Archival

```typescript
import { FileLogger } from 'msr-core';
import { archiveOldLogs } from './archive';

const logger = new FileLogger({
    maxFileSize: 20 * 1024 * 1024,
    maxFiles: 7
});

// Periodically archive old logs
setInterval(() => {
    const files = logger.getLogFiles();
    const oldFiles = files.slice(5);  // Keep 5 recent, archive rest

    if (oldFiles.length > 0) {
        archiveOldLogs(oldFiles);
    }
}, 24 * 60 * 60 * 1000);  // Daily
```

### 4. Monitor Disk Space

```typescript
import { FileLogger } from 'msr-core';
import { checkDiskSpace } from 'check-disk-space';

const logger = new FileLogger({
    logPath: '/var/log/app/migrations.log'
});

// Check disk space before logging large operations
async function logOperation() {
    const space = await checkDiskSpace('/var/log');

    if (space.free < 100 * 1024 * 1024) {  // Less than 100MB
        logger.warn('Low disk space:', space.free);
        // Consider cleanup or alerting
    }

    logger.info('Operation starting...');
}
```

### 5. Use Different Logs for Different Purposes

```typescript
import { FileLogger } from 'msr-core';

// Separate logs for different concerns
const migrationLogger = new FileLogger({
    logPath: '/var/log/app/migrations.log'
});

const errorLogger = new FileLogger({
    logPath: '/var/log/app/errors.log',
    maxFileSize: 50 * 1024 * 1024,
    maxFiles: 50  // Keep errors longer
});

const auditLogger = new FileLogger({
    logPath: '/var/log/app/audit.log',
    maxFiles: 365  // Keep audit trail for 1 year
});
```

## Performance Considerations

FileLogger uses synchronous file operations to ensure logs aren't lost:

```typescript
// Synchronous writes guarantee durability
fs.appendFileSync(this.logPath, logMessage, 'utf8');
```

This means:
- **Pro:** Logs are never lost, even if process crashes
- **Con:** May impact performance in high-throughput scenarios

For high-volume logging, consider:

1. **Batch logging:**
```typescript
const messages = [];

function batchLog(message: string) {
    messages.push(message);

    if (messages.length >= 100) {
        messages.forEach(msg => logger.info(msg));
        messages.length = 0;
    }
}
```

2. **Async wrapper:**
```typescript
import { promisify } from 'util';

class AsyncFileLogger extends FileLogger {
    async infoAsync(message: string, ...args: unknown[]): Promise<void> {
        // Implement async version
    }
}
```

## Error Handling

FileLogger handles various edge cases gracefully:

```typescript
const logger = new FileLogger({ includeTimestamp: false });

// Circular references
const obj: any = { a: 1 };
obj.self = obj;
logger.info('circular', obj);
// Output: [INFO] circular [object Object]

// Error objects with stack traces
logger.error('Failed', new Error('Connection timeout'));
// Output: [ERROR] Failed Error: Connection timeout
//     at Object.<anonymous> (/path:10:20)
//     ...

// Special characters
logger.info('Test with émojis 🎉 and spëcial çhars');
// Output: [INFO] Test with émojis 🎉 and spëcial çhars

// Empty messages
logger.info('');
// Output: [INFO]

// Null and undefined
logger.info('test', null, undefined);
// Output: [INFO] test null undefined
```

## API Reference

### Constructor

```typescript
constructor(config?: FileLoggerConfig)
```

Creates a new FileLogger instance with optional configuration.

**Parameters:**

- `config` (optional): Configuration object

**Configuration Interface:**

```typescript
interface FileLoggerConfig {
    logPath?: string;           // Default: './logs/migration.log'
    maxFileSize?: number;       // Default: 10485760 (10MB)
    maxFiles?: number;          // Default: 5
    includeTimestamp?: boolean; // Default: true
    timestampFormat?: string;   // Default: 'YYYY-MM-DD HH:mm:ss.SSS'
}
```

### Logging Methods

All methods accept a message string and optional additional arguments:

#### `info(message: string, ...args: unknown[]): void`

Logs an informational message with `[INFO]` level.

#### `warn(message: string, ...args: unknown[]): void`

Logs a warning message with `[WARN]` level.

#### `error(message: string, ...args: unknown[]): void`

Logs an error message with `[ERROR]` level.

#### `debug(message: string, ...args: unknown[]): void`

Logs a debug message with `[DEBUG]` level.

#### `log(message: string, ...args: unknown[]): void`

Logs a general message with `[LOG]` level.

### Utility Methods

#### `getFileSize(): number`

Returns the current log file size in bytes, or `0` if file doesn't exist.

```typescript
const size = logger.getFileSize();
console.log(`Log file is ${size} bytes`);
```

#### `getLogFiles(): string[]`

Returns an array of all log file paths (current + rotated) that exist.

```typescript
const files = logger.getLogFiles();
files.forEach(file => console.log(file));
```

#### `clearLogs(): void`

Deletes all log files (current + rotated).

```typescript
logger.clearLogs();
```

