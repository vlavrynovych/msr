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
import { IDatabaseMigrationHandler, IMigrationInfo, IBackup, IDB, ISchemaVersion } from '@migration-script-runner/core';

export class MyDatabaseHandler implements IDatabaseMigrationHandler {

  // Your database connection
  db: IDB;

  // Schema version tracking (required)
  schemaVersion: ISchemaVersion;

  // Backup interface (optional - only needed for BACKUP or BOTH rollback strategies)
  backup?: IBackup;

  getName(): string {
    return 'MyDatabaseHandler';
  }

}
```

**Note:** The backup interface is now **optional**. You only need to implement it if using BACKUP or BOTH rollback strategies. For DOWN or NONE strategies, you can omit the backup implementation entirely.

---

## Creating Your First Migration Script

Create a migration file following the naming convention: `V{timestamp}_{description}.ts`

Example: `V202501220100_initial_setup.ts`

```typescript
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

// Define your database type for type safety
interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export default class InitialSetup implements IRunnableScript {

  async up(
    db: IMyDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {

    // Your migration logic here with full type safety
    console.log('Running initial setup...');

    // Example: create tables, insert data, etc.
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');

    return 'Migration completed successfully';
  }

  // Optional: Implement down() for rollback without backups
  async down(
    db: IMyDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {

    // Reverse the changes made in up()
    console.log('Rolling back initial setup...');

    await db.query('DROP TABLE IF EXISTS users');

    return 'Rollback completed successfully';
  }
}
```

**Tip:** The `down()` method is optional but recommended for the DOWN rollback strategy. It allows you to rollback migrations without requiring database backups.

---

## Configuration

Create a configuration object to customize MSR behavior:

```typescript
import { Config, BackupConfig, RollbackStrategy } from '@migration-script-runner/core';

const config = new Config();

// Set migration scripts folder
config.folder = './migrations';

// Set filename pattern (optional)
config.filePattern = /^V(\d+)_(.+)\.ts$/;

// Set schema version table name
config.tableName = 'schema_version';

// Configure rollback strategy (defaults to BACKUP for backward compatibility)
config.rollbackStrategy = RollbackStrategy.DOWN;  // Use down() methods

// Configure backups (only needed for BACKUP or BOTH strategies)
config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
```

### Rollback Strategies

MSR supports four rollback strategies:

- **`RollbackStrategy.BACKUP`** (default): Traditional backup/restore. Creates a backup before migrations and restores on failure.
- **`RollbackStrategy.DOWN`**: Calls `down()` methods on migrations in reverse order. No backup required.
- **`RollbackStrategy.BOTH`**: Tries `down()` first, falls back to backup if `down()` fails. Requires backup interface.
- **`RollbackStrategy.NONE`**: No rollback. Logs a warning and leaves database in current state.

**Example:**
```typescript
// Use down() methods for rollback (no backup needed)
config.rollbackStrategy = RollbackStrategy.DOWN;

// Use both strategies (down first, backup as fallback)
config.rollbackStrategy = RollbackStrategy.BOTH;

// No rollback (dangerous - use only in development)
config.rollbackStrategy = RollbackStrategy.NONE;
```

---

## Running Migrations

### Execute Pending Migrations

MSR can be used either as a library (recommended) or as a CLI tool.

#### Library Usage (Recommended)

Use MSR as a library to integrate migrations into your application without terminating the process:

```typescript
import { MigrationScriptExecutor, IMigrationResult, Config } from '@migration-script-runner/core';

const config = new Config();
const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler, config);

// Run migrations and get structured results
const result: IMigrationResult = await executor.migrate();

if (result.success) {
  console.log(`✅ Successfully executed ${result.executed.length} migrations`);
  console.log(`📋 Total migrations in database: ${result.migrated.length}`);

  if (result.ignored.length > 0) {
    console.warn(`⚠️ Ignored ${result.ignored.length} out-of-order migrations`);
  }

  // Continue with application startup
  await startApplication();
} else {
  console.error('❌ Migration failed');
  result.errors?.forEach(err => console.error(err));

  // Handle error gracefully
  await notifyAdmins(result.errors);
  process.exit(1);
}
```

#### CLI Usage

For standalone migration scripts, control the process exit based on results:

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';

const config = new Config();
const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler, config);

const result = await executor.migrate();
process.exit(result.success ? 0 : 1);
```

### List All Migrations

```typescript
// List all migrations with their status
await executor.list();

// List only the last 10 migrations
await executor.list(10);
```

---

## Project Structure

### Flat Structure (Traditional)

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

### Organized by Sub-folders (Recommended)

MSR supports organizing migrations into sub-folders by feature, module, or version:

```
my-project/
├── migrations/
│   ├── users/                   # User-related migrations
│   │   ├── V202501220100_create_users_table.ts
│   │   └── V202501230200_add_user_roles.ts
│   ├── auth/                    # Authentication migrations
│   │   └── V202501220150_create_sessions_table.ts
│   └── products/                # Product migrations
│       └── V202501240100_create_products_table.ts
├── backups/
└── src/
    ├── database-handler.ts
    └── run-migrations.ts
```

**Note:** Migrations execute in timestamp order regardless of folder structure:
1. `V202501220100_create_users_table.ts` (users/)
2. `V202501220150_create_sessions_table.ts` (auth/)
3. `V202501230200_add_user_roles.ts` (users/)
4. `V202501240100_create_products_table.ts` (products/)

Sub-folder scanning is enabled by default. To disable:
```typescript
config.recursive = false;
```

---

## Using beforeMigrate for Data Seeding

MSR supports a special `beforeMigrate.ts` (or `.js`) file that executes once before any migrations run, similar to Flyway's `beforeMigrate.sql`. Simply place a file named `beforeMigrate.ts` in your migrations folder - MSR will automatically detect and execute it **before** scanning for migrations.

**Important**: The beforeMigrate script runs **before migration scanning**, allowing it to completely reset or erase the database (e.g., loading a production snapshot) and then apply all migrations to that fresh state.

This special file is perfect for:

- **Data seeding**: Loading production snapshots or test data before migrations
- **Fresh database setup**: Creating database extensions, schemas, or initial structure
- **Environment-specific configuration**: Setting connection parameters, timeouts, or modes
- **Validation checks**: Ensuring database version compatibility or required prerequisites

### Example: beforeMigrate.ts for Seeding Production Snapshot

Create a file named `beforeMigrate.ts` in your migrations folder:

```typescript
// migrations/beforeMigrate.ts
import fs from 'fs';
import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from 'migration-script-runner';

export default class BeforeMigrate implements IRunnableScript {
  async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    // Load production snapshot for testing/development
    if (process.env.NODE_ENV === 'development') {
      const snapshot = fs.readFileSync('./snapshots/prod_snapshot.sql', 'utf8');
      console.log('Loading production snapshot...');

      // Execute snapshot SQL (example for PostgreSQL)
      await (db as any).query(snapshot);
      console.log('✅ Production snapshot loaded');
    }

    return 'beforeMigrate setup completed';
  }
}
```

### Example: beforeMigrate.ts for PostgreSQL Extensions

```typescript
// migrations/beforeMigrate.ts
import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from 'migration-script-runner';

export default class BeforeMigrate implements IRunnableScript {
  async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    // Check if this is a fresh database
    const tables = await (db as any).query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);

    if (tables[0].count === 0) {
      // Fresh database - create required extensions
      await (db as any).query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await (db as any).query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
      console.log('✅ Database extensions created');
    }

    return 'beforeMigrate setup completed';
  }
}
```

### Example: beforeMigrate.ts for Environment-Specific Setup

```typescript
// migrations/beforeMigrate.ts
import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from 'migration-script-runner';

export default class BeforeMigrate implements IRunnableScript {
  async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    if (process.env.NODE_ENV === 'test') {
      // Disable query timeouts for tests
      await (db as any).query('SET statement_timeout = 0');
    } else if (process.env.NODE_ENV === 'production') {
      // Enable strict mode for production
      await (db as any).query('SET sql_mode = STRICT_ALL_TABLES');
    }

    return 'Environment setup completed';
  }
}
```

### Example: beforeMigrate.ts for Version Validation

```typescript
// migrations/beforeMigrate.ts
import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from 'migration-script-runner';

export default class BeforeMigrate implements IRunnableScript {
  async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    const result = await (db as any).query('SELECT version()');
    const version = result[0].version;

    const minVersion = '13.0';
    if (!this.isVersionCompatible(version, minVersion)) {
      throw new Error(
        `Database version ${version} is not compatible. ` +
        `Minimum required: ${minVersion}`
      );
    }

    return 'Version validation passed';
  }

  private isVersionCompatible(current: string, required: string): boolean {
    // Version comparison logic
    return true; // Simplified for example
  }
}
```

### Configuration

The beforeMigrate filename is configurable:

```typescript
import { Config } from 'migration-script-runner';

const config = new Config();

// Default: looks for beforeMigrate.ts or beforeMigrate.js
config.beforeMigrateName = 'beforeMigrate';

// Custom name: looks for setup.ts or setup.js
config.beforeMigrateName = 'setup';

// Disable feature entirely
config.beforeMigrateName = null;
```

### Important Notes

- `beforeMigrate.ts` is **optional** - migrations work fine without it
- It executes **once** before migration scanning (allowing it to reset the database)
- It runs **before** MSR scans for pending migrations
- Errors thrown here will **fail the migration** and trigger backup restoration
- The file follows the same structure as regular migration scripts (implements `IRunnableScript`)
- Both `.ts` and `.js` extensions are supported
- Filename is configurable via `config.beforeMigrateName`
- Can be completely disabled by setting `config.beforeMigrateName = null`

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
