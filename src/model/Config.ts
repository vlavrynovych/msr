import {BackupConfig, RollbackStrategy} from "./index";

/**
 * Configuration for the migration system.
 *
 * Controls migration script discovery, database table naming, console output, and backup behavior.
 *
 * @example
 * ```typescript
 * const config = new Config();
 * config.folder = './database/migrations';
 * config.tableName = 'migration_history';
 * config.displayLimit = 10;
 * ```
 */
export class Config {
    /**
     * Regular expression pattern for matching migration file names.
     * The pattern must capture two groups:
     * 1. Timestamp (numeric version identifier)
     * 2. Name (descriptive name)
     *
     * @default /^V(\d{12})_/
     *
     * @example
     * ```typescript
     * // Default pattern matches: V202501220100_initial_setup.ts
     * config.filePattern = /^V(\d+)_(.+)\.ts$/;
     *
     * // Custom pattern for JavaScript files
     * config.filePattern = /^V(\d+)_(.+)\.js$/;
     * ```
     */
    filePattern:RegExp = /^V(\d{12})_/

    /**
     * Directory path containing migration script files.
     * Can be relative or absolute path.
     *
     * @default './migrations' (relative to current working directory)
     *
     * @example
     * ```typescript
     * // Relative path
     * config.folder = './migrations';
     *
     * // Absolute path
     * config.folder = '/usr/local/app/migrations';
     * ```
     */
    folder:string = `${process.cwd()}/migrations`

    /**
     * Name of the database table used to track executed migrations.
     * This table stores migration metadata including timestamp, name, execution time, and result.
     *
     * @default 'schema_version'
     *
     * @example
     * ```typescript
     * config.tableName = 'schema_version';
     * // or
     * config.tableName = 'migrations_history';
     * ```
     */
    tableName:string = 'schema_version';

    /**
     * Backup configuration settings.
     * Controls how database backups are created, named, and managed during migrations.
     *
     * @default new BackupConfig()
     *
     * @example
     * ```typescript
     * config.backup = new BackupConfig();
     * config.backup.folder = './backups';
     * config.backup.deleteBackup = true;
     * ```
     */
    backup:BackupConfig = new BackupConfig()

    /**
     * Limits the number of migrated scripts displayed in console output.
     * Set to 0 to show all scripts (default).
     *
     * This only affects console display - all migrations are still tracked in the database.
     * Useful for projects with many migrations to keep console output manageable.
     *
     * @default 0 (show all)
     *
     * @example
     * ```typescript
     * // Show all migrations
     * config.displayLimit = 0;
     *
     * // Show only the last 10 migrations
     * config.displayLimit = 10;
     * ```
     */
    displayLimit:number = 0

    /**
     * Name of the special setup script that executes before any migrations.
     * This file should be placed in the migrations folder and will be executed
     * before MSR scans for pending migrations.
     *
     * The script executes with the same interface as regular migrations (IRunnableScript),
     * but is NOT saved to the schema version table.
     *
     * Set to `null` to disable beforeMigrate functionality entirely.
     *
     * @default 'beforeMigrate'
     *
     * @example
     * ```typescript
     * // Use default name (beforeMigrate.ts or beforeMigrate.js)
     * config.beforeMigrateName = 'beforeMigrate';
     *
     * // Use custom name
     * config.beforeMigrateName = 'setup';
     * // Will look for setup.ts or setup.js
     *
     * // Disable beforeMigrate entirely
     * config.beforeMigrateName = null;
     * ```
     */
    beforeMigrateName: string | null = 'beforeMigrate'

    /**
     * Enable recursive scanning of sub-folders for migration scripts.
     * When enabled, the migration scanner will search all sub-directories within
     * the configured folder, allowing you to organize migrations by feature, module,
     * version, or any other logical grouping.
     *
     * Migrations are always executed in timestamp order regardless of folder structure.
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Recursive sub-folder support (default)
     * config.recursive = true;
     *
     * // Directory structure:
     * // migrations/
     * // ├── users/
     * // │   ├── V202311010001_create_users_table.ts
     * // │   └── V202311020002_add_user_roles.ts
     * // ├── auth/
     * // │   └── V202311015001_create_sessions_table.ts
     * // └── products/
     * //     └── V202311030001_create_products_table.ts
     * //
     * // Execution order: V202311010001 → V202311015001 → V202311020002 → V202311030001
     *
     * // Disable for single-folder mode
     * config.recursive = false;
     * ```
     */
    recursive:boolean = true

    /**
     * Rollback strategy for handling migration failures.
     *
     * Determines how MSR responds when a migration fails:
     * - `BACKUP` (default): Create database backup before migrations, restore on failure
     * - `DOWN`: Call down() methods on failed migrations for rollback
     * - `BOTH`: Create backup AND use down() methods (safest - tries down() first, backup on down() failure)
     * - `NONE`: No automatic rollback (not recommended - database may be left in inconsistent state)
     *
     * @default RollbackStrategy.BACKUP
     *
     * @example
     * ```typescript
     * import { RollbackStrategy } from '@migration-script-runner/core';
     *
     * // Use backup/restore (default, recommended for production)
     * config.rollbackStrategy = RollbackStrategy.BACKUP;
     * // Requires: handler.backup implementation
     *
     * // Use down() migrations for rollback
     * config.rollbackStrategy = RollbackStrategy.DOWN;
     * // Requires: down() methods in migration scripts
     *
     * // Use both strategies for maximum safety
     * config.rollbackStrategy = RollbackStrategy.BOTH;
     * // Tries down() first, falls back to backup if down() fails
     *
     * // No rollback (dangerous - use with caution)
     * config.rollbackStrategy = RollbackStrategy.NONE;
     * // Database will be left in potentially inconsistent state on failure
     * ```
     *
     * @see IDatabaseMigrationHandler.backup for backup implementation
     * @see IRunnableScript.down for down() method implementation
     * @see RollbackStrategy enum for all available options
     */
    rollbackStrategy: RollbackStrategy = RollbackStrategy.BACKUP
}