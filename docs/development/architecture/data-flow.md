---
layout: default
title: Data Flow
parent: Architecture
nav_order: 2
---

# Data Flow
{: .no_toc }

How data moves through the Migration Script Runner system.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Data Flow

### Complete Migration Workflow

This flowchart shows the complete data flow through MSR from user invocation to result:

```mermaid
graph TD
    Start[User calls executor migrate] --> Backup[BackupService backup<br/>Creates database dump]
    Backup --> Init[SchemaVersionService init<br/>Creates validates schema_version table]
    Init --> Scan[MigrationScanner scan]

    Scan --> Parallel{Parallel Execution}
    Parallel --> ReadFiles[MigrationService readMigrationScripts<br/>Discovers all migration files]
    Parallel --> QueryDB[SchemaVersionService getAllMigratedScripts<br/>Queries schema_version table]

    ReadFiles --> Filter[Sequential Filtering]
    QueryDB --> Filter

    Filter --> GetPending[MigrationScriptSelector getPending<br/>Filters new scripts greater than last executed]
    GetPending --> GetIgnored[MigrationScriptSelector getIgnored<br/>Filters old scripts less than last executed]

    GetIgnored --> RenderMigrated[MigrationRenderer drawMigrated<br/>Display already-executed migrations]
    RenderMigrated --> RenderIgnored[MigrationRenderer drawIgnored<br/>Display skipped migrations]

    RenderIgnored --> Execute[MigrationRunner execute]
    Execute --> Loop{For each script}
    Loop --> LoadModule[script init - load module]
    LoadModule --> RunUp[script up - db info handler]
    RunUp --> SaveSchema[SchemaVersionService save]
    SaveSchema --> NextScript{More scripts?}
    NextScript -->|Yes| Loop
    NextScript -->|No| DeleteBackup

    DeleteBackup[BackupService deleteBackup<br/>Success remove backup] --> Return[Return IMigrationResult<br/>success executed migrated ignored]

    Loop -->|Error| Restore[BackupService restore]
    Restore --> DeleteBackupError[BackupService deleteBackup]
    DeleteBackupError --> ReturnError[Return IMigrationResult with errors]

    style Start fill:#e3f2fd
    style Backup fill:#fff3e0
    style Init fill:#fff3e0
    style Scan fill:#e8f5e9
    style Execute fill:#e8f5e9
    style Return fill:#c8e6c9
    style Restore fill:#ffcdd2
    style ReturnError fill:#ffcdd2
```

---

## Class Diagram

```mermaid
classDiagram
    class MigrationScriptExecutor {
        -IDatabaseMigrationHandler handler
        -IBackupService backupService
        -ISchemaVersionService schemaVersionService
        -IMigrationService migrationService
        -IMigrationRenderer migrationRenderer
        -IMigrationScanner migrationScanner
        -MigrationScriptSelector selector
        -MigrationRunner runner
        -ILogger logger
        +migrate() Promise~IMigrationResult~
        +list(number?) Promise~void~
    }

    class MigrationScanner {
        -IMigrationService migrationService
        -ISchemaVersionService schemaVersionService
        -MigrationScriptSelector selector
        -IDatabaseMigrationHandler handler
        +scan() Promise~IScanResult~
    }

    class MigrationScriptSelector {
        +getPending(all, migrated) IMigrationScript[]
        +getIgnored(all, migrated) IMigrationScript[]
    }

    class MigrationRunner {
        -IDatabaseMigrationHandler handler
        -ISchemaVersionService schemaVersionService
        -ILogger logger
        +execute(scripts) Promise~void~
        +executeOne(script) Promise~void~
    }

    class BackupService {
        +backup() Promise~string~
        +restore(path) Promise~void~
        +deleteBackup(path) Promise~void~
    }

    class SchemaVersionService {
        +init() Promise~void~
        +save(script) Promise~void~
        +getAllMigrated() Promise~IMigrationScript[]~
    }

    class MigrationService {
        +readMigrationScripts(folder) Promise~IMigrationScript[]~
        +parseFilename(name) object
    }

    MigrationScriptExecutor --> MigrationScanner
    MigrationScriptExecutor --> MigrationScriptSelector
    MigrationScriptExecutor --> MigrationRunner
    MigrationScriptExecutor --> BackupService
    MigrationScriptExecutor --> SchemaVersionService
    MigrationScriptExecutor --> MigrationService

    MigrationScanner --> MigrationService
    MigrationScanner --> SchemaVersionService
    MigrationScanner --> MigrationScriptSelector

    MigrationRunner --> SchemaVersionService
```

---

