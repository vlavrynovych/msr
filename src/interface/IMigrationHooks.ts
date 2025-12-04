import { IProcessHooks } from "./IProcessHooks";
import { IMigrationScriptHooks } from "./IMigrationScriptHooks";
import { IBackupHooks } from "./IBackupHooks";
import { ITransactionHooks } from "./ITransactionHooks";
import {IDB} from "./dao";

/**
 * Unified lifecycle hooks for extending migration behavior.
 *
 * IMigrationHooks combines all lifecycle hook interfaces, providing extension
 * points throughout the entire migration process:
 *
 * - **Process-level**: {@link IProcessHooks} - start, completion, errors
 * - **Script-level**: {@link IMigrationScriptHooks} - individual migration execution
 * - **Backup-level**: {@link IBackupHooks} - backup creation and restoration
 * - **Transaction-level**: {@link ITransactionHooks} - transaction lifecycle (v0.5.0)
 *
 * All hooks are optional and async, allowing for non-blocking operations.
 * Hooks are called in sequence during migration execution.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * **New in v0.5.0:** Transaction hooks added via {@link ITransactionHooks}
 *
 * @example
 * ```typescript
 * // Slack notifications for all lifecycle events
 * class SlackHooks implements IMigrationHooks<IDB> {
 *     constructor(private webhookUrl: string) {}
 *
 *     // Process hooks
 *     async onStart(total: number, pending: number): Promise<void> {
 *         await this.notify(`🚀 Starting: ${pending}/${total} migrations`);
 *     }
 *
 *     async onComplete(result: IMigrationResult<IDB>): Promise<void> {
 *         await this.notify(`✅ Completed: ${result.executed.length} migrations`);
 *     }
 *
 *     // Transaction hooks (v0.5.0)
 *     async afterCommit(context: ITransactionContext<IDB>): Promise<void> {
 *         await this.notify(`💾 Transaction committed: ${context.migrations.length} migrations`);
 *     }
 *
 *     async onCommitRetry(context: ITransactionContext<IDB>, attempt: number): Promise<void> {
 *         await this.notify(`⚠️ Commit retry #${attempt} for transaction ${context.transactionId}`);
 *     }
 *
 *     private async notify(text: string): Promise<void> {
 *         await fetch(this.webhookUrl, {
 *             method: 'POST',
 *             body: JSON.stringify({ text })
 *         });
 *     }
 * }
 *
 * const executor = new MigrationScriptExecutor<IDB>(handler, {
 *     hooks: new SlackHooks(process.env.SLACK_WEBHOOK)
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Comprehensive metrics collection
 * class MetricsHooks implements IMigrationHooks<IDB> {
 *     // Script hooks
 *     async onAfterMigrate(script: MigrationScript<IDB>): Promise<void> {
 *         const duration = script.finishedAt! - script.startedAt!;
 *         metrics.timing('migration.duration', duration, {
 *             script: script.name
 *         });
 *     }
 *
 *     async onMigrationError(script: MigrationScript<IDB>, error: Error): Promise<void> {
 *         metrics.increment('migration.error', {
 *             script: script.name,
 *             error: error.message
 *         });
 *     }
 *
 *     // Transaction hooks (v0.5.0)
 *     async afterCommit(context: ITransactionContext<IDB>): Promise<void> {
 *         const duration = Date.now() - context.startTime;
 *         metrics.timing('transaction.duration', duration, {
 *             mode: context.mode,
 *             migrations: context.migrations.length,
 *             attempts: context.attempt
 *         });
 *     }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Custom validation
 * class ValidationHooks implements IMigrationHooks<IDB> {
 *     async onBeforeMigrate(script: MigrationScript<IDB>): Promise<void> {
 *         // Enforce naming convention
 *         if (!script.name.match(/^V\d+_[a-z_]+\.ts$/)) {
 *             throw new Error(`Invalid script name: ${script.name}`);
 *         }
 *     }
 * }
 * ```
 */
export interface IMigrationHooks<DB extends IDB> extends
    IProcessHooks<DB>,
    IMigrationScriptHooks<DB>,
    IBackupHooks,
    ITransactionHooks<DB> {
    // All methods inherited from base interfaces:
    // - IProcessHooks: onStart, onComplete, onError
    // - IMigrationScriptHooks: onBeforeMigrate, onAfterMigrate, onMigrationError
    // - IBackupHooks: onBeforeBackup, onAfterBackup, onBeforeRestore, onAfterRestore
    // - ITransactionHooks: beforeTransactionBegin, afterTransactionBegin, beforeCommit,
    //                      afterCommit, onCommitRetry, beforeRollback, afterRollback
}
