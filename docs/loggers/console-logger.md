---
layout: default
title: ConsoleLogger
parent: Loggers
nav_order: 1
---

# ConsoleLogger

The `ConsoleLogger` is the default logger implementation that outputs all messages to the console using Node.js's built-in `console.*` methods.

## Overview

ConsoleLogger is perfect for development and debugging scenarios where you want immediate, interactive feedback. It requires no configuration and works out of the box.

## Features

- ✅ Zero configuration required
- ✅ Direct output to console
- ✅ Supports all log levels (info, warn, error, debug, log)
- ✅ Preserves console formatting and colors
- ✅ Variable arguments support
- ✅ Fast performance

## Installation

ConsoleLogger is included in the core MSR package:

```typescript
import { ConsoleLogger } from 'msr-core';
```

## Basic Usage

### With MigrationService

```typescript
import { MigrationService, ConsoleLogger } from 'msr-core';

const logger = new ConsoleLogger();
const service = new MigrationService(logger);

await service.readMigrationScripts(config);
// Output: [INFO] Reading migration scripts from ./migrations
```

### With MigrationScriptExecutor

```typescript
import { MigrationScriptExecutor, ConsoleLogger } from 'msr-core';

const executor = new MigrationScriptExecutor(handler, config, {
    logger: new ConsoleLogger()
});

await executor.executeMigration(script, context);
// Output: [INFO] Executing migration V202311020036_add_users_table.ts
```

### Using Default Logger

Since ConsoleLogger is the default, you can omit the logger parameter:

```typescript
import { MigrationService } from 'msr-core';

// Automatically uses ConsoleLogger
const service = new MigrationService();
```

## Log Levels

ConsoleLogger supports all five standard log levels:

```typescript
const logger = new ConsoleLogger();

// Informational messages
logger.info('Migration completed successfully');
// Output: Migration completed successfully

// Warnings
logger.warn('Table already exists, skipping creation');
// Output (yellow): Table already exists, skipping creation

// Errors
logger.error('Failed to connect to database', error);
// Output (red): Failed to connect to database Error: Connection timeout...

// Debug messages
logger.debug('Current state:', { pending: 5, completed: 12 });
// Output: Current state: { pending: 5, completed: 12 }

// General logs
logger.log('Processing record', recordId);
// Output: Processing record 12345
```

## Variable Arguments

All methods support multiple arguments, just like console methods:

```typescript
logger.info('Processing user', userId, 'with role', role);
// Output: Processing user 42 with role admin

logger.error('Database error:', error, 'Query:', query);
// Output: Database error: Error: Connection failed Query: SELECT * FROM users
```

## Use Cases

### Local Development

Perfect for getting immediate feedback during development:

```typescript
import { MigrationService, ConsoleLogger } from 'msr-core';

const logger = new ConsoleLogger();
const service = new MigrationService(logger);

// See all migration activity in real-time
await service.executeMigrations(config);
```

### Debugging

Use debug level to trace execution flow:

```typescript
logger.debug('Before database connection');
await db.connect();
logger.debug('After database connection');

logger.debug('Migration state:', { pending, executed });
```

### Interactive Scripts

Ideal for CLI tools and interactive scripts:

```typescript
import { ConsoleLogger } from 'msr-core';

const logger = new ConsoleLogger();

logger.info('Starting migration process...');
await runMigrations(logger);
logger.info('✓ All migrations completed!');
```

## Output Format

ConsoleLogger preserves the native console formatting:

```typescript
logger.info('Simple message');
// Output: Simple message

logger.error('Error with stack trace', new Error('Database connection failed'));
// Output (with stack trace):
// Error with stack trace Error: Database connection failed
//     at Object.<anonymous> (/path/to/file.js:10:20)
//     ...

logger.debug('Object:', { id: 1, name: 'Test', nested: { value: 42 } });
// Output (formatted object):
// Object: { id: 1, name: 'Test', nested: { value: 42 } }
```

## Integration Examples

### With Custom Migration Handler

```typescript
import {
    MigrationScriptExecutor,
    ConsoleLogger,
    IMigrationScriptHandler
} from 'msr-core';

class MyHandler implements IMigrationScriptHandler {
    private logger: ConsoleLogger;

    constructor() {
        this.logger = new ConsoleLogger();
    }

    async handle(script: MigrationScript): Promise<void> {
        this.logger.info(`Handling migration: ${script.name}`);

        try {
            await this.runMigration(script);
            this.logger.info(`✓ Migration ${script.name} completed`);
        } catch (error) {
            this.logger.error(`✗ Migration ${script.name} failed:`, error);
            throw error;
        }
    }
}
```

### With Backup Service

```typescript
import { BackupService, ConsoleLogger } from 'msr-core';

const logger = new ConsoleLogger();
const backupService = new BackupService(logger);

logger.info('Creating backup...');
await backupService.createBackup(config, version);
logger.info('✓ Backup created successfully');
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// Good: Clear intent
logger.info('Migration started');
logger.warn('Using deprecated configuration option');
logger.error('Failed to execute migration', error);

// Avoid: Everything as info
logger.info('Migration started');
logger.info('Using deprecated configuration option'); // Should be warn
logger.info('Failed to execute migration'); // Should be error
```

### 2. Provide Context in Messages

```typescript
// Good: Descriptive context
logger.info('Executing migration V202311020036_add_users_table.ts');
logger.error('Failed to connect to database at localhost:5432', error);

// Avoid: Vague messages
logger.info('Starting');
logger.error('Error', error);
```

### 3. Include Relevant Data

```typescript
// Good: Helpful debugging info
logger.debug('Processing batch', {
    batchSize: 100,
    currentOffset: 500,
    remainingRecords: 1234
});

// Avoid: Missing context
logger.debug('Processing');
```

## Performance Considerations

ConsoleLogger is synchronous and may impact performance when logging large amounts of data:

```typescript
// For high-volume scenarios, consider throttling or batching
const logger = new ConsoleLogger();

// Avoid in tight loops with many iterations
for (let i = 0; i < 1000000; i++) {
    logger.debug('Processing record', i); // Too verbose
}

// Better: Log at milestones
for (let i = 0; i < 1000000; i++) {
    if (i % 10000 === 0) {
        logger.debug(`Processed ${i} records`);
    }
}
```

## Limitations

- **No persistence**: Logs are not saved anywhere
- **No timestamps**: Console output doesn't include automatic timestamps
- **No filtering**: All log levels are output equally
- **No rotation**: Not suitable for long-running processes that need log management
- **Console-only**: Cannot redirect output to files or external services

For production environments with persistence requirements, see [FileLogger](file-logger.md).

## API Reference

### Constructor

```typescript
constructor()
```

Creates a new ConsoleLogger instance. No configuration required.

### Methods

All methods accept a message string and optional additional arguments:

#### `info(message: string, ...args: unknown[]): void`

Logs an informational message using `console.info()`.

#### `warn(message: string, ...args: unknown[]): void`

Logs a warning message using `console.warn()`.

#### `error(message: string, ...args: unknown[]): void`

Logs an error message using `console.error()`.

#### `debug(message: string, ...args: unknown[]): void`

Logs a debug message using `console.debug()`.

#### `log(message: string, ...args: unknown[]): void`

Logs a general message using `console.log()`.

## Related

- [SilentLogger](silent-logger.md) - For suppressing all output
- [FileLogger](file-logger.md) - For persistent file-based logging
- [Custom Logging Guide](../guides/custom-logging.md) - Creating custom loggers
