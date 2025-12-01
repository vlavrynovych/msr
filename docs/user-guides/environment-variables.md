---
layout: default
title: Environment Variables
parent: User Guides
nav_order: 5
---

# Environment Variables Guide
{: .no_toc }

Complete guide to configuring Migration Script Runner using environment variables
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR v0.5.0+ supports configuration through environment variables, following [12-Factor App](https://12factor.net/config) principles. This enables:

- **Environment-specific configuration** without code changes
- **Container-friendly deployment** (Docker, Kubernetes)
- **CI/CD integration** with secrets management
- **Production-ready practices** for configuration management

---

## Configuration Loading (Waterfall)

MSR loads configuration using a waterfall approach with clear priority:

```
1. Built-in defaults     (lowest priority)
   ↓
2. Config file          (msr.config.js/json)
   ↓
3. Environment variables (MSR_*)
   ↓
4. Constructor overrides (highest priority)
```

**Each level overrides the previous one**, allowing flexible configuration strategies.

---

## Type-Safe Environment Variables

MSR provides a [`EnvironmentVariables`](../../src/model/EnvironmentVariables.ts) enum for type-safe access to all environment variable names. This is used internally by `ConfigLoader` and is available for your use:

```typescript
import { EnvironmentVariables as ENV } from '@migration-script-runner/core';

// Type-safe access to environment variables
const folder = process.env[ENV.MSR_FOLDER];
const dryRun = process.env[ENV.MSR_DRY_RUN];
const tableName = process.env[ENV.MSR_TABLE_NAME];

// Auto-completion and compile-time checking
if (process.env[ENV.MSR_LOGGING_ENABLED] === 'true') {
    console.log(`Logging to: ${process.env[ENV.MSR_LOGGING_PATH]}`);
}
```

**Benefits:**
- **Auto-completion** - Your IDE will suggest all available environment variable names
- **Compile-time checking** - Typos are caught at build time, not runtime
- **Refactoring support** - Rename safely across your entire codebase
- **Single source of truth** - All environment variable names defined in one place

**See Also:**
- [Complete Environment Variables Table](../reference/environment-variables) - All MSR_* variables with types and defaults
- [EnvironmentVariables.ts Source](../../src/model/EnvironmentVariables.ts) - Enum definition with JSDoc comments

---

## Quick Start

### Basic Setup

**1. No configuration needed** - works out of the box:

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';
import { MyDatabaseHandler } from './database-handler';

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler);

await executor.up();
```

**2. Use environment variables** for deployment:

```bash
# Set environment variables
export MSR_FOLDER=./database/migrations
export MSR_TABLE_NAME=migration_history
export MSR_LOGGING_ENABLED=true
export MSR_LOGGING_PATH=./logs

# Run your application
npm start
```

**3. Override when needed**:

```typescript
// Env vars are loaded automatically, but you can override
const executor = new MigrationScriptExecutor(handler, {
    dryRun: true  // Override for this specific run
});
```

---

## Environment Variables

### Simple Properties

Configure basic settings with `MSR_*` environment variables:

```bash
# Migration folder
export MSR_FOLDER=./database/migrations

# Tracking table name
export MSR_TABLE_NAME=migration_history

# Before migrate hook name
export MSR_BEFORE_MIGRATE_NAME=beforeMigrate

# Display limit (0 = show all)
export MSR_DISPLAY_LIMIT=20

# Boolean flags
export MSR_DRY_RUN=true
export MSR_RECURSIVE=true
export MSR_VALIDATE_BEFORE_RUN=true
export MSR_STRICT_VALIDATION=false
```

**Boolean values** are case-insensitive:
- `true`, `1`, `yes`, `on` → `true`
- Everything else → `false`

---

### Complex Objects (Dot-Notation)

Configure nested objects using dot-notation (recommended):

#### Logging Configuration

```bash
export MSR_LOGGING_ENABLED=true
export MSR_LOGGING_PATH=./logs/migrations
export MSR_LOGGING_MAX_FILES=30
export MSR_LOGGING_TIMESTAMP_FORMAT=YYYY-MM-DD
export MSR_LOGGING_LOG_SUCCESSFUL=true
```

#### Backup Configuration

```bash
export MSR_BACKUP_FOLDER=./backups
export MSR_BACKUP_TIMESTAMP=true
export MSR_BACKUP_DELETE_BACKUP=true
export MSR_BACKUP_PREFIX=db-backup
export MSR_BACKUP_TIMESTAMP_FORMAT=YYYY-MM-DD-HH-mm-ss
```

#### Transaction Configuration

```bash
export MSR_TRANSACTION_MODE=PER_MIGRATION  # or PER_BATCH, NONE
export MSR_TRANSACTION_ISOLATION=READ_COMMITTED  # or READ_UNCOMMITTED, REPEATABLE_READ, SERIALIZABLE
export MSR_TRANSACTION_TIMEOUT=30000  # milliseconds
export MSR_TRANSACTION_RETRIES=3  # number of retry attempts
export MSR_TRANSACTION_RETRY_DELAY=100  # milliseconds
export MSR_TRANSACTION_RETRY_BACKOFF=true  # exponential backoff
```

**Naming Convention:**
- `MSR_` prefix for all variables
- Nested properties use `_` separator
- camelCase property names converted to SNAKE_CASE
- Example: `config.logging.maxFiles` → `MSR_LOGGING_MAX_FILES`

---

### Complex Objects (JSON)

Alternatively, use JSON for complex configuration:

```bash
# Logging as JSON
export MSR_LOGGING='{"enabled":true,"path":"./logs","maxFiles":30}'

# Backup as JSON
export MSR_BACKUP='{"folder":"./backups","timestamp":true,"deleteBackup":true}'

# Transaction as JSON
export MSR_TRANSACTION='{"mode":"PER_MIGRATION","isolation":"READ_COMMITTED","retries":3}'
```

**Note:** Dot-notation variables take precedence over JSON if both are set.

---

### File Patterns

Configure migration file patterns using JSON array:

```bash
# Single pattern
export MSR_FILE_PATTERNS='["^V(\\d+)_.*\\.ts$"]'

# Multiple patterns (TypeScript and SQL)
export MSR_FILE_PATTERNS='["^V(\\d+)_.*\\.ts$","^V(\\d+)_.*\\.sql$"]'
```

---

## Configuration Files

### JavaScript Config (Recommended)

Create `msr.config.js` in your project root:

```javascript
// msr.config.js
module.exports = {
    folder: './database/migrations',
    tableName: 'migration_history',
    displayLimit: 20,
    recursive: true,

    // Can use process.env for dynamic values
    validateBeforeRun: true,
    strictValidation: process.env.CI === 'true',

    logging: {
        enabled: true,
        path: './logs/migrations',
        maxFiles: 30,
        timestampFormat: 'YYYY-MM-DD'
    },

    backup: {
        folder: './backups',
        timestamp: true,
        deleteBackup: true,
        prefix: 'db-backup',
        timestampFormat: 'YYYY-MM-DD-HH-mm-ss'
    }
};
```

### JSON Config

Create `msr.config.json` for static configuration:

```json
{
    "folder": "./database/migrations",
    "tableName": "migration_history",
    "displayLimit": 20,
    "recursive": true,
    "validateBeforeRun": true,
    "strictValidation": false,
    "logging": {
        "enabled": true,
        "path": "./logs/migrations",
        "maxFiles": 30
    },
    "backup": {
        "folder": "./backups",
        "timestamp": true,
        "deleteBackup": true,
        "prefix": "db-backup"
    }
}
```

### Custom Config File Location

Use `MSR_CONFIG_FILE` to specify a custom location:

```bash
export MSR_CONFIG_FILE=./config/production.config.js
```

**Priority:**
1. `MSR_CONFIG_FILE` (if set)
2. `msr.config.js` (if exists)
3. `msr.config.json` (if exists)

---

## Platform-Specific Examples

### Docker

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Set environment variables
ENV MSR_FOLDER=/app/migrations
ENV MSR_TABLE_NAME=migration_history
ENV MSR_LOGGING_ENABLED=true
ENV MSR_LOGGING_PATH=/app/logs
ENV MSR_BACKUP_FOLDER=/app/backups

COPY package*.json ./
RUN npm ci --production

COPY . .

CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    environment:
      - MSR_FOLDER=/app/migrations
      - MSR_TABLE_NAME=migration_history
      - MSR_LOGGING_ENABLED=true
      - MSR_LOGGING_PATH=/app/logs
      - MSR_BACKUP_FOLDER=/app/backups
      - MSR_BACKUP_TIMESTAMP=true
    volumes:
      - ./migrations:/app/migrations
      - ./logs:/app/logs
      - ./backups:/app/backups
```

---

### Kubernetes

**ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: msr-config
data:
  MSR_FOLDER: "/app/migrations"
  MSR_TABLE_NAME: "migration_history"
  MSR_LOGGING_ENABLED: "true"
  MSR_LOGGING_PATH: "/var/log/migrations"
  MSR_BACKUP_FOLDER: "/mnt/backups"
  MSR_BACKUP_TIMESTAMP: "true"
  MSR_VALIDATE_BEFORE_RUN: "true"
```

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  template:
    spec:
      containers:
      - name: app
        image: myapp:latest
        envFrom:
        - configMapRef:
            name: msr-config
        volumeMounts:
        - name: migrations
          mountPath: /app/migrations
        - name: logs
          mountPath: /var/log/migrations
        - name: backups
          mountPath: /mnt/backups
      volumes:
      - name: migrations
        persistentVolumeClaim:
          claimName: migrations-pvc
      - name: logs
        persistentVolumeClaim:
          claimName: logs-pvc
      - name: backups
        persistentVolumeClaim:
          claimName: backups-pvc
```

---

### GitHub Actions

**.github/workflows/migrate.yml:**
```yaml
name: Run Migrations

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest

    env:
      MSR_FOLDER: ./migrations
      MSR_TABLE_NAME: migration_history
      MSR_STRICT_VALIDATION: true
      MSR_VALIDATE_BEFORE_RUN: true
      MSR_LOGGING_ENABLED: true
      MSR_DRY_RUN: false

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npm run migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

### Cloud Platforms

#### AWS ECS Task Definition

```json
{
  "containerDefinitions": [
    {
      "name": "app",
      "image": "myapp:latest",
      "environment": [
        {
          "name": "MSR_FOLDER",
          "value": "/app/migrations"
        },
        {
          "name": "MSR_TABLE_NAME",
          "value": "migration_history"
        },
        {
          "name": "MSR_LOGGING_ENABLED",
          "value": "true"
        },
        {
          "name": "MSR_BACKUP_FOLDER",
          "value": "/mnt/efs/backups"
        }
      ]
    }
  ]
}
```

#### Heroku

```bash
# Set config vars
heroku config:set MSR_FOLDER=./database/migrations
heroku config:set MSR_TABLE_NAME=migration_history
heroku config:set MSR_LOGGING_ENABLED=true
heroku config:set MSR_BACKUP_FOLDER=./backups

# Deploy
git push heroku main
```

---

## Environment-Specific Strategies

### Development (.env)

```bash
# .env.development
MSR_FOLDER=./migrations
MSR_DRY_RUN=false
MSR_STRICT_VALIDATION=false
MSR_LOGGING_ENABLED=true
MSR_BACKUP_DELETE_BACKUP=true
```

**Usage with dotenv:**
```typescript
import 'dotenv/config';
import { MigrationScriptExecutor } from '@migration-script-runner/core';

// Environment variables loaded automatically
const executor = new MigrationScriptExecutor(handler);
await executor.up();
```

---

### Staging

```bash
# .env.staging
MSR_FOLDER=./database/migrations
MSR_TABLE_NAME=migration_history
MSR_VALIDATE_BEFORE_RUN=true
MSR_STRICT_VALIDATION=false
MSR_LOGGING_ENABLED=true
MSR_LOGGING_PATH=/var/log/migrations
MSR_BACKUP_FOLDER=/var/backups
MSR_BACKUP_TIMESTAMP=true
```

---

### Production

```bash
# .env.production
MSR_FOLDER=/app/migrations
MSR_TABLE_NAME=migration_history
MSR_VALIDATE_BEFORE_RUN=true
MSR_STRICT_VALIDATION=false
MSR_LOGGING_ENABLED=true
MSR_LOGGING_PATH=/var/log/migrations
MSR_BACKUP_FOLDER=/var/backups/database
MSR_BACKUP_TIMESTAMP=true
MSR_BACKUP_DELETE_BACKUP=true
```

---

## Advanced Configuration

### Manual Loading with ConfigLoader

For advanced use cases, use `ConfigLoader` directly:

```typescript
import { ConfigLoader, MigrationScriptExecutor } from '@migration-script-runner/core';

// Load with waterfall approach
const config = ConfigLoader.load();

// Load with overrides (highest priority)
const config = ConfigLoader.load({
    folder: './migrations',
    dryRun: true
});

// Load from specific directory
const config = ConfigLoader.load({}, '/app');

const executor = new MigrationScriptExecutor(handler, config);
```

See [ConfigLoader API Reference](../api/ConfigLoader) for detailed documentation.

---

### Validation

Ensure required environment variables are set:

```typescript
import { ConfigLoader } from '@migration-script-runner/core';

// Validate required variables
ConfigLoader.validateRequired([
    'DATABASE_URL',
    'MSR_FOLDER',
    'MSR_TABLE_NAME'
]);

// Throws error with list of missing variables if any are not set
```

---

## Troubleshooting

### Environment Variables Not Applied

**Problem:** Environment variables don't seem to affect configuration.

**Solutions:**
1. **Check variable names** - Must start with `MSR_`
2. **Check spelling** - camelCase → SNAKE_CASE (e.g., `maxFiles` → `MAX_FILES`)
3. **Restart application** - Environment variables are loaded at startup
4. **Check priority** - Constructor overrides take precedence over env vars

**Debug:**
```typescript
console.log('MSR_FOLDER:', process.env.MSR_FOLDER);
const config = ConfigLoader.load();
console.log('Loaded folder:', config.folder);
```

---

### Config File Not Found

**Problem:** Warning: "MSR_CONFIG_FILE points to non-existent file"

**Solutions:**
1. Check file path is relative to `process.cwd()` or absolute
2. Verify file exists: `ls msr.config.js`
3. Check MSR_CONFIG_FILE value: `echo $MSR_CONFIG_FILE`

---

### Invalid JSON Format

**Problem:** Warning: "Invalid MSR_LOGGING JSON" or "Invalid MSR_FILE_PATTERNS format"

**Solutions:**
1. Validate JSON syntax: Use a JSON validator
2. Escape properly in shell: Use single quotes `'{"key":"value"}'`
3. Use dot-notation instead (recommended)

**Instead of:**
```bash
export MSR_LOGGING='{"enabled":true}'  # Can be error-prone
```

**Use:**
```bash
export MSR_LOGGING_ENABLED=true  # Cleaner, less error-prone
```

---

## Complete Example

Production-ready configuration combining all approaches:

**msr.config.js:**
```javascript
module.exports = {
    folder: process.env.MSR_FOLDER || './migrations',
    tableName: process.env.MSR_TABLE_NAME || 'schema_version',
    validateBeforeRun: true,
    strictValidation: process.env.NODE_ENV === 'production',

    logging: {
        enabled: true,
        path: process.env.MSR_LOGGING_PATH || './logs'
    },

    backup: {
        folder: process.env.MSR_BACKUP_FOLDER || './backups',
        timestamp: true,
        deleteBackup: process.env.NODE_ENV === 'production'
    }
};
```

**Environment variables (.env.production):**
```bash
NODE_ENV=production
MSR_FOLDER=/app/migrations
MSR_TABLE_NAME=migration_history
MSR_LOGGING_PATH=/var/log/migrations
MSR_BACKUP_FOLDER=/var/backups/database
```

**Application code:**
```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';
import { DatabaseHandler } from './database';

const handler = new DatabaseHandler();

// Automatically loads: defaults → file → env vars
const executor = new MigrationScriptExecutor(handler);

await executor.migrate();
```

---

## Reference

- [Environment Variables Reference](../reference/environment-variables) - Complete table of all variables
- [ConfigLoader API](../api/ConfigLoader) - API documentation
- [Configuration Overview](../configuration/) - Config class documentation
- [Getting Started](../getting-started) - Quick start guide

---

## Next Steps

- [Environment Variables Reference](../reference/environment-variables) - See all available variables
- [ConfigLoader API](../api/ConfigLoader) - Advanced usage
- [Docker Deployment](../deployment/docker) - Container setup
- [CI/CD Integration](../deployment/ci-cd) - Pipeline configuration
