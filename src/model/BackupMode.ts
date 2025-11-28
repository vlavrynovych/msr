/**
 * Backup behavior mode during migration execution.
 *
 * Controls when backups are created and whether automatic restore occurs on failure.
 * This provides granular control for users who manage backups externally or want
 * custom workflows.
 *
 * @example
 * ```typescript
 * // Full automatic backup and restore (default)
 * config.backupMode = BackupMode.FULL;
 *
 * // Create backup but don't restore automatically
 * config.backupMode = BackupMode.CREATE_ONLY;
 *
 * // Don't create backup, restore from existing on failure
 * config.backupMode = BackupMode.RESTORE_ONLY;
 * config.backup.existingBackupPath = './backups/my-backup.bkp';
 *
 * // No automatic backup/restore, use manual methods
 * config.backupMode = BackupMode.MANUAL;
 * ```
 */
export enum BackupMode {
    /**
     * Full automatic backup and restore (default).
     *
     * - Creates backup before migrations
     * - Restores automatically on failure
     * - Deletes backup on success
     *
     * This is the default behavior and maintains backward compatibility.
     *
     * @example
     * ```typescript
     * config.backupMode = BackupMode.FULL;
     * await executor.migrate(); // Creates backup, restores on failure, cleans up on success
     * ```
     */
    FULL = 'full',

    /**
     * Create backup but don't restore automatically on failure.
     *
     * - Creates backup before migrations
     * - Does NOT restore on failure
     * - Keeps backup file for manual inspection/restore
     *
     * Useful when:
     * - User wants to manually inspect and decide whether to restore
     * - External monitoring system handles restore decisions
     * - Migrations are reversible via down() methods, backup is just for safety
     *
     * @example
     * ```typescript
     * config.backupMode = BackupMode.CREATE_ONLY;
     * config.rollbackStrategy = RollbackStrategy.DOWN;
     * await executor.migrate(); // Creates backup, uses down() on failure, keeps backup
     * ```
     */
    CREATE_ONLY = 'create_only',

    /**
     * Don't create backup, but restore from existing backup if migration fails.
     *
     * - Does NOT create backup
     * - Restores from config.backup.existingBackupPath on failure
     * - Requires existingBackupPath to be set
     *
     * Useful when:
     * - External backup system already created a backup
     * - Running migrations in pipeline where backup was created in earlier step
     * - Re-attempting failed migration with existing backup
     *
     * @example
     * ```typescript
     * config.backupMode = BackupMode.RESTORE_ONLY;
     * config.backup.existingBackupPath = './backups/my-backup.bkp';
     * await executor.migrate(); // No backup creation, restores from existing on failure
     * ```
     */
    RESTORE_ONLY = 'restore_only',

    /**
     * No automatic backup or restore during migrate().
     *
     * - Does NOT create backup automatically
     * - Does NOT restore automatically on failure
     * - Use manual backup/restore methods instead
     *
     * Useful when:
     * - Full manual control over backup/restore workflow is required
     * - Integrating with custom backup systems
     * - Complex workflows with conditional backup/restore logic
     *
     * @example
     * ```typescript
     * config.backupMode = BackupMode.MANUAL;
     *
     * // Manual workflow
     * const backupPath = await executor.createBackup();
     * try {
     *   await executor.migrate();
     * } catch (error) {
     *   if (shouldRestore(error)) {
     *     await executor.restoreFromBackup(backupPath);
     *   }
     * }
     * ```
     */
    MANUAL = 'manual'
}
