/**
 * Environment variables for backup configuration.
 *
 * Control automatic database backups before migrations for
 * safety and rollback capability.
 *
 * @example
 * ```typescript
 * // Configure backups via dot-notation
 * process.env[BackupEnvVars.MSR_BACKUP_FOLDER] = './backups';
 * process.env[BackupEnvVars.MSR_BACKUP_TIMESTAMP] = 'true';
 *
 * // Or use JSON format
 * process.env[BackupEnvVars.MSR_BACKUP] = JSON.stringify({
 *   folder: './backups',
 *   timestamp: true,
 *   deleteBackup: false  // Keep backups after successful migration
 * });
 * ```
 */
export enum BackupEnvVars {
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
}
