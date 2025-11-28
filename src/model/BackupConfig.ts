/**
 * Configuration for the backup system.
 *
 * Controls how database backups are created, named, stored, and managed during migrations.
 * Backups are automatically created before migrations run and can be automatically deleted
 * after successful completion.
 *
 * @example
 * ```typescript
 * const backup = new BackupConfig();
 * backup.folder = './backups';
 * backup.deleteBackup = true;
 * backup.timestamp = true;
 * backup.prefix = 'db-backup';
 * ```
 */
export class BackupConfig {
    /**
     * Include timestamp in backup filename.
     *
     * @default true
     *
     * @example
     * ```typescript
     * // With timestamp: backup-2025-01-22-01-30-45.bkp
     * backup.timestamp = true;
     *
     * // Without timestamp: backup.bkp (will overwrite existing)
     * backup.timestamp = false;
     * ```
     */
    timestamp:boolean = true;

    /**
     * Automatically delete backup file after successful migration.
     *
     * When true, backup files are cleaned up after migrations complete successfully.
     * When false, backup files accumulate and must be managed manually.
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Delete backups after success (recommended)
     * backup.deleteBackup = true;
     *
     * // Keep all backups for manual review
     * backup.deleteBackup = false;
     * ```
     */
    deleteBackup:boolean = true;

    /**
     * Directory where backup files are stored.
     * Can be relative or absolute path.
     *
     * @default './backups' (relative to current working directory)
     *
     * @example
     * ```typescript
     * backup.folder = './backups';
     * backup.folder = '/var/backups/myapp';
     * ```
     */
    folder:string = `${process.cwd()}/backups`

    /**
     * Filename prefix for backup files.
     *
     * @default 'backup'
     *
     * @example
     * ```typescript
     * // Default: backup-2025-01-22-01-30-45.bkp
     * backup.prefix = 'backup';
     *
     * // Custom: db-snapshot-2025-01-22-01-30-45.bkp
     * backup.prefix = 'db-snapshot';
     * ```
     */
    prefix:string = 'backup';

    /**
     * Custom filename component inserted between prefix and timestamp.
     *
     * @default '' (empty string)
     *
     * @example
     * ```typescript
     * // Default: backup-2025-01-22-01-30-45.bkp
     * backup.custom = '';
     *
     * // Custom: backup-production-2025-01-22-01-30-45.bkp
     * backup.custom = 'production';
     * ```
     */
    custom:string = '';

    /**
     * Filename suffix inserted before extension.
     *
     * @default '' (empty string)
     *
     * @example
     * ```typescript
     * // Default: backup-2025-01-22-01-30-45.bkp
     * backup.suffix = '';
     *
     * // Custom: backup-2025-01-22-01-30-45-v2.bkp
     * backup.suffix = 'v2';
     * ```
     */
    suffix:string = '';

    /**
     * Moment.js format string for backup timestamp.
     *
     * Uses Moment.js formatting tokens. See https://momentjs.com/docs/#/displaying/format/
     *
     * @default 'YYYY-MM-DD-HH-mm-ss'
     *
     * @example
     * ```typescript
     * // Default format: 2025-01-22-01-30-45
     * backup.timestampFormat = 'YYYY-MM-DD-HH-mm-ss';
     *
     * // ISO format: 2025-01-22T01:30:45
     * backup.timestampFormat = 'YYYY-MM-DDTHH:mm:ss';
     *
     * // Compact: 20250122_013045
     * backup.timestampFormat = 'YYYYMMDD_HHmmss';
     * ```
     */
    timestampFormat:string = 'YYYY-MM-DD-HH-mm-ss';

    /**
     * File extension for backup files (without leading dot).
     *
     * @default 'bkp'
     *
     * @example
     * ```typescript
     * backup.extension = 'bkp';     // backup-2025-01-22-01-30-45.bkp
     * backup.extension = 'backup';  // backup-2025-01-22-01-30-45.backup
     * backup.extension = 'json';    // backup-2025-01-22-01-30-45.json
     * ```
     */
    extension:string = 'bkp';

    /**
     * Path to existing backup file for restore operations.
     *
     * Used with BackupMode.RESTORE_ONLY to restore from a pre-existing backup
     * rather than creating a new one. Can be absolute or relative path.
     *
     * @default undefined
     *
     * @example
     * ```typescript
     * import { BackupMode } from '@migration-script-runner/core';
     *
     * // Use existing backup from external backup system
     * config.backupMode = BackupMode.RESTORE_ONLY;
     * config.backup.existingBackupPath = './backups/pre-deploy-2025-01-22.bkp';
     *
     * // Absolute path
     * config.backup.existingBackupPath = '/var/backups/myapp/manual-backup.bkp';
     *
     * // Manual restore workflow
     * config.backupMode = BackupMode.MANUAL;
     * await executor.restoreFromBackup('./backups/specific-backup.bkp');
     * ```
     *
     * @see BackupMode.RESTORE_ONLY for automatic restore mode
     */
    existingBackupPath?: string;
}