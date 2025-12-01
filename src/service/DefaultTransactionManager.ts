import { ITransactionManager } from '../interface/service/ITransactionManager';
import { ITransactionalDB } from '../interface/dao/ITransactionalDB';
import { IsolationLevel } from '../model/IsolationLevel';
import { TransactionConfig } from '../model/TransactionConfig';
import { ILogger } from '../interface/ILogger';

/**
 * Default implementation of {@link ITransactionManager}.
 *
 * Wraps an {@link ITransactionalDB} instance and provides automatic retry logic
 * for commit operations. This is the standard transaction manager used by MSR
 * when a custom transaction manager is not provided.
 *
 * **Features:**
 * - Automatic commit retry with exponential backoff
 * - Intelligent error detection (retriable vs non-retriable)
 * - Configurable retry attempts and delays
 * - Optional isolation level management
 *
 * **Retriable Errors:**
 * - Deadlock detected
 * - Lock timeout
 * - Serialization failure
 * - Connection lost/closed
 *
 * **Non-Retriable Errors:**
 * - Constraint violations
 * - Data type errors
 * - Permission errors
 *
 * **New in v0.5.0**
 *
 * @example
 * ```typescript
 * import { DefaultTransactionManager } from '@migration-script-runner/core';
 *
 * // Create transaction manager
 * const transactionManager = new DefaultTransactionManager(
 *   db,                // ITransactionalDB instance
 *   config.transaction, // TransactionConfig
 *   logger             // Optional logger
 * );
 *
 * // Use in migrations
 * await transactionManager.begin();
 * try {
 *   // Execute migrations...
 *   await transactionManager.commit();  // Automatic retry on retriable errors
 * } catch (error) {
 *   await transactionManager.rollback();
 *   throw error;
 * }
 * ```
 */
export class DefaultTransactionManager implements ITransactionManager {
    /**
     * Create a new DefaultTransactionManager.
     *
     * @param db - Database instance implementing ITransactionalDB
     * @param config - Transaction configuration with retry settings
     * @param logger - Optional logger for transaction operations
     *
     * @example
     * ```typescript
     * const txManager = new DefaultTransactionManager(
     *   myDB,
     *   new TransactionConfig(),
     *   new ConsoleLogger()
     * );
     * ```
     */
    constructor(
        private readonly db: ITransactionalDB,
        private readonly config: TransactionConfig,
        private readonly logger?: ILogger
    ) {}

    /**
     * Begin a new transaction.
     *
     * Sets the isolation level (if configured) and starts the transaction.
     *
     * @throws Error if transaction cannot be started
     *
     * @example
     * ```typescript
     * await transactionManager.begin();
     * ```
     */
    async begin(): Promise<void> {
        // Set isolation level if configured
        if (this.config.isolation && this.db.setIsolationLevel) {
            await this.db.setIsolationLevel(this.config.isolation);
            this.logger?.debug(`Isolation level set to: ${this.config.isolation}`);
        }

        // Begin transaction
        await this.db.beginTransaction();
        this.logger?.debug('Transaction started');
    }

    /**
     * Commit the current transaction with automatic retry.
     *
     * Automatically retries commit on retriable errors (deadlocks, serialization failures)
     * using exponential backoff. Throws error after all retry attempts are exhausted.
     *
     * @throws Error if commit fails after all retries
     *
     * @example
     * ```typescript
     * try {
     *   await transactionManager.commit();  // Retries automatically
     * } catch (error) {
     *   console.error('Commit failed after all retries:', error);
     *   await transactionManager.rollback();
     * }
     * ```
     */
    async commit(): Promise<void> {
        const maxRetries = this.config.retries ?? 3;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.db.commit();
                this.logger?.debug(`Transaction committed successfully${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
                return; // Success!
            } catch (error) {
                lastError = error as Error;

                // Check if we should retry
                const isRetriable = this.isRetriable(lastError);
                const hasMoreAttempts = attempt < maxRetries;

                if (isRetriable && hasMoreAttempts) {
                    const delay = this.calculateDelay(attempt);
                    this.logger?.warn(
                        `Commit failed (attempt ${attempt}/${maxRetries}): ${lastError.message}. ` +
                        `Retrying in ${delay}ms...`
                    );
                    await this.sleep(delay);
                    continue; // Retry
                } else {
                    // Non-retriable error or no more attempts
                    if (!isRetriable) {
                        this.logger?.error(`Commit failed with non-retriable error: ${lastError.message}`);
                    } else {
                        this.logger?.error(`Commit failed after ${maxRetries} attempts: ${lastError.message}`);
                    }
                    throw lastError;
                }
            }
        }

        // Should never reach here, but TypeScript doesn't know that
        /* istanbul ignore next */
        throw lastError ?? new Error('Commit failed for unknown reason');
    }

    /**
     * Rollback the current transaction.
     *
     * **Important:** Rollback is NOT retried. If rollback fails, the database
     * may be in an inconsistent state requiring manual intervention.
     *
     * @throws Error if rollback fails (critical error)
     *
     * @example
     * ```typescript
     * try {
     *   await transactionManager.rollback();
     * } catch (error) {
     *   console.error('CRITICAL: Rollback failed:', error);
     *   // Manual intervention may be required
     * }
     * ```
     */
    async rollback(): Promise<void> {
        try {
            await this.db.rollback();
            this.logger?.debug('Transaction rolled back');
        } catch (error) {
            this.logger?.error(`Rollback failed: ${(error as Error).message}`);
            throw error; // Don't hide rollback failures
        }
    }

    /**
     * Set the isolation level for the next transaction.
     *
     * Optional method - only available if the database supports isolation level management.
     *
     * @param level - SQL isolation level to set
     *
     * @example
     * ```typescript
     * await transactionManager.setIsolationLevel(IsolationLevel.SERIALIZABLE);
     * await transactionManager.begin();
     * ```
     */
    async setIsolationLevel(level: IsolationLevel): Promise<void> {
        if (this.db.setIsolationLevel) {
            await this.db.setIsolationLevel(level);
            this.logger?.debug(`Isolation level set to: ${level}`);
        } else {
            this.logger?.warn('Database does not support setIsolationLevel()');
        }
    }

    /**
     * Check if an error is retriable.
     *
     * Determines whether a commit failure should trigger an automatic retry.
     * Uses error message pattern matching to detect retriable conditions.
     *
     * **Retriable Errors:**
     * - Deadlock detected
     * - Lock timeout / wait timeout
     * - Serialization failure / could not serialize
     * - Connection lost/closed/reset
     *
     * @param error - The error to check
     * @returns True if error is retriable, false otherwise
     *
     * @example
     * ```typescript
     * const error = new Error('deadlock detected');
     * if (this.isRetriable(error)) {
     *   console.log('Error can be retried');
     * }
     * ```
     */
    private isRetriable(error: Error): boolean {
        const message = error.message.toLowerCase();

        // Deadlock errors
        if (message.includes('deadlock')) {
            return true;
        }

        // Lock timeout errors
        if (message.includes('lock timeout') || message.includes('lock wait timeout')) {
            return true;
        }

        // Serialization errors
        if (message.includes('serialization') || message.includes('could not serialize')) {
            return true;
        }

        // Connection errors
        if (message.includes('connection') &&
            (message.includes('lost') || message.includes('closed') || message.includes('reset'))) {
            return true;
        }

        return false;
    }

    /**
     * Calculate retry delay with optional exponential backoff.
     *
     * Implements exponential backoff when configured, otherwise returns fixed delay.
     *
     * @param attempt - Current attempt number (1-based)
     * @returns Delay in milliseconds
     *
     * @example
     * ```typescript
     * // With exponential backoff (retryDelay=100, retryBackoff=true):
     * // attempt 1: 100ms
     * // attempt 2: 200ms
     * // attempt 3: 400ms
     *
     * // Without exponential backoff (retryDelay=100, retryBackoff=false):
     * // All attempts: 100ms
     * ```
     */
    private calculateDelay(attempt: number): number {
        const baseDelay = this.config.retryDelay ?? 100;

        if (this.config.retryBackoff) {
            // Exponential backoff: baseDelay * 2^(attempt-1)
            return baseDelay * Math.pow(2, attempt - 1);
        }

        // Fixed delay
        return baseDelay;
    }

    /**
     * Sleep for specified milliseconds.
     *
     * Utility method for implementing retry delays.
     *
     * @param ms - Milliseconds to sleep
     *
     * @example
     * ```typescript
     * await this.sleep(1000); // Sleep for 1 second
     * ```
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
