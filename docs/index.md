---
layout: default
title: Home
nav_order: 1
description: "Migration Script Runner - A database-agnostic migration framework for TypeScript and JavaScript"
permalink: /
---

<h1 style="display: flex; align-items: center; gap: 15px;">
  <img src="https://avatars.githubusercontent.com/u/150583924?s=200&v=4" alt="Migration Script Runner Logo" width="60" height="60" style="border: 2px solid #4b4cd4; border-radius: 8px;">
  <span>Migration Script Runner</span>
</h1>
{: .fs-9 }

A database-agnostic migration framework for TypeScript and JavaScript projects.
{: .fs-6 .fw-300 }

[Get started now](getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View all features](features){: .btn .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/migration-script-runner/msr-core){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Why MSR?

**Bring your own database.** MSR provides a lightweight, flexible framework for managing database migrations without locking you into a specific ORM or database system. Whether you're using PostgreSQL, MongoDB, DynamoDB, or a custom database, MSR handles the migration workflow while you maintain full control over your database operations.

### Perfect for

- 🔌 **Any database system** - SQL, NoSQL, NewSQL, or custom databases
- 🎯 **Production applications** - Returns structured results instead of calling `process.exit()`
- 🛡️ **Type-safe migrations** - Full TypeScript support with type definitions
- 📦 **Library or CLI** - Use as a library in your app or run from command line
- ⚡ **Flexible workflows** - Multiple rollback strategies, validation, and hooks

---

## Key Features

### Core Capabilities

- **🔌 Database Agnostic** - Works with any database by implementing a simple interface
- **🛡️ Type Safe** - Generic type parameters for database-specific type safety (v0.6.0+)
- **💡 Full IDE Support** - Complete autocomplete for database-specific methods with generics
- **💾 Smart Rollback** - Four strategies: backup/restore, down() methods, both, or none
- **✅ Built-in Validation** - Detects duplicate timestamps, missing files, and checksum mismatches
- **📊 Migration Tracking** - Keeps history of executed migrations in your database

### Developer Experience

- **🎨 Multiple Output Formats** - ASCII tables, JSON, or silent output via Strategy Pattern
- **📝 Flexible Logging** - Built-in loggers (Console, File, Silent) or bring your own
- **🪝 Lifecycle Hooks** - Extend behavior with beforeMigrate and custom hooks
- **🎯 Version Control** - Target specific versions with `up(targetVersion)` and `down(targetVersion)`
- **🔒 Transaction Control** - Configurable transaction modes with automatic retry and isolation levels
- **⚙️ Environment Variables** - Full 12-factor app configuration support with MSR_* variables
- **✅ Well Tested** - 100% code coverage with mutation testing

**[→ View all features](features)** - Complete feature list with detailed descriptions
{: .fs-5 }

---

## What's New in v0.6.0

🎉 Latest release brings database-specific type safety:

- **🎯 Generic Type Parameters** - Full type safety for database-specific operations with `IDatabaseMigrationHandler<DB>`, `IRunnableScript<DB>`, and `MigrationScriptExecutor<DB>`
- **💡 Enhanced IDE Support** - Full autocomplete and IntelliSense for database-specific methods (no more `as any` casting!)
- **🛡️ Compile-Time Validation** - Catch database errors at compile time, not runtime
- **🔍 Enhanced Type Guards** - Type-preserving `isImperativeTransactional<DB>()` and `isCallbackTransactional<DB, TxContext>()` functions
- **🚀 Zero Breaking Changes** - 100% backward compatible with v0.5.x, default generics maintain existing behavior

**[→ View v0.6.0 migration guide](version-migration/v0.5-to-v0.6)** | **[→ See full changelog](features#feature-highlights-by-version)**
{: .fs-5 }

---

## Quick Start

### Installation

```bash
npm install @migration-script-runner/core
```

### 1. Implement Database Handler

```typescript
import { IDatabaseMigrationHandler, IDB, ISchemaVersion } from '@migration-script-runner/core';

// Define your database type for full type safety (v0.6.0+)
interface IMyDatabase extends IDB {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export class MyDatabaseHandler implements IDatabaseMigrationHandler<IMyDatabase> {
  db: IMyDatabase;  // ✅ Typed database connection
  schemaVersion: ISchemaVersion<IMyDatabase>;

  getName(): string {
    return 'My Database Handler';
  }

  getVersion(): string {
    return '1.0.0';
  }

  // Implement schema version tracking and optionally backup
}
```

### 2. Create Migration Script

```typescript
// migrations/V202501280100_create_users.ts
import { IRunnableScript, IMigrationInfo, IDB } from '@migration-script-runner/core';

interface IMyDatabase extends IDB {
  query(sql: string): Promise<unknown[]>;
}

export default class CreateUsers implements IRunnableScript<IMyDatabase> {
  async up(db: IMyDatabase, info: IMigrationInfo): Promise<string> {
    // ✅ Full autocomplete for db.query() - no casting needed!
    await db.query(`
      CREATE TABLE users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255)
      )
    `);
    return 'Users table created';
  }

  async down(db: IMyDatabase): Promise<string> {
    await db.query('DROP TABLE users');
    return 'Users table dropped';
  }
}
```

### 3. Run Migrations

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';
import { MyDatabaseHandler, IMyDatabase } from './database-handler';

const config = new Config();
config.folder = './migrations';

const handler = new MyDatabaseHandler();
const executor = new MigrationScriptExecutor<IMyDatabase>({ handler }, config);

// Library usage - returns result object
const result = await executor.up();

if (result.success) {
  console.log(`✅ Executed ${result.executed.length} migrations`);
} else {
  console.error('❌ Migration failed:', result.errors);
  process.exit(1);
}
```

---

## Documentation

### Getting Started

- **[Getting Started](getting-started)** - Installation, basic usage, and quick start
- **[Guides](guides/)** - Comprehensive guides and practical examples

### Reference

- **[API Reference](api/)** - Complete API documentation for all classes and interfaces
- **[Configuration](configuration/)** - Migration, validation, rollback, and backup settings

### Advanced

- **[Extending MSR](customization/)** - Extend MSR with custom loggers, renderers, and validators
- **[Architecture](development/architecture/)** - System design, components, and data flow

### Project

- **[Version Migration](version-migration/)** - Upgrade guides for migrating between MSR versions
- **[Development](development/)** - Contributing, testing, and development workflow

---

## What Makes MSR Different?

### Library-First Design

Unlike most migration tools, MSR returns structured results instead of calling `process.exit()`. This makes it safe to use in:
- Web servers (Express, Fastify, NestJS)
- Background workers
- Serverless functions
- Any long-running application

### True Database Agnosticism

MSR doesn't assume SQL or any specific database system. Use it with:
- **SQL databases**: PostgreSQL, MySQL, SQLite
- **NoSQL databases**: MongoDB, DynamoDB, Cassandra
- **NewSQL databases**: CockroachDB, TiDB
- **Custom systems**: Your proprietary database or data store

### Flexible Rollback Strategies

Choose the right rollback strategy for your needs:
- **BACKUP** - Automatic backup and restore (default, safest)
- **DOWN** - Execute down() methods for rollback
- **BOTH** - Try down() first, fallback to backup
- **NONE** - No rollback (for append-only systems)

---

## Project Status

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/migration-script-runner/msr-core/tree/master.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/migration-script-runner/msr-core/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/migration-script-runner/msr-core/badge.svg?branch=master)](https://coveralls.io/github/migration-script-runner/msr-core?branch=master)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![GitHub issues](https://img.shields.io/github/issues/migration-script-runner/msr-core.svg)](https://github.com/migration-script-runner/msr-core/issues)
[![License](https://img.shields.io/badge/license-MIT%20%2B%20CC%20%2B%20Attribution-blue.svg)](license)
[![NPM Version](https://img.shields.io/npm/v/@migration-script-runner/core.svg?style=flat)](https://npmjs.org/package/@migration-script-runner/core)
[![NPM Downloads](https://img.shields.io/npm/dm/@migration-script-runner/core.svg?style=flat)](https://npmjs.org/package/@migration-script-runner/core)

---

## Community & Support

- **📚 Documentation**: [Full documentation site](https://migration-script-runner.github.io/msr-core/)
- **🐛 Issues**: [GitHub Issues](https://github.com/migration-script-runner/msr-core/issues)
- **📦 npm**: [@migration-script-runner/core](https://www.npmjs.com/package/@migration-script-runner/core)
- **💬 Discussions**: [GitHub Discussions](https://github.com/migration-script-runner/msr-core/discussions)

---

## License

This project is licensed under the **MIT License with Commons Clause and Attribution Requirements**.

**Quick Summary:**
- ✅ **Free to use** in your applications and products
- ✅ **Free to modify** and contribute
- ❌ **Cannot sell** MSR or adapters as standalone products
- 🔒 **Attribution required** for database adapters and extensions

[Read the full license documentation](license) for detailed examples and FAQ.

---

{: .text-center }
![Made in Ukraine](https://img.shields.io/badge/in%20Ukraine-dodgerblue?label=Proudly%20made&labelColor=%23FFFF00)
