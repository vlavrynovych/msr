---
layout: default
title: IRunnableScript
parent: Interfaces
grand_parent: API Reference
nav_order: 3
---

# IRunnableScript
{: .no_toc }

Interface for migration script classes.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Interface for migration script classes. Used by both regular migrations and the special `beforeMigrate` setup script.

**Signature (v0.6.0+):**
```typescript
interface IRunnableScript<DB extends IDB> {
  up(db: DB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<DB>): Promise<string>;
  down?(db: DB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<DB>): Promise<string>;
}
```

{: .important }
> **Breaking Change (v0.6.0):** Generic type parameter `<DB extends IDB>` is now **required** for full type safety. You must explicitly specify the type parameter in your implementations (e.g., `IRunnableScript<IDB>`).

**Purpose:** Defines the contract for executable migration scripts.

---

## Methods

### up()

Execute the migration (forward).

```typescript
async up(
  db: IDB,
  info: IMigrationInfo,
  handler: IDatabaseMigrationHandler
): Promise<string>
```

**Parameters:**
- `db`: Your database connection/client object (extend `IDB` for type safety)
- `info`: Metadata about this migration
- `handler`: The database handler (for advanced use cases)

**Returns:** String describing the migration result

**Behavior:**
- **Regular migrations**: Result is stored in migration tracking table
- **beforeMigrate script**: Result is NOT stored (runs before tracking)

**Example:**
```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

// Define your database type for type safety
interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export default class AddUsersTable implements IRunnableScript<IDB> {
  async up(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created';
  }
}
```

---

### down()

Rollback the migration (optional).

```typescript
async down(
  db: IDB,
  info: IMigrationInfo,
  handler: IDatabaseMigrationHandler
): Promise<string>
```

**Optional:** Only required for DOWN or BOTH rollback strategies. Allows migrations to be rolled back without database backups.

**Parameters:**
- `db`: Your database connection/client object (extend `IDB` for type safety)
- `info`: Metadata about this migration
- `handler`: The database handler (for advanced use cases)

**Returns:** String describing the rollback result

{: .warning }
> The `down()` method is called when a migration fails, **including the failed migration itself**. This allows cleanup of partial changes. Ensure your down() method is idempotent and can handle being called on partially-executed migrations.

**Example:**
```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export default class AddUsersTable implements IRunnableScript<IDB> {
  async up(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created';
  }

  // Optional: Reverse the changes made in up()
  async down(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    await db.query('DROP TABLE IF EXISTS users');
    return 'Users table dropped';
  }
}
```

---

## Complete Examples

### Basic Table Creation

```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

interface IPostgresDB extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export default class V202501280100_CreateUsersTable implements IRunnableScript<IDB> {
  async up(db: IPostgresDB, info: IMigrationInfo): Promise<string> {
    await db.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(`
      CREATE INDEX idx_users_email ON users(email)
    `);

    await db.query(`
      CREATE INDEX idx_users_username ON users(username)
    `);

    return 'Created users table with indexes';
  }

  async down(db: IPostgresDB, info: IMigrationInfo): Promise<string> {
    await db.query('DROP TABLE IF EXISTS users CASCADE');
    return 'Dropped users table';
  }
}
```

### Data Transformation

```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

interface IPostgresDB extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export default class V202501280200_NormalizeEmails implements IRunnableScript<IDB> {
  async up(db: IPostgresDB, info: IMigrationInfo): Promise<string> {
    // Get all users
    const users = await db.query<{id: number, email: string}>(`
      SELECT id, email FROM users
    `);

    // Normalize emails to lowercase
    for (const user of users) {
      await db.query(`
        UPDATE users
        SET email = $1
        WHERE id = $2
      `, [user.email.toLowerCase(), user.id]);
    }

    return `Normalized ${users.length} email addresses`;
  }

  async down(db: IPostgresDB, info: IMigrationInfo): Promise<string> {
    // This transformation is not reversible
    return 'Email normalization cannot be reversed';
  }
}
```

### Using Migration Info

```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

interface IPostgresDB extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export default class V202501280300_AddAuditColumns implements IRunnableScript<IDB> {
  async up(db: IPostgresDB, info: IMigrationInfo): Promise<string> {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN created_by VARCHAR(255) DEFAULT $1,
      ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `, [info.username]);  // Use the username from migration info

    return `Added audit columns (created by ${info.username})`;
  }

  async down(db: IPostgresDB, info: IMigrationInfo): Promise<string> {
    await db.query(`
      ALTER TABLE users
      DROP COLUMN created_by,
      DROP COLUMN created_at
    `);

    return 'Removed audit columns';
  }
}
```

### Complex Migration with Transactions

```typescript
import { IRunnableScript, IMigrationInfo, IDB, IDatabaseMigrationHandler } from '@migration-script-runner/core';

interface IPostgresDB extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}

export default class V202501280400_MigrateUserRoles implements IRunnableScript<IDB> {
  async up(db: IPostgresDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    // Use transaction for atomicity
    await db.transaction(async () => {
      // Create new roles table
      await db.query(`
        CREATE TABLE roles (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL UNIQUE
        )
      `);

      // Create user_roles junction table
      await db.query(`
        CREATE TABLE user_roles (
          user_id INT REFERENCES users(id),
          role_id INT REFERENCES roles(id),
          PRIMARY KEY (user_id, role_id)
        )
      `);

      // Insert default roles
      const roles = await db.query<{id: number}>(`
        INSERT INTO roles (name)
        VALUES ('admin'), ('user'), ('guest')
        RETURNING id
      `);

      // Migrate existing users to 'user' role
      const userRoleId = roles.find(r => r.name === 'user')?.id;
      await db.query(`
        INSERT INTO user_roles (user_id, role_id)
        SELECT id, $1 FROM users
      `, [userRoleId]);
    });

    return 'Migrated user roles system';
  }

  async down(db: IPostgresDB, info: IMigrationInfo): Promise<string> {
    await db.transaction(async () => {
      await db.query('DROP TABLE IF EXISTS user_roles CASCADE');
      await db.query('DROP TABLE IF EXISTS roles CASCADE');
    });

    return 'Rolled back user roles system';
  }
}
```

---

## beforeMigrate Script

The `beforeMigrate` script uses the same `IRunnableScript` interface but behaves differently:

```typescript
// migrations/beforeMigrate.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

export default class BeforeMigrate implements IRunnableScript<IDB> {
  async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    // This runs BEFORE migration scanning
    // Perfect for:
    // - Loading database snapshots
    // - Creating PostgreSQL extensions
    // - Setting up database-specific configuration
    // - Initializing required schemas

    console.log('Running beforeMigrate setup...');

    // Example: Create PostgreSQL extensions
    if (isSqlDB(db)) {
      await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      await db.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    }

    return 'beforeMigrate setup completed';
  }
}
```

{: .note }
The `beforeMigrate` script:
- Uses the same `IRunnableScript` interface
- Result is NOT saved to schema version table
- Executes before MSR scans for pending migrations
- Useful for database initialization tasks

---

## Best Practices

### 1. Use Type-Safe Database Interfaces

```typescript
// ✅ Good - Type safety
interface IMyDB extends IDB {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

async up(db: IMyDB, info: IMigrationInfo): Promise<string> {
  const users = await db.query<User>('SELECT * FROM users');
  // TypeScript knows users is User[]
}

// ❌ Bad - No type safety
async up(db: IDB, info: IMigrationInfo): Promise<string> {
  const users = await (db as any).query('SELECT * FROM users');
  // No type checking
}
```

### 2. Make down() Methods Idempotent

```typescript
// ✅ Good - Safe to run multiple times
async down(db: IDB): Promise<string> {
  await db.query('DROP TABLE IF EXISTS users');
  await db.query('DROP INDEX IF EXISTS idx_users_email');
  return 'Rollback completed';
}

// ❌ Bad - Fails if already dropped
async down(db: IDB): Promise<string> {
  await db.query('DROP TABLE users');  // Error if table doesn't exist
  return 'Rollback completed';
}
```

### 3. Return Descriptive Result Messages

```typescript
// ✅ Good - Descriptive
async up(db: IDB): Promise<string> {
  const result = await db.query('INSERT INTO users ...');
  return `Created ${result.rowCount} users`;
}

// ❌ Bad - Not informative
async up(db: IDB): Promise<string> {
  await db.query('INSERT INTO users ...');
  return 'Done';
}
```

### 4. Handle Partial Failures in down()

```typescript
async down(db: IDB, info: IMigrationInfo): Promise<string> {
  // Migration may have partially completed
  // down() should clean up whatever was done

  // Check what exists before dropping
  const tableExists = await db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_name = 'users'
    )
  `);

  if (tableExists[0].exists) {
    await db.query('DROP TABLE users CASCADE');
  }

  return 'Cleanup completed';
}
```

### 5. Use Transactions for Atomicity

**SQL Databases (ITransactionalDB):**
```typescript
// ✅ Good - All or nothing (SQL)
async up(db: ITransactionalDB): Promise<string> {
  await db.transaction(async () => {
    await db.query('CREATE TABLE users ...');
    await db.query('CREATE TABLE roles ...');
    await db.query('INSERT INTO roles ...');
  });
  return 'Migration completed atomically';
}

// ❌ Bad - Partial completion possible
async up(db: IDB): Promise<string> {
  await db.query('CREATE TABLE users ...');  // Succeeds
  await db.query('CREATE TABLE roles ...');  // Fails
  // users table exists, roles doesn't - inconsistent state
}
```

**NoSQL Databases (ICallbackTransactionalDB):**
```typescript
// ✅ Good - All or nothing (NoSQL)
async up(db: ICallbackTransactionalDB<Transaction>, info: IMigrationInfo): Promise<string> {
  const firestore = (db as FirestoreDB).firestore;

  await db.runTransaction!(async (tx: Transaction) => {
    // All operations execute atomically within transaction
    const userRef = firestore.collection('users').doc('user1');
    const roleRef = firestore.collection('roles').doc('role1');

    tx.set(userRef, { name: 'John', migrated: true });
    tx.set(roleRef, { name: 'admin' });
  });

  return 'Migration completed atomically';
}

// ❌ Bad - Not using transaction (partial completion possible)
async up(db: IDB): Promise<string> {
  const firestore = (db as FirestoreDB).firestore;

  await firestore.collection('users').doc('user1').set({ name: 'John' });  // Succeeds
  await firestore.collection('roles').doc('role1').set({ name: 'admin' }); // Fails
  // Inconsistent state
}
```

---

## NoSQL Examples

### Firestore Document Migration

```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';
import { Transaction } from '@google-cloud/firestore';

interface IFirestoreDB extends IDB {
  runTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;
  firestore: Firestore;
}

export default class V202501280500_MigrateUserProfiles implements IRunnableScript<IDB> {
  async up(db: IFirestoreDB, info: IMigrationInfo): Promise<string> {
    const firestore = db.firestore;
    let migratedCount = 0;

    // Get users to migrate (outside transaction)
    const usersSnapshot = await firestore
      .collection('users')
      .where('profileMigrated', '==', false)
      .get();

    // Migrate in transaction
    await db.runTransaction!(async (tx: Transaction) => {
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();

        // Create new profile document
        const profileRef = firestore.collection('profiles').doc(doc.id);
        tx.set(profileRef, {
          userId: doc.id,
          bio: userData.bio || '',
          avatar: userData.avatar || null,
          createdAt: new Date(),
          migratedFrom: info.version
        });

        // Update user document
        tx.update(doc.ref, {
          profileMigrated: true,
          migratedAt: new Date()
        });

        migratedCount++;
      }
    });

    return `Migrated ${migratedCount} user profiles`;
  }

  async down(db: IFirestoreDB, info: IMigrationInfo): Promise<string> {
    const firestore = db.firestore;
    let rolledBackCount = 0;

    // Get migrated users
    const usersSnapshot = await firestore
      .collection('users')
      .where('profileMigrated', '==', true)
      .get();

    // Rollback in transaction
    await db.runTransaction!(async (tx: Transaction) => {
      for (const doc of usersSnapshot.docs) {
        // Delete profile
        const profileRef = firestore.collection('profiles').doc(doc.id);
        tx.delete(profileRef);

        // Update user
        tx.update(doc.ref, {
          profileMigrated: false,
          migratedAt: null
        });

        rolledBackCount++;
      }
    });

    return `Rolled back ${rolledBackCount} user profiles`;
  }
}
```

### MongoDB Collection Migration

```typescript
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';
import { ClientSession, MongoClient } from 'mongodb';

interface IMongoDatabase extends IDB {
  runTransaction<T>(callback: (session: ClientSession) => Promise<T>): Promise<T>;
  client: MongoClient;
}

export default class V202501280600_AddUserTimestamps implements IRunnableScript<IDB> {
  async up(db: IMongoDatabase, info: IMigrationInfo): Promise<string> {
    const database = db.client.db('myapp');
    let updatedCount = 0;

    await db.runTransaction!(async (session: ClientSession) => {
      // Find users without timestamps
      const users = await database.collection('users')
        .find({ createdAt: { $exists: false } }, { session })
        .toArray();

      // Update each user
      for (const user of users) {
        await database.collection('users').updateOne(
          { _id: user._id },
          {
            $set: {
              createdAt: new Date(),
              updatedAt: new Date(),
              migratedBy: info.version
            }
          },
          { session }  // ← Important: pass session for transaction
        );
        updatedCount++;
      }
    });

    return `Added timestamps to ${updatedCount} users`;
  }

  async down(db: IMongoDatabase, info: IMigrationInfo): Promise<string> {
    const database = db.client.db('myapp');
    let revertedCount = 0;

    await db.runTransaction!(async (session: ClientSession) => {
      const result = await database.collection('users').updateMany(
        { migratedBy: info.version },
        {
          $unset: {
            createdAt: '',
            updatedAt: '',
            migratedBy: ''
          }
        },
        { session }
      );

      revertedCount = result.modifiedCount;
    });

    return `Reverted timestamps from ${revertedCount} users`;
  }
}
```

---

## Testing

### Unit Test Example

```typescript
import { expect } from 'chai';
import V001_CreateUsers from '../migrations/V001_CreateUsers';

describe('V001_CreateUsers', () => {
  let migration: V001_CreateUsers;
  let mockDb: any;
  let queries: string[];

  beforeEach(() => {
    migration = new V001_CreateUsers();
    queries = [];

    mockDb = {
      query: async (sql: string) => {
        queries.push(sql);
        return [];
      }
    };
  });

  it('should execute CREATE TABLE query', async () => {
    await migration.up(mockDb, {} as any, {} as any);

    expect(queries).to.have.lengthOf(1);
    expect(queries[0]).to.include('CREATE TABLE users');
  });

  it('should be reversible', async () => {
    await migration.up(mockDb, {} as any, {} as any);
    queries = [];
    await migration.down(mockDb, {} as any, {} as any);

    expect(queries).to.have.lengthOf(1);
    expect(queries[0]).to.include('DROP TABLE');
  });
});
```

---
