---
layout: default
title: SQL Migrations
parent: Guides
nav_order: 4
---

# SQL Migrations Guide
{: .no_toc }

Complete guide to using SQL migration files with Migration Script Runner.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Starting with v0.4.0, MSR supports SQL migration files alongside TypeScript migrations. This allows you to write migrations in pure SQL for database-specific operations while still leveraging MSR's migration tracking, rollback strategies, and validation features.

### When to Use SQL Migrations

**Use SQL migrations for:**
- Schema changes (CREATE, ALTER, DROP statements)
- Database-specific features (PostgreSQL extensions, MySQL storage engines)
- Performance-critical operations (bulk inserts, complex queries)
- Simple DDL operations that don't require business logic

**Use TypeScript migrations for:**
- Complex data transformations requiring business logic
- Operations that need conditional logic or loops
- Migrations that interact with external APIs
- Cross-database compatible operations

### SQL Migration Features

- ✅ **golang-migrate style**: Separate `.up.sql` and `.down.sql` files
- ✅ **ISqlDB interface**: Type-safe database contract
- ✅ **Rollback support**: Use `.down.sql` files with DOWN strategy
- ✅ **Hybrid projects**: Mix TypeScript and SQL migrations freely
- ✅ **Database agnostic**: Works with any SQL database (PostgreSQL, MySQL, SQLite, etc.)

---

## File Naming Convention

SQL migrations follow the same timestamp-based naming as TypeScript migrations:

```
V{timestamp}_{description}.up.sql    # Forward migration (required)
V{timestamp}_{description}.down.sql  # Rollback migration (optional)
```

### Examples

**PostgreSQL Migration:**
```
V202501280100_create_users_table.up.sql
V202501280100_create_users_table.down.sql
```

**MySQL Migration:**
```
V202501280200_add_product_indexes.up.sql
V202501280200_add_product_indexes.down.sql
```

**SQLite Migration:**
```
V202501280300_create_sessions.up.sql
V202501280300_create_sessions.down.sql
```

### File Pairing

- `.up.sql` files are **required** and execute forward migrations
- `.down.sql` files are **optional** and used for rollback (DOWN strategy)
- Files are paired by timestamp - both must have the same timestamp prefix
- Execution order is determined by timestamp, not folder location

---

## ISqlDB Interface

To use SQL migrations, your database handler must implement the `ISqlDB` interface, which extends `IDB` with a `query()` method.

```typescript
interface ISqlDB extends IDB {
  query(sql: string): Promise<unknown>;
}
```

### Type Guard

MSR provides a type guard to check if a database implements ISqlDB:

```typescript
import { isSqlDB } from '@migration-script-runner/core';

if (isSqlDB(db)) {
  // Safe to use db.query()
  await db.query('SELECT * FROM users');
}
```

---

## Implementing ISqlDB

### PostgreSQL Example

```typescript
import { Pool, QueryResult } from 'pg';
import { ISqlDB } from '@migration-script-runner/core';

class PostgresDB implements ISqlDB {
  constructor(private pool: Pool) {}

  async query(sql: string): Promise<unknown> {
    const result: QueryResult = await this.pool.query(sql);
    return result.rows;
  }
}

// Usage in handler
export class PostgresHandler implements IDatabaseMigrationHandler<IDB> {
  db: PostgresDB;
  schemaVersion: ISchemaVersion;

  constructor(pool: Pool) {
    this.db = new PostgresDB(pool);
    // ... initialize schemaVersion
  }

  getName(): string {
    return 'PostgreSQL Handler';
  }
}
```

### MySQL Example

```typescript
import { Connection } from 'mysql2/promise';
import { ISqlDB } from '@migration-script-runner/core';

class MySQLDB implements ISqlDB {
  constructor(private connection: Connection) {}

  async query(sql: string): Promise<unknown> {
    const [rows] = await this.connection.execute(sql);
    return rows;
  }
}

// Usage in handler
export class MySQLHandler implements IDatabaseMigrationHandler<IDB> {
  db: MySQLDB;
  schemaVersion: ISchemaVersion;

  constructor(connection: Connection) {
    this.db = new MySQLDB(connection);
    // ... initialize schemaVersion
  }

  getName(): string {
    return 'MySQL Handler';
  }
}
```

### SQLite Example

```typescript
import Database from 'better-sqlite3';
import { ISqlDB } from '@migration-script-runner/core';

class SQLiteDB implements ISqlDB {
  constructor(private db: Database.Database) {}

  async query(sql: string): Promise<unknown> {
    // SQLite doesn't return Promise natively, so we wrap it
    try {
      const stmt = this.db.prepare(sql);

      // Check if it's a SELECT query
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all();
      } else {
        // For INSERT, UPDATE, DELETE, etc.
        return stmt.run();
      }
    } catch (error) {
      throw new Error(`SQLite query failed: ${error.message}`);
    }
  }
}

// Usage in handler
export class SQLiteHandler implements IDatabaseMigrationHandler<IDB> {
  db: SQLiteDB;
  schemaVersion: ISchemaVersion;

  constructor(db: Database.Database) {
    this.db = new SQLiteDB(db);
    // ... initialize schemaVersion
  }

  getName(): string {
    return 'SQLite Handler';
  }
}
```

---

## Writing SQL Migrations

### Basic Table Creation

**V202501280100_create_users_table.up.sql:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

**V202501280100_create_users_table.down.sql:**
```sql
DROP TABLE IF EXISTS users;
```

### Adding Columns

**V202501280200_add_user_status.up.sql:**
```sql
ALTER TABLE users
ADD COLUMN status VARCHAR(20) DEFAULT 'active' NOT NULL;

CREATE INDEX idx_users_status ON users(status);
```

**V202501280200_add_user_status.down.sql:**
```sql
DROP INDEX IF EXISTS idx_users_status;
ALTER TABLE users DROP COLUMN status;
```

### Data Migrations

**V202501280300_seed_default_roles.up.sql:**
```sql
INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrator with full access'),
  ('user', 'Regular user with limited access'),
  ('guest', 'Guest with read-only access');
```

**V202501280300_seed_default_roles.down.sql:**
```sql
DELETE FROM roles WHERE name IN ('admin', 'user', 'guest');
```

### Database-Specific Features

**PostgreSQL Extensions:**
```sql
-- V202501280400_enable_extensions.up.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "hstore";
```

**MySQL Storage Engines:**
```sql
-- V202501280500_create_audit_log.up.sql
CREATE TABLE audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    user_id INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## Configuration

### Enable SQL Migrations

SQL migrations are supported by default in v0.4.0. The default `filePatterns` configuration includes `.up.sql` files:

```typescript
import { Config } from '@migration-script-runner/core';

const config = new Config();
config.folder = './migrations';

// Default filePatterns (already includes SQL):
// [
//   /^V(\d{12})_.*\.ts$/,
//   /^V(\d{12})_.*\.js$/,
//   /^V(\d{12})_.*\.up\.sql$/
// ]
```

### Custom Patterns

To customize SQL file patterns:

```typescript
const config = new Config();

// TypeScript and SQL only
config.filePatterns = [
  /^V(\d{12})_.*\.ts$/,
  /^V(\d{12})_.*\.up\.sql$/
];

// Custom SQL naming
config.filePatterns = [
  /^V(\d{12})_.*\.ts$/,
  /^V(\d{12})_.*\.sql$/  // No .up suffix
];
```

---

## Rollback Strategies with SQL

SQL migrations work with all rollback strategies:

### RollbackStrategy.DOWN

Use `.down.sql` files for rollback:

```typescript
import { Config, RollbackStrategy } from '@migration-script-runner/core';

const config = new Config();
config.rollbackStrategy = RollbackStrategy.DOWN;
```

**Requirements:**
- Each `.up.sql` file should have a corresponding `.down.sql` file
- Down files execute the reverse operation
- Missing `.down.sql` files will cause rollback to fail

### RollbackStrategy.BACKUP

Use database backups for rollback:

```typescript
const config = new Config();
config.rollbackStrategy = RollbackStrategy.BACKUP;  // Default

// Backup configuration required
config.backup.folder = './backups';
config.backup.deleteBackup = true;
```

- No `.down.sql` files needed
- Backup created before migrations
- Restore on failure

### RollbackStrategy.BOTH

Try `.down.sql` first, fallback to backup:

```typescript
const config = new Config();
config.rollbackStrategy = RollbackStrategy.BOTH;

config.backup.folder = './backups';
```

- Best of both strategies
- Uses `.down.sql` if available
- Falls back to backup if `.down.sql` missing or fails

---

## Mixing TypeScript and SQL Migrations

You can freely mix TypeScript and SQL migrations in the same project. Execution order is determined by timestamp only.

### Project Structure

```
migrations/
├── V202501280100_create_schema.up.sql        # SQL
├── V202501280100_create_schema.down.sql
├── V202501280200_seed_initial_data.ts        # TypeScript
├── V202501280300_add_indexes.up.sql          # SQL
├── V202501280300_add_indexes.down.sql
└── V202501280400_migrate_legacy_data.ts      # TypeScript
```

### Execution Order

Migrations execute in timestamp order:
1. `V202501280100` - Create schema (SQL)
2. `V202501280200` - Seed data (TypeScript)
3. `V202501280300` - Add indexes (SQL)
4. `V202501280400` - Migrate data (TypeScript)

### Example Configuration

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';

const config = new Config();
config.folder = './migrations';
config.filePatterns = [
  /^V(\d{12})_.*\.ts$/,      // TypeScript migrations
  /^V(\d{12})_.*\.up\.sql$/   // SQL migrations
];

const executor = new MigrationScriptExecutor(handler, config);
const result = await executor.up();

console.log(`Executed ${result.executed.length} migrations (TypeScript + SQL)`);
```

---

## Error Handling

### SQL Syntax Errors

When a SQL migration fails, MSR provides detailed error information:

```
Migration failed: V202501280100_create_users_table

Error: relation "users" already exists

SQL Preview (first 200 chars):
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP...
```

### Missing ISqlDB Implementation

If your database handler doesn't implement ISqlDB:

```
Error: Database handler does not implement ISqlDB interface required for SQL migrations.
Please ensure your database handler's db property has a query(sql: string) method.

Migration: V202501280100_create_users_table.up.sql
```

**Solution:** Implement the `query()` method on your database class.

### Missing .down.sql Files

When using DOWN rollback strategy without `.down.sql` files:

```
Error: Cannot rollback migration - down file not found
Migration: V202501280100_create_users_table
Expected: V202501280100_create_users_table.down.sql
```

**Solutions:**
1. Create the missing `.down.sql` file
2. Use `RollbackStrategy.BACKUP` instead
3. Use `RollbackStrategy.BOTH` for fallback behavior

---

## Best Practices

### 1. Keep SQL Migrations Simple

```sql
-- ✅ Good - Simple, focused
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- ❌ Bad - Too complex, use TypeScript instead
CREATE TABLE products (id SERIAL PRIMARY KEY, name VARCHAR(255));
INSERT INTO products (name) SELECT DISTINCT name FROM legacy_products WHERE created_at > NOW() - INTERVAL '30 days';
UPDATE products SET name = UPPER(name) WHERE LENGTH(name) < 3;
```

### 2. Always Provide .down.sql When Possible

```sql
-- ✅ Good - Reversible
-- up.sql
CREATE TABLE sessions (id UUID PRIMARY KEY);

-- down.sql
DROP TABLE IF EXISTS sessions;

-- ❌ Bad - No rollback plan
-- up.sql
CREATE TABLE sessions (id UUID PRIMARY KEY);
-- (no down.sql file)
```

### 3. Use Transactions (Database-Specific)

**PostgreSQL:**
```sql
BEGIN;

CREATE TABLE users (id SERIAL PRIMARY KEY);
CREATE INDEX idx_users_id ON users(id);

COMMIT;
```

**MySQL:**
```sql
START TRANSACTION;

CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY);
CREATE INDEX idx_users_id ON users(id);

COMMIT;
```

{: .note }
SQLite enables transactions by default for schema changes.

### 4. Test SQL in Isolation First

Before creating a migration:

```bash
# Test SQL directly on database
psql -U user -d dbname -c "CREATE TABLE test (id SERIAL);"

# Verify it works, then create migration
cp test.sql migrations/V202501280100_create_test.up.sql
```

### 5. Use Database-Specific SQL Wisely

```sql
-- ✅ Good - PostgreSQL specific with clear comment
-- This migration requires PostgreSQL 12+
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- ⚠️ Caution - Not portable to other databases
-- Consider using TypeScript for cross-database compatibility
```

### 6. Document Complex Migrations

```sql
-- V202501280100_optimize_user_queries.up.sql
--
-- Purpose: Add composite index to improve user search performance
-- Impact: ~2 minute execution time on production (10M rows)
-- Rollback: Safe to rollback, removes index only
--

CREATE INDEX CONCURRENTLY idx_users_email_status
ON users(email, status)
WHERE deleted_at IS NULL;
```

---

## Troubleshooting

### SQL Migration Not Found

**Problem:** MSR doesn't detect `.sql` files

**Solution:**
```typescript
// Check filePatterns includes SQL
const config = new Config();
console.log(config.filePatterns);
// Should include: /^V(\d{12})_.*\.up\.sql$/

// If not, add manually:
config.filePatterns.push(/^V(\d{12})_.*\.up\.sql$/);
```

### Query Method Returns Wrong Type

**Problem:** `query()` returns incompatible type

**Solution:**
```typescript
class MyDB implements ISqlDB {
  async query(sql: string): Promise<unknown> {
    const result = await this.connection.execute(sql);
    // Return appropriate type for MSR
    return result.rows || result;
  }
}
```

### Multi-Statement SQL Fails

**Problem:** Multiple SQL statements in one file fail

**Solution (PostgreSQL):**
```typescript
// Some databases don't support multi-statement execution
// Split into multiple query() calls or use database-specific methods

class PostgresDB implements ISqlDB {
  async query(sql: string): Promise<unknown> {
    // PostgreSQL pg library handles multi-statement by default
    return await this.pool.query(sql);
  }
}
```

**Solution (MySQL):**
```typescript
class MySQLDB implements ISqlDB {
  async query(sql: string): Promise<unknown> {
    // MySQL requires multipleStatements option
    const statements = sql.split(';').filter(s => s.trim());
    const results = [];

    for (const stmt of statements) {
      if (stmt.trim()) {
        const [rows] = await this.connection.execute(stmt);
        results.push(rows);
      }
    }

    return results;
  }
}
```

---

## Complete Example

### Project Setup

```
my-project/
├── migrations/
│   ├── V202501280100_create_users.up.sql
│   ├── V202501280100_create_users.down.sql
│   ├── V202501280200_seed_roles.ts
│   └── V202501280300_add_indexes.up.sql
├── src/
│   ├── database/
│   │   ├── handler.ts
│   │   └── postgres-db.ts
│   └── migrate.ts
└── package.json
```

### PostgreSQL ISqlDB Implementation

**src/database/postgres-db.ts:**
```typescript
import { Pool, QueryResult } from 'pg';
import { ISqlDB } from '@migration-script-runner/core';

export class PostgresDB implements ISqlDB {
  constructor(private pool: Pool) {}

  async query(sql: string): Promise<unknown> {
    const result: QueryResult = await this.pool.query(sql);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
```

### Database Handler

**src/database/handler.ts:**
```typescript
import {
  IDatabaseMigrationHandler,
  ISchemaVersion,
  IBackup
} from '@migration-script-runner/core';
import { Pool } from 'pg';
import { PostgresDB } from './postgres-db';
import { PostgresSchemaVersion } from './schema-version';
import { PostgresBackup } from './backup';

export class PostgresHandler implements IDatabaseMigrationHandler<IDB> {
  db: PostgresDB;
  schemaVersion: ISchemaVersion;
  backup?: IBackup;

  constructor(pool: Pool) {
    this.db = new PostgresDB(pool);
    this.schemaVersion = new PostgresSchemaVersion(this.db);
    this.backup = new PostgresBackup(this.db);
  }

  getName(): string {
    return 'PostgreSQL Handler';
  }
}
```

### Migration Runner

**src/migrate.ts:**
```typescript
import { Pool } from 'pg';
import { MigrationScriptExecutor, Config, RollbackStrategy } from '@migration-script-runner/core';
import { PostgresHandler } from './database/handler';

async function runMigrations() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    user: 'postgres',
    password: 'password'
  });

  try {
    const handler = new PostgresHandler(pool);

    const config = new Config();
    config.folder = './migrations';
    config.rollbackStrategy = RollbackStrategy.DOWN;
    config.filePatterns = [
      /^V(\d{12})_.*\.ts$/,
      /^V(\d{12})_.*\.up\.sql$/
    ];

    const executor = new MigrationScriptExecutor(handler, config);
    const result = await executor.up();

    if (result.success) {
      console.log(`✅ Executed ${result.executed.length} migrations`);
    } else {
      console.error('❌ Migration failed:', result.errors);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

runMigrations();
```

### SQL Migration

**migrations/V202501280100_create_users.up.sql:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

**migrations/V202501280100_create_users.down.sql:**
```sql
DROP TABLE IF EXISTS users CASCADE;
```

### Running Migrations

```bash
# Install dependencies
npm install pg @migration-script-runner/core

# Run migrations
npx ts-node src/migrate.ts

# Output:
# ✅ Executed 3 migrations
# - V202501280100_create_users (SQL)
# - V202501280200_seed_roles (TypeScript)
# - V202501280300_add_indexes (SQL)
```

---

