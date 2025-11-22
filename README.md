# Migration Script Runner

[![Build Status](https://app.travis-ci.com/migration-script-runner/msr-core.svg?branch=master)](https://app.travis-ci.com/migration-script-runner/msr-core)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/migration-script-runner/msr-core/tree/master.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/migration-script-runner/msr-core/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/migration-script-runner/msr-core/badge.svg?branch=master)](https://coveralls.io/github/migration-script-runner/msr-core?branch=master)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=migration-script-runner_msr-core&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=migration-script-runner_msr-core)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=migration-script-runner_msr-core&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=migration-script-runner_msr-core)
[![GitHub issues](https://img.shields.io/github/issues/migration-script-runner/msr-core.svg)](https://github.com/migration-script-runner/msr-core/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/migration-script-runner/msr-core/master/LICENSE)
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
![Static Badge](https://img.shields.io/badge/in%20Ukraine-dodgerblue?label=Proudly%20made&labelColor=%23FFFF00)

[//]: # ([![NPM]&#40;https://nodei.co/npm/@msr/core.png?downloads=true&#41;]&#40;https://nodei.co/npm/@msr/core/&#41;)
[//]: # ([![SonarCloud]&#40;https://sonarcloud.io/images/project_badges/sonarcloud-white.svg&#41;]&#40;https://sonarcloud.io/summary/new_code?id=migration-script-runner_msr-core&#41;)

[npm-image]: https://img.shields.io/npm/v/@msr/core.svg?style=flat
[npm-url]: https://npmjs.org/package/@msr/core
[npm-downloads-image]: https://img.shields.io/npm/dm/@msr/core.svg?style=flat

**A database-agnostic migration script runner for TypeScript and JavaScript projects.**

MSR provides a lightweight, flexible framework for managing database migrations. Bring your own database implementation and let MSR handle the migration workflow, versioning, backups, and execution.

## Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Configuration](#-configuration)
- [Usage Examples](#-usage-examples)
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
- **🎨 Beautiful Output** - Color-coded console tables and status information
- **✅ Well Tested** - 132 tests with 100% code coverage and mutation testing

---

## 📦 Installation

```bash
npm install @msr/core
```

Or with yarn:

```bash
yarn add @msr/core
```

---

## 🚀 Quick Start

### 1. Implement Database Handler

Create a handler for your specific database:

```typescript
import { IDatabaseMigrationHandler, Config } from '@msr/core';

export class MyDatabaseHandler implements IDatabaseMigrationHandler {
  cfg: Config;
  db: any; // Your database connection
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
import { IMigrationScript, IMigrationInfo, IDatabaseMigrationHandler } from '@msr/core';

export default class InitialSetup implements IMigrationScript {
  async up(db: any, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    // Your migration logic
    await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
    return 'Users table created successfully';
  }
}
```

### 3. Run Migrations

```typescript
import { MigrationScriptExecutor } from '@msr/core';
import { MyDatabaseHandler } from './my-database-handler';

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler);

await executor.migrate();
```

---

## 📚 Documentation

**[Full Documentation](https://migration-script-runner.github.io/msr-core/)** | **[API Reference](https://migration-script-runner.github.io/msr-core/api/)** | **[Examples](https://migration-script-runner.github.io/msr-core/guides/writing-migrations)**

### Quick Links

- **[Getting Started Guide](https://migration-script-runner.github.io/msr-core/getting-started)** - Complete setup walkthrough
- **[Configuration](https://migration-script-runner.github.io/msr-core/configuration)** - All configuration options
- **[API Reference](https://migration-script-runner.github.io/msr-core/api/)** - Complete API documentation
- **[Writing Migrations](https://migration-script-runner.github.io/msr-core/guides/writing-migrations)** - Best practices and patterns
- **[Testing](https://migration-script-runner.github.io/msr-core/testing/)** - Testing your migrations

---

## ⚙️ Configuration

Customize MSR behavior through the `Config` class:

```typescript
import { Config, BackupConfig } from '@msr/core';

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

### Run All Pending Migrations

```typescript
const executor = new MigrationScriptExecutor(handler);
await executor.migrate();
```

### List All Migrations

```typescript
await executor.list();        // Show all migrations
await executor.list(10);      // Show last 10 migrations
```

### Custom Migration Example

```typescript
// V202501220200_add_posts_table.ts
export default class AddPostsTable implements IMigrationScript {
  async up(db: any): Promise<string> {
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

---

## 🎯 Why MSR?

Migration Script Runner was created to solve migration challenges when:

- ✅ Working with new or uncommon database systems
- ✅ Public migration libraries are not yet available
- ✅ You need full control over the migration process
- ✅ You want a lightweight, database-agnostic solution
- ✅ You prefer TypeScript and type safety

Unlike framework-specific migration tools, MSR doesn't lock you into a particular ORM or database. You implement the database interface, MSR handles the workflow.

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
- **npm:** https://www.npmjs.com/package/@msr/core

---

**By [Volodymyr Lavrynovych](https://github.com/vlavrynovych)**
