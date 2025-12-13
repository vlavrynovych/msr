---
layout: default
title: Testing Migrations
parent: Recipes
grand_parent: Guides
nav_order: 3
---

# Testing Migrations
{: .no_toc }

Comprehensive testing strategies for migration scripts including unit tests, integration tests, and CI/CD integration.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## What You'll Learn

- Unit testing individual migration scripts
- Integration testing with real databases
- Mocking database handlers for fast tests
- Testing rollback scenarios
- CI/CD pipeline integration
- Round-trip testing patterns

---

## Overview

Testing migrations is critical for database reliability. This recipe covers:
- **Unit Tests** - Test migration logic in isolation
- **Integration Tests** - Test against real databases
- **Rollback Tests** - Verify down() methods work
- **CI/CD Integration** - Automated testing in pipelines

**When to use:**
- Before deploying migrations to production
- In CI/CD pipelines for automated validation
- When implementing complex data transformations
- For team collaboration to prevent breaking changes

---

## Prerequisites

```bash
npm install --save-dev mocha chai @types/mocha @types/chai
npm install --save-dev sinon @types/sinon  # For mocking
```

---

## Unit Testing Migrations

### Testing Migration Logic

Test the business logic without a real database:

```typescript
// test/unit/migrations/V202501220100_create_users_table.test.ts
import { expect } from 'chai';
import CreateUsersTable from '../../../migrations/V202501220100_create_users_table';
import { IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

describe('V202501220100_create_users_table', () => {
  let migration: CreateUsersTable;
  let mockDb: IDB;
  let queries: string[];

  beforeEach(() => {
    migration = new CreateUsersTable();
    queries = [];

    // Mock database that records queries
    mockDb = {
      query: async (sql: string) => {
        queries.push(sql);
        return [];
      }
    } as IDB;
  });

  it('should execute CREATE TABLE query', async () => {
    const result = await migration.up(
      mockDb,
      {} as IMigrationInfo,
      {} as IDatabaseMigrationHandler
    );

    expect(queries).to.have.lengthOf(1);
    expect(queries[0]).to.include('CREATE TABLE users');
    expect(result).to.be.a('string');
  });

  it('should create email index', async () => {
    await migration.up(
      mockDb,
      {} as IMigrationInfo,
      {} as IDatabaseMigrationHandler
    );

    const createIndexQuery = queries.find(q => q.includes('CREATE INDEX'));
    expect(createIndexQuery).to.exist;
    expect(createIndexQuery).to.include('idx_users_email');
  });

  it('should have reversible down() method', async () => {
    // First, run up()
    await migration.up(
      mockDb,
      {} as IMigrationInfo,
      {} as IDatabaseMigrationHandler
    );

    queries = []; // Reset queries

    // Then, run down()
    const result = await migration.down(
      mockDb,
      {} as IMigrationInfo,
      {} as IDatabaseMigrationHandler
    );

    expect(queries).to.have.lengthOf(1);
    expect(queries[0]).to.include('DROP TABLE');
    expect(queries[0]).to.include('users');
  });
});
```

### Testing Data Transformations

For migrations that transform data:

```typescript
// test/unit/migrations/V202501220200_normalize_emails.test.ts
import { expect } from 'chai';
import NormalizeEmails from '../../../migrations/V202501220200_normalize_emails';

describe('V202501220200_normalize_emails', () => {
  let migration: NormalizeEmails;
  let mockDb: any;
  let userData: any[];

  beforeEach(() => {
    migration = new NormalizeEmails();
    userData = [
      { id: 1, email: 'USER@EXAMPLE.COM' },
      { id: 2, email: 'Test.User@Gmail.COM' },
      { id: 3, email: 'admin@company.org' }
    ];

    mockDb = {
      query: async (sql: string) => {
        if (sql.includes('SELECT')) {
          return userData;
        }
        if (sql.includes('UPDATE')) {
          // Simulate the update
          userData = userData.map(user => ({
            ...user,
            email: user.email.toLowerCase()
          }));
          return { affectedRows: userData.length };
        }
        return [];
      }
    };
  });

  it('should normalize all emails to lowercase', async () => {
    await migration.up(mockDb, {} as any, {} as any);

    expect(userData[0].email).to.equal('user@example.com');
    expect(userData[1].email).to.equal('test.user@gmail.com');
    expect(userData[2].email).to.equal('admin@company.org');
  });

  it('should return correct count', async () => {
    const result = await migration.up(mockDb, {} as any, {} as any);

    expect(result).to.include('3');
  });
});
```

---

## Integration Testing

### Test Against Real Database

Create a test database handler:

```typescript
// test/integration/helpers/TestDatabaseHandler.ts
import { PostgreSQLHandler, IPostgreSQLConfig } from '../../../src/database/PostgreSQLHandler';

export class TestDatabaseHandler extends PostgreSQLHandler {
  constructor() {
    const config: IPostgreSQLConfig = {
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'msr_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'test'
    };

    super(config);
  }

  /**
   * Clean database before each test
   */
  async clean(): Promise<void> {
    // Get all tables except schema_version
    const tables = await this.db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != 'schema_version'
    `);

    // Drop all tables
    for (const table of tables) {
      await this.db.query(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE`);
    }

    // Clear schema_version
    await this.db.query('TRUNCATE TABLE schema_version');
  }
}
```

### Integration Test Suite

```typescript
// test/integration/migrations.integration.test.ts
import { expect } from 'chai';
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { TestDatabaseHandler } from './helpers/TestDatabaseHandler';

describe('Migration Integration Tests', () => {
  let handler: TestDatabaseHandler;
  let executor: MigrationScriptExecutor;
  let config: Config;

  before(async () => {
    handler = new TestDatabaseHandler();

    config = new Config();
    config.folder = './migrations';
    config.backup.folder = './test/backups';

    executor = new MigrationScriptExecutor({ handler , config });

    // Initialize schema version table
    await handler.schemaVersion.init();
  });

  after(async () => {
    await handler.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await handler.clean();
  });

  describe('Forward Migrations', () => {
    it('should execute all pending migrations', async () => {
      const result = await executor.up();

      expect(result.success).to.be.true;
      expect(result.executed.length).to.be.greaterThan(0);
      expect(result.errors).to.be.empty;
    });

    it('should track executed migrations', async () => {
      await executor.up();

      const migrated = await handler.schemaVersion.list();
      expect(migrated.length).to.be.greaterThan(0);
    });

    it('should be idempotent - running twice does nothing', async () => {
      const result1 = await executor.up();
      const result2 = await executor.up();

      expect(result1.executed.length).to.be.greaterThan(0);
      expect(result2.executed.length).to.equal(0); // No new migrations
    });

    it('should create expected database schema', async () => {
      await executor.up();

      // Verify users table exists
      const tables = await handler.db.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'users'
      `);

      expect(tables).to.have.lengthOf(1);

      // Verify columns
      const columns = await handler.db.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users'
      `);

      const columnNames = columns.map(c => c.column_name);
      expect(columnNames).to.include('id');
      expect(columnNames).to.include('email');
      expect(columnNames).to.include('name');
    });
  });

  describe('Rollback Tests', () => {
    it('should rollback all migrations using downTo(0)', async () => {
      // First, run migrations
      await executor.up();

      // Verify tables exist
      let tables = await handler.db.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != 'schema_version'
      `);
      expect(tables.length).to.be.greaterThan(0);

      // Rollback all
      const result = await executor.down(0);

      expect(result.success).to.be.true;
      expect(result.executed.length).to.be.greaterThan(0);

      // Verify tables are gone
      tables = await handler.db.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != 'schema_version'
      `);
      expect(tables).to.have.lengthOf(0);
    });

    it('should rollback to specific version', async () => {
      // Run all migrations
      await executor.up();

      const allMigrations = await handler.schemaVersion.list();
      const targetVersion = allMigrations[1].timestamp; // Rollback to 2nd migration

      // Rollback to target
      const result = await executor.down(targetVersion);

      expect(result.success).to.be.true;

      // Verify only 2 migrations remain
      const remaining = await handler.schemaVersion.list();
      expect(remaining.length).to.equal(2);
      expect(remaining[remaining.length - 1].timestamp).to.equal(targetVersion);
    });
  });

  describe('Round-Trip Tests', () => {
    it('should successfully migrate up and down', async () => {
      // Capture initial state
      const initialTables = await handler.db.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != 'schema_version'
      `);

      // Migrate up
      const upResult = await executor.up();
      expect(upResult.success).to.be.true;

      // Verify changes
      const migratedTables = await handler.db.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != 'schema_version'
      `);
      expect(migratedTables.length).to.be.greaterThan(initialTables.length);

      // Migrate down
      const downResult = await executor.down(0);
      expect(downResult.success).to.be.true;

      // Verify back to initial state
      const finalTables = await handler.db.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != 'schema_version'
      `);
      expect(finalTables.length).to.equal(initialTables.length);
    });
  });

  describe('Error Handling', () => {
    it('should rollback on migration failure', async () => {
      // This test assumes a migration that will fail
      config.folder = './test/fixtures/failing-migrations';

      const failingExecutor = new MigrationScriptExecutor({ handler , config });

      const result = await failingExecutor.migrate();

      expect(result.success).to.be.false;
      expect(result.errors.length).to.be.greaterThan(0);

      // Verify database was rolled back
      const tables = await handler.db.query<{ tablename: string }>(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != 'schema_version'
      `);

      expect(tables).to.have.lengthOf(0); // Should be clean
    });
  });
});
```

---

## Mocking for Fast Tests

Create reusable mocks:

```typescript
// test/helpers/mocks.ts
import { IDatabaseMigrationHandler, IDB, IBackup, ISchemaVersion, IMigrationScript } from '@migration-script-runner/core';

/**
 * Create a mock database handler for testing
 */
export function createMockHandler(): IDatabaseMigrationHandler {
  const migrations: IMigrationScript[] = [];

  return {
    getName: () => 'Mock Database Handler',

    db: {
      query: async (sql: string) => {
        console.log('Mock query:', sql);
        return [];
      }
    } as IDB,

    backup: {
      backup: async () => {
        return JSON.stringify({ timestamp: Date.now(), data: {} });
      },
      restore: async (data: string) => {
        console.log('Mock restore:', data);
      }
    } as IBackup,

    schemaVersion: {
      init: async () => {
        console.log('Mock init schema version');
      },
      list: async () => {
        return [...migrations];
      },
      add: async (script: IMigrationScript) => {
        migrations.push(script);
      },
      remove: async (timestamp: number) => {
        const index = migrations.findIndex(m => m.timestamp === timestamp);
        if (index > -1) {
          migrations.splice(index, 1);
        }
      }
    } as ISchemaVersion
  };
}

/**
 * Create a spy database that tracks all queries
 */
export class SpyDatabase implements IDB {
  queries: string[] = [];
  responses: Map<string, any[]> = new Map();

  async query(sql: string, params?: any[]): Promise<any[]> {
    this.queries.push(sql);

    // Return mocked response if configured
    for (const [pattern, response] of this.responses.entries()) {
      if (sql.includes(pattern)) {
        return response;
      }
    }

    return [];
  }

  /**
   * Configure response for queries matching pattern
   */
  mockResponse(pattern: string, response: any[]): void {
    this.responses.set(pattern, response);
  }

  /**
   * Get all queries that match pattern
   */
  getQueriesMatching(pattern: string): string[] {
    return this.queries.filter(q => q.includes(pattern));
  }

  /**
   * Reset recorded queries
   */
  reset(): void {
    this.queries = [];
  }
}
```

### Using Mocks in Tests

```typescript
// test/unit/migrations-with-mocks.test.ts
import { expect } from 'chai';
import { MigrationScriptExecutor, Config, SilentLogger } from '@migration-script-runner/core';
import { createMockHandler, SpyDatabase } from '../helpers/mocks';

describe('Migrations with Mocks', () => {
  it('should execute migrations without real database', async () => {
    const handler = createMockHandler();
    const config = new Config();
    config.folder = './migrations';

    const executor = new MigrationScriptExecutor({ handler, 
      logger: new SilentLogger()
    });

    const result = await executor.up();

    expect(result.success).to.be.true;
  });

  it('should track queries executed', async () => {
    const spyDb = new SpyDatabase();
    spyDb.mockResponse('SELECT', [{ id: 1, name: 'test' }]);

    const result = await spyDb.query('SELECT * FROM users');

    expect(result).to.deep.equal([{ id: 1, name: 'test' }]);
    expect(spyDb.queries).to.include('SELECT * FROM users');
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test-migrations.yml
name: Test Migrations

on:
  pull_request:
    paths:
      - 'migrations/**'
      - 'src/**'
      - 'test/**'
  push:
    branches: [main]

jobs:
  test-migrations:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: msr_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate migrations (dry run)
        run: npm run migrate:validate
        env:
          TEST_DB_HOST: localhost
          TEST_DB_PORT: 5432
          TEST_DB_NAME: msr_test
          TEST_DB_USER: postgres
          TEST_DB_PASSWORD: test

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_DB_HOST: localhost
          TEST_DB_PORT: 5432
          TEST_DB_NAME: msr_test
          TEST_DB_USER: postgres
          TEST_DB_PASSWORD: test

      - name: Test migration rollback
        run: npm run test:rollback
        env:
          TEST_DB_HOST: localhost
          TEST_DB_PORT: 5432
          TEST_DB_NAME: msr_test
          TEST_DB_USER: postgres
          TEST_DB_PASSWORD: test

      - name: Generate coverage report
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### NPM Scripts

```json
{
  "scripts": {
    "test": "mocha 'test/**/*.test.ts' --require ts-node/register",
    "test:unit": "mocha 'test/unit/**/*.test.ts' --require ts-node/register",
    "test:integration": "mocha 'test/integration/**/*.test.ts' --require ts-node/register --timeout 10000",
    "test:rollback": "node test/scripts/test-rollback.js",
    "test:coverage": "nyc npm test",
    "test:watch": "mocha 'test/**/*.test.ts' --require ts-node/register --watch",
    "migrate:validate": "node test/scripts/validate-migrations.js"
  }
}
```

### Dry Run Validation Script

Create a validation script that uses dry run mode:

```typescript
// test/scripts/validate-migrations.ts
import { Config, MigrationScriptExecutor } from '@migration-script-runner/core';
import { createDatabaseHandler } from '../helpers/database';

async function validateMigrations() {
  const handler = await createDatabaseHandler();
  const config = new Config();

  // Enable dry run and validation
  config.dryRun = true;
  config.validateBeforeRun = true;
  config.folder = './migrations';

  const executor = new MigrationScriptExecutor({ handler , config });

  try {
    const result = await executor.up();

    if (!result.success) {
      console.error('❌ Migration validation failed');
      process.exit(1);
    }

    console.log('✓ All migrations validated successfully');
    console.log(`  Would execute: ${result.executed.length} migration(s)`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation error:', error.message);
    process.exit(1);
  }
}

validateMigrations();
```

{: .tip }
> Dry run mode is perfect for CI/CD validation because it catches errors without making database changes.

---

## Testing Best Practices

### 1. Test Isolation

Each test should be independent:

```typescript
describe('Migration Tests', () => {
  beforeEach(async () => {
    // Clean state before each test
    await handler.clean();
    await handler.schemaVersion.init();
  });

  it('test 1', async () => {
    // This test doesn't affect test 2
  });

  it('test 2', async () => {
    // Clean slate from beforeEach
  });
});
```

### 2. Test Both Up and Down

```typescript
describe('V202501220100_create_users', () => {
  it('should create users table', async () => {
    await migration.up(db, info, handler);
    // Verify table exists
  });

  it('should drop users table', async () => {
    await migration.up(db, info, handler);
    await migration.down(db, info, handler);
    // Verify table is gone
  });
});
```

### 3. Test Edge Cases

```typescript
describe('Edge Cases', () => {
  it('should handle empty database', async () => {
    const result = await executor.up();
    expect(result.success).to.be.true;
  });

  it('should handle already-migrated database', async () => {
    await executor.up(); // First run
    const result = await executor.up(); // Second run
    expect(result.executed.length).to.equal(0);
  });

  it('should handle missing down() method gracefully', async () => {
    // Test behavior when down() is not implemented
  });
});
```

### 4. Use Descriptive Test Names

```typescript
// ❌ Bad
it('should work', async () => {});

// ✅ Good
it('should create users table with email index', async () => {});
it('should rollback users table creation on failure', async () => {});
it('should normalize all email addresses to lowercase', async () => {});
```

---

## Performance Testing

### Measuring Migration Speed

```typescript
// test/performance/migration-speed.test.ts
import { expect } from 'chai';
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { TestDatabaseHandler } from '../helpers/TestDatabaseHandler';

describe('Migration Performance', () => {
  it('should complete within acceptable time', async function() {
    this.timeout(30000); // 30 second timeout

    const handler = new TestDatabaseHandler();
    const config = new Config();
    const executor = new MigrationScriptExecutor({ handler , config });

    const startTime = Date.now();
    await executor.up();
    const duration = Date.now() - startTime;

    console.log(`Migrations completed in ${duration}ms`);
    expect(duration).to.be.lessThan(5000); // Should complete in < 5 seconds

    await handler.close();
  });
});
```

---

## Troubleshooting Tests

### Issue 1: Tests Failing Intermittently

**Cause:** Race conditions or test pollution

**Solution:**
```typescript
// Use proper cleanup
afterEach(async () => {
  await handler.clean();
});

// Use unique test data
const testId = Date.now();
const testEmail = `test-${testId}@example.com`;
```

### Issue 2: Integration Tests Slow

**Cause:** Real database operations

**Solution:**
```typescript
// Use transactions for faster cleanup
beforeEach(async () => {
  await db.query('BEGIN');
});

afterEach(async () => {
  await db.query('ROLLBACK');
});
```

### Issue 3: Mock Not Working

**Cause:** Incorrect type casting

**Solution:**
```typescript
// Use proper interface casting
const mockDb = {
  query: async () => []
} as IDB;

// Not just 'as any'
```

---

## Complete Test Suite Example

```typescript
// test/migrations.complete.test.ts
import { expect } from 'chai';
import { MigrationScriptExecutor, Config, RollbackStrategy } from '@migration-script-runner/core';
import { TestDatabaseHandler } from './helpers/TestDatabaseHandler';

describe('Complete Migration Test Suite', () => {
  let handler: TestDatabaseHandler;

  before(async () => {
    handler = new TestDatabaseHandler();
    await handler.schemaVersion.init();
  });

  after(async () => {
    await handler.close();
  });

  beforeEach(async () => {
    await handler.clean();
  });

  describe('Standard Migration Flow', () => {
    it('should execute all migrations successfully', async () => {
      const config = new Config();
      const executor = new MigrationScriptExecutor({ handler , config });

      const result = await executor.up();

      expect(result.success).to.be.true;
      expect(result.executed.length).to.be.greaterThan(0);
    });
  });

  describe('Rollback Strategies', () => {
    it('should rollback using BACKUP strategy', async () => {
      const config = new Config();
      config.rollbackStrategy = RollbackStrategy.BACKUP;
      const executor = new MigrationScriptExecutor({ handler , config });

      // Test with failing migration...
    });

    it('should rollback using DOWN strategy', async () => {
      const config = new Config();
      config.rollbackStrategy = RollbackStrategy.DOWN;
      const executor = new MigrationScriptExecutor({ handler , config });

      // Test rollback...
    });
  });

  describe('Version Control', () => {
    it('should migrate to specific version', async () => {
      const config = new Config();
      const executor = new MigrationScriptExecutor({ handler , config });

      const result = await executor.up(202501220200);

      expect(result.success).to.be.true;

      const migrated = await handler.schemaVersion.list();
      expect(migrated.every(m => m.timestamp <= 202501220200)).to.be.true;
    });
  });
});
```

---

