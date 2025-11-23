import { MigrationScript } from "../model/MigrationScript";
import { IMigrationResult } from "./IMigrationResult";

/**
 * Lifecycle hooks for extending migration behavior.
 *
 * IMigrationHooks provides extension points throughout the migration lifecycle,
 * enabling custom behavior like notifications, metrics, logging, validation,
 * and integration with external services.
 *
 * All hooks are optional and async, allowing for non-blocking operations.
 * Hooks are called in sequence during migration execution.
 *
 * @example
 * ```typescript
 * // Slack notifications
 * class SlackHooks implements IMigrationHooks {
 *     constructor(private webhookUrl: string) {}
 *
 *     async onStart(total: number, pending: number): Promise<void> {
 *         await fetch(this.webhookUrl, {
 *             method: 'POST',
 *             body: JSON.stringify({
 *                 text: `🚀 Starting: ${pending}/${total} migrations`
 *             })
 *         });
 *     }
 *
 *     async onComplete(result: IMigrationResult): Promise<void> {
 *         await fetch(this.webhookUrl, {
 *             method: 'POST',
 *             body: JSON.stringify({
 *                 text: `✅ Completed: ${result.executed.length} migrations`
 *             })
 *         });
 *     }
 * }
 *
 * const executor = new MigrationScriptExecutor(handler, {
 *     hooks: new SlackHooks(process.env.SLACK_WEBHOOK)
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Metrics collection
 * class MetricsHooks implements IMigrationHooks {
 *     async onAfterMigrate(script: MigrationScript): Promise<void> {
 *         const duration = script.finishedAt! - script.startedAt!;
 *         metrics.timing('migration.duration', duration, {
 *             script: script.name
 *         });
 *     }
 *
 *     async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
 *         metrics.increment('migration.error', {
 *             script: script.name,
 *             error: error.message
 *         });
 *     }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Custom validation
 * class ValidationHooks implements IMigrationHooks {
 *     async onBeforeMigrate(script: MigrationScript): Promise<void> {
 *         // Enforce naming convention
 *         if (!script.name.match(/^V\d+_[a-z_]+\.ts$/)) {
 *             throw new Error(`Invalid script name: ${script.name}`);
 *         }
 *     }
 * }
 * ```
 */
export interface IMigrationHooks {

    /**
     * Called at the start of the migration process.
     *
     * Invoked before any backup or migration operations begin. Useful for
     * initialization, notifications, or logging.
     *
     * @param totalScripts - Total number of migration scripts found
     * @param pendingScripts - Number of scripts that will be executed
     *
     * @example
     * ```typescript
     * async onStart(total: number, pending: number): Promise<void> {
     *     console.log(`Starting migration: ${pending} of ${total} scripts`);
     *     await notifySlack(`Migration started`);
     * }
     * ```
     */
    onStart?(totalScripts: number, pendingScripts: number): Promise<void>;

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
     * Called before executing a migration script.
     *
     * Invoked immediately before script.up() is called. Useful for
     * validation, logging, or preparing script execution environment.
     *
     * @param script - Migration script about to be executed
     *
     * @example
     * ```typescript
     * async onBeforeMigrate(script: MigrationScript): Promise<void> {
     *     console.log(`Executing: ${script.name}`);
     *     metrics.increment('migration.started');
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Dry-run mode
     * async onBeforeMigrate(script: MigrationScript): Promise<void> {
     *     console.log(`[DRY RUN] Would execute: ${script.name}`);
     *     throw new Error('DRY_RUN_MODE'); // Skip execution
     * }
     * ```
     */
    onBeforeMigrate?(script: MigrationScript): Promise<void>;

    /**
     * Called after successfully executing a migration script.
     *
     * Invoked after script.up() completes successfully and script is saved
     * to schema version table. Useful for metrics, logging, or notifications.
     *
     * @param script - Migration script that was executed (includes timing info)
     * @param result - Result returned by script.up()
     *
     * @example
     * ```typescript
     * async onAfterMigrate(script: MigrationScript, result: string): Promise<void> {
     *     const duration = script.finishedAt! - script.startedAt!;
     *     console.log(`Completed ${script.name} in ${duration}ms: ${result}`);
     *     metrics.timing('migration.duration', duration);
     * }
     * ```
     */
    onAfterMigrate?(script: MigrationScript, result: string): Promise<void>;

    /**
     * Called when a migration script fails.
     *
     * Invoked when script.up() throws an error. Called before backup restoration
     * begins. Useful for error logging, notifications, or custom error handling.
     *
     * Note: This hook should not throw errors as it's called during error handling.
     *
     * @param script - Migration script that failed
     * @param error - Error thrown by the script
     *
     * @example
     * ```typescript
     * async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
     *     console.error(`Failed: ${script.name}`, error);
     *     metrics.increment('migration.error');
     *     await notifySlack(`Migration failed: ${script.name} - ${error.message}`);
     * }
     * ```
     */
    onMigrationError?(script: MigrationScript, error: Error): Promise<void>;

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

    /**
     * Called when all migrations complete successfully.
     *
     * Invoked after all migrations execute successfully, before returning
     * the result. Useful for final notifications, metrics, or cleanup.
     *
     * @param result - Complete migration result with execution details
     *
     * @example
     * ```typescript
     * async onComplete(result: IMigrationResult): Promise<void> {
     *     console.log(`✅ Success: ${result.executed.length} migrations executed`);
     *     await notifySlack(`Migration completed successfully`);
     *     metrics.increment('migration.success');
     * }
     * ```
     */
    onComplete?(result: IMigrationResult): Promise<void>;

    /**
     * Called when the migration process fails.
     *
     * Invoked when the overall migration process fails (after restoration if needed).
     * This is the final hook called during error scenarios. Useful for final
     * error handling, notifications, or cleanup.
     *
     * Note: This hook should not throw errors as it's called during error handling.
     *
     * @param error - Error that caused the migration to fail
     *
     * @example
     * ```typescript
     * async onError(error: Error): Promise<void> {
     *     console.error('Migration process failed:', error);
     *     await notifySlack(`❌ Migration failed: ${error.message}`);
     *     await sendErrorToMonitoring(error);
     * }
     * ```
     */
    onError?(error: Error): Promise<void>;
}
