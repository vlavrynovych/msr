---
layout: default
title: Backup & Restore
parent: Environment Variables
grand_parent: API Reference
nav_order: 4
---

# Backup Environment Variables
{: .no_toc }

Environment variables for configuring automatic database backups before migrations.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Backup environment variables control automatic database backups created before migration execution, providing safety and rollback capability.

**Key Features:**
- Automatic backups before migrations
- Flexible filename customization
- Configurable retention policies
- Restore from existing backups

---

## Configuration Approaches

### Dot-Notation (Recommended)

Configure individual properties:

```bash
export MSR_BACKUP_FOLDER=./backups
export MSR_BACKUP_TIMESTAMP=true
export MSR_BACKUP_DELETE_BACKUP=false
export MSR_BACKUP_PREFIX=db-backup
```

### JSON Format

Configure all settings at once:

```bash
export MSR_BACKUP='{
  "folder": "./backups",
  "timestamp": true,
  "deleteBackup": false,
  "prefix": "db-backup",
  "timestampFormat": "YYYY-MM-DD-HH-mm-ss"
}'
```

**Priority**: Dot-notation variables override JSON configuration.

---

## Variables

### MSR_BACKUP

**Complete backup configuration as JSON**

- **Type**: `JSON object`
- **Default**: None
- **Example**: See JSON Format above

Alternative to dot-notation variables. Provides complete backup configuration in a single variable.

```bash
export MSR_BACKUP='{"folder":"./backups","timestamp":true,"deleteBackup":false}'
```

**JSON Schema:**
```typescript
{
  folder?: string;              // Backup directory
  timestamp?: boolean;          // Include timestamp
  deleteBackup?: boolean;       // Delete after success
  prefix?: string;              // Filename prefix
  custom?: string;              // Custom component
  suffix?: string;              // Filename suffix
  timestampFormat?: string;     // Timestamp format
  extension?: string;           // File extension
  existingBackupPath?: string;  // Path for restore
}
```

**Programmatic Equivalent:**
```typescript
config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.timestamp = true;
```

---

### MSR_BACKUP_FOLDER

**Backup files directory**

- **Type**: `string`
- **Default**: `./backups`
- **Example**: `./database/backups`, `/var/backups/db`

Directory where backup files are created. Created automatically if it doesn't exist.

```bash
export MSR_BACKUP_FOLDER=./database/backups
```

**Programmatic Equivalent:**
```typescript
config.backup.folder = './database/backups';
```

**Permissions:**
- Directory must be writable by the application
- Consider disk space for production databases
- Should be on reliable storage with sufficient capacity

**See Also:**
- [Backup Settings](../../configuration/backup-settings#folder)

---

### MSR_BACKUP_TIMESTAMP

**Include timestamp in filename**

- **Type**: `boolean`
- **Default**: `true`
- **Example**: `true`, `false`

Controls whether timestamp is included in backup filename.

```bash
# With timestamp (default)
export MSR_BACKUP_TIMESTAMP=true
# Result: backup-2024-01-15-14-30-45.bkp

# Without timestamp
export MSR_BACKUP_TIMESTAMP=false
# Result: backup.bkp
```

**Programmatic Equivalent:**
```typescript
config.backup.timestamp = true;
```

**Use Cases:**
- `true` - Keep multiple backups, historical tracking
- `false` - Only keep latest backup, save disk space

---

### MSR_BACKUP_DELETE_BACKUP

**Delete backup after successful migration**

- **Type**: `boolean`
- **Default**: `true`
- **Example**: `true`, `false`

Controls whether backup is deleted after successful migration.

```bash
# Delete after success (default)
export MSR_BACKUP_DELETE_BACKUP=true

# Keep backups
export MSR_BACKUP_DELETE_BACKUP=false
```

**Programmatic Equivalent:**
```typescript
config.backup.deleteBackup = true;
```

**Behavior:**

| Migration Result | `true` | `false` |
|------------------|--------|---------|
| Success | 🗑️ Delete | ✅ Keep |
| Failure | ✅ Keep | ✅ Keep |

**Use Cases:**
- `true` - Production (automatic cleanup)
- `false` - Development, compliance, audit requirements

---

### MSR_BACKUP_PREFIX

**Filename prefix**

- **Type**: `string`
- **Default**: `backup`
- **Example**: `db-backup`, `prod-backup`, `myapp`

Prefix component of backup filename.

```bash
export MSR_BACKUP_PREFIX=prod-backup
# Result: prod-backup-2024-01-15-14-30-45.bkp
```

**Programmatic Equivalent:**
```typescript
config.backup.prefix = 'prod-backup';
```

**Filename Format:**
```
{prefix}[-{custom}][-{timestamp}][{suffix}].{extension}
```

**Examples:**

| Configuration | Filename |
|---------------|----------|
| prefix: `backup` | `backup-2024-01-15.bkp` |
| prefix: `db-backup` | `db-backup-2024-01-15.bkp` |
| prefix: `prod` | `prod-2024-01-15.bkp` |

---

### MSR_BACKUP_CUSTOM

**Custom filename component**

- **Type**: `string`
- **Default**: `''` (empty)
- **Example**: `production`, `staging`, `v1.2.0`

Custom component inserted into backup filename between prefix and timestamp.

```bash
export MSR_BACKUP_PREFIX=backup
export MSR_BACKUP_CUSTOM=production
# Result: backup-production-2024-01-15-14-30-45.bkp
```

**Programmatic Equivalent:**
```typescript
config.backup.custom = 'production';
```

**Use Cases:**
- Environment identification: `production`, `staging`, `dev`
- Version tracking: `v1.2.0`, `release-2024-01`
- Custom identifiers: `customer-name`, `tenant-id`

**Examples:**

| prefix | custom | timestamp | Result |
|--------|--------|-----------|--------|
| `backup` | `prod` | `2024-01-15` | `backup-prod-2024-01-15.bkp` |
| `db` | `v1.2.0` | `2024-01-15` | `db-v1.2.0-2024-01-15.bkp` |

---

### MSR_BACKUP_SUFFIX

**Filename suffix**

- **Type**: `string`
- **Default**: `''` (empty)
- **Example**: `-pre-migration`, `-before-update`

Suffix component appended before file extension.

```bash
export MSR_BACKUP_SUFFIX=-pre-migration
# Result: backup-2024-01-15-14-30-45-pre-migration.bkp
```

**Programmatic Equivalent:**
```typescript
config.backup.suffix = '-pre-migration';
```

**Note**: Suffix should include leading dash if desired.

---

### MSR_BACKUP_TIMESTAMP_FORMAT

**Timestamp format**

- **Type**: `string` (Moment.js format)
- **Default**: `YYYY-MM-DD-HH-mm-ss`
- **Example**: `YYYYMMDD-HHmmss`, `YYYY-MM-DD`

Moment.js format string for backup timestamp.

```bash
# Default format
export MSR_BACKUP_TIMESTAMP_FORMAT=YYYY-MM-DD-HH-mm-ss
# Result: backup-2024-01-15-14-30-45.bkp

# Compact format
export MSR_BACKUP_TIMESTAMP_FORMAT=YYYYMMDD-HHmmss
# Result: backup-20240115-143045.bkp

# Date only
export MSR_BACKUP_TIMESTAMP_FORMAT=YYYY-MM-DD
# Result: backup-2024-01-15.bkp
```

**Programmatic Equivalent:**
```typescript
config.backup.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';
```

**Common Formats:**

| Format | Example | Use Case |
|--------|---------|----------|
| `YYYY-MM-DD-HH-mm-ss` | `2024-01-15-14-30-45` | Full precision (default) |
| `YYYYMMDD-HHmmss` | `20240115-143045` | Compact format |
| `YYYY-MM-DD` | `2024-01-15` | Daily backups |
| `YYYY-MM-DD-HH` | `2024-01-15-14` | Hourly backups |

**See Also:**
- [Moment.js Format Documentation](https://momentjs.com/docs/#/displaying/format/)

---

### MSR_BACKUP_EXTENSION

**File extension**

- **Type**: `string`
- **Default**: `bkp`
- **Example**: `bak`, `backup`, `sql`, `dump`

File extension for backup files (without leading dot).

```bash
export MSR_BACKUP_EXTENSION=sql
# Result: backup-2024-01-15-14-30-45.sql
```

**Programmatic Equivalent:**
```typescript
config.backup.extension = 'sql';
```

**Common Extensions:**

| Extension | Use Case |
|-----------|----------|
| `bkp` | Generic backup (default) |
| `bak` | Alternative backup extension |
| `sql` | SQL dump files |
| `dump` | Database dump files |
| `tar.gz` | Compressed archives |

**Note**: Do not include the leading dot.

---

### MSR_BACKUP_EXISTING_BACKUP_PATH

**Path to existing backup for restore**

- **Type**: `string`
- **Default**: `undefined`
- **Example**: `./backups/backup-2024-01-15.bkp`

Path to existing backup file for restore operations.

```bash
export MSR_BACKUP_EXISTING_BACKUP_PATH=./backups/backup-2024-01-15.bkp
```

**Programmatic Equivalent:**
```typescript
config.backup.existingBackupPath = './backups/backup-2024-01-15.bkp';
```

**Use Cases:**
- Restore from specific backup
- Disaster recovery
- Environment synchronization

**See Also:**
- [Backup & Restore Guide](../../guides/backup-restore-workflows)
- [Restore Operations](../../guides/backup-restore-workflows#restore-operations)

---

## Complete Examples

### Development Environment

Keep all backups for safety:

```bash
export MSR_BACKUP_FOLDER=./backups
export MSR_BACKUP_TIMESTAMP=true
export MSR_BACKUP_DELETE_BACKUP=false
export MSR_BACKUP_PREFIX=dev-backup
```

### Production Environment

Automatic cleanup with environment identification:

```bash
export MSR_BACKUP_FOLDER=/var/backups/database
export MSR_BACKUP_PREFIX=backup
export MSR_BACKUP_CUSTOM=production
export MSR_BACKUP_TIMESTAMP=true
export MSR_BACKUP_TIMESTAMP_FORMAT=YYYY-MM-DD-HH-mm-ss
export MSR_BACKUP_DELETE_BACKUP=true
export MSR_BACKUP_EXTENSION=bkp
```

### CI/CD Pipeline

Compact backups with build identification:

```bash
export MSR_BACKUP_FOLDER=./build/backups
export MSR_BACKUP_PREFIX=ci
export MSR_BACKUP_CUSTOM=${BUILD_NUMBER}
export MSR_BACKUP_TIMESTAMP=false
export MSR_BACKUP_DELETE_BACKUP=false
```

### Docker Configuration

```dockerfile
ENV MSR_BACKUP_FOLDER=/var/backups \
    MSR_BACKUP_PREFIX=docker-backup \
    MSR_BACKUP_TIMESTAMP=true \
    MSR_BACKUP_DELETE_BACKUP=true \
    MSR_BACKUP_EXTENSION=bkp
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: msr-backup-config
data:
  MSR_BACKUP_FOLDER: "/var/backups/database"
  MSR_BACKUP_PREFIX: "k8s-backup"
  MSR_BACKUP_CUSTOM: "production"
  MSR_BACKUP_TIMESTAMP: "true"
  MSR_BACKUP_TIMESTAMP_FORMAT: "YYYY-MM-DD-HH-mm-ss"
  MSR_BACKUP_DELETE_BACKUP: "true"
  MSR_BACKUP_EXTENSION: "bkp"
```

### Using JSON Format

Complete configuration in single variable:

```bash
export MSR_BACKUP='{
  "folder": "/var/backups/database",
  "prefix": "backup",
  "custom": "production",
  "timestamp": true,
  "timestampFormat": "YYYY-MM-DD-HH-mm-ss",
  "deleteBackup": true,
  "extension": "bkp"
}'
```

---

## Filename Examples

Based on different configurations:

| Configuration | Filename |
|---------------|----------|
| Default | `backup-2024-01-15-14-30-45.bkp` |
| Custom prefix | `db-backup-2024-01-15-14-30-45.bkp` |
| With custom component | `backup-production-2024-01-15-14-30-45.bkp` |
| With suffix | `backup-2024-01-15-14-30-45-pre-migration.bkp` |
| Different extension | `backup-2024-01-15-14-30-45.sql` |
| No timestamp | `backup.bkp` |
| Compact timestamp | `backup-20240115-143045.bkp` |
| Full customization | `prod-v1.2.0-20240115-143045-pre-update.sql` |

---

## Restore Operations

To restore from an existing backup:

```bash
# Specify the backup file to restore
export MSR_BACKUP_EXISTING_BACKUP_PATH=./backups/backup-2024-01-15.bkp

# Run restore operation (programmatically)
# executor.restore()
```

**See Also:**
- [Backup & Restore Workflows](../../guides/backup-restore-workflows)

---

## Source Code

TypeScript enum definition: [`src/model/env/BackupEnvVars.ts`](../../../src/model/env/BackupEnvVars.ts)
