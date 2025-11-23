# Migration Script Runner

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/migration-script-runner/msr-core/tree/master.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/migration-script-runner/msr-core/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/migration-script-runner/msr-core/badge.svg?branch=master)](https://coveralls.io/github/migration-script-runner/msr-core?branch=master)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![GitHub issues](https://img.shields.io/github/issues/migration-script-runner/msr-core.svg)](https://github.com/migration-script-runner/msr-core/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/migration-script-runner/msr-core/master/LICENSE)
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
![Static Badge](https://img.shields.io/badge/in%20Ukraine-dodgerblue?label=Proudly%20made&labelColor=%23FFFF00)

[//]: # ([![NPM]&#40;https://nodei.co/npm/@migration-script-runner/core.png?downloads=true&#41;]&#40;https://nodei.co/npm/@migration-script-runner/core/&#41;)
[//]: # ([![SonarCloud]&#40;https://sonarcloud.io/images/project_badges/sonarcloud-white.svg&#41;]&#40;https://sonarcloud.io/summary/new_code?id=migration-script-runner_msr-core&#41;)

[npm-image]: https://img.shields.io/npm/v/@migration-script-runner/core.svg?style=flat
[npm-url]: https://npmjs.org/package/@migration-script-runner/core
[npm-downloads-image]: https://img.shields.io/npm/dm/@migration-script-runner/core.svg?style=flat

**A database-agnostic migration script runner for TypeScript and JavaScript projects.**

MSR provides a lightweight, flexible framework for managing database migrations. Bring your own database implementation and let MSR handle the migration workflow, versioning, backups, and execution.

## Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
  - [1. Implement Database Handler](#1-implement-database-handler)
  - [2. Create Migration Script](#2-create-migration-script)
  - [3. Run Migrations](#3-run-migrations)
- [Documentation](#-documentation)
- [Configuration](#-configuration)
- [Usage Examples](#-usage-examples)
  - [Library Usage](#library-usage)
  - [CLI Usage](#cli-usage)
  - [List All Migrations](#list-all-migrations)
  - [Custom Migration Example](#custom-migration-example)
  - [Custom Logger](#custom-logger)
- [Why MSR?](#-why-msr)
- [Development](#-development)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)
- [Support](#-support)

---

## ✨ Features

- **🔌 Database Agnostic** - Works with any database by implementing a simple interface
- **🛡️ Type Safe** - Written in TypeScript with full type definitions
- **💾 Automatic Backups** - Built-in backup and restore on failure
- **📊 Migration Tracking** - Keeps history of executed migrations in your database
- **⚙️ Flexible Configuration** - Customize paths, patterns, and backup behavior
- **🎨 Multiple Output Formats** - ASCII tables, JSON, or silent output via Strategy Pattern
- **📝 Custom Logging** - Pluggable logger interface for console, file, or cloud logging
- **✅ Well Tested** - 330 tests with 100% code coverage and mutation testing

---

## 📦 Installation

```bash
npm install @migration-script-runner/core
```

Or with yarn:

```bash
yarn add @migration-script-runner/core
```

---

## 🚀 Quick Start

### 1. Implement Database Handler

Create a handler for your specific database:

```typescript
import { IDatabaseMigrationHandler, IDB, Config } from '@migration-script-runner/core';

// Define your database type
interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  transaction(callback: (client: IMyDatabase) => Promise<void>): Promise<void>;
}

export class MyDatabaseHandler implements IDatabaseMigrationHandler {
  cfg: Config;
  db: IMyDatabase; // Your database connection
  schemaVersion: any; // Schema version tracker
  backup: any; // Backup handler

  constructor(config: Config) {
    this.cfg = config;
    // Initialize your database connection and handlers
  }

  getName(): string {
    return 'My Database Handler v1.0';
  }
}
```

### 2. Create Migration Script

Create a migration file following the naming pattern: `V{timestamp}_{description}.ts`

```typescript
// migrations/V202501220100_initial_setup.ts
import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from '@migration-script-runner/core';

// Define your database type (can be shared across migrations)
interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export default class InitialSetup implements IRunnableScript {
  async up(db: IMyDatabase, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    // Your migration logic - now with type safety!
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created successfully';
  }
}
```

### 3. Run Migrations

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';
import { MyDatabaseHandler } from './my-database-handler';

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler);

// As a library - returns result object
const result = await executor.migrate();
if (result.success) {
  console.log(`Successfully executed ${result.executed.length} migrations`);
} else {
  console.error('Migration failed:', result.errors);
}

// As a CLI - control process exit
process.exit(result.success ? 0 : 1);
```

---

## 📚 Documentation

**[Full Documentation](https://migration-script-runner.github.io/msr-core/)** | **[API Reference](https://migration-script-runner.github.io/msr-core/api/)** | **[Examples](https://migration-script-runner.github.io/msr-core/guides/writing-migrations)**

### Quick Links

- **[Getting Started Guide](https://migration-script-runner.github.io/msr-core/getting-started)** - Complete setup walkthrough
- **[Configuration](https://migration-script-runner.github.io/msr-core/configuration)** - All configuration options
- **[API Reference](https://migration-script-runner.github.io/msr-core/api/)** - Complete API documentation
- **[Writing Migrations](https://migration-script-runner.github.io/msr-core/guides/writing-migrations)** - Best practices and patterns
- **[Custom Logging](https://migration-script-runner.github.io/msr-core/guides/custom-logging)** - Customize logging behavior
- **[Testing](https://migration-script-runner.github.io/msr-core/testing/)** - Testing your migrations

---

## ⚙️ Configuration

Customize MSR behavior through the `Config` class:

```typescript
import { Config, BackupConfig } from '@migration-script-runner/core';

const config = new Config();

// Migration settings
config.folder = './database/migrations';
config.filePattern = /^V(\d+)_(.+)\.ts$/;
config.tableName = 'schema_version';
config.displayLimit = 10; // Show last 10 migrations

// Backup settings
config.backup = new BackupConfig();
config.backup.folder = './backups';
config.backup.deleteBackup = true;
config.backup.timestamp = true;
```

See the [Configuration Guide](https://migration-script-runner.github.io/msr-core/configuration) for all options.

---

## 💡 Usage Examples

### Library Usage (Recommended)

MSR can be used as a library in your application without terminating the process:

```typescript
import { MigrationScriptExecutor, IMigrationResult } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor(handler);
const result: IMigrationResult = await executor.migrate();

if (result.success) {
  console.log(`✅ Executed ${result.executed.length} migrations`);
  console.log(`📋 Total migrated: ${result.migrated.length}`);
  // Continue with application startup
  startServer();
} else {
  console.error('❌ Migration failed:', result.errors);
  // Handle error gracefully
  await sendAlert(result.errors);
  process.exit(1);
}
```

### CLI Usage

For CLI tools, control the process exit based on the result:

```typescript
const executor = new MigrationScriptExecutor(handler);
const result = await executor.migrate();
process.exit(result.success ? 0 : 1);
```

### List All Migrations

```typescript
await executor.list();        // Show all migrations
await executor.list(10);      // Show last 10 migrations
```

### Custom Migration Example

```typescript
// V202501220200_add_posts_table.ts
import { IRunnableScript, IDB } from '@migration-script-runner/core';

interface IMyDatabase extends IDB {
  query(sql: string): Promise<unknown[]>;
}

export default class AddPostsTable implements IRunnableScript {
  async up(db: IMyDatabase): Promise<string> {
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

    await db.query('CREATE INDEX idx_user_id ON posts(user_id)');

    return 'Posts table and index created';
  }
}
```

### Custom Logger

MSR provides flexible logging through the `ILogger` interface with three built-in implementations:

**Built-in Loggers:**
- **[ConsoleLogger](https://migration-script-runner.github.io/msr-core/loggers/console-logger)** (default) - Output to console for development
- **[SilentLogger](https://migration-script-runner.github.io/msr-core/loggers/silent-logger)** - Suppress all output for testing
- **[FileLogger](https://migration-script-runner.github.io/msr-core/loggers/file-logger)** - Write to files with automatic rotation for production

**Quick Example:**

```typescript
import { MigrationService, FileLogger } from '@migration-script-runner/core';

// Production logging with file rotation
const logger = new FileLogger({
    logPath: '/var/log/migrations.log',
    maxFileSize: 10 * 1024 * 1024,  // 10MB
    maxFiles: 10
});

const service = new MigrationService(logger);
await service.executeMigrations(config);
```

📖 **Documentation:**
- [Logger Implementations](https://migration-script-runner.github.io/msr-core/loggers) - Detailed guides for each logger
- [Custom Logging Guide](https://migration-script-runner.github.io/msr-core/guides/custom-logging) - Create your own loggers for cloud services, custom formatting, etc.

### Custom Output Formats

MSR uses the Strategy Pattern to support multiple output formats through render strategies:

**Built-in Render Strategies:**
- **[AsciiTableRenderStrategy](https://migration-script-runner.github.io/msr-core/rendering/ascii-table-strategy)** (default) - Beautiful ASCII tables for terminal output
- **[JsonRenderStrategy](https://migration-script-runner.github.io/msr-core/rendering/json-strategy)** - Structured JSON for CI/CD integration and log aggregation
- **[SilentRenderStrategy](https://migration-script-runner.github.io/msr-core/rendering/silent-strategy)** - No output for testing and library usage

**Quick Examples:**

```typescript
import {
    MigrationScriptExecutor,
    JsonRenderStrategy,
    SilentRenderStrategy
} from '@migration-script-runner/core';

// JSON output for CI/CD pipelines
const executor = new MigrationScriptExecutor(handler, {
    renderStrategy: new JsonRenderStrategy(true)  // pretty: true
});

// Compact JSON for log aggregation
const executor = new MigrationScriptExecutor(handler, {
    renderStrategy: new JsonRenderStrategy(false)  // pretty: false
});

// Silent output for testing
const executor = new MigrationScriptExecutor(handler, {
    renderStrategy: new SilentRenderStrategy()
});

// Default ASCII tables (no configuration needed)
const executor = new MigrationScriptExecutor(handler);
```

**JSON Output Example:**
```json
{
  "migrated": [
    {
      "timestamp": 202501220100,
      "name": "add_users_table",
      "executed": "2025-01-22T01:00:00.000Z",
      "executedAgo": "2 hours ago",
      "duration": 2.5,
      "username": "admin",
      "foundLocally": true
    }
  ]
}
```

📖 **Documentation:**
- [Render Strategies Guide](https://migration-script-runner.github.io/msr-core/rendering) - Detailed guide for each strategy
- [Custom Render Strategy](https://migration-script-runner.github.io/msr-core/guides/custom-rendering) - Create your own output formats

---

## 🎯 Why MSR?

Migration Script Runner was created to solve migration challenges when:

- ✅ Working with new or uncommon database systems
- ✅ Public migration libraries are not yet available
- ✅ You need full control over the migration process
- ✅ You want a lightweight, database-agnostic solution
- ✅ You prefer TypeScript and type safety
- ✅ You need to integrate migrations into larger applications (Express, NestJS, etc.)
- ✅ You want structured error handling and migration results

Unlike framework-specific migration tools, MSR doesn't lock you into a particular ORM or database. You implement the database interface, MSR handles the workflow.

**Library-first design:** MSR returns structured results instead of calling `process.exit()`, making it safe to use in web servers, background workers, and any long-running applications.

---

## 🔧 Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test                    # Run linter and all tests
npm run test:unit           # Run unit tests only
npm run test:integration    # Run integration tests only
npm run test:coverage       # Generate coverage report
npm run test:mutation       # Run mutation tests (slow)
```

### Watch Mode

```bash
npm run test:watch          # Re-run tests on file changes
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Write tests** for your changes
4. **Ensure all tests pass** (`npm test`)
5. **Commit your changes** (`git commit -m 'Add amazing feature'`)
6. **Push to your branch** (`git push origin feature/amazing-feature`)
7. **Open a Pull Request**

### Development Guidelines

- Maintain 100% test coverage
- Follow existing code style (enforced by ESLint)
- Add JSDoc comments for public APIs
- Update documentation for user-facing changes
- Write descriptive commit messages

See our [GitHub Issues](https://github.com/migration-script-runner/msr-core/issues) for tasks that need help.

---

## 🐛 Troubleshooting

### Migration files not found

**Problem:** "Migration scripts folder is empty"

**Solution:** Check your `config.folder` path and ensure files match `config.filePattern`:

```typescript
config.folder = './migrations';  // Must exist and contain migration files
config.filePattern = /^V(\d+)_(.+)\.ts$/;  // Must match your naming
```

### TypeScript compilation issues

**Problem:** "Cannot find module" errors

**Solution:** Install `ts-node` for development:

```bash
npm install --save-dev ts-node
```

### Database connection errors

**Problem:** Migrations fail to connect to database

**Solution:** Verify your database handler's `init()` method establishes a connection:

```typescript
async init(): Promise<void> {
  await this.db.connect();  // Ensure connection is established
  await this.createSchemaVersionTable();
}
```

### Backup/restore failures

**Problem:** "Cannot restore from backup"

**Solution:** Ensure your backup handler serializes/deserializes correctly:

```typescript
async backup(): Promise<string> {
  const data = await this.captureState();
  return JSON.stringify(data);  // Must return serialized string
}

async restore(data: string): Promise<void> {
  const state = JSON.parse(data);
  await this.restoreState(state);
}
```

For more help, check our [GitHub Issues](https://github.com/migration-script-runner/msr-core/issues) or create a new one.

---

## 📋 FAQ

**Q: Can I use MSR with [my database]?**
A: Yes! MSR is database-agnostic. Implement the `IDatabaseMigrationHandler` interface for your database.

**Q: Does MSR support rollback/down migrations?**
A: MSR focuses on forward-only migrations with automatic backup/restore on failure. This approach is simpler and safer for production environments.

**Q: Can I use JavaScript instead of TypeScript?**
A: Yes, but TypeScript is recommended for better type safety and IDE support.

**Q: How do I handle long-running migrations?**
A: Add progress logging in your migration's `up()` method and consider batching large operations.

**Q: Can I run migrations in CI/CD?**
A: Yes! MSR works great in CI/CD pipelines. Exit codes indicate success (0) or failure (1).

**Q: What happens if a migration fails?**
A: MSR automatically restores the database from the backup created before migrations started.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🌟 Acknowledgments

Created in Ukraine 🇺🇦

- Built with [TypeScript](https://www.typescriptlang.org/)
- Tested with [Mocha](https://mochajs.org/) and [Chai](https://www.chaijs.com/)
- Mutation tested with [Stryker](https://stryker-mutator.io/)

---

## 📞 Support

- **Documentation:** https://migration-script-runner.github.io/msr-core/
- **Issues:** https://github.com/migration-script-runner/msr-core/issues
- **npm:** https://www.npmjs.com/package/@migration-script-runner/core

---

**By [Volodymyr Lavrynovych](https://github.com/vlavrynovych)**
