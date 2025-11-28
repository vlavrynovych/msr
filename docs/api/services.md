---
layout: default
title: Services
parent: API Reference
nav_order: 4
---

# Services
{: .no_toc }

Internal service classes for advanced usage and customization.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Services

### MigrationService

Service for scanning and loading migration files.

```typescript
import { MigrationService } from '@migration-script-runner/core';

const service = new MigrationService();
const scripts = await service.readMigrationScripts(config);
```

#### Methods

##### readMigrationScripts()

Scan directory and load all migration scripts.

```typescript
async readMigrationScripts(config: Config): Promise<MigrationScript[]>
```

**Parameters:**
- `config`: Configuration object

**Returns:** Array of `MigrationScript` objects sorted by timestamp

{: .note }
The `beforeMigrate` file (if it exists) is NOT included in the results. It's handled separately via `getBeforeMigrateScript()`.

---

##### getBeforeMigrateScript()

Check if a `beforeMigrate` setup script exists.

```typescript
async getBeforeMigrateScript(config: Config): Promise<string | undefined>
```

**Parameters:**
- `config`: Configuration object containing `beforeMigrateName` property

**Returns:** Path to beforeMigrate script if found, `undefined` otherwise

**Behavior:**
- Returns `undefined` if `config.beforeMigrateName` is `null` (feature disabled)
- Looks for files with configured name + `.ts` or `.js` extension
- Only searches in root of migrations folder (not recursive)

**Example:**
```typescript
const config = new Config();
config.beforeMigrateName = 'beforeMigrate';  // default
config.folder = './migrations';

const service = new MigrationService();
const path = await service.getBeforeMigrateScript(config);

if (path) {
  console.log(`Found beforeMigrate script: ${path}`);
  // migrations/beforeMigrate.ts
}
```

---

### SchemaVersionService

Service for managing the schema version tracking table.

```typescript
import { SchemaVersionService } from '@migration-script-runner/core';

const service = new SchemaVersionService(config, handler);
await service.init();
```

#### Methods

##### init()

Initialize the schema version table.

```typescript
async init(): Promise<void>
```

---

##### save()

Save migration info to tracking table.

```typescript
async save(info: IMigrationInfo): Promise<void>
```

---

##### getAllMigratedScripts()

Get all executed migrations.

```typescript
async getAllMigratedScripts(): Promise<IMigrationInfo[]>
```

---

##### remove()

Remove a migration record from the schema version table.

```typescript
async remove(timestamp: number): Promise<void>
```

**Parameters:**
- `timestamp`: The timestamp of the migration to remove

**Usage:**
Used internally by `downTo()` to remove migration records after successful rollback. Can also be used manually for maintenance operations.

**Example:**
```typescript
const service = new SchemaVersionService(config, handler);
await service.remove(202501220100);
```

{: .note }
> This method is called automatically by `downTo()` after successfully executing a migration's `down()` method. Manual use is typically not needed unless performing database maintenance.

---

### BackupService

Service for backup and restore operations.

```typescript
import { BackupService } from '@migration-script-runner/core';

const service = new BackupService(config.backup, handler);
const backupPath = await service.backup();
```

#### Methods

##### backup()

Create a backup file.

```typescript
async backup(): Promise<string>
```

**Returns:** Path to created backup file

---

##### restore()

Restore from a backup file.

```typescript
async restore(backupPath?: string): Promise<void>
```

**Parameters:**
- `backupPath` (optional): Path to specific backup file. If not provided, uses the most recent backup.

---

##### deleteBackup()

Delete the backup file from disk.

```typescript
deleteBackup(): void
```

**Behavior:**
- Only deletes if `config.backup.deleteBackup` is `true`
- Safe to call multiple times

---

