---
layout: default
title: Getting Started
nav_order: 2
---

# Getting Started
{: .no_toc }

This guide will help you set up and run your first migrations with Migration Script Runner.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Installation

Install MSR via npm:

```bash
npm install migration-script-runner
```

Or with yarn:

```bash
yarn add migration-script-runner
```

---

## Prerequisites

- Node.js 14.x or higher
- TypeScript 4.x or higher (if using TypeScript)
- A database system you want to manage migrations for

---

## Implementing Your Database Handler

MSR is database-agnostic. You need to implement the `IDatabaseMigrationHandler` interface for your specific database:

```typescript
import { IDatabaseMigrationHandler, IMigrationInfo } from '@migration-script-runner/core';

export class MyDatabaseHandler implements IDatabaseMigrationHandler {

  /**
   * Initialize database connection and schema version table
   */
  async init(): Promise<void> {
    // Connect to your database
    // Create schema version tracking table if needed
  }

  /**
   * Save migration info after successful execution
   */
  async save(info: IMigrationInfo): Promise<void> {
    // Save migration metadata to your tracking table
  }

  /**
   * Get all previously executed migrations
   */
  async getAllMigratedScripts(): Promise<IMigrationInfo[]> {
    // Query your tracking table
    return [];
  }

  /**
   * Create a backup of current database state
   */
  async backup(): Promise<string> {
    // Create backup and return serialized state
    return JSON.stringify({ /* your backup data */ });
  }

  /**
   * Restore database from backup
   */
  async restore(data: string): Promise<void> {
    // Restore database from serialized backup
  }
}
```

---

## Creating Your First Migration Script

Create a migration file following the naming convention: `V{timestamp}_{description}.ts`

Example: `V202501220100_initial_setup.ts`

```typescript
import { IMigrationScript, IMigrationInfo, IDatabaseMigrationHandler } from '@migration-script-runner/core';

export default class InitialSetup implements IMigrationScript {

  async up(
    db: any,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<any> {

    // Your migration logic here
    console.log('Running initial setup...');

    // Example: create tables, insert data, etc.
    // await db.query('CREATE TABLE users ...');

    return 'Migration completed successfully';
  }
}
```

---

## Configuration

Create a configuration object to customize MSR behavior:

```typescript
import { Config, BackupConfig } from '@migration-script-runner/core';

const config = new Config();

// Set migration scripts folder
config.folder = './migrations';

// Set filename pattern (optional)
config.filePattern = /^V(\d+)_(.+)\.ts$/;

// Set schema version table name
config.tableName = 'schema_version';

// Configure backups
config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
```

---

## Running Migrations

### Execute Pending Migrations

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor(config, new MyDatabaseHandler());

// Run all pending migrations
await executor.migrate();
```

### List All Migrations

```typescript
// List all migrations with their status
await executor.list();
```

### Get Pending Migrations

```typescript
// Get list of migrations that haven't been executed yet
const pending = await executor.getTodo();
console.log(`${pending.length} migrations pending`);
```

---

## Project Structure

Recommended project structure:

```
my-project/
├── migrations/                  # Migration scripts
│   ├── V202501220100_initial.ts
│   ├── V202501220200_add_users.ts
│   └── V202501220300_add_posts.ts
├── backups/                     # Automatic backups
├── src/
│   ├── database-handler.ts     # Your DB implementation
│   └── run-migrations.ts       # Migration runner
└── package.json
```

---

## Next Steps

- [Configuration Guide](configuration) - Learn about all configuration options
- [API Reference](api/) - Explore the full API
- [Writing Migrations](guides/writing-migrations) - Best practices for migration scripts
- [Testing](testing/) - How to test your migrations

---

## Troubleshooting

### Migration files not found

Make sure your `config.folder` points to the correct directory and your files match the `filePattern`:

```typescript
config.folder = './migrations';  // Relative or absolute path
config.filePattern = /^V(\d+)_(.+)\.ts$/;  // Must match your naming
```

### TypeScript compilation issues

If using TypeScript, ensure `ts-node` is installed:

```bash
npm install --save-dev ts-node
```

### Database connection errors

Verify your database handler's `init()` method properly establishes a connection before migrations run.

---

## Need Help?

- [GitHub Issues](https://github.com/vlavrynovych/msr/issues)
- [npm Package](https://www.npmjs.com/package/migration-script-runner)
