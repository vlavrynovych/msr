---
layout: default
title: SilentLogger
parent: Loggers
nav_order: 2
---

# SilentLogger

The `SilentLogger` suppresses all log output completely. It's designed for testing environments and scenarios where logging is not desired or would interfere with output.

## Overview

SilentLogger implements the `ILogger` interface but discards all log messages. This is particularly useful in unit tests where you want to test the migration logic without cluttering test output with log messages.

## Features

- ✅ Zero configuration required
- ✅ Suppresses all log output
- ✅ Implements full ILogger interface
- ✅ Zero performance overhead
- ✅ Perfect for testing

## Installation

SilentLogger is included in the core MSR package:

```typescript
import { SilentLogger } from 'msr-core';
```

## Basic Usage

### In Unit Tests

```typescript
import { MigrationService, SilentLogger } from 'msr-core';
import { expect } from 'chai';

describe('MigrationService', () => {
    it('should execute migrations successfully', async () => {
        // Use SilentLogger to keep test output clean
        const logger = new SilentLogger();
        const service = new MigrationService(logger);

        const result = await service.executeMigrations(config);

        expect(result.success).to.be.true;
        // No log output during test execution
    });
});
```

### In Integration Tests

```typescript
import { MigrationScriptExecutor, SilentLogger } from 'msr-core';

describe('Migration execution', () => {
    let executor: MigrationScriptExecutor;

    beforeEach(() => {
        // Silent logger prevents test output pollution
        executor = new MigrationScriptExecutor({ handler, 
            logger: new SilentLogger()
        });
    });

    it('should handle migration errors', async () => {
        await expect(
            executor.executeMigration(invalidScript, context)
        ).to.be.rejected;
    });
});
```

## Use Cases

### 1. Unit Testing

Keep test output focused on test results, not migration logs:

```typescript
import { describe, it, expect } from '@jest/globals';
import { BackupService, SilentLogger } from 'msr-core';

describe('BackupService', () => {
    it('should create backup successfully', async () => {
        const logger = new SilentLogger();
        const service = new BackupService(logger);

        const backupPath = await service.createBackup(config, version);

        expect(backupPath).toBeDefined();
        expect(fs.existsSync(backupPath)).toBe(true);
    });
});
```

### 2. CI/CD Pipelines

Reduce noise in CI logs when you only care about test pass/fail:

```typescript
// test/setup.ts
import { SilentLogger } from 'msr-core';

// Global test configuration
export const testLogger = new SilentLogger();
```

```typescript
// test/migrations.spec.ts
import { testLogger } from './setup';
import { MigrationService } from 'msr-core';

describe('Migration tests', () => {
    const service = new MigrationService(testLogger);

    // Tests run without migration log output
});
```

### 3. Programmatic Usage

When embedding MSR in applications where logging is handled elsewhere:

```typescript
import { MigrationService, SilentLogger } from 'msr-core';
import { myCustomLogger } from './logger';

async function runMigrations() {
    // Suppress MSR's internal logging
    const silentLogger = new SilentLogger();
    const service = new MigrationService(silentLogger);

    try {
        myCustomLogger.info('Starting migrations');
        await service.executeMigrations(config);
        myCustomLogger.info('Migrations completed');
    } catch (error) {
        myCustomLogger.error('Migration failed', error);
        throw error;
    }
}
```

### 4. Silent Batch Operations

When processing many migrations where individual log messages are overwhelming:

```typescript
import { MigrationScriptExecutor, SilentLogger } from 'msr-core';

async function batchExecute(scripts: MigrationScript[]) {
    const executor = new MigrationScriptExecutor({ handler, 
        logger: new SilentLogger()
    });

    console.log(`Processing ${scripts.length} migrations...`);

    for (const script of scripts) {
        await executor.executeMigration(script, context);
        // No log spam for each migration
    }

    console.log('All migrations completed');
}
```

## Complete Example: Test Suite

Here's a complete test suite using SilentLogger:

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
    MigrationService,
    MigrationScriptExecutor,
    BackupService,
    SilentLogger,
    MigrationConfig
} from 'msr-core';

describe('Migration System', () => {
    let logger: SilentLogger;
    let config: MigrationConfig;

    beforeEach(() => {
        logger = new SilentLogger();
        config = {
            migrationsPath: './test/fixtures/migrations',
            // ... other config
        };
    });

    describe('MigrationService', () => {
        it('should read migration scripts', async () => {
            const service = new MigrationService(logger);
            const scripts = await service.readMigrationScripts(config);

            expect(scripts).toHaveLength(3);
        });

        it('should execute all pending migrations', async () => {
            const service = new MigrationService(logger);
            const result = await service.executeMigrations(config);

            expect(result.executed).toBe(3);
            expect(result.failed).toBe(0);
        });
    });

    describe('BackupService', () => {
        it('should create backup before migration', async () => {
            const service = new BackupService(logger);
            const backupPath = await service.createBackup(config, 'v1.0.0');

            expect(fs.existsSync(backupPath)).toBe(true);
        });
    });

    // All tests run silently - no migration logs in test output
});
```

## Comparison with ConsoleLogger

```typescript
// With ConsoleLogger (verbose test output)
const consoleLogger = new ConsoleLogger();
const service = new MigrationService(consoleLogger);
await service.executeMigrations(config);
// Test output:
// Reading migration scripts from ./migrations
// Found 3 migration scripts
// Executing V202311020036_add_users_table.ts
// Migration V202311020036_add_users_table.ts completed
// ...

// With SilentLogger (clean test output)
const silentLogger = new SilentLogger();
const service = new MigrationService(silentLogger);
await service.executeMigrations(config);
// Test output:
// (nothing - just test results)
```

## Integration with Test Frameworks

### Mocha/Chai

```typescript
import { expect } from 'chai';
import { MigrationService, SilentLogger } from 'msr-core';

describe('Migrations', () => {
    it('should execute successfully', async () => {
        const service = new MigrationService(new SilentLogger());
        const result = await service.executeMigrations(config);
        expect(result.success).to.be.true;
    });
});
```

### Jest

```typescript
import { MigrationService, SilentLogger } from 'msr-core';

describe('Migrations', () => {
    it('should execute successfully', async () => {
        const service = new MigrationService(new SilentLogger());
        const result = await service.executeMigrations(config);
        expect(result.success).toBe(true);
    });
});
```

### Vitest

```typescript
import { describe, it, expect } from 'vitest';
import { MigrationService, SilentLogger } from 'msr-core';

describe('Migrations', () => {
    it('should execute successfully', async () => {
        const service = new MigrationService(new SilentLogger());
        const result = await service.executeMigrations(config);
        expect(result.success).toBe(true);
    });
});
```

## Best Practices

### 1. Use in All Tests

```typescript
// Good: Consistent silent logging in tests
const logger = new SilentLogger();

// Avoid: Mix of loggers in tests
const logger = Math.random() > 0.5 ? new ConsoleLogger() : new SilentLogger();
```

### 2. Create Once, Reuse

```typescript
// Good: Single instance for test suite
const testLogger = new SilentLogger();

beforeEach(() => {
    service = new MigrationService(testLogger);
});

// Avoid: Creating new instance each time
beforeEach(() => {
    service = new MigrationService(new SilentLogger());
});
```

### 3. Document When Used

```typescript
// Good: Clear why silent logger is used
describe('MigrationService', () => {
    // Using SilentLogger to keep test output clean and focused
    const logger = new SilentLogger();

    // tests...
});
```

## API Reference

### Constructor

```typescript
constructor()
```

Creates a new SilentLogger instance. No configuration required.

### Methods

All methods accept a message string and optional additional arguments, but all output is suppressed:

#### `info(message: string, ...args: unknown[]): void`

Suppresses informational messages. No output produced.

#### `warn(message: string, ...args: unknown[]): void`

Suppresses warning messages. No output produced.

#### `error(message: string, ...args: unknown[]): void`

Suppresses error messages. No output produced.

#### `debug(message: string, ...args: unknown[]): void`

Suppresses debug messages. No output produced.

#### `log(message: string, ...args: unknown[]): void`

Suppresses general messages. No output produced.

## Performance

SilentLogger has zero performance overhead - method calls are no-ops:

```typescript
export class SilentLogger implements ILogger {
    info(message: string, ...args: unknown[]): void {}
    warn(message: string, ...args: unknown[]): void {}
    error(message: string, ...args: unknown[]): void {}
    debug(message: string, ...args: unknown[]): void {}
    log(message: string, ...args: unknown[]): void {}
}
```

This makes it ideal for performance-critical code paths where logging is disabled.

