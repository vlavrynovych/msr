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

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 32px 0;">

  <div style="background: #e8eaf6; padding: 24px; border-radius: 8px; border-left: 4px solid #5c6bc0;">
    <div style="display: flex; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px; line-height: 1;">🔌</span>
      <div>
        <h3 style="color: #3f51b5; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Database Agnostic</h3>
        <p style="color: #9e9e9e; font-size: 12px; margin: 0;">Bring your own database</p>
      </div>
    </div>
    <p style="color: #5f6368; line-height: 1.6; margin: 0; font-size: 14px;">Works with any database system - SQL, NoSQL, NewSQL, or custom. Implement a simple interface and MSR handles the rest.</p>
  </div>

  <div style="background: #fce4ec; padding: 24px; border-radius: 8px; border-left: 4px solid #ec407a;">
    <div style="display: flex; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px; line-height: 1;">🛡️</span>
      <div>
        <h3 style="color: #c2185b; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Type Safe</h3>
        <p style="color: #9e9e9e; font-size: 12px; margin: 0;">Full TypeScript support</p>
      </div>
    </div>
    <p style="color: #5f6368; line-height: 1.6; margin: 0; font-size: 14px;">Generic type parameters provide database-specific type safety with full IDE autocomplete. Catch errors at compile time, not runtime.</p>
  </div>

  <div style="background: #e1f5fe; padding: 24px; border-radius: 8px; border-left: 4px solid #29b6f6;">
    <div style="display: flex; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px; line-height: 1;">💾</span>
      <div>
        <h3 style="color: #0277bd; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Smart Rollback</h3>
        <p style="color: #9e9e9e; font-size: 12px; margin: 0;">4 strategies for every scenario</p>
      </div>
    </div>
    <p style="color: #5f6368; line-height: 1.6; margin: 0; font-size: 14px;">Four rollback strategies: automatic backup/restore, down() methods, both, or none. Choose what fits your database best.</p>
  </div>

  <div style="background: #e8f5e9; padding: 24px; border-radius: 8px; border-left: 4px solid #66bb6a;">
    <div style="display: flex; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px; line-height: 1;">✅</span>
      <div>
        <h3 style="color: #2e7d32; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Built-in Validation</h3>
        <p style="color: #9e9e9e; font-size: 12px; margin: 0;">Prevent errors before they happen</p>
      </div>
    </div>
    <p style="color: #5f6368; line-height: 1.6; margin: 0; font-size: 14px;">Automatically detects duplicate timestamps, missing files, and checksum mismatches before migrations run.</p>
  </div>

  <div style="background: #fff3e0; padding: 24px; border-radius: 8px; border-left: 4px solid #ffa726;">
    <div style="display: flex; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px; line-height: 1;">🎯</span>
      <div>
        <h3 style="color: #e65100; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Production Ready</h3>
        <p style="color: #9e9e9e; font-size: 12px; margin: 0;">Library-first design</p>
      </div>
    </div>
    <p style="color: #5f6368; line-height: 1.6; margin: 0; font-size: 14px;">Returns structured results instead of process.exit(). Safe for web servers, workers, and any long-running application.</p>
  </div>

  <div style="background: #f3e5f5; padding: 24px; border-radius: 8px; border-left: 4px solid #ab47bc;">
    <div style="display: flex; gap: 12px; margin-bottom: 12px;">
      <span style="font-size: 32px; line-height: 1;">🪝</span>
      <div>
        <h3 style="color: #6a1b9a; font-size: 20px; font-weight: 600; margin: 0 0 4px 0;">Extensible</h3>
        <p style="color: #9e9e9e; font-size: 12px; margin: 0;">Customize everything</p>
      </div>
    </div>
    <p style="color: #5f6368; line-height: 1.6; margin: 0; font-size: 14px;">Lifecycle hooks, custom loggers, output renderers, and validators. Extend MSR to match your workflow perfectly.</p>
  </div>

</div>

**[→ View all features](features)** - Complete feature list with detailed descriptions
{: .fs-5 }

---

## What's New in v0.7.0

🎉 Latest release brings CLI factory and improved architecture:

- **🖥️ CLI Factory** - Create command-line interfaces with built-in commands (migrate, list, down, validate, backup) using Commander.js - see [CLI Adapter Development Guide](guides/cli-adapter-development)
- **🎨 Facade Pattern** - Services grouped into logical facades (core, execution, output, orchestration) for better code organization
- **🏭 Factory Pattern** - Dedicated service initialization reduces constructor complexity by 83%
- **🔧 Protected Facades** - Adapters can extend MigrationScriptExecutor and access internal services through protected facades
- **✨ Extensible Configuration** - IConfigLoader interface allows custom environment variable handling
- **🔨 Breaking Changes** - Constructor signature changed (config moved to dependencies object)

**[→ View v0.6.x → v0.7.0 migration guide](version-migration/v0.6-to-v0.7)** | **[→ See full changelog](features#feature-highlights-by-version)**
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
const executor = new MigrationScriptExecutor<IMyDatabase>({ handler , config });

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

### Production Deployment

- **[CLI vs API Usage](guides/cli-vs-api)** - When to use command-line vs programmatic approach
- **[Production Deployment](guides/production-deployment)** - Security best practices and platform-specific patterns
- **[CI/CD Integration](guides/ci-cd-integration)** - GitHub Actions, GitLab, Jenkins, and more
- **[Docker & Kubernetes](guides/docker-kubernetes)** - Container orchestration and deployment patterns

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
