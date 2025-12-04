import { ITransactionManager } from '../interface/service/ITransactionManager';
import { ICallbackTransactionalDB } from '../interface/dao/ITransactionalDB';
import { IsolationLevel } from '../model/IsolationLevel';
import { TransactionConfig } from '../model/TransactionConfig';
import { ILogger } from '../interface/ILogger';
import {IDB} from '../interface/dao';

/**
 * Transaction manager for callback-style transactional databases (NoSQL).
 *
 * Manages transactions for databases that use callback-based transaction APIs
 * like Firestore, MongoDB with sessions, and DynamoDB. Unlike {@link DefaultTransactionManager}
 * which uses imperative begin/commit/rollback, this manager collects operations
 * and executes them within a single `runTransaction()` callback.
 *
 * **Features:**
 * - Automatic retry with exponential backoff for transient errors
 * - Operation buffering for batch execution
 * - Compatible with NoSQL databases' native retry mechanisms
 *
 * **New in v0.5.0**
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 * - `TxContext` - Database-specific transaction context type (e.g., Firestore.Transaction)
 *
 * @template DB - Database interface type
 * @template TxContext - Database-specific transaction context type
 *
 * @example
 * ```typescript
 * import { CallbackTransactionManager } from '@migration-script-runner/core';
 * import { Firestore, Transaction } from '@google-cloud/firestore';
 *
 * const firestore = new Firestore();
 * const db: ICallbackTransactionalDB<Transaction> = {
 *   runTransaction: (cb) => firestore.runTransaction(cb),
 *   checkConnection: async () => true
 * };
 *
 * const config = new TransactionConfig();
 * config.retries = 3;
 * config.retryBackoff = true;
 *
 * const txManager = new CallbackTransactionManager<IDB, Transaction>(db, config);
 *
 * // Used by MigrationRunner
 * await txManager.begin();
 * // ... migrations execute ...
 * await txManager.commit();  // Executes all operations in single transaction
 * ```
 */
export class CallbackTransactionManager<DB extends IDB, TxContext = unknown> implements ITransactionManager<DB> {
    private operations: Array<(tx: TxContext) => Promise<void>> = [];

    /**
     * Create a new CallbackTransactionManager.
     *
     * @param db - Database instance implementing ICallbackTransactionalDB
     * @param config - Transaction configuration with retry settings
     * @param logger - Optional logger for transaction operations
     *
     * @example
     * ```typescript
     * const txManager = new CallbackTransactionManager<Transaction>(
     *   firestoreDB,
     *   new TransactionConfig(),
     *   new ConsoleLogger()
     * );
     * ```
     */
    constructor(
        private readonly db: ICallbackTransactionalDB<TxContext>,
        private readonly config: TransactionConfig,
        private readonly logger?: ILogger
    ) {}

    /**
     * Prepare to collect operations for callback transaction.
     *
     * For callback-style transactions, this initializes the operation buffer.
     * No actual database transaction is started until commit().
     *
     * @example
     * ```typescript
     * await txManager.begin();
     * // Operations will be buffered until commit()
     * ```
     */
    async begin(): Promise<void> {
        this.operations = [];
        this.logger?.debug('Prepared callback transaction (operation buffering started)');
    }

    /**
     * Execute all collected operations in a single runTransaction() call.
     *
     * Automatically retries on retriable errors (conflicts, contentions, timeouts)
     * using exponential backoff. All operations execute atomically within the
     * database's transaction callback.
     *
     * @throws Error if transaction fails after all retries
     *
     * @example
     * ```typescript
     * try {
     *   await txManager.commit();  // All operations execute in single transaction
     * } catch (error) {
     *   console.error('Transaction failed:', error);
     *   await txManager.rollback();
     * }
     * ```
     */
    async commit(): Promise<void> {
        if (this.operations.length === 0) {
            this.logger?.debug('No operations to execute');
            return;
        }

        const maxRetries = this.config.retries ?? 3;
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.executeTransaction();
                this.logSuccess(attempt);
                this.operations = [];
                return;
            } catch (error) {
                lastError = error as Error;
                const shouldRetry = await this.handleTransactionError(lastError, attempt, maxRetries);

                if (!shouldRetry) {
                    this.operations = [];
                    throw lastError;
                }
            }
        }

        /* istanbul ignore next */
        throw lastError ?? new Error('Transaction failed for unknown reason');
    }

    /**
     * Execute all operations in a single transaction.
     * @private
     */
    private async executeTransaction(): Promise<void> {
        await this.db.runTransaction(async (tx) => {
            for (const op of this.operations) {
                await op(tx);
            }
        });
    }

    /**
     * Log successful transaction execution.
     * @private
     */
    private logSuccess(attempt: number): void {
        const message = `Transaction executed successfully (${this.operations.length} operations)`;
        const attemptInfo = attempt > 1 ? ` (attempt ${attempt})` : '';
        this.logger?.debug(message + attemptInfo);
    }

    /**
     * Handle transaction error and determine if retry should happen.
     * @returns true if should retry, false otherwise
     * @private
     */
    private async handleTransactionError(error: Error, attempt: number, maxRetries: number): Promise<boolean> {
        const isRetriable = this.isRetriable(error);
        const hasMoreAttempts = attempt < maxRetries;

        if (isRetriable && hasMoreAttempts) {
            const delay = this.calculateDelay(attempt);
            this.logger?.warn(
                `Transaction failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`
            );
            await this.sleep(delay);
            return true;
        }

        this.logFinalError(error, isRetriable, maxRetries);
        return false;
    }

    /**
     * Log final error message based on error type.
     * @private
     */
    private logFinalError(error: Error, isRetriable: boolean, maxRetries: number): void {
        if (isRetriable) {
            this.logger?.error(`Transaction failed after ${maxRetries} attempts: ${error.message}`);
        } else {
            this.logger?.error(`Transaction failed with non-retriable error: ${error.message}`);
        }
    }

    /**
     * Discard all collected operations without executing.
     *
     * For callback-style transactions, this simply clears the operation buffer
     * since no actual database transaction was started.
     *
     * @example
     * ```typescript
     * await txManager.rollback();  // Discard buffered operations
     * ```
     */
    async rollback(): Promise<void> {
        const opCount = this.operations.length;
        this.operations = [];
        this.logger?.debug(`Discarded ${opCount} transaction operations`);
    }

    /**
     * Set isolation level (no-op for NoSQL databases).
     *
     * Most NoSQL databases don't support SQL-style isolation levels.
     * This method logs a warning and does nothing.
     *
     * @param level - Isolation level (ignored)
     *
     * @example
     * ```typescript
     * await txManager.setIsolationLevel(IsolationLevel.SERIALIZABLE);
     * // Logs warning: "Callback-style transactions do not support isolation levels"
     * ```
     */
    async setIsolationLevel(level: IsolationLevel): Promise<void> {
        this.logger?.warn(
            `Callback-style transactions do not support SQL isolation levels (requested: ${level})`
        );
    }

    /**
     * Add an operation to be executed in the transaction.
     *
     * Operations are buffered and executed together when commit() is called.
     * This method is primarily used internally by MSR's migration execution logic.
     *
     * @param op - Operation function receiving transaction context
     *
     * @example
     * ```typescript
     * txManager.addOperation(async (tx: Transaction) => {
     *   const doc = await tx.get(docRef);
     *   tx.update(docRef, { migrated: true });
     * });
     * ```
     */
    addOperation(op: (tx: TxContext) => Promise<void>): void {
        this.operations.push(op);
    }

    /**
     * Check if an error is retriable.
     *
     * Determines whether a transaction failure should trigger an automatic retry.
     * Uses error message pattern matching to detect retriable conditions.
     *
     * **Retriable Errors:**
     * - Conflict / contention
     * - Deadlock detected
     * - Timeout / lock wait timeout
     *
     * @param error - The error to check
     * @returns True if error is retriable, false otherwise
     */
    private isRetriable(error: Error): boolean {
        const message = error.message.toLowerCase();

        // Conflict/contention errors (common in NoSQL)
        if (message.includes('conflict') || message.includes('contention')) {
            return true;
        }

        // Deadlock errors
        if (message.includes('deadlock')) {
            return true;
        }

        // Timeout errors
        if (message.includes('timeout') || message.includes('lock wait')) {
            return true;
        }

        return false;
    }

    /**
     * Calculate retry delay with optional exponential backoff.
     *
     * @param attempt - Current attempt number (1-based)
     * @returns Delay in milliseconds
     */
    private calculateDelay(attempt: number): number {
        const baseDelay = this.config.retryDelay ?? 100;

        if (this.config.retryBackoff) {
            // Exponential backoff: baseDelay * 2^(attempt-1)
            return baseDelay * Math.pow(2, attempt - 1);
        }

        return baseDelay;
    }

    /**
     * Sleep for specified milliseconds.
     *
     * @param ms - Milliseconds to sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
