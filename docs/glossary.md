---
layout: default
title: Glossary
nav_order: 9
---

# Glossary
{: .no_toc }

Common terms and concepts used in Migration Script Runner.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## B

### Backup
A snapshot of the database state created before running migrations. Used to restore the database if migrations fail. See [Backup Settings](configuration/backup-settings).

### beforeMigrate
A special migration script that runs before MSR scans for pending migrations. Used for one-time setup tasks like loading snapshots or creating extensions. See [Writing Migrations](user-guides/writing-migrations#special-beforemigrate-setup-script).

---

## C

### Checksum
A hash value calculated from migration file contents. Used to detect if a migration file has been modified after execution, ensuring migration integrity.

### Config
The configuration class that controls MSR behavior including migration folder, backup settings, rollback strategy, and display options. See [Configuration](configuration/).

### ConsoleLogger
The default logger that outputs messages to the terminal using standard console methods. See [Loggers](customization/loggers/).

---

## D

### Database Handler
An implementation of `IDatabaseMigrationHandler` that provides database-specific operations. Must implement database connection, backup/restore, and schema version tracking.

### down() Method
An optional method in migration scripts that reverses the changes made by `up()`. Required when using `RollbackStrategy.DOWN` or `RollbackStrategy.BOTH`. See [Writing Migrations](user-guides/writing-migrations#writing-reversible-migrations).

### down(targetVersion)
An executor method that rolls back migrations, optionally to a specific target version. When given a version number, it calls migration `down()` methods in reverse chronological order until reaching that version. See [Version Control](user-guides/version-control#rolling-back-to-a-specific-version).

---

## H

### Handler
Short for Database Handler. See [Database Handler](#database-handler).

### Hooks
Lifecycle callbacks that execute at specific points during migration execution. Allows custom logic for events like `onBeforeMigrate`, `onAfterMigrate`, `onBeforeRestore`, etc.

---

## I

### IBackup
Interface for backup and restore operations. Requires `backup()` and `restore()` methods.

### IDB
Minimal base interface for database connections. Intentionally flexible to support any database type.

### IDatabaseMigrationHandler
The main interface that database handlers must implement. Includes database connection (`db`), backup operations (`backup`), and schema version tracking (`schemaVersion`).

### ILogger
Interface for logging implementations. Supports different log levels (debug, info, warn, error).

### IMigrationInfo
Metadata object passed to migration scripts containing timestamp, name, checksum, username, and execution times.

### IRenderStrategy
Interface for output formatting strategies. Implementations include ASCII tables, JSON, and silent output.

### IRunnableScript
Interface that all migration scripts must implement. Requires an `up()` method and optionally a `down()` method.

### ISchemaVersion
Interface for tracking executed migrations in the database. Provides methods to initialize, list, add, and remove migration records.

---

## M

### Migration
A database change script that modifies schema or data. Contains an `up()` method to apply changes and optionally a `down()` method to revert them.

### Migration Script
A TypeScript or JavaScript file implementing `IRunnableScript`. File names must follow the `V{timestamp}_{description}` pattern.

### Migration Handler
See [Database Handler](#database-handler).

### MigrationScriptExecutor
The main class for executing migrations. Orchestrates scanning, validation, execution, and rollback operations.

### up(targetVersion)
An executor method that executes migrations up to and including a specific target version. Enables staged deployments and controlled rollouts. See [Version Control](user-guides/version-control#migrating-to-a-specific-version).

---

## P

### Pending Migrations
Migrations that have been discovered but not yet executed. Previously called "todo migrations" in versions before v0.3.0.

---

## R

### Render Strategy
An implementation of `IRenderStrategy` that formats migration output. Built-in strategies include ASCII tables, JSON, and silent. See [Render Strategies](customization/render-strategies/).

### Rollback
The process of reverting database changes after a failed migration. Behavior depends on the configured `RollbackStrategy`.

### RollbackStrategy
Determines how migrations are rolled back on failure. Options:
- `BACKUP` - Restore from database backup
- `DOWN` - Call down() methods in reverse
- `BOTH` - Try down() first, fallback to backup
- `NONE` - No rollback (dangerous)

See [Rollback Settings](configuration/rollback-settings).

---

## S

### Schema Version
The database version represented by the timestamp of the last executed migration. Tracked in the `schema_version` table.

### Schema Version Table
A database table (default name: `schema_version`) that tracks which migrations have been executed. Stores timestamp, name, and checksum for each migration.

### Strategy Pattern
A design pattern used by MSR for rendering and (in user code) for backup strategies. Allows swapping implementations without changing core logic.

---

## T

### Timestamp
The numeric prefix in migration file names (e.g., `V202501220100`). Used to determine execution order. Can be a date-based format (YYYYMMDDHHmm), Unix timestamp, or simple incrementing number.

---

## U

### up() Method
The required method in migration scripts that applies database changes. Receives database connection, migration info, and handler as parameters. Must return a string describing the result.

---

## V

### Validation
The process of checking migration scripts for correctness before execution. Validates file naming, checksums, and structural requirements.

### Version Control
The ability to migrate to or rollback to specific database versions using `up(targetVersion)` and `down(targetVersion)` methods.

---

## Common Acronyms

- **MSR** - Migration Script Runner
- **CLI** - Command Line Interface
- **CI/CD** - Continuous Integration / Continuous Deployment
- **SRP** - Single Responsibility Principle
- **API** - Application Programming Interface

---

## Related Documentation

- [Getting Started](getting-started) - Basic setup and usage
- [User Guides](user-guides/) - Comprehensive usage guides
- [API Reference](api/) - Detailed API documentation
- [Configuration](configuration/) - All configuration options
