import { IMigrationResult } from "./IMigrationResult";
import {IDB} from "./dao";

/**
 * Lifecycle hooks for the overall migration process.
 *
 * Provides extension points for the high-level migration workflow:
 * - When the migration process starts
 * - When all migrations complete successfully
 * - When the migration process fails
 *
 * These hooks operate at the process level, not individual migration level.
 * All methods are optional.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * **New in v0.5.0**
 *
 * @example
 * ```typescript
 * import { IProcessHooks } from '@migration-script-runner/core';
 *
 * class NotificationHooks implements IProcessHooks<IDB> {
 *   async onStart(total: number, pending: number): Promise<void> {
 *     await this.slack.send(`🚀 Starting migration: ${pending}/${total} scripts`);
 *   }
 *
 *   async onComplete(result: IMigrationResult<IDB>): Promise<void> {
 *     await this.slack.send(`✅ Migration completed: ${result.executed.length} scripts executed`);
 *   }
 *
 *   async onError(error: Error): Promise<void> {
 *     await this.slack.send(`❌ Migration failed: ${error.message}`);
 *   }
 * }
 * ```
 */
export interface IProcessHooks<DB extends IDB> {
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
     * Called when all migrations complete successfully.
     *
     * Invoked after all migrations execute successfully, before returning
     * the result. Useful for final notifications, metrics, or cleanup.
     *
     * @param result - Complete migration result with execution details (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * async onComplete(result: IMigrationResult<IDB>): Promise<void> {
     *     console.log(`✅ Success: ${result.executed.length} migrations executed`);
     *     await notifySlack(`Migration completed successfully`);
     *     metrics.increment('migration.success');
     * }
     * ```
     */
    onComplete?(result: IMigrationResult<DB>): Promise<void>;

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
