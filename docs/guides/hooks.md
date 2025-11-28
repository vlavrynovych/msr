---
layout: default
title: Migration Hooks
parent: Guides
nav_order: 5
---

# Migration Hooks
{: .no_toc }

Extend migration behavior with lifecycle hooks
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Migration hooks provide extension points throughout the migration lifecycle, enabling you to add custom behavior without modifying the core migration code. Hooks follow the [Observer Pattern](https://en.wikipedia.org/wiki/Observer_pattern), allowing multiple implementations to respond to migration events.

### Common Use Cases

- **Notifications** - Send Slack, email, or SMS alerts on migration events
- **Metrics** - Collect timing, success/failure metrics for monitoring
- **Logging** - Custom logging to files, databases, or external services
- **Validation** - Enforce naming conventions or migration policies
- **Dry-run Mode** - Preview migrations without executing them
- **Integration** - Trigger CI/CD pipelines, update status pages

---

## Quick Start

### Basic Hook Implementation

```typescript
import { IMigrationHooks, MigrationScript, IMigrationResult } from 'migration-script-runner';

class NotificationHooks implements IMigrationHooks {
    async onStart(total: number, pending: number): Promise<void> {
        console.log(`Starting migration: ${pending}/${total} scripts`);
    }

    async onComplete(result: IMigrationResult): Promise<void> {
        console.log(`✅ Completed: ${result.executed.length} migrations`);
    }

    async onError(error: Error): Promise<void> {
        console.error(`❌ Failed: ${error.message}`);
    }
}

// Use the hooks
const executor = new MigrationScriptExecutor(handler, config, {
    hooks: new NotificationHooks()
});

await executor.migrate();
```

---

## Available Lifecycle Hooks

The `IMigrationHooks` interface provides 10 lifecycle hooks:

| Hook | Timing | Use Case |
|------|--------|----------|
| `onStart` | After scripts loaded, before backup | Initialization, notifications |
| `onBeforeBackup` | Before creating backup | Pre-backup checks, disk space validation |
| `onAfterBackup` | After backup created | Upload backup to S3, verify backup |
| `onBeforeMigrate` | Before each migration runs | Validation, dry-run mode, logging |
| `onAfterMigrate` | After each migration succeeds | Metrics, notifications per script |
| `onMigrationError` | When a migration fails | Error logging, alerting |
| `onBeforeRestore` | Before restoring backup | Pre-restore notifications |
| `onAfterRestore` | After backup restored | Post-restore validation |
| `onComplete` | After all migrations succeed | Success notifications, cleanup |
| `onError` | When migration process fails | Failure notifications, error tracking |

---

## Hook Examples

### Slack Notifications

```typescript
class SlackHooks implements IMigrationHooks {
    constructor(private webhookUrl: string) {}

    async onStart(total: number, pending: number): Promise<void> {
        await this.sendMessage({
            text: `🚀 Starting migration`,
            attachments: [{
                color: 'good',
                fields: [
                    { title: 'Total Scripts', value: String(total), short: true },
                    { title: 'To Execute', value: String(pending), short: true }
                ]
            }]
        });
    }

    async onComplete(result: IMigrationResult): Promise<void> {
        await this.sendMessage({
            text: `✅ Migration completed successfully`,
            attachments: [{
                color: 'good',
                fields: [
                    { title: 'Executed', value: String(result.executed.length), short: true },
                    { title: 'Scripts', value: result.executed.map(s => s.name).join(', ') }
                ]
            }]
        });
    }

    async onError(error: Error): Promise<void> {
        await this.sendMessage({
            text: `❌ Migration failed`,
            attachments: [{
                color: 'danger',
                fields: [
                    { title: 'Error', value: error.message },
                    { title: 'Stack', value: error.stack || 'N/A' }
                ]
            }]
        });
    }

    private async sendMessage(payload: any): Promise<void> {
        await fetch(this.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }
}

// Usage
const hooks = new SlackHooks(process.env.SLACK_WEBHOOK_URL!);
const executor = new MigrationScriptExecutor(handler, config, { hooks });
```

---

### Metrics Collection

```typescript
import { metrics } from './metrics-client'; // Your metrics library

class MetricsHooks implements IMigrationHooks {
    async onStart(total: number, pending: number): Promise<void> {
        metrics.gauge('migration.total_scripts', total);
        metrics.gauge('migration.pending_scripts', pending);
        metrics.increment('migration.started');
    }

    async onAfterMigrate(script: MigrationScript, result: string): Promise<void> {
        const duration = (script.finishedAt! - script.startedAt!) / 1000;

        metrics.timing('migration.duration', duration, {
            script: script.name,
            timestamp: script.timestamp
        });

        metrics.increment('migration.script.success', {
            script: script.name
        });
    }

    async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
        metrics.increment('migration.script.error', {
            script: script.name,
            error: error.message
        });
    }

    async onComplete(result: IMigrationResult): Promise<void> {
        metrics.increment('migration.completed');
        metrics.gauge('migration.total_executed', result.executed.length);
    }

    async onError(error: Error): Promise<void> {
        metrics.increment('migration.failed', {
            error: error.message
        });
    }
}
```

---

### Custom File Logger

```typescript
import fs from 'fs';
import path from 'path';

class DetailedFileLoggerHooks implements IMigrationHooks {
    private logPath: string;

    constructor(logPath: string) {
        this.logPath = logPath;
        // Ensure log directory exists
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    async onStart(total: number, pending: number): Promise<void> {
        this.log(`=== Migration Started ===`);
        this.log(`Total Scripts: ${total}`);
        this.log(`Pending: ${pending}`);
        this.log(`Timestamp: ${new Date().toISOString()}`);
        this.log('');
    }

    async onBeforeMigrate(script: MigrationScript): Promise<void> {
        this.log(`Executing: ${script.name}`);
        this.log(`  Path: ${script.filepath}`);
        this.log(`  Timestamp: ${script.timestamp}`);
    }

    async onAfterMigrate(script: MigrationScript, result: string): Promise<void> {
        const duration = script.finishedAt! - script.startedAt!;
        this.log(`  ✅ Success: ${script.name}`);
        this.log(`  Duration: ${duration}ms`);
        this.log(`  Result: ${result}`);
        this.log('');
    }

    async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
        this.log(`  ❌ Failed: ${script.name}`);
        this.log(`  Error: ${error.message}`);
        this.log(`  Stack: ${error.stack}`);
        this.log('');
    }

    async onComplete(result: IMigrationResult): Promise<void> {
        this.log(`=== Migration Completed ===`);
        this.log(`Executed: ${result.executed.length} scripts`);
        result.executed.forEach(s => {
            this.log(`  - ${s.name}`);
        });
        this.log('');
    }

    async onError(error: Error): Promise<void> {
        this.log(`=== Migration Failed ===`);
        this.log(`Error: ${error.message}`);
        this.log(`Stack: ${error.stack}`);
        this.log('');
    }

    private log(message: string): void {
        fs.appendFileSync(this.logPath, message + '\n');
    }
}
```

---

### Dry-Run Mode

```typescript
class DryRunHooks implements IMigrationHooks {
    async onBeforeMigrate(script: MigrationScript): Promise<void> {
        console.log(`[DRY RUN] Would execute: ${script.name}`);
        console.log(`  Timestamp: ${script.timestamp}`);
        console.log(`  Path: ${script.filepath}`);

        // Throw error to skip actual execution
        throw new Error('DRY_RUN_MODE');
    }

    async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
        // Suppress error for dry-run mode
        if (error.message === 'DRY_RUN_MODE') {
            console.log(`  [DRY RUN] Skipped execution\n`);
            return;
        }

        // Real error - log it
        console.error(`  ❌ Error: ${error.message}\n`);
    }
}

// Usage
const hooks = new DryRunHooks();
const executor = new MigrationScriptExecutor(handler, config, { hooks });

try {
    await executor.migrate();
} catch (error) {
    if (error.message !== 'DRY_RUN_MODE') {
        throw error;
    }
    console.log('Dry run completed');
}
```

---

### Migration Validation

```typescript
class ValidationHooks implements IMigrationHooks {
    async onBeforeMigrate(script: MigrationScript): Promise<void> {
        // Enforce naming convention
        const pattern = /^V\d{12}_[a-z_]+\.ts$/;
        if (!script.name.match(pattern)) {
            throw new Error(
                `Invalid script name: ${script.name}. ` +
                `Must match pattern: V{timestamp}_{description}.ts`
            );
        }

        // Enforce timestamp ordering
        const now = Date.now();
        const scriptDate = new Date(String(script.timestamp)).getTime();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

        if (scriptDate > now) {
            throw new Error(`Script timestamp is in the future: ${script.name}`);
        }

        if (scriptDate < oneYearAgo) {
            console.warn(`⚠️  Script is older than 1 year: ${script.name}`);
        }

        // Custom validation logic
        if (script.name.includes('drop') || script.name.includes('delete')) {
            console.warn(`⚠️  Destructive migration detected: ${script.name}`);
        }
    }
}
```

---

### Backup and Restore Monitoring

```typescript
class BackupMonitoringHooks implements IMigrationHooks {
    async onBeforeBackup(): Promise<void> {
        console.log('📦 Creating backup before migration...');

        // Check disk space
        const diskSpace = await this.checkDiskSpace();
        if (diskSpace.available < 1024 * 1024 * 1024) { // Less than 1GB
            console.warn('⚠️  Low disk space - backup may fail');
        }
    }

    async onAfterBackup(backupPath: string): Promise<void> {
        console.log(`✅ Backup created: ${backupPath}`);

        // Verify backup file exists and is readable
        const backupSize = await this.getBackupSize(backupPath);
        console.log(`   Size: ${(backupSize / 1024 / 1024).toFixed(2)} MB`);

        // Optionally upload to S3 or cloud storage
        if (process.env.BACKUP_TO_S3 === 'true') {
            await this.uploadToS3(backupPath);
        }
    }

    async onBeforeRestore(): Promise<void> {
        console.log('⚠️  Migration failed - restoring from backup...');

        // Send alert that rollback is happening
        await this.sendAlert({
            level: 'warning',
            message: 'Migration rollback in progress',
            action: 'Database restoration from backup'
        });
    }

    async onAfterRestore(): Promise<void> {
        console.log('✅ Database restored to previous state');

        // Verify database is operational
        const isHealthy = await this.checkDatabaseHealth();
        if (!isHealthy) {
            console.error('❌ Database health check failed after restore');
            await this.sendAlert({
                level: 'critical',
                message: 'Database unhealthy after restoration',
                action: 'Manual intervention required'
            });
        } else {
            console.log('✅ Database health check passed');
        }
    }

    private async checkDiskSpace(): Promise<{ available: number }> {
        // Implementation depends on your platform
        return { available: 10 * 1024 * 1024 * 1024 }; // 10GB example
    }

    private async getBackupSize(path: string): Promise<number> {
        const fs = await import('fs/promises');
        const stats = await fs.stat(path);
        return stats.size;
    }

    private async uploadToS3(path: string): Promise<void> {
        console.log(`   Uploading backup to S3...`);
        // S3 upload implementation
    }

    private async checkDatabaseHealth(): Promise<boolean> {
        // Run simple query to verify database is accessible
        return true; // Placeholder
    }

    private async sendAlert(alert: { level: string; message: string; action: string }): Promise<void> {
        // Send alert via Slack, PagerDuty, etc.
        console.log(`[${alert.level.toUpperCase()}] ${alert.message}: ${alert.action}`);
    }
}

// Usage
const config = new Config();
config.rollbackStrategy = RollbackStrategy.BACKUP; // Enable backup/restore

const hooks = new BackupMonitoringHooks();
const executor = new MigrationScriptExecutor(handler, config, { hooks });

await executor.migrate();
```

**Note:** `onBeforeRestore` and `onAfterRestore` hooks are only called when:
1. A migration fails during execution
2. The rollback strategy is set to `RollbackStrategy.BACKUP`
3. A valid backup was created before the migration

---

## Combining Multiple Hooks

Use `CompositeHooks` to combine multiple hook implementations:

```typescript
import { CompositeHooks } from 'migration-script-runner';

const hooks = new CompositeHooks([
    new SlackHooks(process.env.SLACK_WEBHOOK!),
    new MetricsHooks(),
    new DetailedFileLoggerHooks('/var/log/migrations.log'),
    new ValidationHooks()
]);

const executor = new MigrationScriptExecutor(handler, config, { hooks });
await executor.migrate();
```

### Dynamic Hook Management

```typescript
const hooks = new CompositeHooks();

// Always use these hooks
hooks.addHook(new SlackHooks(webhookUrl));
hooks.addHook(new ValidationHooks());

// Conditional hooks
if (process.env.NODE_ENV === 'production') {
    hooks.addHook(new MetricsHooks());
    hooks.addHook(new DatadogHooks());
}

if (process.env.ENABLE_DETAILED_LOGGING === 'true') {
    hooks.addHook(new DetailedFileLoggerHooks('/var/log/migrations.log'));
}

const executor = new MigrationScriptExecutor(handler, config, { hooks });
```

---

## Advanced Patterns

### Error Recovery Hook

```typescript
class ErrorRecoveryHooks implements IMigrationHooks {
    private attempts = new Map<string, number>();
    private maxRetries = 3;

    async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
        const attempts = (this.attempts.get(script.name) || 0) + 1;
        this.attempts.set(script.name, attempts);

        if (attempts < this.maxRetries) {
            console.log(`Retry ${attempts}/${this.maxRetries} for ${script.name}`);
            // Could implement retry logic here
        } else {
            console.error(`Max retries exceeded for ${script.name}`);
            await this.notifyAdmins(script, error);
        }
    }

    private async notifyAdmins(script: MigrationScript, error: Error): Promise<void> {
        // Send urgent notification
        console.error(`🚨 URGENT: Migration failed after ${this.maxRetries} attempts`);
    }
}
```

### Conditional Hooks

```typescript
class ConditionalHooks implements IMigrationHooks {
    constructor(private condition: () => boolean) {}

    async onStart(total: number, pending: number): Promise<void> {
        if (this.condition()) {
            console.log(`Conditional hook activated`);
        }
    }

    async onComplete(result: IMigrationResult): Promise<void> {
        if (this.condition()) {
            console.log(`Migration completed conditionally`);
        }
    }
}

// Usage
const hooks = new ConditionalHooks(() => process.env.NODE_ENV === 'production');
```

### Nested Composites

```typescript
// Group related hooks
const notificationHooks = new CompositeHooks([
    new SlackHooks(slackWebhook),
    new EmailHooks(emailConfig),
    new PagerDutyHooks(pdApiKey)
]);

const monitoringHooks = new CompositeHooks([
    new MetricsHooks(),
    new DatadogHooks(),
    new NewRelicHooks()
]);

const loggingHooks = new CompositeHooks([
    new DetailedFileLoggerHooks('/var/log/migrations.log'),
    new SentryHooks(),
    new CloudWatchHooks()
]);

// Combine all groups
const allHooks = new CompositeHooks([
    notificationHooks,
    monitoringHooks,
    loggingHooks
]);

const executor = new MigrationScriptExecutor(handler, config, { hooks: allHooks });
```

---

## Best Practices

### 1. Keep Hooks Focused

Each hook should have a single responsibility:

```typescript
// ✅ Good - focused on one thing
class SlackNotificationHooks implements IMigrationHooks {
    async onComplete(result: IMigrationResult): Promise<void> {
        await this.sendSlackMessage(result);
    }
}

// ❌ Bad - doing too much
class EverythingHooks implements IMigrationHooks {
    async onComplete(result: IMigrationResult): Promise<void> {
        await this.sendSlackMessage(result);
        await this.updateDatabase(result);
        await this.generateReport(result);
        await this.notifyEmail(result);
    }
}
```

### 2. Handle Errors Gracefully

Hooks should not throw errors unless intentional (like dry-run mode):

```typescript
class SafeHooks implements IMigrationHooks {
    async onComplete(result: IMigrationResult): Promise<void> {
        try {
            await this.sendNotification(result);
        } catch (error) {
            // Log error but don't fail the migration
            console.error('Notification failed:', error);
        }
    }
}
```

### 3. Make Hooks Configurable

```typescript
interface SlackHooksConfig {
    webhookUrl: string;
    channel?: string;
    username?: string;
    notifyOnSuccess?: boolean;
    notifyOnFailure?: boolean;
}

class SlackHooks implements IMigrationHooks {
    constructor(private config: SlackHooksConfig) {}

    async onComplete(result: IMigrationResult): Promise<void> {
        if (this.config.notifyOnSuccess !== false) {
            await this.sendMessage(/* ... */);
        }
    }
}
```

### 4. Use TypeScript for Type Safety

```typescript
import { IMigrationHooks, MigrationScript, IMigrationResult } from 'migration-script-runner';

class TypeSafeHooks implements IMigrationHooks {
    async onAfterMigrate(script: MigrationScript, result: string): Promise<void> {
        // TypeScript ensures correct parameter types
        const duration = script.finishedAt! - script.startedAt!;
        console.log(`${script.name} completed in ${duration}ms`);
    }
}
```

### 5. Test Your Hooks

```typescript
import { expect } from 'chai';
import sinon from 'sinon';

describe('SlackHooks', () => {
    it('should send notification on completion', async () => {
        const fetchStub = sinon.stub(global, 'fetch').resolves();
        const hooks = new SlackHooks('https://hooks.slack.com/...');

        const result: IMigrationResult = {
            success: true,
            executed: [],
            migrated: [],
            ignored: []
        };

        await hooks.onComplete(result);

        expect(fetchStub.calledOnce).to.be.true;
        fetchStub.restore();
    });
});
```

---

## Troubleshooting

### Hook Not Called

**Problem:** Your hook methods are not being invoked.

**Solutions:**
1. Verify hook is passed to MigrationScriptExecutor:
   ```typescript
   const executor = new MigrationScriptExecutor(handler, config, { hooks: myHooks });
   ```

2. Check method names match IMigrationHooks interface exactly

3. Ensure methods are async and return Promise<void>

### Hooks Causing Migration to Fail

**Problem:** Migration fails due to hook errors.

**Solution:** Wrap hook logic in try-catch:
```typescript
async onComplete(result: IMigrationResult): Promise<void> {
    try {
        await this.riskyOperation(result);
    } catch (error) {
        console.error('Hook error (non-fatal):', error);
    }
}
```

### Hooks Not Executing in Order

**Problem:** Hooks run out of order or in parallel.

**Solution:** Hooks in a CompositeHooks are called sequentially. If using multiple executors, they may run in parallel.

---

## API Reference

See [IMigrationHooks API Documentation](../api/interfaces/IMigrationHooks) for complete interface details.

---

## Related Documentation

- [Custom Logging](custom-logging.md) - Implementing custom loggers
- [CompositeLogger](../loggers/composite-logger.md) - Multi-destination logging
- [Architecture](../development/architecture/) - System design and component relationships
- [API Reference](../api/) - Complete API documentation

---

## Example: Production-Ready Hooks

Complete example combining multiple patterns:

```typescript
import { CompositeHooks, IMigrationHooks, MigrationScript, IMigrationResult } from 'migration-script-runner';

// Create hook factory based on environment
function createHooks(env: string): IMigrationHooks {
    const hooks = new CompositeHooks();

    // Always validate
    hooks.addHook(new ValidationHooks());

    // Environment-specific hooks
    if (env === 'production') {
        hooks.addHook(new SlackHooks(process.env.SLACK_WEBHOOK!));
        hooks.addHook(new DatadogMetricsHooks());
        hooks.addHook(new SentryErrorHooks());
        hooks.addHook(new CloudWatchLogsHooks());
    } else if (env === 'staging') {
        hooks.addHook(new SlackHooks(process.env.SLACK_WEBHOOK!));
        hooks.addHook(new FileLoggerHooks('/var/log/migrations-staging.log'));
    } else {
        // Development
        hooks.addHook(new ConsoleLoggingHooks());
    }

    return hooks;
}

// Use in your application
const hooks = createHooks(process.env.NODE_ENV || 'development');
const executor = new MigrationScriptExecutor(handler, config, { hooks });

const result = await executor.migrate();

if (result.success) {
    console.log('Migration completed successfully');
    process.exit(0);
} else {
    console.error('Migration failed');
    process.exit(1);
}
```
