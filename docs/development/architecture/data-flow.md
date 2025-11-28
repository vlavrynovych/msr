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

```
1. User calls executor.migrate()
   │
   ├─▶ 2. BackupService.backup()
   │      └─▶ Creates database dump
   │
   ├─▶ 3. SchemaVersionService.init()
   │      └─▶ Creates/validates schema_version table
   │
   ├─▶ 4. MigrationScanner.scan()
   │      └─▶ Parallel execution:
   │          ├─▶ MigrationService.readMigrationScripts()
   │          │   └─▶ Discovers all .ts/.js files in migrations/
   │          │
   │          └─▶ SchemaVersionService.getAllMigratedScripts()
   │              └─▶ Queries schema_version table
   │
   │      └─▶ Sequential filtering:
   │          ├─▶ MigrationScriptSelector.getPending()
   │          │   └─▶ Filters: new scripts > last executed
   │          │
   │          └─▶ MigrationScriptSelector.getIgnored()
   │              └─▶ Filters: old scripts < last executed
   │
   ├─▶ 5. MigrationRenderer.drawMigrated()
   │      └─▶ Display already-executed migrations
   │
   ├─▶ 6. MigrationRenderer.drawIgnored()
   │      └─▶ Display skipped migrations
   │
   ├─▶ 7. MigrationRunner.execute()
   │      └─▶ For each script:
   │          ├─▶ script.init() (load module)
   │          ├─▶ script.up(db, info, handler)
   │          └─▶ SchemaVersionService.save()
   │
   ├─▶ 8. BackupService.deleteBackup()
   │      └─▶ Success: remove backup
   │
   └─▶ 9. Return IMigrationResult
          └─▶ { success, executed, migrated, ignored }

If error at any step:
   ├─▶ BackupService.restore()
   ├─▶ BackupService.deleteBackup()
   └─▶ Return IMigrationResult with errors
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

