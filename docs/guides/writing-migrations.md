---
layout: default
title: Writing Migrations
parent: Guides
nav_order: 1
---

# Writing Migration Scripts
{: .no_toc }

Best practices and guidelines for writing effective database migrations.
{: .fs-6 .fw-300 }

## What You'll Learn

- Migration file naming conventions and formats
- Writing type-safe migration scripts with generic type parameters (v0.6.0+)
- Using the beforeMigrate setup script
- Best practices for maintainable migrations
- Implementing reversible migrations with down() methods
- Common patterns and pitfalls to avoid

{: .note }
> **New in v0.6.0:** Generic type parameters provide full type safety for database-specific operations. Examples in this guide use `IRunnableScript<IDB>` for simplicity. For database-specific typing (PostgreSQL, MongoDB, etc.), see the [v0.6.0 migration guide](../version-migration/v0.5-to-v0.6).

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Naming Convention

Migration files must follow a strict naming convention: `V{timestamp}_{description}.ts`

{: .note }
> The `V` prefix and underscore separator are required. MSR will ignore files that don't follow this pattern.

### Timestamp Format

Use a timestamp that ensures chronological ordering:

```
V202501220100_initial_setup.ts       ✅ Recommended: YYYYMMDDHHmm
V20250122_add_users.ts               ✅ Alternative: YYYYMMDD
V1737504000_create_posts.ts          ✅ Unix timestamp
V1_first_migration.ts                ✅ Simple incrementing
```

{: .tip }
Use `YYYYMMDDHHmm` format (year, month, day, hour, minute) to avoid conflicts in team environments.

### Description Guidelines

- Use lowercase with underscores
- Be descriptive but concise
- Use verbs (add, create, update, remove)
- Avoid special characters

```typescript
// Good names
V202501220100_create_users_table.ts
V202501220101_add_email_to_users.ts
V202501220102_create_posts_index.ts

// Bad names
V202501220100_migration.ts          ❌ Not descriptive
V202501220100_USERS.ts              ❌ Uppercase
V202501220100_create users.ts       ❌ Space instead of underscore
```

---

## Migration Structure

### Type-Safe Database Interface

MSR provides the `IDB` interface for type safety. Extend it with your database-specific methods:

```typescript
import { IDB } from '@migration-script-runner/core';

// Define once and import in all migrations
export interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  transaction(callback: (client: IMyDatabase) => Promise<void>): Promise<void>;
}
```

{: .tip }
> Define your database interface in a shared file (e.g., `types.ts`) and import it in all migrations for consistency.

### Basic Template

```typescript
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

// Import your database type
interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export default class MigrationName implements IRunnableScript<IDB> {

  async up(
    db: IMyDatabase,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {

    // Your migration logic here with full type safety
    await db.query('CREATE TABLE example (id INT)');

    return 'Migration description or result';
  }
}
```

### Class Naming

The class name should match the description (in PascalCase):

```typescript
// File: V202501220100_create_users_table.ts
export default class CreateUsersTable implements IRunnableScript<IDB> {
  // ...
}

// File: V202501220101_add_email_index.ts
export default class AddEmailIndex implements IRunnableScript<IDB> {
  // ...
}
```

---

## Special: beforeMigrate Setup Script

MSR supports a special `beforeMigrate.ts` (or `.js`) file that executes **before** MSR scans for pending migrations. This is perfect for one-time setup tasks.

### When to Use beforeMigrate

Use `beforeMigrate` for setup tasks that need to run before migrations:

- **Data Seeding**: Load production snapshots or test data
- **Fresh Database Setup**: Create extensions, schemas, or initial structure
- **Environment Configuration**: Set database parameters, timeouts, modes
- **Validation**: Check database version or prerequisites

### Creating a beforeMigrate Script

Create a file named `beforeMigrate.ts` in your migrations folder:

```typescript
// migrations/beforeMigrate.ts
import fs from 'fs';
import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from 'migration-script-runner';

export default class BeforeMigrate implements IRunnableScript<IDB> {
  async up(
    db: IDB,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<string> {
    // Load production snapshot for development/testing
    if (process.env.NODE_ENV === 'development') {
      const snapshot = fs.readFileSync('./snapshots/prod.sql', 'utf8');
      await (db as any).query(snapshot);
      console.log('✅ Production snapshot loaded');
    }

    // Create PostgreSQL extensions on fresh database
    await (db as any).query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    return 'beforeMigrate setup completed';
  }
}
```

### Important Notes

{: .warning }
**beforeMigrate runs BEFORE migration scanning**, allowing it to completely reset/erase your database. Use with caution!

- ✅ Uses the same `IRunnableScript` interface as regular migrations
- ✅ NOT saved to schema version table
- ✅ Filename configurable via `config.beforeMigrateName`
- ✅ Can be disabled with `config.beforeMigrateName = null`
- ✅ Supports both `.ts` and `.js` extensions

### Configuration

```typescript
import { Config } from 'migration-script-runner';

const config = new Config();

// Default: looks for beforeMigrate.ts or beforeMigrate.js
config.beforeMigrateName = 'beforeMigrate';

// Custom name: looks for setup.ts or setup.js
config.beforeMigrateName = 'setup';

// Disable entirely
config.beforeMigrateName = null;
```

### Execution Order

```
1. Create backup
2. Initialize schema version table
3. Execute beforeMigrate.ts  ← Runs BEFORE scan (can erase DB)
4. Scan for pending migrations
5. Execute pending migrations
6. Delete backup on success
```

---

## Migration Best Practices

### 1. Keep Migrations Small and Focused

Each migration should do one thing:

```typescript
// Good: Single responsibility
export default class AddEmailToUsers implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    await db.query('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
    return 'Added email column';
  }
}

// Bad: Multiple responsibilities
export default class UpdateUserSchema implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    await db.query('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
    await db.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');
    await db.query('CREATE INDEX idx_email ON users(email)');
    await db.query('UPDATE users SET email = "default@example.com"');
    // Too much in one migration!
  }
}
```

### 2. Make Migrations Idempotent (When Possible)

Migrations that can safely run multiple times:

```typescript
export default class CreateUsersTable implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    // Check if table exists first
    const exists = await db.query(
      "SELECT * FROM information_schema.tables WHERE table_name = 'users'"
    );

    if (!exists || exists.length === 0) {
      await db.query('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255))');
      return 'Users table created';
    }

    return 'Users table already exists';
  }
}
```

{: .note }
MSR tracks executed migrations, so this is mainly useful for manual re-runs during development.

### 3. Add Logging for Complex Operations

```typescript
export default class MigrateUserData implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    console.log('Starting user data migration...');

    const users = await db.query('SELECT * FROM old_users');
    console.log(`Found ${users.length} users to migrate`);

    let migrated = 0;
    for (const user of users) {
      await db.query('INSERT INTO users (id, name, email) VALUES (?, ?, ?)', [
        user.id, user.name, user.email
      ]);
      migrated++;

      if (migrated % 100 === 0) {
        console.log(`Migrated ${migrated}/${users.length} users...`);
      }
    }

    console.log(`Migration complete: ${migrated} users migrated`);
    return `Migrated ${migrated} users`;
  }
}
```

### 4. Handle Errors Gracefully

```typescript
export default class UpdateUserEmails implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    try {
      const result = await db.query(
        'UPDATE users SET email = LOWER(email) WHERE email IS NOT NULL'
      );

      return `Updated ${result.affectedRows} user emails`;

    } catch (error) {
      console.error('Failed to update emails:', error);
      throw new Error(`Email update failed: ${error.message}`);
    }
  }
}
```

{: .warning }
If a migration throws an error, MSR will automatically rollback using your configured strategy (backup restore, down() methods, or both).

### 5. Use Transactions (If Supported)

```typescript
export default class ComplexDataMigration implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    const transaction = await db.beginTransaction();

    try {
      // Multiple related operations
      await transaction.query('UPDATE users SET status = "active"');
      await transaction.query('INSERT INTO audit_log (action) VALUES ("users_activated")');

      await transaction.commit();
      return 'Migration completed successfully';

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

---

## Common Patterns

### Creating Tables

```typescript
export default class CreatePostsTable implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    await db.query(`
      CREATE TABLE posts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    return 'Posts table created';
  }
}
```

### Adding Columns

```typescript
export default class AddAvatarToUsers implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN avatar_url VARCHAR(512)
    `);

    return 'Added avatar_url column to users';
  }
}
```

### Creating Indexes

```typescript
export default class AddEmailIndex implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    await db.query('CREATE INDEX idx_users_email ON users(email)');
    return 'Created email index on users table';
  }
}
```

### Data Migrations

```typescript
export default class PopulateDefaultSettings implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    const users = await db.query('SELECT id FROM users');

    for (const user of users) {
      await db.query(
        'INSERT INTO user_settings (user_id, theme, language) VALUES (?, ?, ?)',
        [user.id, 'light', 'en']
      );
    }

    return `Created settings for ${users.length} users`;
  }
}
```

### Dropping Tables/Columns

{: .warning }
Be extremely careful with destructive operations!

```typescript
export default class RemoveDeprecatedTable implements IRunnableScript<IDB> {
  async up(db: any): Promise<any> {
    // Optional: Create backup of data first
    const data = await db.query('SELECT * FROM deprecated_table');
    console.log(`Backing up ${data.length} rows before dropping table`);

    // Could save to a JSON file as additional backup
    // await fs.writeFile('deprecated_table_backup.json', JSON.stringify(data));

    await db.query('DROP TABLE IF EXISTS deprecated_table');
    return 'Removed deprecated_table';
  }
}
```

---

## Writing Reversible Migrations

MSR supports optional `down()` methods for migration rollback without requiring database backups. This is particularly useful for:

- **Development environments**: Fast rollback without backup overhead
- **Large databases**: Avoid expensive backup/restore operations
- **Cloud databases**: Reduce I/O costs and time
- **Rapid iteration**: Quickly test migration changes

### Rollback Strategies

MSR offers four rollback strategies configured via `config.rollbackStrategy`:

| Strategy | Description | Requires Backup | Requires down() |
|----------|-------------|-----------------|-----------------|
| `BACKUP` | Traditional backup/restore (default) | ✅ Yes | ❌ No |
| `DOWN` | Call down() methods in reverse order | ❌ No | ✅ Yes |
| `BOTH` | Try down() first, fallback to backup | ✅ Yes | ⚠️  Recommended |
| `NONE` | No rollback, logs warning | ❌ No | ❌ No |

```typescript
import { Config, RollbackStrategy } from '@migration-script-runner/core';

const config = new Config();

// Use down() methods for rollback (no backup needed)
config.rollbackStrategy = RollbackStrategy.DOWN;

// Use both strategies (down first, backup as fallback)
config.rollbackStrategy = RollbackStrategy.BOTH;
```

### Basic down() Method

The `down()` method should reverse the changes made by `up()`:

```typescript
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

export default class CreateUsersTable implements IRunnableScript<IDB> {
  async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    await (db as any).query(`
      CREATE TABLE users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE
      )
    `);
    return 'Users table created';
  }

  // Reverse the up() operation
  async down(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    await (db as any).query('DROP TABLE IF EXISTS users');
    return 'Users table dropped';
  }
}
```

### down() Method Best Practices

#### 1. Always Use IF EXISTS / IF NOT EXISTS

Make down() methods idempotent:

```typescript
export default class AddEmailIndex implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query('CREATE INDEX idx_users_email ON users(email)');
    return 'Email index created';
  }

  async down(db: any): Promise<string> {
    // Safe to run multiple times
    await db.query('DROP INDEX IF EXISTS idx_users_email ON users');
    return 'Email index dropped';
  }
}
```

#### 2. Preserve Data When Possible

For destructive operations, consider preserving data:

```typescript
export default class RemovePhoneColumn implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    // Archive data before dropping
    await db.query(`
      CREATE TABLE users_phone_archive AS
      SELECT id, phone FROM users WHERE phone IS NOT NULL
    `);

    await db.query('ALTER TABLE users DROP COLUMN phone');
    return 'Phone column removed (data archived)';
  }

  async down(db: any): Promise<string> {
    // Restore column
    await db.query('ALTER TABLE users ADD COLUMN phone VARCHAR(20)');

    // Restore data from archive
    await db.query(`
      UPDATE users u
      JOIN users_phone_archive a ON u.id = a.id
      SET u.phone = a.phone
    `);

    await db.query('DROP TABLE IF EXISTS users_phone_archive');
    return 'Phone column restored with archived data';
  }
}
```

#### 3. Reverse Data Transformations

For data migrations, down() should reverse transformations:

```typescript
export default class NormalizeEmails implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    // Store original values for rollback
    await db.query(`
      CREATE TABLE email_backup AS
      SELECT id, email FROM users
    `);

    // Normalize emails to lowercase
    await db.query('UPDATE users SET email = LOWER(email)');

    return 'Emails normalized to lowercase';
  }

  async down(db: any): Promise<string> {
    // Restore original email values
    await db.query(`
      UPDATE users u
      JOIN email_backup b ON u.id = b.id
      SET u.email = b.email
    `);

    await db.query('DROP TABLE IF EXISTS email_backup');
    return 'Original email values restored';
  }
}
```

#### 4. Handle Complex Multi-Step Migrations

Reverse operations in opposite order:

```typescript
export default class AddUserRoles implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    // Step 1: Create roles table
    await db.query('CREATE TABLE roles (id INT PRIMARY KEY, name VARCHAR(50))');

    // Step 2: Add foreign key to users
    await db.query('ALTER TABLE users ADD COLUMN role_id INT');

    // Step 3: Create foreign key constraint
    await db.query(`
      ALTER TABLE users
      ADD CONSTRAINT fk_user_role
      FOREIGN KEY (role_id) REFERENCES roles(id)
    `);

    // Step 4: Insert default roles
    await db.query("INSERT INTO roles (id, name) VALUES (1, 'user'), (2, 'admin')");

    return 'User roles system created';
  }

  async down(db: any): Promise<string> {
    // Reverse in opposite order!

    // Step 4: Remove role data (not strictly necessary, but clean)
    await db.query('TRUNCATE TABLE roles');

    // Step 3: Drop foreign key constraint
    await db.query('ALTER TABLE users DROP FOREIGN KEY IF EXISTS fk_user_role');

    // Step 2: Remove column
    await db.query('ALTER TABLE users DROP COLUMN IF EXISTS role_id');

    // Step 1: Drop roles table
    await db.query('DROP TABLE IF EXISTS roles');

    return 'User roles system removed';
  }
}
```

### Common down() Patterns

#### Table Operations

```typescript
// Creating a table
export default class CreatePostsTable implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query('CREATE TABLE posts (id INT, title VARCHAR(255))');
    return 'Posts table created';
  }

  async down(db: any): Promise<string> {
    await db.query('DROP TABLE IF EXISTS posts');
    return 'Posts table dropped';
  }
}
```

#### Column Operations

```typescript
// Adding a column
export default class AddAvatarColumn implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512)');
    return 'Avatar column added';
  }

  async down(db: any): Promise<string> {
    await db.query('ALTER TABLE users DROP COLUMN IF EXISTS avatar_url');
    return 'Avatar column removed';
  }
}

// Renaming a column
export default class RenameEmailColumn implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query('ALTER TABLE users RENAME COLUMN email TO email_address');
    return 'Email column renamed';
  }

  async down(db: any): Promise<string> {
    await db.query('ALTER TABLE users RENAME COLUMN email_address TO email');
    return 'Email column name restored';
  }
}
```

#### Index Operations

```typescript
// Creating an index
export default class AddUserEmailIndex implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query('CREATE INDEX idx_users_email ON users(email)');
    return 'Email index created';
  }

  async down(db: any): Promise<string> {
    await db.query('DROP INDEX IF EXISTS idx_users_email ON users');
    return 'Email index dropped';
  }
}

// Creating a unique constraint
export default class AddUniqueEmailConstraint implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query('ALTER TABLE users ADD CONSTRAINT uk_email UNIQUE (email)');
    return 'Email unique constraint added';
  }

  async down(db: any): Promise<string> {
    await db.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS uk_email');
    return 'Email unique constraint removed';
  }
}
```

#### Data Operations

```typescript
// Inserting seed data
export default class AddDefaultRoles implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query(`
      INSERT INTO roles (id, name) VALUES
      (1, 'user'),
      (2, 'admin'),
      (3, 'moderator')
    `);
    return 'Default roles inserted';
  }

  async down(db: any): Promise<string> {
    await db.query('DELETE FROM roles WHERE id IN (1, 2, 3)');
    return 'Default roles removed';
  }
}
```

### When down() Is Not Recommended

Some migrations are difficult or impossible to reverse safely:

#### ❌ Large Data Deletions

```typescript
// Risky: Hard to restore deleted data
export default class CleanupOldData implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    await db.query("DELETE FROM logs WHERE created_at < '2024-01-01'");
    return 'Old logs deleted';
  }

  // ⚠️  Can't restore deleted data without backup!
  async down(db: any): Promise<string> {
    throw new Error('Cannot restore deleted logs - use backup strategy');
  }
}
```

**Recommendation:** Use `RollbackStrategy.BACKUP` or `BOTH` for destructive operations.

#### ❌ External System Integration

```typescript
// Complex: Involves external APIs
export default class SyncToExternalSystem implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    const users = await db.query('SELECT * FROM users');
    await externalAPI.bulkCreate(users);  // External system updated
    return 'Users synced to external system';
  }

  // ⚠️  External state is hard to reverse
  async down(db: any): Promise<string> {
    // Would need to call external API again
    throw new Error('External sync cannot be automatically reversed');
  }
}
```

#### ❌ Schema Changes With Data Loss

```typescript
// Dangerous: Type changes can lose data
export default class ChangeColumnType implements IRunnableScript<IDB> {
  async up(db: any): Promise<string> {
    // Converting string to integer loses data
    await db.query('ALTER TABLE users MODIFY COLUMN age INT');
    return 'Age column converted to INT';
  }

  // ⚠️  Original string values are lost!
  async down(db: any): Promise<string> {
    await db.query('ALTER TABLE users MODIFY COLUMN age VARCHAR(50)');
    return 'Age column reverted to VARCHAR';
    // But original data like "twenty-five" is gone forever!
  }
}
```

### Testing down() Methods

Always test your down() methods:

```typescript
import { expect } from 'chai';

describe('CreateUsersTable Migration', () => {
  let migration: CreateUsersTable;

  beforeEach(() => {
    migration = new CreateUsersTable();
  });

  it('should create users table in up()', async () => {
    await migration.up(mockDb, mockInfo, mockHandler);

    const tables = await mockDb.query('SHOW TABLES LIKE "users"');
    expect(tables).to.have.lengthOf(1);
  });

  it('should drop users table in down()', async () => {
    // Setup: create table
    await migration.up(mockDb, mockInfo, mockHandler);

    // Test: rollback
    await migration.down(mockDb, mockInfo, mockHandler);

    const tables = await mockDb.query('SHOW TABLES LIKE "users"');
    expect(tables).to.have.lengthOf(0);
  });

  it('should be idempotent - down() can run multiple times', async () => {
    await migration.up(mockDb, mockInfo, mockHandler);

    // Run down() twice
    await migration.down(mockDb, mockInfo, mockHandler);
    await migration.down(mockDb, mockInfo, mockHandler);  // Should not throw

    const tables = await mockDb.query('SHOW TABLES LIKE "users"');
    expect(tables).to.have.lengthOf(0);
  });
});
```

### Rollback Behavior

When a migration fails, MSR automatically rolls back based on your configured strategy:

#### DOWN Strategy
```typescript
config.rollbackStrategy = RollbackStrategy.DOWN;

// If migration 3 fails:
// 1. Call down() on migration 3 (the failed one)
// 2. Call down() on migration 2 (in reverse order)
// 3. Call down() on migration 1 (in reverse order)
// Result: Database reverted to state before migrations started
```

#### BOTH Strategy
```typescript
config.rollbackStrategy = RollbackStrategy.BOTH;

// If migration 3 fails:
// 1. Try calling down() methods in reverse order
// 2. If down() fails, restore from backup
// Result: Fast rollback with backup safety net
```

#### Missing down() Warning
```
⚠️  No down() method for V202501220100_add_users - skipping rollback
```

If using `DOWN` or `BOTH` strategies, MSR warns when migrations lack down() methods.

### Migration With down() Example

Complete example with proper error handling:

```typescript
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

export default class CreateUserActivityLog implements IRunnableScript<IDB> {
  async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    try {
      // Create table
      await (db as any).query(`
        CREATE TABLE user_activity_log (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create index for performance
      await (db as any).query('CREATE INDEX idx_user_activity_user_id ON user_activity_log(user_id)');
      await (db as any).query('CREATE INDEX idx_user_activity_created_at ON user_activity_log(created_at)');

      console.log('✅ User activity log table and indexes created');
      return 'User activity log system initialized';

    } catch (error) {
      console.error('❌ Failed to create user activity log:', error);
      throw error;
    }
  }

  async down(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    try {
      // Drop indexes first (best practice)
      await (db as any).query('DROP INDEX IF EXISTS idx_user_activity_created_at ON user_activity_log');
      await (db as any).query('DROP INDEX IF EXISTS idx_user_activity_user_id ON user_activity_log');

      // Drop table
      await (db as any).query('DROP TABLE IF EXISTS user_activity_log');

      console.log('✅ User activity log table and indexes removed');
      return 'User activity log system removed';

    } catch (error) {
      console.error('❌ Failed to rollback user activity log:', error);
      throw error;
    }
  }
}
```

{: .note }
**Pro Tip:** For `BOTH` strategy, implement down() methods for fast rollback in development, while keeping backup protection for production.

---

## Testing Migrations

### Manual Testing

Test your migrations before committing:

```bash
# 1. Run migration
npm run migrate

# 2. Verify changes in database
# (use your database client)

# 3. Test rollback (if you have backup disabled)
# Restore from backup manually
```

### Automated Testing

Write tests for complex migrations:

```typescript
import { expect } from 'chai';
import { MigrationScript } from './V202501220100_add_email_to_users';

describe('AddEmailToUsers Migration', () => {
  it('should add email column to users table', async () => {
    const migration = new MigrationScript();

    // Run migration
    await migration.up(mockDb, mockInfo, mockHandler);

    // Verify column exists
    const columns = await mockDb.query('DESCRIBE users');
    const emailColumn = columns.find(c => c.Field === 'email');

    expect(emailColumn).to.exist;
    expect(emailColumn.Type).to.equal('varchar(255)');
  });
});
```

---

## Common Mistakes to Avoid

### ❌ Hard-coding Values

```typescript
// Bad
await db.query("INSERT INTO settings (key, value) VALUES ('api_url', 'https://api.example.com')");

// Good - use environment variables or config
const apiUrl = process.env.API_URL || 'https://api.example.com';
await db.query('INSERT INTO settings (key, value) VALUES (?, ?)', ['api_url', apiUrl]);
```

### ❌ Modifying Old Migrations

{: .warning }
> Once a migration is committed and run in any environment, **never modify it**. MSR tracks migrations by filename and checksum. Modifying an executed migration will cause checksum mismatches and potential data corruption.

```typescript
// ❌ Don't do this:
// - Edit existing V202501220100_create_users.ts

// ✅ Do this instead:
// - Create new V202501220101_update_users_table.ts
```

### ❌ Skipping Return Values

```typescript
// Bad - no return value
async up(db: any): Promise<any> {
  await db.query('CREATE TABLE users ...');
  // Missing return!
}

// Good - descriptive return value
async up(db: any): Promise<any> {
  await db.query('CREATE TABLE users ...');
  return 'Users table created successfully';
}
```

### ❌ Long-Running Migrations Without Progress

```typescript
// Bad - no feedback for long operation
async up(db: any): Promise<any> {
  for (let i = 0; i < 1000000; i++) {
    await db.query('INSERT INTO ...');
  }
}

// Good - progress logging
async up(db: any): Promise<any> {
  for (let i = 0; i < 1000000; i++) {
    await db.query('INSERT INTO ...');

    if (i % 10000 === 0) {
      console.log(`Progress: ${i}/1000000`);
    }
  }
  return 'Inserted 1M records';
}
```

---

## Advanced Patterns

### Conditional Migrations

```typescript
export default class AddFeatureColumn implements IRunnableScript<IDB> {
  async up(db: any, info: IMigrationInfo): Promise<any> {
    // Only run in certain environments
    if (process.env.ENABLE_FEATURE === 'true') {
      await db.query('ALTER TABLE users ADD COLUMN feature_flag BOOLEAN');
      return 'Feature column added';
    }

    return 'Feature column skipped (feature disabled)';
  }
}
```

### Multi-Database Migrations

```typescript
export default class SyncAcrossDatabases implements IRunnableScript<IDB> {
  async up(db: any, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<any> {
    // Migrate primary database
    await db.query('CREATE TABLE sync_log ...');

    // Also update a separate database/service
    const secondaryDb = await connectToSecondary();
    await secondaryDb.query('CREATE TABLE sync_log ...');

    return 'Synced across both databases';
  }
}
```

---

## Next Steps

- [API Reference](../api/) - Explore the full API
- [Configuration Guide](../configuration) - Configure MSR
- [Testing Documentation](../testing/) - Test your migrations
