# Migration Script Runner

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/migration-script-runner/msr-core/tree/master.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/migration-script-runner/msr-core/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/migration-script-runner/msr-core/badge.svg?branch=master)](https://coveralls.io/github/migration-script-runner/msr-core?branch=master)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![GitHub issues](https://img.shields.io/github/issues/migration-script-runner/msr-core.svg)](https://github.com/migration-script-runner/msr-core/issues)
[![License](https://img.shields.io/badge/license-MIT%20%2B%20CC%20%2B%20Attribution-blue.svg)](https://raw.githubusercontent.com/migration-script-runner/msr-core/master/LICENSE)
[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
![Static Badge](https://img.shields.io/badge/in%20Ukraine-dodgerblue?label=Proudly%20made&labelColor=%23FFFF00)

[npm-image]: https://img.shields.io/npm/v/@migration-script-runner/core.svg?style=flat
[npm-url]: https://npmjs.org/package/@migration-script-runner/core
[npm-downloads-image]: https://img.shields.io/npm/dm/@migration-script-runner/core.svg?style=flat

**A database-agnostic migration framework for TypeScript and JavaScript projects.**

MSR provides a lightweight, flexible framework for managing database migrations without locking you into a specific ORM or database system. Bring your own database implementation and let MSR handle the migration workflow, versioning, validation, and execution.

---

## 🎉 What's New in v0.5.0

**Production-grade transaction management and cloud-native configuration:**

- **🔒 Transaction Management** - Configurable modes (per-migration, per-batch, none) with automatic retry logic and isolation level control
- **⚙️ Environment Variables** - Complete MSR_* configuration support following 12-factor app principles for Docker, Kubernetes, and CI/CD
- **📊 Enhanced Hooks** - Transaction lifecycle hooks for monitoring and metrics collection
- **🚀 100% Backward Compatible** - Zero breaking changes from v0.4.x

**[→ View migration guide](https://migration-script-runner.github.io/msr-core/version-migration/v0.4-to-v0.5)**

---

## ✨ Features

- **🔌 Database Agnostic** - Works with any database (SQL, NoSQL, NewSQL) by implementing a simple interface
- **🛡️ Type Safe** - Full TypeScript support with complete type definitions
- **💾 Smart Rollback** - Multiple strategies: backup/restore, down() methods, both, or none
- **🔒 Transaction Control** - Configurable transaction modes with automatic retry and isolation levels (v0.5.0)
- **⚙️ Environment Variables** - Full 12-factor app configuration support with MSR_* variables (v0.5.0)
- **📊 Migration Tracking** - Maintains execution history in your database with checksums
- **✅ Built-in Validation** - Detects conflicts, missing files, and integrity issues
- **🎨 Multiple Output Formats** - ASCII tables, JSON, or silent output
- **📝 Flexible Logging** - Console, file, or custom loggers
- **🪝 Lifecycle Hooks** - Process, script, backup, and transaction lifecycle hooks (v0.5.0)
- **📦 Library-First Design** - Returns structured results, safe for web servers and long-running apps

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

```typescript
import { IDatabaseMigrationHandler, IDB, ISqlDB } from '@migration-script-runner/core';

// For SQL databases, implement ISqlDB
interface IMyDatabase extends ISqlDB {
  query(sql: string): Promise<unknown>;
}

export class MyDatabaseHandler implements IDatabaseMigrationHandler {
  db: IMyDatabase;
  schemaVersion: ISchemaVersion;
  backup?: IBackup;

  async checkConnection(): Promise<void> {
    await this.db.query('SELECT 1');
  }

  getName(): string {
    return 'My Database Handler';
  }
}
```

### 2. Create Migration Script

**TypeScript Migration:**
```typescript
// migrations/V202501280100_create_users.ts
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

export default class CreateUsers implements IRunnableScript {
  async up(db: IDB, info: IMigrationInfo): Promise<string> {
    await db.query(`
      CREATE TABLE users (
        id INT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE
      )
    `);
    return 'Users table created';
  }

  async down(db: IDB): Promise<string> {
    await db.query('DROP TABLE users');
    return 'Users table dropped';
  }
}
```

**SQL Migration:**
```sql
-- migrations/V202501280100_create_users.up.sql
CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE
);
```

### 3. Run Migrations

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { MyDatabaseHandler } from './database-handler';

const config = new Config();
config.folder = './migrations';

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor(handler, config);

// Library usage - returns structured result
const result = await executor.up();

if (result.success) {
  console.log(`✅ Executed ${result.executed.length} migrations`);
} else {
  console.error('❌ Migration failed:', result.errors);
  process.exit(1);
}
```

---

## 📚 Documentation

**[📖 Full Documentation](https://migration-script-runner.github.io/msr-core/)** - Complete guides, API reference, and examples

### Getting Started
- **[Getting Started Guide](https://migration-script-runner.github.io/msr-core/getting-started)** - Complete setup walkthrough
- **[Writing Migrations](https://migration-script-runner.github.io/msr-core/guides/writing-migrations)** - Best practices and patterns
- **[SQL Migrations](https://migration-script-runner.github.io/msr-core/guides/sql-migrations)** - Using .sql migration files
- **[Version Control](https://migration-script-runner.github.io/msr-core/guides/version-control)** - Target specific versions

### Configuration & Customization
- **[Configuration](https://migration-script-runner.github.io/msr-core/configuration/)** - Migration settings, validation, rollback strategies
- **[Custom Loggers](https://migration-script-runner.github.io/msr-core/customization/loggers/)** - Console, file, or cloud logging
- **[Render Strategies](https://migration-script-runner.github.io/msr-core/customization/render-strategies/)** - ASCII tables, JSON, or custom formats
- **[Validation](https://migration-script-runner.github.io/msr-core/customization/validation/)** - Custom validation rules

### Reference
- **[API Reference](https://migration-script-runner.github.io/msr-core/api/)** - Complete API documentation
- **[Recipes](https://migration-script-runner.github.io/msr-core/guides/recipes/)** - Common patterns (PostgreSQL, MongoDB, testing)
- **[Comparison](https://migration-script-runner.github.io/msr-core/comparison)** - Compare with other migration tools

### Upgrading
- **[Version Migration](https://migration-script-runner.github.io/msr-core/version-migration/)** - Upgrade guides between versions

---

## 🎯 Why MSR?

**Bring your own database.** MSR doesn't lock you into a specific ORM or database system. Whether you're using PostgreSQL, MongoDB, DynamoDB, or a custom database, MSR handles the migration workflow while you maintain full control.

**Perfect for:**
- 🔌 Any database system (SQL, NoSQL, NewSQL, or custom)
- 🎯 Production applications (returns structured results instead of calling `process.exit()`)
- 🛡️ Type-safe migrations with full TypeScript support
- 📦 Library or CLI usage in web servers, workers, or serverless functions
- ⚡ Flexible workflows with multiple rollback strategies and lifecycle hooks
- 🐳 Container deployments with environment variable configuration (v0.5.0)

**What makes MSR different:**
- **Library-first design** - Safe for web servers and long-running applications
- **True database agnosticism** - No SQL assumptions, works with any database
- **Production-grade transactions** - Configurable modes with automatic retry and isolation control (v0.5.0)
- **Cloud-native configuration** - Complete environment variable support for Docker/Kubernetes (v0.5.0)
- **Multiple rollback strategies** - Choose backup, down() methods, both, or none
- **SQL file support** - Use `.up.sql` and `.down.sql` files alongside TypeScript migrations
- **Well tested** - 100% code coverage with mutation testing

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](https://migration-script-runner.github.io/msr-core/development/contributing) for guidelines on code style, testing requirements, and pull request process.

See our [GitHub Issues](https://github.com/migration-script-runner/msr-core/issues) for tasks that need help.

---

## 📄 License

This project is licensed under the **MIT License with Commons Clause and Attribution Requirements**.

**Quick Summary:**
- ✅ Free to use in your applications (including commercial)
- ✅ Free to modify and contribute
- ❌ Cannot sell MSR or database adapters as standalone products
- 🔒 Database adapters require attribution

See the [LICENSE](LICENSE) file or read the [License Documentation](https://migration-script-runner.github.io/msr-core/license) for detailed examples and FAQ.

---

## 📞 Support

- **📚 Documentation:** https://migration-script-runner.github.io/msr-core/
- **🐛 Issues:** https://github.com/migration-script-runner/msr-core/issues
- **💬 Discussions:** https://github.com/migration-script-runner/msr-core/discussions
- **📦 npm:** https://www.npmjs.com/package/@migration-script-runner/core

---

**By [Volodymyr Lavrynovych](https://github.com/vlavrynovych)** • Created in Ukraine 🇺🇦
