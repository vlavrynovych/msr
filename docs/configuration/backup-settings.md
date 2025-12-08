---
layout: default
title: Backup Settings
parent: Configuration
grand_parent: API Reference
nav_order: 4
---

# Backup Settings
{: .no_toc }

Configure backup file creation and storage
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Backup settings control how MSR creates, names, and stores database backup files. These settings are **only required** when using `BACKUP` or `BOTH` rollback strategies.

The `BackupConfig` class provides fine-grained control over backup file naming and storage location.

{: .note }
> Backup settings are optional if you're using `RollbackStrategy.DOWN` or `RollbackStrategy.NONE`.

---

## When Backups Are Needed

Backup configuration is required for:
- `RollbackStrategy.BACKUP` - Always uses backups
- `RollbackStrategy.BOTH` - Uses backups as fallback

Backup configuration is **not needed** for:
- `RollbackStrategy.DOWN` - Uses down() methods only
- `RollbackStrategy.NONE` - No rollback

---

## BackupConfig Class

### Creating BackupConfig

```typescript
import { BackupConfig } from '@migration-script-runner/core';

// Create with defaults
const backupConfig = new BackupConfig();

// Add to main config
config.backup = backupConfig;
```

### Basic Configuration

```typescript
import { Config, BackupConfig } from '@migration-script-runner/core';

const config = new Config();
config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
```

---

## Backup Options

### folder

**Type:** `string`
**Default:** `./backups`

Directory where backup files are stored.

```typescript
// Relative path (relative to current working directory)
backupConfig.folder = './backups';

// Absolute path
backupConfig.folder = '/var/backups/msr';

// Nested location
backupConfig.folder = './database/backups';

// Environment-specific
backupConfig.folder = process.env.BACKUP_FOLDER || './backups';
```

#### Behavior

- Directory is created automatically if it doesn't exist
- Backups are written to this location before migrations
- Restored from this location on rollback

#### Examples

```typescript
// Development - local folder
backupConfig.folder = './backups';

// Production - dedicated backup location
backupConfig.folder = '/var/lib/app/backups';

// Docker - mounted volume
backupConfig.folder = '/backups';
```

{: .note }
Ensure the folder is writable by the application user.

---

### deleteBackup

**Type:** `boolean`
**Default:** `true`

Whether to automatically delete backup files after successful migrations.

```typescript
// Delete backups after success (recommended)
backupConfig.deleteBackup = true;

// Keep backups for manual review
backupConfig.deleteBackup = false;
```

#### Behavior

**When `true` (default):**
- Backup deleted after all migrations succeed
- Keeps disk space manageable
- Recommended for most use cases

**When `false`:**
- Backup preserved after success
- Accumulates backup files over time
- Useful for audit trails or manual verification

{: .warning }
> In production, consider setting `deleteBackup = false` for critical deployments to maintain recovery options.

#### Use Cases

```typescript
// Production - delete to save space
backupConfig.deleteBackup = true;

// Audit compliance - keep backups
backupConfig.deleteBackup = false;

// Development - delete for cleanliness
backupConfig.deleteBackup = true;

// Critical systems - keep for safety
backupConfig.deleteBackup = false;
```

{: .warning }
Setting `deleteBackup = false` will accumulate backup files over time. Implement your own cleanup strategy if disabled.

#### Cleanup Strategy Example

```typescript
if (!backupConfig.deleteBackup) {
    // Manual cleanup - delete backups older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const oldBackups = fs.readdirSync(backupConfig.folder)
        .filter(file => {
            const stats = fs.statSync(path.join(backupConfig.folder, file));
            return stats.mtime.getTime() < thirtyDaysAgo;
        });

    oldBackups.forEach(file => {
        fs.unlinkSync(path.join(backupConfig.folder, file));
    });
}
```

---

### timestamp

**Type:** `boolean`
**Default:** `true`

Include timestamp in backup filename.

```typescript
// With timestamp (recommended)
backupConfig.timestamp = true;
// Result: backup-2025-01-22-01-30-45.bkp

// Without timestamp
backupConfig.timestamp = false;
// Result: backup.bkp (will overwrite previous)
```

#### Behavior

**When `true` (default):**
- Each backup gets unique timestamp
- Multiple backups can coexist
- Easy to identify when backup was created

**When `false`:**
- Same filename used each time
- New backup overwrites previous
- Only one backup exists at a time

#### Use Cases

```typescript
// Multiple backups - use timestamp
backupConfig.timestamp = true;
backupConfig.deleteBackup = false;

// Single backup - no timestamp needed
backupConfig.timestamp = false;
backupConfig.deleteBackup = true;
```

{: .warning }
Without timestamps, each migration run overwrites the previous backup file.

---

### timestampFormat

**Type:** `string`
**Default:** `'YYYY-MM-DD-HH-mm-ss'`

Moment.js format string for backup timestamp.

```typescript
// Default format: 2025-01-22-01-30-45
backupConfig.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';

// ISO format: 2025-01-22T01:30:45
backupConfig.timestampFormat = 'YYYY-MM-DDTHH:mm:ss';

// Compact format: 20250122_013045
backupConfig.timestampFormat = 'YYYYMMDD_HHmmss';

// Date only: 2025-01-22
backupConfig.timestampFormat = 'YYYY-MM-DD';

// Unix timestamp: 1737510645
backupConfig.timestampFormat = 'X';
```

#### Common Formats

| Format | Example Output | Use Case |
|--------|---------------|----------|
| `YYYY-MM-DD-HH-mm-ss` | 2025-01-22-01-30-45 | Default, readable |
| `YYYYMMDD-HHmmss` | 20250122-013045 | Compact, sortable |
| `YYYY-MM-DDTHH:mm:ss` | 2025-01-22T01:30:45 | ISO 8601 |
| `X` | 1737510645 | Unix timestamp |
| `YYYY-MM-DD` | 2025-01-22 | Date only |

See [Moment.js format documentation](https://momentjs.com/docs/#/displaying/format/) for all options.

#### Examples

```typescript
// Sortable filename
backupConfig.timestampFormat = 'YYYYMMDD-HHmmss';
// backup-20250122-013045.bkp

// Human-readable
backupConfig.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';
// backup-2025-01-22-01-30-45.bkp

// ISO standard
backupConfig.timestampFormat = 'YYYY-MM-DDTHH:mm:ss';
// backup-2025-01-22T01:30:45.bkp
```

---

### prefix

**Type:** `string`
**Default:** `'backup'`

Filename prefix for backup files.

```typescript
// Default prefix
backupConfig.prefix = 'backup';
// Result: backup-2025-01-22-01-30-45.bkp

// Custom prefix
backupConfig.prefix = 'msr-backup';
// Result: msr-backup-2025-01-22-01-30-45.bkp

// Application-specific
backupConfig.prefix = 'myapp-db';
// Result: myapp-db-2025-01-22-01-30-45.bkp
```

#### Use Cases

```typescript
// Default
backupConfig.prefix = 'backup';

// Application identification
backupConfig.prefix = 'myapp-backup';

// Database identification
backupConfig.prefix = 'postgres-backup';

// Environment prefix
backupConfig.prefix = `backup-${process.env.NODE_ENV}`;
// backup-production, backup-staging, etc.
```

---

### filename

**Type:** `string`
**Default:** `''` (empty)

Custom filename component inserted between prefix and timestamp.

```typescript
// No custom filename (default)
backupConfig.filename = '';
// Result: backup-2025-01-22-01-30-45.bkp

// Add environment
backupConfig.filename = 'production';
// Result: backup-production-2025-01-22-01-30-45.bkp

// Add database name
backupConfig.filename = 'users-db';
// Result: backup-users-db-2025-01-22-01-30-45.bkp
```

#### Use Cases

```typescript
// Environment identification
backupConfig.filename = process.env.NODE_ENV;
// backup-production-2025-01-22-01-30-45.bkp

// Database identification
backupConfig.filename = 'primary-db';
// backup-primary-db-2025-01-22-01-30-45.bkp

// Version identification
backupConfig.filename = 'v2';
// backup-v2-2025-01-22-01-30-45.bkp

// Multi-tenant
backupConfig.filename = `tenant-${tenantId}`;
// backup-tenant-123-2025-01-22-01-30-45.bkp
```

---

### suffix

**Type:** `string`
**Default:** `''` (empty)

Filename suffix inserted before extension.

```typescript
// No suffix (default)
backupConfig.suffix = '';
// Result: backup-2025-01-22-01-30-45.bkp

// Add version suffix
backupConfig.suffix = 'v2';
// Result: backup-2025-01-22-01-30-45-v2.bkp

// Add node identifier
backupConfig.suffix = 'node1';
// Result: backup-2025-01-22-01-30-45-node1.bkp
```

#### Use Cases

```typescript
// Version suffix
backupConfig.suffix = 'v1';

// Server identification
backupConfig.suffix = `server-${process.env.HOSTNAME}`;

// Backup type
backupConfig.suffix = 'full';
backupConfig.suffix = 'incremental';
```

---

### ext

**Type:** `string`
**Default:** `'.bkp'`

File extension for backup files.

```typescript
// Default extension
backupConfig.ext = '.bkp';

// Custom extensions
backupConfig.ext = '.backup';
backupConfig.ext = '.json';  // For JSON serialization
backupConfig.ext = '.sql';   // For SQL dumps
backupConfig.ext = '.dump';  // For binary dumps

// Without leading dot (automatically added)
backupConfig.ext = 'bkp';  // Same as '.bkp'
```

#### Examples

```typescript
// Generic backup
backupConfig.ext = '.bkp';

// SQL dump
backupConfig.ext = '.sql';

// JSON format
backupConfig.ext = '.json';

// PostgreSQL dump
backupConfig.ext = '.pgdump';

// Compressed backup
backupConfig.ext = '.bkp.gz';
```

{: .note }
The extension can be specified with or without the leading dot (`.bkp` or `bkp`).

---

## Filename Generation

### Filename Pattern

The final backup filename is constructed from all options:

```
{prefix}[-{filename}][-{timestamp}][-{suffix}]{ext}
```

Components in brackets `[]` are optional based on configuration.

### Examples

**Default configuration:**
```typescript
backupConfig.prefix = 'backup';
backupConfig.filename = '';
backupConfig.timestamp = true;
backupConfig.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';
backupConfig.suffix = '';
backupConfig.ext = '.bkp';

// Result: backup-2025-01-22-01-30-45.bkp
```

**Production configuration:**
```typescript
backupConfig.prefix = 'db-backup';
backupConfig.filename = 'production';
backupConfig.timestamp = true;
backupConfig.timestampFormat = 'YYYYMMDD-HHmmss';
backupConfig.suffix = '';
backupConfig.ext = '.sql';

// Result: db-backup-production-20250122-013045.sql
```

**Multi-tenant configuration:**
```typescript
backupConfig.prefix = 'backup';
backupConfig.filename = `tenant-${tenantId}`;
backupConfig.timestamp = true;
backupConfig.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';
backupConfig.suffix = 'v2';
backupConfig.ext = '.json';

// Result: backup-tenant-123-2025-01-22-01-30-45-v2.json
```

**Simple configuration (no timestamp):**
```typescript
backupConfig.prefix = 'latest';
backupConfig.filename = '';
backupConfig.timestamp = false;
backupConfig.suffix = '';
backupConfig.ext = '.backup';

// Result: latest.backup (overwrites each time)
```

---

### backupMode

**Type:** `BackupMode`
**Default:** `BackupMode.FULL`

Controls when backups are created and whether automatic restore occurs on failure.

```typescript
import { BackupMode, RollbackStrategy } from '@migration-script-runner/core';

// Full automatic backup and restore (default)
config.backupMode = BackupMode.FULL;
config.rollbackStrategy = RollbackStrategy.BACKUP;
```

#### Backup Modes

##### BackupMode.FULL (default)

Complete automatic backup and restore workflow:
- Creates backup before migrations
- Restores automatically on failure
- Deletes backup on success

```typescript
config.backupMode = BackupMode.FULL;
config.rollbackStrategy = RollbackStrategy.BACKUP;

await executor.migrate();
// Backup created → migrations run → backup deleted on success
// OR: Backup created → migrations fail → restore from backup
```

##### BackupMode.CREATE_ONLY

Creates backup but doesn't restore automatically:
- Creates backup before migrations
- Does NOT restore on failure
- Keeps backup file for manual inspection

```typescript
config.backupMode = BackupMode.CREATE_ONLY;
config.rollbackStrategy = RollbackStrategy.DOWN;
config.backup.deleteBackup = false;

await executor.migrate();
// Backup created → migrations run → down() methods used on failure
// Backup file kept for safety/manual restore
```

**Use cases:**
- Using `down()` methods for rollback but want backup safety net
- Manual inspection/decision before restore
- External monitoring handles restore decisions

##### BackupMode.RESTORE_ONLY

Restores from existing backup without creating new one:
- Does NOT create backup
- Restores from `config.backup.existingBackupPath` on failure
- Requires `existingBackupPath` to be set

```typescript
config.backupMode = BackupMode.RESTORE_ONLY;
config.rollbackStrategy = RollbackStrategy.BACKUP;
config.backup.existingBackupPath = './backups/pre-deploy.bkp';

await executor.migrate();
// No backup creation → migrations run → restore from existing on failure
```

**Use cases:**
- External backup system already created backup
- CI/CD pipeline with backup in earlier step
- Re-attempting failed migration with known-good backup

**Important:** Must set `config.backup.existingBackupPath`:

```typescript
// ✅ Correct usage
config.backupMode = BackupMode.RESTORE_ONLY;
config.backup.existingBackupPath = './backups/my-backup.bkp';

// ❌ Will throw error - missing existingBackupPath
config.backupMode = BackupMode.RESTORE_ONLY;
// Error: BackupMode.RESTORE_ONLY requires existingBackupPath configuration
```

##### BackupMode.MANUAL

No automatic backup or restore - full manual control:
- Does NOT create backup automatically
- Does NOT restore automatically on failure
- Use public methods for manual workflow

```typescript
config.backupMode = BackupMode.MANUAL;
config.rollbackStrategy = RollbackStrategy.BACKUP;

// Manual workflow
const backupPath = await executor.createBackup();
try {
  await executor.migrate();
  executor.deleteBackup();
} catch (error) {
  await executor.restoreFromBackup(backupPath);
}
```

**Use cases:**
- Full control over backup/restore timing
- Custom backup logic or conditions
- Integrating with external backup systems
- Complex multi-step workflows

#### BackupMode with RollbackStrategy

BackupMode works in conjunction with `rollbackStrategy`:

| RollbackStrategy | BackupMode Effect |
|------------------|-------------------|
| `BACKUP` | BackupMode controls backup/restore behavior |
| `BOTH` | BackupMode controls backup/restore, `down()` runs first |
| `DOWN` | BackupMode ignored, only `down()` methods used |
| `NONE` | BackupMode ignored, no rollback |

```typescript
// BACKUP strategy - backup/restore controlled by backupMode
config.rollbackStrategy = RollbackStrategy.BACKUP;
config.backupMode = BackupMode.FULL; // Creates + restores
config.backupMode = BackupMode.CREATE_ONLY; // Creates only
config.backupMode = BackupMode.RESTORE_ONLY; // Restores only
config.backupMode = BackupMode.MANUAL; // Manual control

// BOTH strategy - down() first, then backup/restore per backupMode
config.rollbackStrategy = RollbackStrategy.BOTH;
config.backupMode = BackupMode.FULL; // down() → backup if down() fails
config.backupMode = BackupMode.CREATE_ONLY; // down() → no backup restore

// DOWN strategy - backupMode has no effect
config.rollbackStrategy = RollbackStrategy.DOWN;
config.backupMode = BackupMode.FULL; // Ignored, only down() used
```

---

### existingBackupPath

**Type:** `string | undefined`
**Default:** `undefined`

Path to existing backup file for `BackupMode.RESTORE_ONLY`.

```typescript
// Use existing backup for restore
config.backupMode = BackupMode.RESTORE_ONLY;
config.backup.existingBackupPath = './backups/pre-deploy-2025-01-22.bkp';

// Absolute path
config.backup.existingBackupPath = '/var/backups/myapp/manual-backup.bkp';
```

#### Behavior

**When `BackupMode.RESTORE_ONLY`:**
- Required - migrations will fail if not set
- Used as restore source if migrations fail
- No new backup created

**Other backup modes:**
- Optional - ignored if set
- No effect on backup/restore behavior

#### Use Cases

```typescript
// External backup system
config.backupMode = BackupMode.RESTORE_ONLY;
config.backup.existingBackupPath = '/mnt/backup-system/latest.bkp';

// CI/CD pipeline with separate backup step
config.backupMode = BackupMode.RESTORE_ONLY;
config.backup.existingBackupPath = process.env.BACKUP_PATH;

// Manual backup before risky migration
const manualBackup = './backups/before-major-update.bkp';
config.backupMode = BackupMode.RESTORE_ONLY;
config.backup.existingBackupPath = manualBackup;
```

---

## Manual Backup Methods

When using `BackupMode.MANUAL` or for custom workflows, MSR provides public methods for manual backup/restore control.

### createBackup()

Create a database backup manually.

```typescript
const backupPath = await executor.createBackup();
console.log(`Backup created: ${backupPath}`);
// Backup created: ./backups/backup-2025-01-22-01-30-45.bkp
```

**Returns:** `Promise<string>` - Absolute path to created backup file

**Use cases:**
- Manual backup before risky operations
- Custom backup timing/conditions
- Integration with external systems

### restoreFromBackup(backupPath?)

Restore database from backup file.

```typescript
// Restore from specific backup
await executor.restoreFromBackup('./backups/my-backup.bkp');

// Restore from most recent backup (created by createBackup())
await executor.restoreFromBackup();
```

**Parameters:**
- `backupPath` (optional): Path to backup file. If not provided, uses most recent backup.

**Returns:** `Promise<void>`

**Use cases:**
- Manual restore after failed migration
- Testing restore process
- Selective restore based on conditions

### deleteBackup()

Delete backup file from disk.

```typescript
executor.deleteBackup();
```

**Behavior:**
- Only deletes if `config.backup.deleteBackup = true`
- Safe to call multiple times
- No error if file already deleted

**Use cases:**
- Manual cleanup after successful migrations
- Custom cleanup logic
- Conditional backup deletion

### Complete Manual Workflow Example

```typescript
import { MigrationScriptExecutor, Config, BackupMode } from '@migration-script-runner/core';

const config = new Config();
config.backupMode = BackupMode.MANUAL;
config.backup.deleteBackup = true;

const executor = new MigrationScriptExecutor({ handler , config });

// Step 1: Create backup manually
console.log('Creating backup...');
const backupPath = await executor.createBackup();
console.log(`Backup created: ${backupPath}`);

try {
  // Step 2: Run migrations
  console.log('Running migrations...');
  await executor.migrate();

  // Step 3: Success - clean up
  console.log('Migrations successful!');
  executor.deleteBackup();

} catch (error) {
  // Step 4: Failure - restore
  console.error('Migration failed:', error.message);
  console.log('Restoring from backup...');

  await executor.restoreFromBackup(backupPath);
  console.log('Database restored to previous state');

  // Optional: Keep backup for investigation
  // executor.deleteBackup(); // Uncomment to delete
}
```

### Conditional Restore Example

```typescript
const backupPath = await executor.createBackup();

try {
  await executor.migrate();
  executor.deleteBackup();
} catch (error) {
  // Only restore for certain error types
  if (shouldRestore(error)) {
    await executor.restoreFromBackup(backupPath);
  } else {
    console.log('Keeping database as-is for debugging');
  }
}

function shouldRestore(error: Error): boolean {
  // Custom logic to determine if restore is needed
  return error.message.includes('constraint violation');
}
```

### Multiple Backup Workflow

```typescript
// Create multiple backups for different scenarios
config.backup.deleteBackup = false;

// Before migrations
const beforeBackup = await executor.createBackup();

// After first batch
await runFirstBatch();
const midpointBackup = await executor.createBackup();

// After all migrations
await runSecondBatch();
const finalBackup = await executor.createBackup();

// Selective restore based on which batch failed
if (secondBatchFailed) {
  await executor.restoreFromBackup(midpointBackup);
}
```

---

## Complete Examples

### Development Configuration

Simple backup for local development:

```typescript
const config = new Config();
config.rollbackStrategy = RollbackStrategy.BACKUP;

config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
config.backup.ext = '.bkp';

// Result: ./backups/backup-2025-01-22-01-30-45.bkp
```

### Production Configuration

Organized backups with environment identification:

```typescript
const config = new Config();
config.rollbackStrategy = RollbackStrategy.BOTH;

config.backup = new BackupConfig();
config.backup.folder = '/var/lib/myapp/backups';
config.backup.deleteBackup = true;
config.backup.prefix = 'myapp-db';
config.backup.filename = process.env.NODE_ENV;
config.backup.timestamp = true;
config.backup.timestampFormat = 'YYYYMMDD-HHmmss';
config.backup.ext = '.sql';

// Result: /var/lib/myapp/backups/myapp-db-production-20250122-013045.sql
```

### Audit-Compliant Configuration

Keep all backups for compliance:

```typescript
const config = new Config();
config.rollbackStrategy = RollbackStrategy.BACKUP;

config.backup = new BackupConfig();
config.backup.folder = '/mnt/audit-backups';
config.backup.deleteBackup = false;  // Keep all backups
config.backup.prefix = 'audit-backup';
config.backup.timestamp = true;
config.backup.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';
config.backup.ext = '.sql';

// Result: /mnt/audit-backups/audit-backup-2025-01-22-01-30-45.sql
// (Backups accumulate, implement cleanup strategy)
```

### Multi-Environment Configuration

Different settings per environment:

```typescript
const config = new Config();
config.rollbackStrategy = RollbackStrategy.BOTH;

config.backup = new BackupConfig();

// Environment-specific folder
config.backup.folder = process.env.NODE_ENV === 'production'
    ? '/var/backups/production'
    : './backups';

// Delete in dev, keep in production
config.backup.deleteBackup = process.env.NODE_ENV !== 'production';

// Environment in filename
config.backup.filename = process.env.NODE_ENV;

// Common settings
config.backup.timestamp = true;
config.backup.timestampFormat = 'YYYYMMDD-HHmmss';
config.backup.ext = '.bkp';
```

---

## Best Practices

### 1. Use Absolute Paths in Production

```typescript
// ✅ Good - absolute path
config.backup.folder = '/var/lib/myapp/backups';

// ❌ Risky - relative path may change based on working directory
config.backup.folder = './backups';
```

### 2. Enable Timestamps for Multiple Backups

```typescript
// ✅ Good - unique backups
config.backup.timestamp = true;
config.backup.deleteBackup = false;

// ❌ Bad - single backup overwrites
config.backup.timestamp = false;
config.backup.deleteBackup = false;
```

### 3. Use Descriptive Prefixes and Filenames

```typescript
// ✅ Good - clear identification
config.backup.prefix = 'myapp-postgres';
config.backup.filename = process.env.NODE_ENV;

// ❌ Bad - unclear
config.backup.prefix = 'bk';
config.backup.filename = 'temp';
```

### 4. Match Extension to Backup Format

```typescript
// ✅ Good - extension matches format
config.backup.ext = '.sql';  // For SQL dump
config.backup.ext = '.json'; // For JSON serialization

// ❌ Misleading - doesn't match format
config.backup.ext = '.sql';  // But using JSON serialization
```

### 5. Implement Cleanup Strategy

```typescript
// ✅ Good - cleanup old backups
config.backup.deleteBackup = false;

// Add cleanup job
setInterval(() => {
    cleanupOldBackups(config.backup.folder, 30); // Keep 30 days
}, 24 * 60 * 60 * 1000);

// ❌ Bad - no cleanup, disk fills up
config.backup.deleteBackup = false;
// No cleanup strategy!
```

---

## Storage Considerations

### Disk Space

Calculate required disk space:

```typescript
// Estimate: backup size ≈ database size
const dbSize = await getDatabaseSize();
const backupsPerDay = 10;
const retentionDays = 30;

const requiredSpace = dbSize * backupsPerDay * retentionDays;

if (availableSpace < requiredSpace) {
    // Enable deletion or reduce retention
    config.backup.deleteBackup = true;
}
```

### Backup Location

Choose appropriate backup location:

```typescript
// Same disk (fast, less safe)
config.backup.folder = '/var/lib/myapp/backups';

// Different disk (safer)
config.backup.folder = '/mnt/backup-disk/myapp';

// Network storage (safest, slower)
config.backup.folder = '/mnt/nfs/backups/myapp';

// Docker volume (portable)
config.backup.folder = '/backups';  // Mounted volume
```

---

## Troubleshooting

### Problem: Permission Denied

**Cause:** Backup folder not writable

**Solution:**
```bash
# Check permissions
ls -ld /var/lib/myapp/backups

# Fix permissions
sudo chown myapp:myapp /var/lib/myapp/backups
sudo chmod 755 /var/lib/myapp/backups
```

### Problem: Disk Full

**Cause:** Too many backups accumulated

**Solution:**
```typescript
// Enable automatic deletion
config.backup.deleteBackup = true;

// Or implement cleanup
cleanupOldBackups(config.backup.folder, retentionDays);
```

### Problem: Backup Too Slow

**Cause:** Large database or slow storage

**Solution:**
```typescript
// Switch to DOWN strategy
config.rollbackStrategy = RollbackStrategy.DOWN;

// Or use faster storage
config.backup.folder = '/dev/shm/backups';  // RAM disk (temporary)
```

---

