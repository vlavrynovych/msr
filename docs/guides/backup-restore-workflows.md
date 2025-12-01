---
layout: default
title: Backup & Restore Workflows
parent: Guides
nav_order: 6
---

# Backup & Restore Workflows
{: .no_toc }

Practical workflows for database backups, environment synchronization, and disaster recovery.
{: .fs-6 .fw-300 }

## What You'll Learn

- Environment synchronization (production to development)
- Database cloning for testing environments
- Disaster recovery procedures
- CI/CD integration with backups
- Security best practices for production data

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR provides flexible backup and restore capabilities that go beyond simple rollback scenarios. This guide covers practical workflows for:

- **Environment Synchronization**: Copy production data to development/staging
- **Database Cloning**: Create copies of databases for testing
- **Disaster Recovery**: Manual backup and restore procedures
- **CI/CD Integration**: Backup before deployments with external restore capability

{: .warning }
> When copying production data to non-production environments, always sanitize sensitive data (PII, passwords, API keys) to comply with security and privacy regulations.

---

## Environment Synchronization

### Use Case: Copy Production to Development

A common workflow is copying production data to development or staging environments for testing, debugging, or QA purposes.

#### Architecture

```
Production Server              Development Server
  ┌─────────────┐                ┌─────────────┐
  │  Prod DB    │                │   Dev DB    │
  │ (PostgreSQL)│                │ (PostgreSQL)│
  └──────┬──────┘                └──────┬──────┘
         │                              │
         │ 1. Backup                    │ 3. Restore
         ▼                              ▼
    backup.json ──────2. Copy────▶ backup.json
```

#### Step-by-Step Implementation

##### 1. Create Production Handler (PostgreSQL Example)

```typescript
// prod-handler.ts
import { IDatabaseMigrationHandler, IDB, IBackup, ISchemaVersion } from '@migration-script-runner/core';
import { Pool } from 'pg';

interface IProdDB extends IDB {
  pool: Pool;
  query(sql: string, params?: any[]): Promise<any>;
}

export class ProductionHandler implements IDatabaseMigrationHandler {
  db: IProdDB;
  schemaVersion: ISchemaVersion;
  backup: IBackup;

  constructor() {
    // Production connection
    this.db = {
      pool: new Pool({
        host: process.env.PROD_DB_HOST,
        port: 5432,
        database: process.env.PROD_DB_NAME,
        user: process.env.PROD_DB_USER,
        password: process.env.PROD_DB_PASSWORD,
        ssl: true // Production uses SSL
      }),
      query: async (sql, params) => {
        const result = await this.db.pool.query(sql, params);
        return result.rows;
      }
    };

    // Schema version tracking (same for all environments)
    this.schemaVersion = {
      // ... implementation
    };

    // Backup implementation - serializes entire database
    this.backup = {
      backup: async (): Promise<string> => {
        // Export all tables as JSON
        const tables = await this.getAllTables();
        const data: Record<string, any[]> = {};

        for (const table of tables) {
          data[table] = await this.db.query(`SELECT * FROM ${table}`);
        }

        return JSON.stringify({
          timestamp: Date.now(),
          tables: data,
          version: await this.getCurrentSchemaVersion()
        });
      },

      restore: async (backupData: string): Promise<void> => {
        const backup = JSON.parse(backupData);

        // Truncate all tables
        for (const table of Object.keys(backup.tables)) {
          await this.db.query(`TRUNCATE TABLE ${table} CASCADE`);
        }

        // Restore data
        for (const [table, rows] of Object.entries(backup.tables)) {
          for (const row of rows as any[]) {
            const columns = Object.keys(row);
            const values = Object.values(row);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            await this.db.query(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
          }
        }
      }
    };
  }

  getName(): string {
    return 'Production PostgreSQL Handler';
  }

  private async getAllTables(): Promise<string[]> {
    const result = await this.db.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename != 'schema_version'
    `);
    return result.map((row: any) => row.tablename);
  }

  private async getCurrentSchemaVersion(): Promise<number> {
    // Get latest migration version
    const result = await this.db.query(
      'SELECT timestamp FROM schema_version ORDER BY timestamp DESC LIMIT 1'
    );
    return result[0]?.timestamp || 0;
  }
}
```

##### 2. Create Development Handler

```typescript
// dev-handler.ts
import { IDatabaseMigrationHandler } from '@migration-script-runner/core';
import { Pool } from 'pg';

export class DevelopmentHandler implements IDatabaseMigrationHandler {
  // ... similar structure to ProductionHandler

  constructor() {
    // Development connection - different host/credentials
    this.db = {
      pool: new Pool({
        host: 'localhost',
        port: 5432,
        database: 'myapp_dev',
        user: 'dev_user',
        password: 'dev_password',
        ssl: false // Local development, no SSL
      }),
      query: async (sql, params) => {
        const result = await this.db.pool.query(sql, params);
        return result.rows;
      }
    };

    // Same backup/restore implementation
    this.backup = { /* same as prod */ };
    this.schemaVersion = { /* same as prod */ };
  }

  getName(): string {
    return 'Development PostgreSQL Handler';
  }
}
```

##### 3. Backup Production Database

```typescript
// scripts/backup-production.ts
import { MigrationScriptExecutor, Config, BackupMode } from '@migration-script-runner/core';
import { ProductionHandler } from './prod-handler';
import * as path from 'path';
import * as fs from 'fs';

async function backupProduction() {
  const prodHandler = new ProductionHandler();
  const config = new Config();

  // Configure for manual backup
  config.backupMode = BackupMode.MANUAL;
  config.backup.folder = './backups/production';
  config.backup.prefix = 'prod-backup';
  config.backup.timestamp = true;
  config.backup.deleteBackup = false; // Keep the backup

  // Ensure backup directory exists
  if (!fs.existsSync(config.backup.folder)) {
    fs.mkdirSync(config.backup.folder, { recursive: true });
  }

  const executor = new MigrationScriptExecutor(prodHandler, config);

  console.log('Creating production database backup...');
  const backupPath = await executor.createBackup();
  console.log(`✅ Production backup created: ${backupPath}`);

  // Copy to shared location for development team
  const sharedPath = '/mnt/shared/backups/latest-prod.bkp';
  fs.copyFileSync(backupPath, sharedPath);
  console.log(`📦 Backup copied to: ${sharedPath}`);

  return backupPath;
}

backupProduction().catch(console.error);
```

##### 4. Restore to Development Database

```typescript
// scripts/restore-to-development.ts
import { MigrationScriptExecutor, Config, BackupMode } from '@migration-script-runner/core';
import { DevelopmentHandler } from './dev-handler';
import * as path from 'path';

async function restoreToDevelopment(backupPath: string) {
  const devHandler = new DevelopmentHandler();
  const config = new Config();

  // Configure to use existing backup
  config.backupMode = BackupMode.MANUAL;

  const executor = new MigrationScriptExecutor(devHandler, config);

  console.log(`Restoring production backup to development...`);
  console.log(`Source: ${backupPath}`);

  // Restore the production backup to development database
  await executor.restoreFromBackup(backupPath);

  console.log('✅ Development database updated with production data');
  console.log('⚠️  Remember to sanitize sensitive data if needed');
}

// Usage
const backupPath = process.argv[2] || '/mnt/shared/backups/latest-prod.bkp';
restoreToDevelopment(backupPath).catch(console.error);
```

##### 5. Complete Workflow Script

```typescript
// scripts/sync-prod-to-dev.ts
import { MigrationScriptExecutor, Config, BackupMode, SilentLogger } from '@migration-script-runner/core';
import { ProductionHandler } from './prod-handler';
import { DevelopmentHandler } from './dev-handler';

async function syncProdToDev() {
  console.log('🔄 Starting Production → Development Sync\n');

  // Step 1: Backup Production
  console.log('Step 1/3: Backing up production database...');
  const prodHandler = new ProductionHandler();
  const prodConfig = new Config();
  prodConfig.backupMode = BackupMode.MANUAL;
  prodConfig.backup.folder = './backups/temp';

  const prodExecutor = new MigrationScriptExecutor(prodHandler, prodConfig, {
    logger: new SilentLogger()
  });

  const backupPath = await prodExecutor.createBackup();
  console.log(`✅ Production backup created: ${backupPath}\n`);

  // Step 2: Backup Development (safety)
  console.log('Step 2/3: Creating safety backup of development...');
  const devHandler = new DevelopmentHandler();
  const devConfig = new Config();
  devConfig.backupMode = BackupMode.MANUAL;
  devConfig.backup.folder = './backups/dev-safety';
  devConfig.backup.prefix = 'dev-safety';

  const devExecutor = new MigrationScriptExecutor(devHandler, devConfig);

  const devSafetyBackup = await devExecutor.createBackup();
  console.log(`✅ Development safety backup: ${devSafetyBackup}\n`);

  // Step 3: Restore Production data to Development
  console.log('Step 3/3: Restoring production data to development...');
  await devExecutor.restoreFromBackup(backupPath);
  console.log('✅ Development database synchronized with production\n');

  console.log('📋 Summary:');
  console.log(`  Production backup: ${backupPath}`);
  console.log(`  Dev safety backup: ${devSafetyBackup}`);
  console.log(`  Status: Synchronized successfully`);
  console.log('\n⚠️  Don\'t forget to sanitize sensitive data!');
}

syncProdToDev().catch(error => {
  console.error('❌ Sync failed:', error.message);
  process.exit(1);
});
```

#### Running the Workflow

```bash
# Option 1: Run complete sync
npm run sync:prod-to-dev

# Option 2: Manual steps
npm run backup:prod           # Creates backup
npm run restore:dev -- backup-prod-2025-01-22.bkp
```

---

## Firebase Example

### Environment Synchronization with Firestore

```typescript
// firebase-handler.ts
import { IDatabaseMigrationHandler, IDB, IBackup } from '@migration-script-runner/core';
import * as admin from 'firebase-admin';

export class FirebaseHandler implements IDatabaseMigrationHandler {
  db: IDB & { firestore: admin.firestore.Firestore };
  backup: IBackup;

  constructor(serviceAccountPath: string, databaseURL: string) {
    // Initialize Firebase Admin
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      databaseURL: databaseURL
    });

    this.db = {
      firestore: admin.firestore(app),
      // ... other IDB properties
    };

    this.backup = {
      backup: async (): Promise<string> => {
        const collections = ['users', 'orders', 'products']; // Your collections
        const data: Record<string, any[]> = {};

        for (const collectionName of collections) {
          const snapshot = await this.db.firestore.collection(collectionName).get();
          data[collectionName] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        }

        return JSON.stringify({
          timestamp: Date.now(),
          collections: data
        });
      },

      restore: async (backupData: string): Promise<void> => {
        const backup = JSON.parse(backupData);
        const batch = this.db.firestore.batch();
        let operationCount = 0;

        for (const [collectionName, documents] of Object.entries(backup.collections)) {
          for (const doc of documents as any[]) {
            const docRef = this.db.firestore.collection(collectionName).doc(doc.id);
            batch.set(docRef, doc);
            operationCount++;

            // Firestore batch limit is 500 operations
            if (operationCount >= 500) {
              await batch.commit();
              operationCount = 0;
            }
          }
        }

        if (operationCount > 0) {
          await batch.commit();
        }
      }
    };
  }

  getName(): string {
    return 'Firebase Firestore Handler';
  }
}

// Production Firebase
const prodHandler = new FirebaseHandler(
  './config/prod-service-account.json',
  'https://my-app-prod.firebaseio.com'
);

// Development Firebase
const devHandler = new FirebaseHandler(
  './config/dev-service-account.json',
  'https://my-app-dev.firebaseio.com'
);
```

---

## Disaster Recovery Workflow

### Manual Backup Before Risky Operations

{: .tip }
> For production deployments, always create a manual backup before running migrations. Set `config.backup.deleteBackup = false` to keep backups for disaster recovery.

```typescript
// scripts/safe-migration.ts
import { MigrationScriptExecutor, Config, BackupMode } from '@migration-script-runner/core';

async function safeProductionMigration() {
  const handler = new ProductionHandler();
  const config = new Config();

  // Manual control for production safety
  config.backupMode = BackupMode.MANUAL;
  config.backup.folder = '/mnt/backup-storage/critical';
  config.backup.prefix = 'pre-migration';
  config.backup.deleteBackup = false; // Keep all backups

  const executor = new MigrationScriptExecutor(handler, config);

  console.log('🔒 Creating production backup before migration...');
  const backupPath = await executor.createBackup();
  console.log(`✅ Backup created: ${backupPath}`);

  // Store backup path for potential rollback
  const timestamp = Date.now();
  await storeBackupMetadata({
    timestamp,
    path: backupPath,
    environment: 'production',
    reason: 'pre-migration-safety'
  });

  try {
    console.log('🚀 Starting migration...');
    const result = await executor.migrate();

    if (result.success) {
      console.log('✅ Migration completed successfully');
      console.log(`Executed ${result.executed.length} migrations`);

      // Optionally delete backup after success period (e.g., 7 days)
      scheduleBackupDeletion(backupPath, 7);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('');
    console.log('Rollback options:');
    console.log(`1. Automatic restore: node scripts/restore.js ${backupPath}`);
    console.log(`2. Manual restore via database tools`);
    console.log(`3. Contact DBA team with backup ID: ${timestamp}`);

    throw error;
  }
}

async function storeBackupMetadata(metadata: any) {
  // Store in database, S3, or backup management system
  console.log('📝 Backup metadata stored:', metadata);
}

function scheduleBackupDeletion(backupPath: string, days: number) {
  // Schedule cleanup job
  console.log(`📅 Backup scheduled for deletion in ${days} days`);
}
```

---

## CI/CD Integration

### Backup in Pipeline, Restore if Deployment Fails

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Create pre-deployment backup
        id: backup
        run: |
          node scripts/create-backup.js
          echo "BACKUP_PATH=$(cat backup-path.txt)" >> $GITHUB_OUTPUT
        env:
          DB_HOST: ${{ secrets.PROD_DB_HOST }}
          DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}

      - name: Run migrations
        id: migrate
        run: node scripts/run-migrations.js
        env:
          DB_HOST: ${{ secrets.PROD_DB_HOST }}
          DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}

      - name: Deploy application
        run: npm run deploy

      - name: Restore on failure
        if: failure() && steps.migrate.outcome == 'failure'
        run: |
          node scripts/restore-backup.js ${{ steps.backup.outputs.BACKUP_PATH }}
        env:
          DB_HOST: ${{ secrets.PROD_DB_HOST }}
          DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}

      - name: Notify on failure
        if: failure()
        run: |
          echo "Deployment failed. Database restored to pre-deployment state."
          echo "Backup location: ${{ steps.backup.outputs.BACKUP_PATH }}"
```

#### Backup Script for CI/CD

```typescript
// scripts/create-backup.js
import { MigrationScriptExecutor, Config, BackupMode } from '@migration-script-runner/core';
import { ProductionHandler } from './prod-handler';
import * as fs from 'fs';

async function createBackup() {
  const handler = new ProductionHandler();
  const config = new Config();

  config.backupMode = BackupMode.MANUAL;
  config.backup.folder = process.env.BACKUP_FOLDER || './backups';
  config.backup.prefix = 'ci-backup';
  config.backup.timestamp = true;

  const executor = new MigrationScriptExecutor(handler, config);
  const backupPath = await executor.createBackup();

  // Write backup path for next steps
  fs.writeFileSync('backup-path.txt', backupPath);

  console.log(`Backup created: ${backupPath}`);
  return backupPath;
}

createBackup().catch(error => {
  console.error('Backup failed:', error);
  process.exit(1);
});
```

#### Migration with External Backup Reference

```typescript
// scripts/run-migrations.js
import { MigrationScriptExecutor, Config, BackupMode, RollbackStrategy } from '@migration-script-runner/core';
import { ProductionHandler } from './prod-handler';
import * as fs from 'fs';

async function runMigrations() {
  const handler = new ProductionHandler();
  const config = new Config();

  // Use RESTORE_ONLY mode with CI backup
  config.backupMode = BackupMode.RESTORE_ONLY;
  config.rollbackStrategy = RollbackStrategy.BACKUP;

  // Read backup path from previous CI step
  const backupPath = fs.readFileSync('backup-path.txt', 'utf8');
  config.backup.existingBackupPath = backupPath;

  const executor = new MigrationScriptExecutor(handler, config);

  console.log('Running migrations with backup restore capability...');
  const result = await executor.migrate();

  if (result.success) {
    console.log(`✅ ${result.executed.length} migrations completed successfully`);
  } else {
    console.error('❌ Migration failed - database restored from backup');
    process.exit(1);
  }
}

runMigrations().catch(error => {
  console.error('Migration error:', error);
  process.exit(1);
});
```

---

## Database Cloning for Testing

### Create Test Database from Production

```typescript
// scripts/create-test-database.ts
import { MigrationScriptExecutor, Config, BackupMode } from '@migration-script-runner/core';
import { ProductionHandler } from './prod-handler';
import { TestHandler } from './test-handler';

async function cloneProductionToTest(testDbName: string) {
  console.log(`Creating test database: ${testDbName}`);

  // Step 1: Backup production
  const prodHandler = new ProductionHandler();
  const prodConfig = new Config();
  prodConfig.backupMode = BackupMode.MANUAL;

  const prodExecutor = new MigrationScriptExecutor(prodHandler, prodConfig);
  const backupPath = await prodExecutor.createBackup();

  console.log(`✅ Production backed up: ${backupPath}`);

  // Step 2: Create new test database
  const testHandler = new TestHandler(testDbName);
  await testHandler.createDatabase();

  console.log(`✅ Test database created: ${testDbName}`);

  // Step 3: Restore production data
  const testConfig = new Config();
  const testExecutor = new MigrationScriptExecutor(testHandler, testConfig);
  await testExecutor.restoreFromBackup(backupPath);

  console.log(`✅ Production data restored to: ${testDbName}`);

  // Step 4: Sanitize sensitive data
  await testHandler.sanitizeData();
  console.log(`✅ Sensitive data sanitized`);

  console.log(`\n📦 Test database ready: ${testDbName}`);
  console.log(`   Connection: ${testHandler.getConnectionString()}`);
}

// Usage
const testDbName = `test_${Date.now()}`;
cloneProductionToTest(testDbName).catch(console.error);
```

---

## Best Practices

### Security

1. **Sanitize Sensitive Data**
   ```typescript
   async function sanitizeData(handler: IDatabaseMigrationHandler) {
     await handler.db.query(`
       UPDATE users
       SET email = CONCAT('user', id, '@example.com'),
           password = 'hashed_dummy_password',
           phone = NULL
     `);
   }
   ```

2. **Encrypt Backups**
   ```typescript
   import * as crypto from 'crypto';

   backup: {
     backup: async (): Promise<string> => {
       const data = await createBackupData();
       const encrypted = encryptData(data, process.env.BACKUP_KEY);
       return encrypted;
     },
     restore: async (encryptedData: string): Promise<void> => {
       const data = decryptData(encryptedData, process.env.BACKUP_KEY);
       await restoreData(data);
     }
   }
   ```

3. **Access Control**
   ```typescript
   // Separate credentials for read-only backup access
   const backupHandler = new BackupOnlyHandler({
     host: process.env.DB_HOST,
     user: process.env.BACKUP_USER, // Read-only user
     password: process.env.BACKUP_PASSWORD
   });
   ```

### Storage

1. **External Storage**
   ```typescript
   async function uploadToS3(backupPath: string) {
     const s3 = new AWS.S3();
     const fileContent = fs.readFileSync(backupPath);

     await s3.upload({
       Bucket: 'my-app-backups',
       Key: `backups/${path.basename(backupPath)}`,
       Body: fileContent
     }).promise();
   }
   ```

2. **Backup Rotation**
   ```typescript
   async function cleanOldBackups(folder: string, retentionDays: number) {
     const files = fs.readdirSync(folder);
     const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

     for (const file of files) {
       const stats = fs.statSync(path.join(folder, file));
       if (stats.mtime.getTime() < cutoffDate) {
         fs.unlinkSync(path.join(folder, file));
       }
     }
   }
   ```

### Monitoring

```typescript
async function monitoredBackup(executor: MigrationScriptExecutor) {
  const startTime = Date.now();

  try {
    const backupPath = await executor.createBackup();
    const duration = Date.now() - startTime;
    const size = fs.statSync(backupPath).size;

    await metrics.track('backup.success', {
      duration,
      size,
      timestamp: Date.now()
    });

    return backupPath;
  } catch (error) {
    await metrics.track('backup.failure', {
      error: error.message,
      timestamp: Date.now()
    });
    throw error;
  }
}
```

---

## Troubleshooting

### Backup Takes Too Long

**Problem:** Production backup takes 10+ minutes

**Solutions:**
1. Use database-native backup tools for large databases
2. Implement incremental backups
3. Backup only essential tables
4. Use parallel backup for multiple collections

```typescript
// Parallel backup for Firebase
async backup(): Promise<string> {
  const collections = ['users', 'orders', 'products'];

  const backupPromises = collections.map(async (name) => {
    const snapshot = await this.db.firestore.collection(name).get();
    return [name, snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
  });

  const results = await Promise.all(backupPromises);
  return JSON.stringify(Object.fromEntries(results));
}
```

### Large Backup Files

**Problem:** Backup files are too large to transfer

**Solution:** Compress backups

```typescript
import * as zlib from 'zlib';

backup: {
  backup: async (): Promise<string> => {
    const data = await createBackupData();
    const compressed = zlib.gzipSync(JSON.stringify(data));
    return compressed.toString('base64');
  },

  restore: async (compressedData: string): Promise<void> => {
    const buffer = Buffer.from(compressedData, 'base64');
    const decompressed = zlib.gunzipSync(buffer);
    const data = JSON.parse(decompressed.toString());
    await restoreData(data);
  }
}
```

---

