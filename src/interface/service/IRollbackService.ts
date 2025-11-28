import {MigrationScript} from "../../model/MigrationScript";

/**
 * Service for handling database rollback operations.
 *
 * Encapsulates all rollback strategies (BACKUP, DOWN, BOTH, NONE) and
 * backup mode logic, providing a clean interface for rolling back failed
 * migrations based on the configured strategy.
 *
 * @example
 * ```typescript
 * const rollbackService = new RollbackService(handler, config, backupService, logger, hooks);
 *
 * try {
 *   await runMigrations();
 * } catch (error) {
 *   await rollbackService.rollback(executedScripts, backupPath);
 * }
 * ```
 */
export interface IRollbackService {
    /**
     * Execute rollback based on the configured strategy.
     *
     * Handles rollback using one of four strategies:
     * - BACKUP: Restore from backup file
     * - DOWN: Call down() methods in reverse order
     * - BOTH: Try down() first, fallback to backup if it fails
     * - NONE: No rollback (logs warning)
     *
     * @param executedScripts - Scripts that were attempted (including the failed one)
     * @param backupPath - Path to backup file (if created during migration)
     *
     * @example
     * ```typescript
     * try {
     *   await executor.migrate();
     * } catch (error) {
     *   // Rollback all attempted migrations
     *   await rollbackService.rollback(attemptedScripts, backupPath);
     * }
     * ```
     */
    rollback(executedScripts: MigrationScript[], backupPath?: string): Promise<void>;

    /**
     * Determine if backup should be created based on rollback strategy and backup mode.
     *
     * Returns true only when:
     * - Handler has backup interface
     * - Rollback strategy is BACKUP or BOTH
     * - Backup mode is FULL or CREATE_ONLY
     *
     * @returns True if backup should be created, false otherwise
     *
     * @example
     * ```typescript
     * if (rollbackService.shouldCreateBackup()) {
     *   const backupPath = await backupService.backup();
     * }
     * ```
     */
    shouldCreateBackup(): boolean;
}
