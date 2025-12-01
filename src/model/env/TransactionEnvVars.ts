/**
 * Environment variables for transaction management configuration.
 *
 * Control transaction behavior, isolation levels, and automatic
 * retry logic for robust migration execution.
 *
 * @since v0.5.0
 *
 * @example
 * ```typescript
 * // Configure transactions via dot-notation
 * process.env[TransactionEnvVars.MSR_TRANSACTION_MODE] = 'PER_BATCH';
 * process.env[TransactionEnvVars.MSR_TRANSACTION_ISOLATION] = 'SERIALIZABLE';
 * process.env[TransactionEnvVars.MSR_TRANSACTION_RETRIES] = '5';
 *
 * // Or use JSON format
 * process.env[TransactionEnvVars.MSR_TRANSACTION] = JSON.stringify({
 *   mode: 'PER_MIGRATION',
 *   isolation: 'READ_COMMITTED',
 *   retries: 3,
 *   retryDelay: 100,
 *   retryBackoff: true
 * });
 * ```
 */
export enum TransactionEnvVars {
    /**
     * Complete transaction configuration as JSON (alternative to dot-notation).
     * @since v0.5.0
     */
    MSR_TRANSACTION = 'MSR_TRANSACTION',

    /**
     * Transaction mode: PER_MIGRATION, PER_BATCH, or NONE.
     * @default 'PER_MIGRATION'
     * @since v0.5.0
     */
    MSR_TRANSACTION_MODE = 'MSR_TRANSACTION_MODE',

    /**
     * SQL isolation level: READ_UNCOMMITTED, READ_COMMITTED, REPEATABLE_READ, or SERIALIZABLE.
     * @default 'READ_COMMITTED'
     * @since v0.5.0
     */
    MSR_TRANSACTION_ISOLATION = 'MSR_TRANSACTION_ISOLATION',

    /**
     * Transaction timeout in milliseconds.
     * @default 30000
     * @since v0.5.0
     */
    MSR_TRANSACTION_TIMEOUT = 'MSR_TRANSACTION_TIMEOUT',

    /**
     * Number of commit retry attempts on retriable errors.
     * @default 3
     * @since v0.5.0
     */
    MSR_TRANSACTION_RETRIES = 'MSR_TRANSACTION_RETRIES',

    /**
     * Initial delay between retries in milliseconds.
     * @default 100
     * @since v0.5.0
     */
    MSR_TRANSACTION_RETRY_DELAY = 'MSR_TRANSACTION_RETRY_DELAY',

    /**
     * Enable exponential backoff for retry delays.
     * @default true
     * @since v0.5.0
     */
    MSR_TRANSACTION_RETRY_BACKOFF = 'MSR_TRANSACTION_RETRY_BACKOFF',
}
