import {MigrationScript} from "../model/MigrationScript";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {Config, RollbackStrategy, BackupMode} from "../model";
import {IBackupService} from "../interface/service/IBackupService";
import {ILogger} from "../interface/ILogger";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {IRollbackService} from "../interface/service/IRollbackService";
import {IDB} from "../interface/dao";

/**
 * Service for handling database rollback operations.
 *
 * Encapsulates all rollback strategies (BACKUP, DOWN, BOTH, NONE) and
 * backup mode logic. Handles the complexity of determining when to create
 * backups and when to restore them based on the configured strategy and mode.
 *
 *
 * @template DB - Database interface type
 * @example
 * ```typescript
 * const rollbackService = new RollbackService<DB>(handler, config, backupService, logger, hooks);
 *
 * try {
 *   await runMigrations();
 * } catch (error) {
 *   // Automatically rollback using configured strategy
 *   await rollbackService.rollback(executedScripts, backupPath);
 * }
 * ```
 */
export class RollbackService<DB extends IDB> implements IRollbackService<DB> {

    /**
     * Creates a new RollbackService instance.
     *
     * @param handler - Database migration handler for accessing the database
     * @param config - Configuration including rollback strategy and backup mode
     * @param backupService - Service for creating and restoring backups
     * @param logger - Logger for rollback messages
     * @param hooks - Optional lifecycle hooks for rollback events
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const rollbackService = new RollbackService<DB>(
     *     handler,
     *     config,
     *     backupService,
     *     logger,
     *     hooks
     * );
     * ```
     */
    constructor(
        private readonly handler: IDatabaseMigrationHandler<DB>,
        private readonly config: Config,
        private readonly backupService: IBackupService,
        private readonly logger: ILogger,
        private readonly hooks?: IMigrationHooks<DB>
    ) {}

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
 *
 * @template DB - Database interface type
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
    async rollback(executedScripts: MigrationScript<DB>[], backupPath?: string): Promise<void> {
        const strategy = this.config.rollbackStrategy;

        switch (strategy) {
            case RollbackStrategy.BACKUP:
                await this.rollbackWithBackup(backupPath);
                break;

            case RollbackStrategy.DOWN:
                await this.rollbackWithDown(executedScripts);
                break;

            case RollbackStrategy.BOTH:
                await this.rollbackWithBoth(executedScripts, backupPath);
                break;

            case RollbackStrategy.NONE:
                this.logger.warn('⚠️  No rollback configured - database may be in inconsistent state');
                break;
        }
    }

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
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * if (rollbackService.shouldCreateBackup()) {
     *   const backupPath = await backupService.backup();
     * }
     * ```
     */
    shouldCreateBackup(): boolean {
        const hasBackup = !!this.handler.backup;

        // Need backup interface and correct mode/strategy combination
        return hasBackup && this.shouldBackupInMode();
    }

    /**
     * Rollback using backup/restore strategy.
     *
     * Determines which backup to restore from based on backup mode:
     * - RESTORE_ONLY: Uses config.backup.existingBackupPath
     * - Other modes: Uses the backup created during this migration run
     *
     * @param backupPath - Path to backup file (from CREATE backup operations)
     * @private
     */
    private async rollbackWithBackup(backupPath: string | undefined): Promise<void> {
        // Check if restore should happen based on backupMode
        if (!this.shouldRestoreInMode()) {
            this.logger.warn('⚠️  Backup restore skipped due to backupMode setting');
            return;
        }

        // Determine which backup to restore from
        let pathToRestore: string | undefined;
        if (this.config.backupMode === BackupMode.RESTORE_ONLY) {
            // Use existing backup path from config
            pathToRestore = this.config.backup.existingBackupPath;
            if (!pathToRestore) {
                this.logger.error('❌ BackupMode.RESTORE_ONLY requires config.backup.existingBackupPath to be set');
                throw new Error('BackupMode.RESTORE_ONLY requires existingBackupPath configuration');
            }
        } else {
            // Use the backup created during this migration run
            pathToRestore = backupPath;
        }

        if (!pathToRestore) {
            this.logger.warn('No backup available for restore');
            return;
        }

        // Hook: Before restore
        if (this.hooks && this.hooks.onBeforeRestore) {
            await this.hooks.onBeforeRestore();
        }

        this.logger.info('Restoring from backup...');
        await this.backupService.restore(pathToRestore);

        // Hook: After restore
        if (this.hooks && this.hooks.onAfterRestore) {
            await this.hooks.onAfterRestore();
        }

        this.backupService.deleteBackup();
        this.logger.info('✓ Database restored from backup');
    }

    /**
     * Rollback using down() methods strategy.
     *
     * Calls down() on all attempted migrations in reverse order.
     * This includes the failed migration (last in array) to clean up partial changes.
     *
     * @param attemptedScripts - All scripts that were attempted (including the failed one)
     * @private
     */
    private async rollbackWithDown(attemptedScripts: MigrationScript<DB>[]): Promise<void> {
        if (attemptedScripts.length === 0) {
            this.logger.info('No migrations to rollback');
            return;
        }

        this.logger.info(`Rolling back ${attemptedScripts.length} migration(s) using down() methods...`);

        // Roll back all attempted migrations in reverse order
        // The failed migration is last in the array, so it will be rolled back first
        // Use spread operator to avoid mutating the caller's array
        for (const script of [...attemptedScripts].reverse()) {
            if (script.script.down) {
                this.logger.info(`Rolling back: ${script.name}`);
                await script.script.down(this.handler.db, script, this.handler);
            } else {
                this.logger.warn(`⚠️  No down() method for ${script.name} - skipping rollback`);
            }
        }

        this.logger.info('✓ Rollback completed using down() methods');
    }

    /**
     * Rollback using both strategies (down first, backup as fallback).
     *
     * Attempts to rollback using down() methods first. If that fails,
     * falls back to restoring from backup.
     *
     * @param attemptedScripts - All scripts that were attempted (including the failed one)
     * @param backupPath - Path to backup file
     * @private
     */
    private async rollbackWithBoth(attemptedScripts: MigrationScript<DB>[], backupPath: string | undefined): Promise<void> {
        try {
            // Try down() methods first (includes failed migration cleanup)
            await this.rollbackWithDown(attemptedScripts);
        } catch (downError) {
            this.logger.error(`down() rollback failed: ${downError}`);
            this.logger.info('Falling back to backup restore...');

            // Fallback to backup if down() fails
            await this.rollbackWithBackup(backupPath);
        }
    }

    /**
     * Determine if backup should be created based on backupMode and rollbackStrategy.
     *
     * Returns true only when:
     * - Rollback strategy is BACKUP or BOTH
     * - Backup mode is FULL or CREATE_ONLY
     *
     * @returns True if backup should be created, false otherwise
     * @private
     */
    private shouldBackupInMode(): boolean {
        const mode = this.config.backupMode;
        const strategy = this.config.rollbackStrategy;

        // Only create backup if rollback strategy involves backups
        if (strategy !== RollbackStrategy.BACKUP && strategy !== RollbackStrategy.BOTH) {
            return false;
        }

        // Check backup mode
        return mode === BackupMode.FULL || mode === BackupMode.CREATE_ONLY;
    }

    /**
     * Determine if restore should happen on failure based on backupMode and rollbackStrategy.
     *
     * Returns true only when:
     * - Rollback strategy is BACKUP or BOTH
     * - Backup mode is FULL or RESTORE_ONLY
     *
     * @returns True if restore should happen on failure, false otherwise
     * @private
     */
    private shouldRestoreInMode(): boolean {
        const mode = this.config.backupMode;
        const strategy = this.config.rollbackStrategy;

        // Only restore if rollback strategy involves backups
        if (strategy !== RollbackStrategy.BACKUP && strategy !== RollbackStrategy.BOTH) {
            return false;
        }

        // Check backup mode
        return mode === BackupMode.FULL || mode === BackupMode.RESTORE_ONLY;
    }
}
