---
layout: default
title: API Reference
nav_order: 4
has_children: true
---

# API Reference
{: .no_toc }

Complete API documentation for Migration Script Runner.
{: .fs-6 .fw-300 }

---

## Overview

This section contains comprehensive API documentation for all public classes, interfaces, and types in Migration Script Runner. Each subsection provides detailed information about constructors, methods, properties, and usage examples.

{: .note }
> All public APIs include JSDoc comments in the source code for IDE intellisense support.

---

## Documentation Structure

### [Core Classes](core-classes)
The main classes you'll interact with:
- **MigrationScriptExecutor** - Primary class for executing migrations
- **Config** - Configuration management
- **MigrationScript** - Migration script representation

### [Interfaces](interfaces)
Core interfaces for implementing database handlers and custom components:
- **IDatabaseMigrationHandler** - Database handler interface
- **ISchemaVersion** - Schema version tracking
- **IDB** - Database connection interface
- **IMigrationInfo** - Migration metadata
- And more...

### [Services](services)
Internal service classes (advanced usage):
- **MigrationService** - Migration file discovery
- **MigrationValidationService** - Validation logic
- **BackupService** - Backup/restore operations
- **RollbackService** - Rollback orchestration
- And more...

### [Models & Enums](models)
Model classes and enumeration types:
- **BackupMode** - Backup mode options
- **RollbackStrategy** - Rollback strategy options
- **DownMethodPolicy** - Down method validation policy
- **ValidationIssueType** - Validation issue types

### [TypeScript Types](types)
Type definitions and aliases for TypeScript users

---

## Quick Navigation

**Getting Started?**
- Start with [MigrationScriptExecutor](core-classes#migrationscriptexecutor)
- Configure with [Config](core-classes#config)
- Implement [IDatabaseMigrationHandler](interfaces#idatabasemigrationhandler)

**Customizing?**
- Custom loggers: [ILogger](interfaces#ilogger)
- Custom validators: [IMigrationValidator](interfaces#imigrationvalidator)
- Lifecycle hooks: [IMigrationHooks](interfaces#imigrationhooks)

**Advanced Usage?**
- Explore [Services](services) for fine-grained control
- Review [Interfaces](interfaces) for extensibility points

---

## API Versioning

MSR follows [Semantic Versioning](https://semver.org/). This documentation reflects:
- **Current Version**: v0.3.0
- **Breaking Changes**: Documented in [Migration Guides](../version-migration/)
- **Deprecations**: Marked with `@deprecated` in source code

---

## Contributing

Found an error in the API documentation? Please [open an issue](https://github.com/migration-script-runner/msr-core/issues) or submit a pull request.
