import { TransactionMode } from './TransactionMode';
import { IsolationLevel } from './IsolationLevel';

/**
 * Configuration for transaction management during migrations.
 *
 * Controls how migrations are executed within database transactions, including
 * transaction mode, isolation level, timeout, and automatic retry behavior.
 *
 * @example
 * ```typescript
 * import { TransactionConfig, TransactionMode, IsolationLevel } from '@migration-script-runner/core';
 *
 * // Default configuration (recommended)
 * const txConfig = new TransactionConfig();
 * // mode: PER_MIGRATION, isolation: READ_COMMITTED, retries: 3
 *
 * // Custom configuration
 * const txConfig = new TransactionConfig();
 * txConfig.mode = TransactionMode.PER_BATCH;
 * txConfig.isolation = IsolationLevel.SERIALIZABLE;
 * txConfig.retries = 5;
 * ```
 */
export class TransactionConfig {
    /**
     * Transaction execution mode.
     *
     * Determines when and how transactions are used during migration execution.
     *
     * @default TransactionMode.PER_MIGRATION
     *
     * @see {@link TransactionMode} for detailed explanation of each mode
     *
     * @example
     * ```typescript
     * // Each migration in its own transaction (default, safest)
     * config.transaction.mode = TransactionMode.PER_MIGRATION;
     *
     * // All migrations in single transaction (all-or-nothing)
     * config.transaction.mode = TransactionMode.PER_BATCH;
     *
     * // No automatic transactions (manual control)
     * config.transaction.mode = TransactionMode.NONE;
     * ```
     */
    mode: TransactionMode = TransactionMode.PER_MIGRATION;

    /**
     * Transaction isolation level.
     *
     * Controls how concurrent transactions interact. Optional - if not specified,
     * database default is used.
     *
     * **Note:** Not all databases support all isolation levels. If unsupported,
     * the setting is silently ignored.
     *
     * @default IsolationLevel.READ_COMMITTED
     *
     * @see {@link IsolationLevel} for detailed explanation of each level
     *
     * @example
     * ```typescript
     * // Default - good balance of safety and performance
     * config.transaction.isolation = IsolationLevel.READ_COMMITTED;
     *
     * // Maximum consistency (slowest, more deadlocks)
     * config.transaction.isolation = IsolationLevel.SERIALIZABLE;
     *
     * // Let database use its default
     * config.transaction.isolation = undefined;
     * ```
     */
    isolation?: IsolationLevel = IsolationLevel.READ_COMMITTED;

    /**
     * Transaction timeout in milliseconds.
     *
     * Maximum time a transaction can remain open before timing out.
     * Helps prevent long-running transactions from blocking the database.
     *
     * **Note:** Timeout enforcement depends on database implementation.
     * Some databases may not support transaction-level timeouts.
     *
     * @default 30000 (30 seconds)
     *
     * @example
     * ```typescript
     * // Short timeout for quick migrations
     * config.transaction.timeout = 10000;  // 10 seconds
     *
     * // Long timeout for data migrations
     * config.transaction.timeout = 300000; // 5 minutes
     *
     * // No timeout (use database default)
     * config.transaction.timeout = undefined;
     * ```
     */
    timeout?: number = 30000;

    /**
     * Number of automatic retry attempts on retriable errors.
     *
     * When a commit fails due to a retriable error (deadlock, serialization failure,
     * connection lost), MSR automatically retries the commit up to this many times.
     *
     * **Retriable Errors:**
     * - Deadlock detected
     * - Lock timeout
     * - Serialization failure
     * - Connection lost/closed
     *
     * **Set to 0** to disable automatic retries.
     *
     * @default 3
     *
     * @example
     * ```typescript
     * // Default - retry up to 3 times (recommended)
     * config.transaction.retries = 3;
     *
     * // More retries for high-contention databases
     * config.transaction.retries = 10;
     *
     * // Disable retries (fail immediately)
     * config.transaction.retries = 0;
     * ```
     */
    retries?: number = 3;

    /**
     * Base delay between retry attempts in milliseconds.
     *
     * When a commit fails and will be retried, MSR waits this long before trying again.
     * If {@link retryBackoff} is enabled, this is multiplied for each subsequent retry.
     *
     * @default 100 (100ms)
     *
     * @see {@link retryBackoff} for exponential backoff behavior
     *
     * @example
     * ```typescript
     * // Fast retries (low contention)
     * config.transaction.retryDelay = 50;   // 50ms
     *
     * // Slower retries (high contention)
     * config.transaction.retryDelay = 500;  // 500ms
     *
     * // With exponential backoff:
     * // retryDelay = 100, retryBackoff = true
     * // Attempt 1: wait 100ms
     * // Attempt 2: wait 200ms
     * // Attempt 3: wait 400ms
     * ```
     */
    retryDelay?: number = 100;

    /**
     * Enable exponential backoff for retry delays.
     *
     * When enabled, the delay between retries increases exponentially:
     * - Retry 1: {@link retryDelay} × 2^0 = retryDelay
     * - Retry 2: {@link retryDelay} × 2^1 = retryDelay × 2
     * - Retry 3: {@link retryDelay} × 2^2 = retryDelay × 4
     * - Retry N: {@link retryDelay} × 2^(N-1)
     *
     * **Recommended:** Leave enabled for production (reduces database contention).
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Exponential backoff (default, recommended)
     * config.transaction.retryBackoff = true;
     * config.transaction.retryDelay = 100;
     * // Delays: 100ms, 200ms, 400ms, 800ms...
     *
     * // Fixed delay (not recommended)
     * config.transaction.retryBackoff = false;
     * config.transaction.retryDelay = 100;
     * // Delays: 100ms, 100ms, 100ms, 100ms...
     * ```
     */
    retryBackoff?: boolean = true;
}
