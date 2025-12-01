/**
 * Lifecycle hooks for backup and restore operations.
 *
 * Provides extension points for backup-related operations:
 * - Before creating a backup
 * - After backup is created
 * - Before restoring from backup
 * - After restore completes
 *
 * These hooks are called when backup/restore operations occur based on
 * the configured rollback strategy. All methods are optional.
 *
 * **New in v0.5.0**
 *
 * @example
 * ```typescript
 * import { IBackupHooks } from '@migration-script-runner/core';
 *
 * class BackupMonitoringHooks implements IBackupHooks {
 *   async onBeforeBackup(): Promise<void> {
 *     console.log('Creating backup...');
 *     await checkDiskSpace();
 *   }
 *
 *   async onAfterBackup(backupPath: string): Promise<void> {
 *     console.log(`Backup created: ${backupPath}`);
 *     await uploadToS3(backupPath);
 *     await verifyBackupIntegrity(backupPath);
 *   }
 *
 *   async onBeforeRestore(): Promise<void> {
 *     console.log('Migration failed, restoring backup...');
 *     await notifySlack('⚠️ Rolling back migration');
 *   }
 *
 *   async onAfterRestore(): Promise<void> {
 *     console.log('Database restored to previous state');
 *     await verifyDatabaseState();
 *   }
 * }
 * ```
 */
export interface IBackupHooks {
    /**
     * Called before creating a database backup.
     *
     * Invoked immediately before the backup operation. Useful for pre-backup
     * validation, notifications, or cleanup.
     *
     * @example
     * ```typescript
     * async onBeforeBackup(): Promise<void> {
     *     console.log('Creating backup...');
     *     await checkDiskSpace();
     * }
     * ```
     */
    onBeforeBackup?(): Promise<void>;

    /**
     * Called after creating a database backup.
     *
     * Invoked immediately after successful backup creation. Useful for
     * backup verification, copying to remote storage, or notifications.
     *
     * @param backupPath - File path of the created backup
     *
     * @example
     * ```typescript
     * async onAfterBackup(backupPath: string): Promise<void> {
     *     console.log(`Backup created: ${backupPath}`);
     *     await uploadToS3(backupPath);
     * }
     * ```
     */
    onAfterBackup?(backupPath: string): Promise<void>;

    /**
     * Called before restoring from backup.
     *
     * Invoked when migration fails and backup restoration is about to begin.
     * Useful for logging, notifications, or pre-restore preparation.
     *
     * @example
     * ```typescript
     * async onBeforeRestore(): Promise<void> {
     *     console.log('Migration failed, restoring backup...');
     *     await notifySlack('⚠️ Rolling back migration');
     * }
     * ```
     */
    onBeforeRestore?(): Promise<void>;

    /**
     * Called after restoring from backup.
     *
     * Invoked after successful backup restoration. Useful for logging,
     * notifications, or post-restore validation.
     *
     * @example
     * ```typescript
     * async onAfterRestore(): Promise<void> {
     *     console.log('Database restored to previous state');
     *     await verifyDatabaseState();
     * }
     * ```
     */
    onAfterRestore?(): Promise<void>;
}
