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

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Naming Convention

Migration files must follow a strict naming convention: `V{timestamp}_{description}.ts`

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

### Basic Template

```typescript
import { IMigrationScript, IMigrationInfo, IDatabaseMigrationHandler } from 'migration-script-runner';

export default class MigrationName implements IMigrationScript {

  async up(
    db: any,
    info: IMigrationInfo,
    handler: IDatabaseMigrationHandler
  ): Promise<any> {

    // Your migration logic here

    return 'Migration description or result';
  }
}
```

### Class Naming

The class name should match the description (in PascalCase):

```typescript
// File: V202501220100_create_users_table.ts
export default class CreateUsersTable implements IMigrationScript {
  // ...
}

// File: V202501220101_add_email_index.ts
export default class AddEmailIndex implements IMigrationScript {
  // ...
}
```

---

## Migration Best Practices

### 1. Keep Migrations Small and Focused

Each migration should do one thing:

```typescript
// Good: Single responsibility
export default class AddEmailToUsers implements IMigrationScript {
  async up(db: any): Promise<any> {
    await db.query('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
    return 'Added email column';
  }
}

// Bad: Multiple responsibilities
export default class UpdateUserSchema implements IMigrationScript {
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
export default class CreateUsersTable implements IMigrationScript {
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
export default class MigrateUserData implements IMigrationScript {
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
export default class UpdateUserEmails implements IMigrationScript {
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
If a migration throws an error, MSR will automatically restore the database from backup.

### 5. Use Transactions (If Supported)

```typescript
export default class ComplexDataMigration implements IMigrationScript {
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
export default class CreatePostsTable implements IMigrationScript {
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
export default class AddAvatarToUsers implements IMigrationScript {
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
export default class AddEmailIndex implements IMigrationScript {
  async up(db: any): Promise<any> {
    await db.query('CREATE INDEX idx_users_email ON users(email)');
    return 'Created email index on users table';
  }
}
```

### Data Migrations

```typescript
export default class PopulateDefaultSettings implements IMigrationScript {
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
export default class RemoveDeprecatedTable implements IMigrationScript {
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

Once a migration is committed and run in any environment, **never modify it**.

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
export default class AddFeatureColumn implements IMigrationScript {
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
export default class SyncAcrossDatabases implements IMigrationScript {
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
