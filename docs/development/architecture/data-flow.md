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

```
┌─────────────────────────────────────────────────────────────────┐
│                   MigrationScriptExecutor                        │
├─────────────────────────────────────────────────────────────────┤
│ - handler: IDatabaseMigrationHandler                            │
│ - backupService: IBackupService                                 │
│ - schemaVersionService: ISchemaVersionService                   │
│ - migrationService: IMigrationService                           │
│ - migrationRenderer: IMigrationRenderer                         │
│ - migrationScanner: IMigrationScanner                           │
│ - selector: MigrationScriptSelector                             │
│ - runner: MigrationRunner                                       │
│ - logger: ILogger                                               │
├─────────────────────────────────────────────────────────────────┤
│ + migrate(): Promise<IMigrationResult>                          │
│ + list(number?: number): Promise<void>                          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ delegates to
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ MigrationScanner │  │ MigrationScrip│  │  MigrationRunner     │
├──────────────────┤  │ tSelector     │  ├──────────────────────┤
│ - migrationService│ ├──────────────┤  │ - handler            │
│ - schemaVersion   │  │ (stateless)  │  │ - schemaVersionService│
│   Service         │  ├──────────────┤  │ - logger             │
│ - selector        │  │ + getPending()│  ├──────────────────────┤
│ - handler         │  │ + getIgnored()│  │ + execute()          │
├──────────────────┤  └──────────────┘  │ + executeOne()       │
│ + scan()         │                     └──────────────────────┘
└──────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                     Supporting Services                       │
├──────────────────────────┬──────────────────┬────────────────┤
│   BackupService          │ SchemaVersion    │ MigrationService│
│   • backup()             │ Service          │ • readMigration │
│   • restore()            │ • init()         │   Scripts()     │
│   • deleteBackup()       │ • save()         │ • parseFilename()│
│                          │ • getAllMigrated │                 │
└──────────────────────────┴──────────────────┴─────────────────┘
```

---

