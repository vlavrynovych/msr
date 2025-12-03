import { MigrationScript } from '../../model/MigrationScript';
import { TransactionMode } from '../../model/TransactionMode';
import { IsolationLevel } from '../../model/IsolationLevel';
import {IDB} from "../dao";

/**
 * Context information for transaction lifecycle hooks.
 *
 * Provides metadata about the current transaction for monitoring, logging,
 * and alerting purposes. Passed to all transaction hook methods.
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
 * class MetricsHook implements ITransactionHooks<IDB> {
 *   async afterCommit(context: ITransactionContext<IDB>): Promise<void> {
 *     console.log(`Transaction ${context.transactionId} committed`);
 *     console.log(`Migrations: ${context.migrations.map(m => m.name).join(', ')}`);
 *     console.log(`Duration: ${Date.now() - context.startTime}ms`);
 *     console.log(`Attempts: ${context.attempt}`);
 *   }
 * }
 * ```
 */
export interface ITransactionContext<DB extends IDB> {
    /**
     * Unique identifier for this transaction.
     *
     * Generated when transaction begins. Useful for correlating logs,
     * tracking transactions across systems, and debugging.
     *
     * @example
     * ```typescript
     * // Format: tx-[mode]-[timestamp]
     * transactionId: 'tx-PER_MIGRATION-1735689600123'
     * transactionId: 'tx-PER_BATCH-1735689600456'
     * ```
     */
    transactionId: string;

    /**
     * Transaction execution mode for this transaction.
     *
     * Indicates whether this is a per-migration transaction, per-batch
     * transaction, or no transaction.
     */
    mode: TransactionMode;

    /**
     * Transaction isolation level (if configured).
     *
     * undefined if using database default isolation level.
     */
    isolation?: IsolationLevel;

    /**
     * Migration scripts included in this transaction.
     * Typed with the generic DB parameter (v0.6.0).
     *
     * - PER_MIGRATION mode: Array with single migration
     * - PER_BATCH mode: Array with all migrations in batch
     * - NONE mode: Empty array
     */
    migrations: MigrationScript<DB>[];

    /**
     * Transaction start timestamp (Unix milliseconds).
     *
     * Captured when transaction begins. Use with Date.now() to calculate
     * transaction duration.
     *
     * @example
     * ```typescript
     * const duration = Date.now() - context.startTime;
     * console.log(`Transaction took ${duration}ms`);
     * ```
     */
    startTime: number;

    /**
     * Current commit attempt number (for retries).
     *
     * - 1 = First attempt
     * - 2 = First retry
     * - 3 = Second retry
     * - etc.
     *
     * Increments only for commit retries, not for transaction begin retries.
     *
     * @example
     * ```typescript
     * async onCommitRetry(context: ITransactionContext<DB>, attempt: number) {
     *   if (context.attempt >= 3) {
     *     await this.slack.alert(`Transaction ${context.transactionId} failing repeatedly`);
     *   }
     * }
     * ```
     */
    attempt: number;

    /**
     * Custom metadata for this transaction.
     *
     * Free-form object for storing additional context. Useful for passing
     * data between hooks or storing application-specific information.
     *
     * @example
     * ```typescript
     * // Store deployment info
     * context.metadata = {
     *   deploymentId: process.env.DEPLOYMENT_ID,
     *   environment: 'production',
     *   user: 'deploy-bot'
     * };
     *
     * // Store performance metrics
     * context.metadata = {
     *   queriesExecuted: 42,
     *   rowsAffected: 1000
     * };
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: Record<string, any>;
}
