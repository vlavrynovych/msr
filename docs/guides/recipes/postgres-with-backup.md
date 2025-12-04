---
layout: default
title: PostgreSQL with Backup
parent: Recipes
grand_parent: Guides
nav_order: 1
---

# PostgreSQL with pg_dump Backup
{: .no_toc }

Complete PostgreSQL database handler implementation with pg_dump/restore backup capability.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## What You'll Learn

- How to implement `IDatabaseMigrationHandler` for PostgreSQL
- Using pg_dump and psql for backup/restore
- Implementing schema version tracking
- Type-safe database operations
- Error handling and connection management

---

## Overview

This recipe provides a production-ready PostgreSQL handler with:
- Full `IDatabaseMigrationHandler` implementation
- pg_dump backup with compression
- ps ql restore capability
- Schema version table management
- Connection pooling with `pg` library
- TypeScript type safety

**When to use:**
- PostgreSQL database migrations
- Need reliable backup/restore functionality
- Production environments requiring rollback protection

---

## Prerequisites

```bash
npm install pg
npm install --save-dev @types/pg
```

Ensure PostgreSQL client tools (`pg_dump`, `psql`) are installed and available in PATH.

---

## Complete Implementation

### PostgreSQL Handler

```typescript
// src/database/PostgreSQLHandler.ts
import { Pool, PoolClient } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  IDatabaseMigrationHandler,
  IDB,
  IBackup,
  ISchemaVersion,
  IMigrationScript
} from '@migration-script-runner/core';

const execAsync = promisify(exec);

/**
 * PostgreSQL-specific database interface with type-safe methods
 */
export interface IPostgresDB extends IDB {
  pool: Pool;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  getClient(): Promise<PoolClient>;
}

/**
 * Configuration for PostgreSQL connection
 */
export interface IPostgreSQLConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;  // Max connections in pool
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Complete PostgreSQL handler with backup/restore capability
 */
export class PostgreSQLHandler implements IDatabaseMigrationHandler<IDB> {
  readonly db: IPostgresDB;
  readonly backup: IBackup;
  readonly schemaVersion: ISchemaVersion;

  private readonly config: IPostgreSQLConfig;
  private readonly schemaTable: string = 'schema_version';

  constructor(config: IPostgreSQLConfig) {
    this.config = config;

    // Initialize connection pool
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.max || 10,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000
    });

    // Setup database interface
    this.db = {
      pool,
      query: async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
        const result = await pool.query(sql, params);
        return result.rows as T[];
      },
      getClient: async (): Promise<PoolClient> => {
        return await pool.connect();
      }
    };

    // Setup backup implementation
    this.backup = {
      backup: this.createBackup.bind(this),
      restore: this.restoreBackup.bind(this)
    };

    // Setup schema version tracking
    this.schemaVersion = {
      init: this.initSchemaVersionTable.bind(this),
      list: this.listMigratedScripts.bind(this),
      add: this.addMigratedScript.bind(this),
      remove: this.removeMigratedScript.bind(this)
    };
  }

  /**
   * Returns handler name for logging
   */
  getName(): string {
    return `PostgreSQL Handler (${this.config.database}@${this.config.host})`;
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    await this.db.pool.end();
  }

  // ========================================
  // BACKUP IMPLEMENTATION
  // ========================================

  /**
   * Create database backup using pg_dump
   */
  private async createBackup(): Promise<string> {
    try {
      // Get database schema and data as SQL
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {
        timestamp,
        database: this.config.database,
        schema: await this.dumpSchema(),
        data: await this.dumpData()
      };

      return JSON.stringify(backupData);
    } catch (error) {
      throw new Error(`Backup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Dump database schema using pg_dump
   */
  private async dumpSchema(): Promise<string> {
    const command = [
      'pg_dump',
      `-h ${this.config.host}`,
      `-p ${this.config.port}`,
      `-U ${this.config.user}`,
      `-d ${this.config.database}`,
      '--schema-only',
      '--no-owner',
      '--no-privileges'
    ].join(' ');

    const env = { ...process.env, PGPASSWORD: this.config.password };
    const { stdout } = await execAsync(command, { env, maxBuffer: 50 * 1024 * 1024 });

    return stdout;
  }

  /**
   * Dump database data using pg_dump
   */
  private async dumpData(): Promise<string> {
    const command = [
      'pg_dump',
      `-h ${this.config.host}`,
      `-p ${this.config.port}`,
      `-U ${this.config.user}`,
      `-d ${this.config.database}`,
      '--data-only',
      '--no-owner',
      '--no-privileges',
      '--column-inserts'  // Use INSERT statements for better compatibility
    ].join(' ');

    const env = { ...process.env, PGPASSWORD: this.config.password };
    const { stdout } = await execAsync(command, { env, maxBuffer: 50 * 1024 * 1024 });

    return stdout;
  }

  /**
   * Restore database from backup
   */
  private async restoreBackup(backupData: string): Promise<void> {
    try {
      const backup = JSON.parse(backupData);

      // Validate backup format
      if (!backup.schema || !backup.data) {
        throw new Error('Invalid backup format');
      }

      console.log(`Restoring backup from ${backup.timestamp}...`);

      // Drop all tables (except schema_version which we'll handle separately)
      await this.dropAllTables();

      // Restore schema
      await this.executeSQL(backup.schema);

      // Restore data
      await this.executeSQL(backup.data);

      console.log('✅ Backup restored successfully');
    } catch (error) {
      throw new Error(`Restore failed: ${(error as Error).message}`);
    }
  }

  /**
   * Drop all tables in the database
   */
  private async dropAllTables(): Promise<void> {
    const tables = await this.db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != '${this.schemaTable}'
    `);

    for (const table of tables) {
      await this.db.query(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`);
    }
  }

  /**
   * Execute SQL script using psql
   */
  private async executeSQL(sql: string): Promise<void> {
    // Write SQL to temporary file
    const tempFile = path.join('/tmp', `restore-${Date.now()}.sql`);
    fs.writeFileSync(tempFile, sql);

    try {
      const command = [
        'psql',
        `-h ${this.config.host}`,
        `-p ${this.config.port}`,
        `-U ${this.config.user}`,
        `-d ${this.config.database}`,
        `-f ${tempFile}`,
        '--quiet'
      ].join(' ');

      const env = { ...process.env, PGPASSWORD: this.config.password };
      await execAsync(command, { env });
    } finally {
      // Clean up temporary file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  }

  // ========================================
  // SCHEMA VERSION IMPLEMENTATION
  // ========================================

  /**
   * Initialize schema version tracking table
   */
  private async initSchemaVersionTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS ${this.schemaTable} (
        timestamp BIGINT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster queries
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_${this.schemaTable}_timestamp
      ON ${this.schemaTable}(timestamp)
    `);
  }

  /**
   * List all migrated scripts
   */
  private async listMigratedScripts(): Promise<IMigrationScript[]> {
    const rows = await this.db.query<{
      timestamp: string;
      name: string;
      checksum: string;
    }>(`
      SELECT timestamp, name, checksum
      FROM ${this.schemaTable}
      ORDER BY timestamp ASC
    `);

    return rows.map(row => ({
      timestamp: parseInt(row.timestamp),
      name: row.name,
      checksum: row.checksum
    }));
  }

  /**
   * Add migrated script to tracking table
   */
  private async addMigratedScript(script: IMigrationScript): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.schemaTable} (timestamp, name, checksum)
       VALUES ($1, $2, $3)
       ON CONFLICT (timestamp) DO NOTHING`,
      [script.timestamp, script.name, script.checksum]
    );
  }

  /**
   * Remove migrated script from tracking table
   */
  private async removeMigratedScript(timestamp: number): Promise<void> {
    await this.db.query(
      `DELETE FROM ${this.schemaTable} WHERE timestamp = $1`,
      [timestamp]
    );
  }
}
```

---

## Usage Example

### Basic Setup

```typescript
// src/migrate.ts
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { PostgreSQLHandler } from './database/PostgreSQLHandler';

async function runMigrations() {
  // Configure PostgreSQL connection
  const handler = new PostgreSQLHandler({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'myapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production',
    max: 10,
    idleTimeoutMillis: 30000
  });

  // Configure MSR
  const config = new Config();
  config.folder = './migrations';
  config.backup.folder = './backups';
  config.backup.deleteBackup = false;  // Keep backups in production

  // Create executor
  const executor = new MigrationScriptExecutor({ handler }, config);

  try {
    console.log('Running migrations...');
    const result = await executor.up();

    if (result.success) {
      console.log(`✅ Success! Executed ${result.executed.length} migrations`);
    } else {
      console.error('❌ Migration failed:', result.errors);
      process.exit(1);
    }
  } finally {
    await handler.close();
  }
}

runMigrations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### Environment Variables

Create `.env` file:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
DB_USER=postgres
DB_PASSWORD=your-password
NODE_ENV=development
```

---

## Writing Migrations

Create type-safe migrations using the PostgreSQL interface:

```typescript
// migrations/V202501220100_create_users_table.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler } from '@migration-script-runner/core';
import { IPostgresDB } from '../src/database/PostgreSQLHandler';

export default class CreateUsersTable implements IRunnableScript<IDB> {
  async up(
    db: IPostgresDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    await db.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for email lookups
    await db.query(`
      CREATE INDEX idx_users_email ON users(email)
    `);

    return 'Users table created with email index';
  }

  async down(
    db: IPostgresDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    await db.query('DROP TABLE IF EXISTS users CASCADE');
    return 'Users table dropped';
  }
}
```

---

## Testing

### Unit Tests

```typescript
// test/PostgreSQLHandler.test.ts
import { expect } from 'chai';
import { PostgreSQLHandler } from '../src/database/PostgreSQLHandler';

describe('PostgreSQLHandler', () => {
  let handler: PostgreSQLHandler;

  before(async () => {
    handler = new PostgreSQLHandler({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      user: 'postgres',
      password: 'test'
    });
  });

  after(async () => {
    await handler.close();
  });

  it('should initialize schema version table', async () => {
    await handler.schemaVersion.init();

    const tables = await handler.db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables
      WHERE tablename = 'schema_version'
    `);

    expect(tables).to.have.lengthOf(1);
  });

  it('should add and list migrated scripts', async () => {
    await handler.schemaVersion.add({
      timestamp: 202501220100,
      name: 'test_migration',
      checksum: 'abc123'
    });

    const scripts = await handler.schemaVersion.list();
    expect(scripts).to.have.lengthOf(1);
    expect(scripts[0].timestamp).to.equal(202501220100);
  });

  it('should create and restore backup', async () => {
    // Insert test data
    await handler.db.query(`
      CREATE TABLE test_table (id INT, name VARCHAR(50))
    `);
    await handler.db.query(`
      INSERT INTO test_table (id, name) VALUES (1, 'test')
    `);

    // Create backup
    const backupData = await handler.backup.backup();
    expect(backupData).to.be.a('string');

    // Modify data
    await handler.db.query(`DELETE FROM test_table`);

    // Restore backup
    await handler.backup.restore(backupData);

    // Verify restoration
    const rows = await handler.db.query(`SELECT * FROM test_table`);
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].name).to.equal('test');
  });
});
```

### Integration Tests

```typescript
// test/integration/migrations.test.ts
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { PostgreSQLHandler } from '../../src/database/PostgreSQLHandler';

describe('Migration Integration', () => {
  let handler: PostgreSQLHandler;
  let executor: MigrationScriptExecutor;

  before(async () => {
    handler = new PostgreSQLHandler({
      host: 'localhost',
      port: 5432,
      database: 'integration_test',
      user: 'postgres',
      password: 'test'
    });

    const config = new Config();
    config.folder = './test/fixtures/migrations';

    executor = new MigrationScriptExecutor({ handler }, config);
  });

  after(async () => {
    await handler.close();
  });

  it('should execute all migrations successfully', async () => {
    const result = await executor.up();

    expect(result.success).to.be.true;
    expect(result.executed.length).to.be.greaterThan(0);
  });

  it('should rollback on migration failure', async () => {
    // This test requires a migration that intentionally fails
    const result = await executor.up();

    // Verify database was restored to previous state
    const tables = await handler.db.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);

    // Should only have schema_version table
    expect(tables).to.have.lengthOf(1);
  });
});
```

---

## Common Issues

### Issue 1: Permission Denied for pg_dump

**Error:**
```
Error: Command failed: pg_dump ... permission denied
```

**Solution:**
Ensure the PostgreSQL user has sufficient privileges:

```sql
GRANT ALL PRIVILEGES ON DATABASE myapp TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
```

### Issue 2: Connection Timeout

**Error:**
```
Error: Connection timeout
```

**Solution:**
Increase connection timeout or check network connectivity:

```typescript
const handler = new PostgreSQLHandler({
  // ...
  connectionTimeoutMillis: 5000  // Increase timeout
});
```

### Issue 3: Backup Too Large

**Problem:** Backup files consuming too much disk space

**Solution:** Use pg_dump with compression:

```typescript
private async dumpData(): Promise<string> {
  const command = [
    'pg_dump',
    // ... other options
    '--compress=9'  // Add compression
  ].join(' ');

  // ...
}
```

---

## Performance Tips

<details markdown="1">
<summary>Advanced: Performance optimization techniques</summary>

### 1. Use Connection Pooling

Already implemented in the recipe with configurable pool size:

```typescript
const handler = new PostgreSQLHandler({
  // ...
  max: 20,  // Increase for high-concurrency applications
  idleTimeoutMillis: 30000
});
```

### 2. Batch Operations

For large data migrations:

```typescript
export default class MigrateLargeDataset implements IRunnableScript<IDB> {
  async up(db: IPostgresDB): Promise<string> {
    const batchSize = 1000;
    let offset = 0;
    let processed = 0;

    while (true) {
      const rows = await db.query(
        `SELECT * FROM old_table LIMIT $1 OFFSET $2`,
        [batchSize, offset]
      );

      if (rows.length === 0) break;

      // Process batch
      for (const row of rows) {
        await db.query(
          'INSERT INTO new_table (id, data) VALUES ($1, $2)',
          [row.id, row.data]
        );
      }

      processed += rows.length;
      offset += batchSize;

      console.log(`Processed ${processed} rows...`);
    }

    return `Migrated ${processed} rows`;
  }
}
```

### 3. Use Transactions

Wrap related operations in transactions:

```typescript
const client = await db.getClient();

try {
  await client.query('BEGIN');

  await client.query('UPDATE users SET status = $1', ['active']);
  await client.query('INSERT INTO audit_log (action) VALUES ($1)', ['activation']);

  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

</details>

---

## Production Checklist

Before deploying to production:

- [ ] Test backup/restore functionality
- [ ] Verify connection pool settings
- [ ] Enable SSL for production database
- [ ] Set appropriate timeouts
- [ ] Test rollback scenarios
- [ ] Configure backup retention
- [ ] Set up monitoring and alerting
- [ ] Document recovery procedures

---

