# Migration Script Runner

[![Build Status](https://app.travis-ci.com/vlavrynovych/msr.svg?branch=master)](https://app.travis-ci.com/vlavrynovych/msr)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/vlavrynovych/msr/tree/master.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/vlavrynovych/msr/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/vlavrynovych/msr/badge.svg?branch=master)](https://coveralls.io/github/vlavrynovych/msr?branch=master)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![GitHub issues](https://img.shields.io/github/issues/vlavrynovych/msr.svg)](https://github.com/vlavrynovych/msr/issues)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/vlavrynovych/msr/master/LICENSE)
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
![Static Badge](https://img.shields.io/badge/in%20Ukraine-dodgerblue?label=Proudly%20made&labelColor=%23FFFF00)

[//]: # ([![NPM]&#40;https://nodei.co/npm/migration-script-runner.png?downloads=true&#41;]&#40;https://nodei.co/npm/migration-script-runner/&#41;)
[//]: # ([![SonarCloud]&#40;https://sonarcloud.io/images/project_badges/sonarcloud-white.svg&#41;]&#40;https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr&#41;)

[npm-image]: https://img.shields.io/npm/v/migration-script-runner.svg?style=flat
[npm-url]: https://npmjs.org/package/migration-script-runner
[npm-downloads-image]: https://img.shields.io/npm/dm/migration-script-runner.svg?style=flat

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
npm install migration-script-runner
```

Or with yarn:

```bash
yarn add migration-script-runner
```

---

## 🚀 Quick Start

### 1. Implement Database Handler

Create a handler for your specific database:

```typescript
import { IDatabaseMigrationHandler, Config } from 'migration-script-runner';

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
import { IMigrationScript, IMigrationInfo, IDatabaseMigrationHandler } from 'migration-script-runner';

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
import { MigrationScriptExecutor } from 'migration-script-runner';
import { MyDatabaseHandler } from './my-database-handler';

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler);

await executor.migrate();
```

---

## 📚 Documentation

**[Full Documentation](https://vlavrynovych.github.io/msr/)** | **[API Reference](https://vlavrynovych.github.io/msr/api/)** | **[Examples](https://vlavrynovych.github.io/msr/guides/writing-migrations)**

### Quick Links

- **[Getting Started Guide](https://vlavrynovych.github.io/msr/getting-started)** - Complete setup walkthrough
- **[Configuration](https://vlavrynovych.github.io/msr/configuration)** - All configuration options
- **[API Reference](https://vlavrynovych.github.io/msr/api/)** - Complete API documentation
- **[Writing Migrations](https://vlavrynovych.github.io/msr/guides/writing-migrations)** - Best practices and patterns
- **[Testing](https://vlavrynovych.github.io/msr/testing/)** - Testing your migrations

---

## ⚙️ Configuration

Customize MSR behavior through the `Config` class:

```typescript
import { Config, BackupConfig } from 'migration-script-runner';

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

See the [Configuration Guide](https://vlavrynovych.github.io/msr/configuration) for all options.

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

See our [GitHub Issues](https://github.com/vlavrynovych/msr/issues) for tasks that need help.

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

For more help, check our [GitHub Issues](https://github.com/vlavrynovych/msr/issues) or create a new one.

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

- **Documentation:** https://vlavrynovych.github.io/msr/
- **Issues:** https://github.com/vlavrynovych/msr/issues
- **npm:** https://www.npmjs.com/package/migration-script-runner

---

**By [Volodymyr Lavrynovych](https://github.com/vlavrynovych)**
