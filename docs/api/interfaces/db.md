---
layout: default
title: IDB & ISqlDB
parent: Interfaces
grand_parent: API Reference
nav_order: 2
---

# IDB & ISqlDB
{: .no_toc }

Database connection interfaces.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## IDB

Base interface for database connections. This is intentionally minimal to support any database system (SQL, NoSQL, etc.).

```typescript
interface IDB {
  checkConnection(): Promise<void>;
  [key: string]: unknown;
}
```

**Purpose:** Provides a minimal base that user implementations extend with their database-specific methods.

**Index Signature:** The `[key: string]: unknown` allows implementations to add any additional properties while maintaining type safety for the base interface.

---

### Required Methods

#### checkConnection()

Validate that the database connection is active and healthy.

```typescript
async checkConnection(): Promise<void>
```

**Called automatically before:**
- Migration execution (`up()`, `down()`)
- Validation operations
- Any database operations

**Behavior:**
- Should throw an error if connection is invalid
- Should complete successfully if connection is healthy
- MSR calls this before migrations to fail fast

{: .important }
> **Breaking Change (v0.4.0):** The `checkConnection()` method is now **required** for all IDB implementations. This enables early detection of connection issues before migration execution.

---

### Implementation Examples

#### PostgreSQL

```typescript
import { Pool } from 'pg';
import { IDB } from '@migration-script-runner/core';

class PostgresDB implements IDB {
  constructor(private pool: Pool) {}

  async checkConnection(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }

  // Custom methods for PostgreSQL
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async transaction<T>(callback: (client: PostgresDB) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(this);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

#### MongoDB

```typescript
import { MongoClient } from 'mongodb';
import { IDB } from '@migration-script-runner/core';

class MongoDB implements IDB {
  constructor(private client: MongoClient) {}

  async checkConnection(): Promise<void> {
    try {
      await this.client.db('admin').command({ ping: 1 });
    } catch (error) {
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  // Custom methods for MongoDB
  getCollection(name: string) {
    return this.client.db().collection(name);
  }

  async startSession() {
    return this.client.startSession();
  }
}
```

#### MySQL

```typescript
import { Connection } from 'mysql2/promise';
import { IDB } from '@migration-script-runner/core';

class MySQLDB implements IDB {
  constructor(private connection: Connection) {}

  async checkConnection(): Promise<void> {
    try {
      await this.connection.ping();
    } catch (error) {
      throw new Error(`MySQL connection failed: ${error.message}`);
    }
  }

  // Custom methods for MySQL
  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const [rows] = await this.connection.execute(sql, params);
    return rows as T[];
  }
}
```

---

### Type Safety Pattern

Define your database type by extending IDB:

```typescript
// Define your database interface
interface IMyDatabase extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(callback: (client: IMyDatabase) => Promise<T>): Promise<T>;
}

// Use in migrations
export default class AddUsersTable implements IRunnableScript {
  async up(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    // TypeScript knows about query() method
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created';
  }
}
```

---

## ISqlDB

Extended interface for SQL databases that support raw SQL query execution. **Required for SQL migration files** (`.up.sql` / `.down.sql`).

```typescript
interface ISqlDB extends IDB {
  query(sql: string): Promise<unknown>;
}
```

**Purpose:** Provides a standardized contract for executing SQL strings, enabling MSR to run SQL migration files.

**When to Use:**
- If you want to use `.up.sql` / `.down.sql` migration files
- For any SQL-based database (PostgreSQL, MySQL, SQLite, etc.)
- Even if you only use TypeScript migrations, implementing ISqlDB is harmless

{: .note }
> **New in v0.4.0:** The `ISqlDB` interface was added to support SQL migration files. If your database handler doesn't implement ISqlDB, SQL migrations (`.up.sql` / `.down.sql`) will fail with a clear error message.

---

### Methods

#### query()

Execute a raw SQL string and return results.

```typescript
async query(sql: string): Promise<unknown>
```

**Parameters:**
- `sql`: Raw SQL string to execute (may contain multiple statements depending on database)

**Returns:** Query results in database-specific format

**Behavior:**
- Should execute the SQL and return results
- Should throw an error if SQL execution fails
- Return type is flexible (`unknown`) to accommodate different databases

---

### Implementation Examples

#### PostgreSQL with pg

```typescript
import { Pool } from 'pg';
import { ISqlDB } from '@migration-script-runner/core';

class PostgresDB implements ISqlDB {
  constructor(private pool: Pool) {}

  async query(sql: string): Promise<unknown> {
    const result = await this.pool.query(sql);
    return result.rows;
  }

  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }
}
```

#### MySQL with mysql2

```typescript
import { Connection } from 'mysql2/promise';
import { ISqlDB } from '@migration-script-runner/core';

class MySQLDB implements ISqlDB {
  constructor(private connection: Connection) {}

  async query(sql: string): Promise<unknown> {
    const [rows] = await this.connection.execute(sql);
    return rows;
  }

  async checkConnection(): Promise<void> {
    await this.connection.ping();
  }
}
```

#### SQLite with better-sqlite3

```typescript
import Database from 'better-sqlite3';
import { ISqlDB } from '@migration-script-runner/core';

class SQLiteDB implements ISqlDB {
  constructor(private db: Database.Database) {}

  async query(sql: string): Promise<unknown> {
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

  async checkConnection(): Promise<void> {
    // SQLite file-based, connection always available
    this.db.prepare('SELECT 1').get();
  }
}
```

---

### Type Guard

MSR provides a helper to check if a database implements ISqlDB:

```typescript
import { isSqlDB } from '@migration-script-runner/core';

// In your code
if (isSqlDB(db)) {
  // TypeScript knows db has query() method
  await db.query('SELECT * FROM users');
} else {
  throw new Error('Database does not support SQL migrations');
}
```

**Usage in MSR:**
MSR uses this type guard internally when loading SQL migration files to ensure the database can execute SQL strings.

---

### Multi-Statement SQL

Some databases support multiple SQL statements in one `query()` call, others don't. Handle this in your implementation:

#### PostgreSQL (Supports Multi-Statement)

```typescript
class PostgresDB implements ISqlDB {
  async query(sql: string): Promise<unknown> {
    // PostgreSQL handles multiple statements automatically
    const result = await this.pool.query(sql);
    return result.rows;
  }
}
```

#### MySQL (Requires Splitting)

```typescript
class MySQLDB implements ISqlDB {
  async query(sql: string): Promise<unknown> {
    // Split multiple statements
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

## Usage in Migrations

### TypeScript Migrations (IDB)

```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

// Extend IDB for type safety
interface IMyDB extends IDB {
  query(sql: string): Promise<unknown[]>;
}

export default class CreateUsersTable implements IRunnableScript {
  async up(db: IMyDB, info: IMigrationInfo): Promise<string> {
    await db.query('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255))');
    return 'Users table created';
  }

  async down(db: IMyDB, info: IMigrationInfo): Promise<string> {
    await db.query('DROP TABLE IF EXISTS users');
    return 'Users table dropped';
  }
}
```

### SQL Migrations (ISqlDB)

**V202501280100_create_users.up.sql:**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

**V202501280100_create_users.down.sql:**
```sql
DROP TABLE IF EXISTS users;
```

MSR will:
1. Check if `db` implements `ISqlDB` using the type guard
2. Call `db.query(sqlFileContents)` for `.up.sql`
3. Call `db.query(downFileContents)` for `.down.sql` (if rollback needed)

---

## Error Handling

### Connection Errors

```typescript
class MyDB implements IDB {
  async checkConnection(): Promise<void> {
    try {
      await this.pool.query('SELECT 1');
    } catch (error) {
      // Provide clear error message
      throw new Error(
        `Database connection failed: ${error.message}\n` +
        `Host: ${this.config.host}\n` +
        `Database: ${this.config.database}`
      );
    }
  }
}
```

### Query Errors

```typescript
class MyDB implements ISqlDB {
  async query(sql: string): Promise<unknown> {
    try {
      return await this.pool.query(sql);
    } catch (error) {
      // Include SQL context in error
      throw new Error(
        `SQL execution failed: ${error.message}\n` +
        `SQL (first 200 chars): ${sql.substring(0, 200)}`
      );
    }
  }
}
```

---

## Testing

### Mock IDB for Tests

```typescript
// Test helper
function createMockDB(): IDB {
  return {
    checkConnection: async () => { /* mock implementation */ },
    query: async (sql: string) => { /* mock implementation */ }
  };
}

// In tests
describe('Migration V001', () => {
  it('should create users table', async () => {
    const db = createMockDB();
    const migration = new V001_CreateUsers();

    await migration.up(db, {} as IMigrationInfo);

    // Verify query was called
  });
});
```

---

## Related Documentation

- [IDatabaseMigrationHandler](database-handler) - Main handler interface
- [SQL Migrations Guide](../../user-guides/sql-migrations) - Complete SQL migration guide
- [IRunnableScript](runnable-script) - Migration script interface
- [Getting Started](../../getting-started) - Basic setup

---

## See Also

- [PostgreSQL Recipe](../../recipes/postgres-with-backup) - Full PostgreSQL implementation
- [MongoDB Recipe](../../recipes/mongodb-migrations) - Full MongoDB implementation
- [Custom Database Example](../../recipes/custom-database) - Generic SQL database
