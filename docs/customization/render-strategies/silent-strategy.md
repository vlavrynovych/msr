---
layout: default
title: SilentRenderStrategy
parent: Render Strategies
nav_order: 3
---

# SilentRenderStrategy

The `SilentRenderStrategy` suppresses all rendering output, making it ideal for testing, library usage, and scenarios where visual output is not desired.

## Overview

SilentRenderStrategy produces zero output, ensuring completely silent operation. This is perfect for unit tests, automated systems, and library integrations where rendering output would clutter logs or interfere with other output.

## Features

- ✅ Zero output (complete silence)
- ✅ Zero configuration required
- ✅ Fastest performance (no I/O operations)
- ✅ Clean test output
- ✅ Library-friendly
- ✅ No file system overhead
- ✅ Perfect for headless environments

## Installation

SilentRenderStrategy is included in the core MSR package:

```typescript
import { SilentRenderStrategy } from '@migration-script-runner/core';
```

## Basic Usage

### With MigrationScriptExecutor

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new SilentRenderStrategy()
});

await executor.migrate();  // No output produced
```

### In Tests

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy, SilentLogger } from '@migration-script-runner/core';

describe('Migration Tests', () => {
    let executor: MigrationScriptExecutor;

    beforeEach(() => {
        executor = new MigrationScriptExecutor({ handler, 
            logger: new SilentLogger(),
            renderStrategy: new SilentRenderStrategy()
        });
    });

    it('should execute migrations without output', async () => {
        // No console clutter during test execution
        const result = await executor.migrate();
        expect(result.success).toBe(true);
    });
});
```

### Library Integration

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy } from '@migration-script-runner/core';

class MyApplication {
    async initDatabase() {
        // Run migrations silently during app startup
        const executor = new MigrationScriptExecutor({ handler, 
            renderStrategy: new SilentRenderStrategy()
        });

        const result = await executor.migrate();

        if (!result.success) {
            throw new Error('Database migration failed');
        }

        // Continue with application startup
    }
}
```

## Output Examples

All methods produce no output:

```typescript
const strategy = new SilentRenderStrategy();

strategy.renderBanner('0.3.0', 'PostgreSQL');     // No output
strategy.renderMigrated(scripts, handler);         // No output
strategy.renderPending(pendingScripts);            // No output
strategy.renderExecuted(executedScripts);          // No output
strategy.renderIgnored(ignoredScripts);            // No output
```

## Use Cases

### Unit Testing

Keep test output clean and focused:

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy, SilentLogger } from '@migration-script-runner/core';

describe('MigrationScriptExecutor', () => {
    it('should handle empty migration list', async () => {
        const executor = new MigrationScriptExecutor({ handler, 
            logger: new SilentLogger(),
            renderStrategy: new SilentRenderStrategy()
        });

        const result = await executor.migrate();

        // Clean output, only test results shown
        expect(result.executed).toHaveLength(0);
    });
});
```

**Without SilentRenderStrategy:**
```
  MigrationScriptExecutor
  __  __ _                 _   _               ____            _       _
 |  \/  (_) __ _ _ __ __ _| |_(_) ___  _ __   / ___|  ___ _ __(_)_ __ | |_
 ...
+---------------------------------------+
|             Migrated                  |
+---------------------------------------+
...
    ✓ should handle empty migration list
```

**With SilentRenderStrategy:**
```
  MigrationScriptExecutor
    ✓ should handle empty migration list
```

### Library Usage

When embedding MSR in a library:

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy } from '@migration-script-runner/core';

export class DatabaseManager {
    async initialize() {
        const executor = new MigrationScriptExecutor({ handler, 
            renderStrategy: new SilentRenderStrategy()
        });

        const result = await executor.migrate();

        // Library users don't see migration output
        // Only application logs are shown
        if (result.success) {
            console.log('Database initialized successfully');
        }
    }
}
```

### Background Jobs

For scheduled or background migration tasks:

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy } from '@migration-script-runner/core';

// Cron job or scheduled task
async function runScheduledMigrations() {
    const executor = new MigrationScriptExecutor({ handler, 
        renderStrategy: new SilentRenderStrategy()
    });

    const result = await executor.migrate();

    // Only log important events, not migration tables
    if (result.executed.length > 0) {
        logger.info(`Executed ${result.executed.length} migrations`);
    }
}
```

### Automated Systems

For fully automated deployments:

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy, FileLogger } from '@migration-script-runner/core';

async function deployApplication() {
    // Run migrations silently, log to file
    const executor = new MigrationScriptExecutor({ handler, 
        logger: new FileLogger({ logPath: './deploy.log' }),
        renderStrategy: new SilentRenderStrategy()
    });

    try {
        const result = await executor.migrate();

        // Only log summary, not tables
        console.log(`Deployment: ${result.executed.length} migrations applied`);

        await startApplication();
    } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
    }
}
```

### Headless Environments

For Docker containers, Lambda functions, etc.:

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy } from '@migration-script-runner/core';

// Lambda function
export const handler = async (event) => {
    const executor = new MigrationScriptExecutor(dbHandler, config, {
        renderStrategy: new SilentRenderStrategy()
    });

    const result = await executor.migrate();

    return {
        statusCode: result.success ? 200 : 500,
        body: JSON.stringify({
            executed: result.executed.length,
            success: result.success
        })
    };
};
```

### Integration Tests

For end-to-end testing:

```typescript
describe('E2E Tests', () => {
    beforeAll(async () => {
        // Set up test database silently
        const executor = new MigrationScriptExecutor(testHandler, config, {
            renderStrategy: new SilentRenderStrategy()
        });

        await executor.migrate();
    });

    it('should create users', async () => {
        // Test actual functionality, not migration output
        const user = await createUser({ name: 'Test' });
        expect(user).toBeDefined();
    });
});
```

## Best Practices

### 1. Combine with SilentLogger for Complete Silence

```typescript
// Good: Complete silence
const executor = new MigrationScriptExecutor({ handler, 
    logger: new SilentLogger(),
    renderStrategy: new SilentRenderStrategy()
});

// Partial: Logger still produces output
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new SilentRenderStrategy()
    // Default ConsoleLogger still logs
});
```

### 2. Use in Test Environments Only

```typescript
// Good: Environment-specific configuration
const renderStrategy = process.env.NODE_ENV === 'test'
    ? new SilentRenderStrategy()
    : new AsciiTableRenderStrategy();

const executor = new MigrationScriptExecutor({ handler,  renderStrategy });

// Avoid: Silent in production (makes debugging hard)
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new SilentRenderStrategy()  // Hard to debug
});
```

### 3. Still Check Migration Results

```typescript
// Good: Silent but validate results
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new SilentRenderStrategy()
});

const result = await executor.migrate();

if (!result.success) {
    console.error('Migrations failed:', result.errors);
    process.exit(1);
}

// Avoid: Silent and ignoring results
await executor.migrate();  // Errors not handled
```

### 4. Document Why Silence is Needed

```typescript
// Good: Clear intent
// Use SilentRenderStrategy to avoid cluttering test output
// Migration status is checked via result.success
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new SilentRenderStrategy()
});

// Avoid: No explanation
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new SilentRenderStrategy()  // Why?
});
```

### 5. Provide Alternative Feedback

```typescript
// Good: Silent tables, but provide feedback
const executor = new MigrationScriptExecutor({ handler, 
    renderStrategy: new SilentRenderStrategy()
});

const result = await executor.migrate();

if (result.executed.length > 0) {
    console.log(`✓ Applied ${result.executed.length} migrations`);
}

// Avoid: Complete silence with no feedback
await executor.migrate();  // User has no idea what happened
```

## Performance

SilentRenderStrategy is the fastest rendering strategy because it performs no I/O operations:

| Strategy | Overhead | I/O Operations |
|----------|----------|----------------|
| SilentRenderStrategy | < 0.1ms | 0 |
| AsciiTableRenderStrategy | 5-50ms | Console/file writes |
| JsonRenderStrategy (compact) | 1-10ms | Console/file writes |
| JsonRenderStrategy (pretty) | 2-15ms | Console/file writes |

## Limitations

- **No visual feedback**: Users get no output at all
- **Harder debugging**: Can't see what migrations ran
- **Not suitable for CLI**: Interactive users expect output
- **Not suitable for production monitoring**: No way to track progress

For production deployments, consider [JsonRenderStrategy](json-strategy.md) with structured logging.

## API Reference

### Constructor

```typescript
constructor()
```

Creates a new SilentRenderStrategy instance. No configuration required.

**Example:**
```typescript
const strategy = new SilentRenderStrategy();
```

### Methods

All methods are no-ops (produce no output):

#### `renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit?: number): void`

No-op: Produces no output for migrated scripts.

#### `renderPending(scripts: MigrationScript[]): void`

No-op: Produces no output for pending migrations.

#### `renderExecuted(scripts: IMigrationInfo[]): void`

No-op: Produces no output for executed migrations.

#### `renderIgnored(scripts: MigrationScript[]): void`

No-op: Produces no output for ignored migrations.

#### `renderBanner(version: string, handlerName: string): void`

No-op: Produces no banner output.

