/**
 * Core MSR environment variables for basic configuration.
 *
 * These environment variables control fundamental MSR behavior like
 * migration folder location, table naming, and file scanning.
 *
 * @example
 * ```typescript
 * // Set migration folder
 * process.env[CoreEnvVars.MSR_FOLDER] = './db/migrations';
 *
 * // Set schema version table name
 * process.env[CoreEnvVars.MSR_TABLE_NAME] = 'migration_history';
 * ```
 */
export enum CoreEnvVars {
    /**
     * Directory containing migration files.
     * @default './migrations'
     */
    MSR_FOLDER = 'MSR_FOLDER',

    /**
     * Name of the schema version tracking table.
     * @default 'schema_version'
     */
    MSR_TABLE_NAME = 'MSR_TABLE_NAME',

    /**
     * Name of the beforeMigrate hook function.
     * @default 'beforeMigrate'
     */
    MSR_BEFORE_MIGRATE_NAME = 'MSR_BEFORE_MIGRATE_NAME',

    /**
     * Run in dry-run mode (no actual changes).
     * @default false
     */
    MSR_DRY_RUN = 'MSR_DRY_RUN',

    /**
     * Maximum number of migrations to display (0 = all).
     * @default 0
     */
    MSR_DISPLAY_LIMIT = 'MSR_DISPLAY_LIMIT',

    /**
     * Display banner with version and handler information.
     * @default true
     */
    MSR_SHOW_BANNER = 'MSR_SHOW_BANNER',

    /**
     * Recursively scan subdirectories for migrations.
     * @default true
     */
    MSR_RECURSIVE = 'MSR_RECURSIVE',

    /**
     * Array of regex patterns for migration file matching (JSON format).
     * @default ["^V(\\d{12})_"]
     */
    MSR_FILE_PATTERNS = 'MSR_FILE_PATTERNS',

    /**
     * Path to custom config file (overrides default msr.config.js/json search).
     */
    MSR_CONFIG_FILE = 'MSR_CONFIG_FILE',
}
