import { ITransactionContext } from './service/ITransactionContext';
import {IDB} from "./dao";

/**
 * Lifecycle hooks for transaction operations.
 *
 * Provides extension points for monitoring, logging, and custom behavior
 * during transaction execution. All methods are optional - implement only
 * the hooks you need.
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
 * import { ITransactionHooks, ITransactionContext } from '@migration-script-runner/core';
 *
 * class TransactionMetricsHook implements ITransactionHooks<IDB> {
 *   async afterCommit(context: ITransactionContext<IDB>): Promise<void> {
 *     const duration = Date.now() - context.startTime;
 *     console.log(`Transaction ${context.transactionId} committed in ${duration}ms`);
 *     console.log(`Migrations: ${context.migrations.length}`);
 *     console.log(`Attempts: ${context.attempt}`);
 *   }
 *
 *   async onCommitRetry(context: ITransactionContext<IDB>, attempt: number, error: Error): Promise<void> {
 *     console.warn(`Commit retry #${attempt}: ${error.message}`);
 *   }
 * }
 *
 * // Usage with CompositeHooks
 * const hooks = new CompositeHooks<DB>([
 *   new ExecutionSummaryHook<DB>(),
 *   new TransactionMetricsHook()
 * ]);
 * ```
 */
export interface ITransactionHooks<DB extends IDB> {
    /**
     * Called before transaction begins.
     *
     * Use for logging, validation, or setting up transaction metadata.
     *
     * @param context - Transaction context with metadata (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * async beforeTransactionBegin(context: ITransactionContext<IDB>): Promise<void> {
     *   this.logger.info(`Starting ${context.mode} transaction for ${context.migrations.length} migrations`);
     *
     *   // Store deployment metadata
     *   context.metadata.deploymentId = process.env.DEPLOYMENT_ID;
     * }
     * ```
     */
    beforeTransactionBegin?(context: ITransactionContext<DB>): Promise<void>;

    /**
     * Called after transaction begins successfully.
     *
     * Use for registering transaction in external systems, starting timers, etc.
     *
     * @param context - Transaction context with metadata (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * async afterTransactionBegin(context: ITransactionContext<IDB>): Promise<void> {
     *   // Register transaction in monitoring system
     *   await this.monitoring.registerTransaction(context.transactionId, {
     *     mode: context.mode,
     *     migrations: context.migrations.map(m => m.name),
     *     startTime: context.startTime
     *   });
     * }
     * ```
     */
    afterTransactionBegin?(context: ITransactionContext<DB>): Promise<void>;

    /**
     * Called before commit attempt.
     *
     * Use for final validation, logging, or preparing for commit.
     *
     * @param context - Transaction context with metadata (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * async beforeCommit(context: ITransactionContext<IDB>): Promise<void> {
     *   // Log commit attempt
     *   this.logger.debug(`Committing transaction ${context.transactionId}`);
     *
     *   // Final validation
     *   if (context.migrations.some(m => m.hasErrors)) {
     *     throw new Error('Cannot commit transaction with errors');
     *   }
     * }
     * ```
     */
    beforeCommit?(context: ITransactionContext<DB>): Promise<void>;

    /**
     * Called after successful commit.
     *
     * Use for logging success, triggering post-migration tasks, cleanup, etc.
     *
     * @param context - Transaction context with metadata (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * async afterCommit(context: ITransactionContext<IDB>): Promise<void> {
     *   const duration = Date.now() - context.startTime;
     *
     *   this.logger.info(
     *     `Transaction ${context.transactionId} committed successfully ` +
     *     `(${duration}ms, ${context.attempt} attempts)`
     *   );
     *
     *   // Trigger webhooks
     *   await this.webhook.notify({
     *     event: 'migration.success',
     *     transactionId: context.transactionId,
     *     migrations: context.migrations.map(m => m.name)
     *   });
     * }
     * ```
     */
    afterCommit?(context: ITransactionContext<DB>): Promise<void>;

    /**
     * Called when commit fails and will be retried.
     *
     * Use for logging retry attempts, alerting on repeated failures, implementing
     * custom backoff strategies, etc.
     *
     * **Not called on final attempt failure** - use {@link afterRollback} for that.
     *
     * @param context - Transaction context with metadata (typed with generic DB parameter in v0.6.0)
     * @param attempt - Current attempt number (1 = first attempt, 2 = first retry, etc.)
     * @param error - The error that caused the failure
     *
     * @example
     * ```typescript
     * async onCommitRetry(context: ITransactionContext<IDB>, attempt: number, error: Error): Promise<void> {
     *   this.logger.warn(
     *     `Transaction ${context.transactionId} commit failed (attempt ${attempt}): ${error.message}`
     *   );
     *
     *   // Alert on repeated deadlocks
     *   if (attempt >= 3 && error.message.includes('deadlock')) {
     *     await this.slack.alert(
     *       `⚠️ Transaction ${context.transactionId} experiencing repeated deadlocks`
     *     );
     *   }
     *
     *   // Custom backoff
     *   if (error.message.includes('serialization')) {
     *     await this.sleep(1000 * attempt);  // Linear backoff
     *   }
     * }
     * ```
     */
    onCommitRetry?(context: ITransactionContext<DB>, attempt: number, error: Error): Promise<void>;

    /**
     * Called before rollback.
     *
     * Use for logging rollback reason, preparing for recovery, saving state, etc.
     *
     * @param context - Transaction context with metadata (typed with generic DB parameter in v0.6.0)
     * @param reason - The error that triggered rollback
     *
     * @example
     * ```typescript
     * async beforeRollback(context: ITransactionContext<IDB>, reason: Error): Promise<void> {
     *   this.logger.error(
     *     `Rolling back transaction ${context.transactionId}: ${reason.message}`
     *   );
     *
     *   // Save failure details for debugging
     *   await this.saveFailure({
     *     transactionId: context.transactionId,
     *     migrations: context.migrations.map(m => m.name),
     *     error: reason.message,
     *     stack: reason.stack,
     *     context: context.metadata
     *   });
     * }
     * ```
     */
    beforeRollback?(context: ITransactionContext<DB>, reason: Error): Promise<void>;

    /**
     * Called after rollback completes.
     *
     * Use for cleanup, notifying stakeholders, logging final state, etc.
     *
     * @param context - Transaction context with metadata (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * async afterRollback(context: ITransactionContext<IDB>): Promise<void> {
     *   const duration = Date.now() - context.startTime;
     *
     *   this.logger.info(
     *     `Transaction ${context.transactionId} rolled back ` +
     *     `(${duration}ms, ${context.attempt} attempts before failure)`
     *   );
     *
     *   // Notify team
     *   await this.slack.send(
     *     `🔴 Migration failed - transaction ${context.transactionId} rolled back. ` +
     *     `Migrations: ${context.migrations.map(m => m.name).join(', ')}`
     *   );
     *
     *   // Cleanup resources
     *   await this.monitoring.endTransaction(context.transactionId, 'rolled_back');
     * }
     * ```
     */
    afterRollback?(context: ITransactionContext<DB>): Promise<void>;
}
