---
layout: default
title: Home
nav_order: 1
description: "Migration Script Runner - Abstract database migration script runner for TypeScript/JavaScript"
permalink: /
---

# Migration Script Runner
{: .fs-9 }

An abstract implementation of script runner which can be extended with your own database implementation.
{: .fs-6 .fw-300 }

[Get started now](getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/vlavrynovych/msr){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Features

- **Database Agnostic**: Works with any database by implementing a simple interface
- **TypeScript First**: Written in TypeScript with full type safety
- **Automatic Backups**: Built-in backup and restore functionality
- **Migration Tracking**: Keeps track of executed migrations in your database
- **Flexible Configuration**: Customize paths, patterns, and backup behavior
- **Console Rendering**: Beautiful console output with tables and status information

---

## Quick Start

### Installation

```bash
npm install migration-script-runner
```

### Basic Usage

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';

// Implement your database handler
class MyDatabaseHandler implements IDatabaseMigrationHandler {
  // ... implement required methods
}

// Configure and run
const config = new Config();
const executor = new MigrationScriptExecutor(config, new MyDatabaseHandler());

await executor.migrate();
```

---

## Why MSR?

Migration Script Runner was created to solve migration problems when:
- Working with new or uncommon database systems
- Public migration libraries are not yet available
- You need full control over the migration process
- You want a lightweight, database-agnostic solution

---

## Project Status

[![Build Status](https://app.travis-ci.com/vlavrynovych/msr.svg?branch=master)](https://app.travis-ci.com/vlavrynovych/msr)
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/vlavrynovych/msr/tree/master.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/vlavrynovych/msr/tree/master)
[![Coverage Status](https://coveralls.io/repos/github/vlavrynovych/msr/badge.svg?branch=master)](https://coveralls.io/github/vlavrynovych/msr?branch=master)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=vlavrynovych_msr&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=vlavrynovych_msr)
[![NPM Version](https://img.shields.io/npm/v/migration-script-runner.svg?style=flat)](https://npmjs.org/package/migration-script-runner)
[![NPM Downloads](https://img.shields.io/npm/dm/migration-script-runner.svg?style=flat)](https://npmjs.org/package/migration-script-runner)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/vlavrynovych/msr/master/LICENSE)

---

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/vlavrynovych/msr/blob/master/LICENSE) file for details.

---

{: .text-center }
![Made in Ukraine](https://img.shields.io/badge/in%20Ukraine-dodgerblue?label=Proudly%20made&labelColor=%23FFFF00)
