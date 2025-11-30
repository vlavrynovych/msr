/**
 * Enum of all MSR environment variable names.
 *
 * Provides type-safe access to environment variable names used throughout MSR.
 * Use these constants instead of string literals for better maintainability
 * and refactoring support.
 *
 * @example
 * ```typescript
 * // Instead of:
 * const folder = process.env.MSR_FOLDER;
 *
 * // Use:
 * const folder = process.env[EnvironmentVariables.MSR_FOLDER];
 *
 * // Or with ConfigLoader:
 * const folder = ConfigLoader.loadFromEnv(
 *     EnvironmentVariables.MSR_FOLDER,
 *     './migrations'
 * );
 * ```
 */
export enum EnvironmentVariables {
    // ==================== Simple Configuration Properties ====================

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
     * Recursively scan subdirectories for migrations.
     * @default true
     */
    MSR_RECURSIVE = 'MSR_RECURSIVE',

    /**
     * Validate migrations before execution.
     * @default true
     */
    MSR_VALIDATE_BEFORE_RUN = 'MSR_VALIDATE_BEFORE_RUN',

    /**
     * Treat validation warnings as errors.
     * @default false
     */
    MSR_STRICT_VALIDATION = 'MSR_STRICT_VALIDATION',

    // ==================== File Patterns ====================

    /**
     * Array of regex patterns for migration file matching (JSON format).
     * @default ["^V(\\d{12})_"]
     */
    MSR_FILE_PATTERNS = 'MSR_FILE_PATTERNS',

    // ==================== Logging Configuration ====================

    /**
     * Complete logging configuration as JSON (alternative to dot-notation).
     */
    MSR_LOGGING = 'MSR_LOGGING',

    /**
     * Enable file logging.
     * @default false
     */
    MSR_LOGGING_ENABLED = 'MSR_LOGGING_ENABLED',

    /**
     * Directory for log files.
     * @default './migrations-logs'
     */
    MSR_LOGGING_PATH = 'MSR_LOGGING_PATH',

    /**
     * Maximum number of log files to retain.
     * @default 10
     */
    MSR_LOGGING_MAX_FILES = 'MSR_LOGGING_MAX_FILES',

    /**
     * Moment.js format for log timestamps.
     * @default 'YYYY-MM-DD'
     */
    MSR_LOGGING_TIMESTAMP_FORMAT = 'MSR_LOGGING_TIMESTAMP_FORMAT',

    /**
     * Log successful migrations (in addition to failures).
     * @default false
     */
    MSR_LOGGING_LOG_SUCCESSFUL = 'MSR_LOGGING_LOG_SUCCESSFUL',

    // ==================== Backup Configuration ====================

    /**
     * Complete backup configuration as JSON (alternative to dot-notation).
     */
    MSR_BACKUP = 'MSR_BACKUP',

    /**
     * Include timestamp in backup filename.
     * @default true
     */
    MSR_BACKUP_TIMESTAMP = 'MSR_BACKUP_TIMESTAMP',

    /**
     * Delete backup after successful migration.
     * @default true
     */
    MSR_BACKUP_DELETE_BACKUP = 'MSR_BACKUP_DELETE_BACKUP',

    /**
     * Directory for backup files.
     * @default './backups'
     */
    MSR_BACKUP_FOLDER = 'MSR_BACKUP_FOLDER',

    /**
     * Filename prefix for backups.
     * @default 'backup'
     */
    MSR_BACKUP_PREFIX = 'MSR_BACKUP_PREFIX',

    /**
     * Custom component for backup filename.
     * @default ''
     */
    MSR_BACKUP_CUSTOM = 'MSR_BACKUP_CUSTOM',

    /**
     * Suffix component for backup filename.
     * @default ''
     */
    MSR_BACKUP_SUFFIX = 'MSR_BACKUP_SUFFIX',

    /**
     * Moment.js format for backup timestamps.
     * @default 'YYYY-MM-DD-HH-mm-ss'
     */
    MSR_BACKUP_TIMESTAMP_FORMAT = 'MSR_BACKUP_TIMESTAMP_FORMAT',

    /**
     * File extension for backup files (without dot).
     * @default 'bkp'
     */
    MSR_BACKUP_EXTENSION = 'MSR_BACKUP_EXTENSION',

    /**
     * Path to existing backup for restore operations.
     * @default undefined
     */
    MSR_BACKUP_EXISTING_BACKUP_PATH = 'MSR_BACKUP_EXISTING_BACKUP_PATH',

    // ==================== Config File Location ====================

    /**
     * Path to custom config file (overrides default msr.config.js/json search).
     */
    MSR_CONFIG_FILE = 'MSR_CONFIG_FILE',
}
