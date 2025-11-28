---
layout: default
title: Best Practices
parent: Architecture
nav_order: 5
---

# Best Practices
{: .no_toc }

Architectural best practices, testing strategy, and performance considerations.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Testing Strategy

### Test Levels

#### Unit Tests
**Location:** `test/unit/`
**Purpose:** Test individual classes in isolation
**Coverage:** 100% branches, statements, functions

```
test/unit/service/
  ├── MigrationScriptSelector.test.ts  (11 tests)
  ├── MigrationScanner.test.ts         (11 tests)
  ├── MigrationRunner.test.ts          (16 tests)
  ├── BackupService.test.ts
  ├── SchemaVersionService.test.ts
  └── ...
```

#### Integration Tests
**Location:** `test/integration/`
**Purpose:** Test multiple components working together
**Coverage:** Real workflow scenarios

```
test/integration/service/
  └── MigrationScriptExecutor.test.ts  (190+ tests)
```

### Test Doubles

- **Stubs** - Simple implementations (e.g., `SilentLogger`)
- **Mocks** - Sinon mocks for behavior verification
- **Fakes** - In-memory implementations for testing

---

## Extension Points

### Custom Logger

```typescript
import { ILogger } from '@migration-script-runner/core';

class CloudLogger implements ILogger {
    log(message: string) {
        sendToCloudWatch(message);
    }
    // ... implement other methods
}

const executor = new MigrationScriptExecutor(handler, config, {
    logger: new CloudLogger()
});
```

### Custom Backup

```typescript
import { IBackupService } from '@migration-script-runner/core';

class S3BackupService implements IBackupService {
    async backup() {
        const dump = await createDump();
        await s3.upload(dump);
    }
    // ... implement restore, deleteBackup
}

const executor = new MigrationScriptExecutor(handler, config, {
    backupService: new S3BackupService()
});
```

### Custom Render Strategy

```typescript
import { IRenderStrategy, JsonRenderStrategy } from '@migration-script-runner/core';

// Use built-in JSON render strategy
const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new JsonRenderStrategy(true)  // pretty-printed JSON
});

// Or create a custom render strategy
class CustomRenderStrategy implements IRenderStrategy {
    renderMigrated(scripts, handler, limit) {
        console.log('Custom output:', scripts);
    }
    // ... implement other methods
}

const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new CustomRenderStrategy()
});
```

---

## Performance Considerations

### Parallel Operations

MSR uses `Promise.all()` for parallel operations where safe:

```typescript
// Parallel: Independent operations (in MigrationScanner)
const { migrated, all } = await Utils.promiseAll({
    migrated: schemaVersionService.getAllMigratedScripts(),
    all: migrationService.readMigrationScripts(handler.cfg)
});

// Sequential: Dependent operations
await script.init();           // Must load first
const result = await script.up();  // Then execute
await schema.save(script);     // Then save
```

**Performance Benefit:** The MigrationScanner executes database and filesystem queries in parallel, significantly reducing startup time for large projects with many migrations. For example:
- Sequential: 500ms (DB query) + 300ms (FS scan) = 800ms
- Parallel: max(500ms, 300ms) = 500ms (38% faster)

### Script Initialization

Scripts are initialized in parallel before execution:

```typescript
// Parallel init
await Promise.all(scripts.map(s => s.init()));

// Sequential execution
for (const script of scripts) {
    await executeOne(script);  // One at a time
}
```

---

## Best Practices

### Service Creation

✅ **Good:** Use dependency injection for testability
```typescript
new MigrationScriptExecutor(handler, config, {
    logger: mockLogger,
    backupService: mockBackup
});
```

❌ **Bad:** Direct instantiation inside services
```typescript
class MyService {
    constructor() {
        this.logger = new ConsoleLogger();  // Hard to test
    }
}
```

### Error Handling

✅ **Good:** Let errors propagate, handle at orchestration layer
```typescript
async executeOne(script) {
    return await script.up();  // Let errors bubble up
}
```

❌ **Bad:** Swallow errors silently
```typescript
async executeOne(script) {
    try {
        return await script.up();
    } catch (err) {
        // Silent failure - BAD!
    }
}
```

### State Management

✅ **Good:** Stateless services (pure functions)
```typescript
class MigrationScriptSelector {
    getPending(migrated, all) {
        // No instance variables, pure logic
        return all.filter(...);
    }
}
```

❌ **Bad:** Stateful services with mutable state
```typescript
class BadSelector {
    private cache = [];  // Shared mutable state

    getPending(migrated, all) {
        this.cache.push(...all);  // Side effects
    }
}
```

---

