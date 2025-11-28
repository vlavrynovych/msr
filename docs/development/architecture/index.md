---
layout: default
title: Architecture
parent: Development
nav_order: 5
has_children: true
---

# Architecture
{: .no_toc }

Comprehensive guide to MSR's internal architecture, component design, and how the pieces fit together.
{: .fs-6 .fw-300 }

---

## Overview

MSR (Migration Script Runner) follows a layered architecture with clear separation of concerns. The system is designed around the Single Responsibility Principle, with each class handling one specific aspect of the migration workflow.

The diagram below shows the three main layers: User Code (blue), Core Orchestration (yellow), and Core Services (green), with data flow indicated by arrows:

```mermaid
graph TB
    subgraph "User Code"
        Handler[IDatabaseMigrationHandler<br/>Your Database Handler]
        Migrations[Migration Scripts<br/>V*_*.ts files]
        UserDB[(Your Database)]
    end

    subgraph "MSR Core - Orchestration"
        Executor[MigrationScriptExecutor<br/>Main orchestrator]
        Config[Config<br/>Settings & Options]
    end

    subgraph "MSR Core - Services"
        Scanner[MigrationScanner<br/>Finds migrations]
        Validator[MigrationValidator<br/>Validates scripts]
        Backup[BackupService<br/>Creates backups]
        SchemaVersion[SchemaVersionService<br/>Tracks versions]
        Execution[MigrationExecutionService<br/>Runs migrations]
        Rollback[RollbackService<br/>Handles failures]
    end

    subgraph "MSR Core - Output"
        Renderer[ConsoleRenderer<br/>Formats output]
        Strategy[IRenderStrategy<br/>ASCII/JSON/Silent]
        Logger[ILogger<br/>Console/File/Silent]
    end

    Executor --> Config
    Executor --> Handler
    Executor --> Scanner
    Executor --> Validator
    Executor --> Backup
    Executor --> SchemaVersion
    Executor --> Execution
    Executor --> Rollback
    Executor --> Renderer

    Handler --> UserDB
    Execution --> Migrations
    Migrations --> UserDB
    SchemaVersion --> Handler
    Backup --> Handler
    Rollback --> Handler

    Renderer --> Strategy
    Renderer --> Logger

    style Handler fill:#e1f5ff
    style Migrations fill:#e1f5ff
    style UserDB fill:#e1f5ff
    style Executor fill:#fff3cd
    style Config fill:#fff3cd
    style Scanner fill:#d4edda
    style Validator fill:#d4edda
    style Backup fill:#d4edda
    style SchemaVersion fill:#d4edda
    style Execution fill:#d4edda
    style Rollback fill:#d4edda
    style Renderer fill:#f8d7da
    style Strategy fill:#f8d7da
    style Logger fill:#f8d7da
```

**Architecture Layers:**
- **Blue**: User-implemented components (database handler, migrations, your database)
- **Yellow**: Orchestration layer (executor and configuration)
- **Green**: Service layer (specialized operations)
- **Red**: Output layer (rendering and logging)

### Design Principles

- **Single Responsibility** - Each class has one clear purpose
- **Dependency Injection** - Services receive dependencies through constructors
- **Interface Segregation** - Small, focused interfaces rather than large ones
- **Open/Closed** - Open for extension, closed for modification
- **Fail-Fast** - Stop execution immediately on first error

---

## Architecture Documentation

### [Core Components](components)
Detailed documentation of the main classes and services:
- MigrationScriptExecutor - Orchestration layer
- Service layer components (Backup, Schema Version, Rollback, etc.)
- Database handler interface

### [Data Flow](data-flow)
How data moves through the system:
- Migration execution workflow
- Service interaction patterns
- Data transformation pipeline

### [Lifecycle & Workflows](lifecycle)
Migration script lifecycle and workflows:
- Migration execution lifecycle
- Error handling strategy
- Recovery workflows

### [Design & Patterns](design-patterns)
Design decisions and architectural patterns:
- Dependency injection approach
- Layer responsibilities
- Extension points
- Class diagram

### [Best Practices](best-practices)
Architectural best practices and guidelines:
- Performance considerations
- Testing strategy
- Development guidelines

---

## Quick Navigation

| Topic | Description |
|-------|-------------|
| [Components](components) | Core classes and services |
| [Data Flow](data-flow) | How data moves through the system |
| [Lifecycle](lifecycle) | Migration execution lifecycle |
| [Design Patterns](design-patterns) | Architectural patterns used |
| [Best Practices](best-practices) | Performance and testing guidelines |

---

## Related Documentation

- [Development Setup](../setup) - Set up your environment
- [Development Workflow](../workflow) - Contributing process
- [Testing Guide](../testing/) - Testing standards
- [API Reference](../../api/) - Complete API documentation
