import {BackupConfig} from "./index";

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
}