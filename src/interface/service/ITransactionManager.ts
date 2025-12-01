import { IsolationLevel } from '../../model/IsolationLevel';

/**
 * Interface for managing database transactions.
 *
 * Provides transaction lifecycle management with automatic retry logic
 * for commit operations. MSR provides a default implementation ({@link DefaultTransactionManager})
 * that wraps {@link ITransactionalDB}, but users can provide custom implementations
 * for advanced scenarios (distributed transactions, savepoints, etc.).
 *
 * **New in v0.5.0**
 *
 * @example
 * ```typescript
 * // Using default implementation (automatic)
 * class PostgresDB implements ITransactionalDB {
 *   async beginTransaction(): Promise<void> { await this.pool.query('BEGIN'); }
 *   async commit(): Promise<void> { await this.pool.query('COMMIT'); }
 *   async rollback(): Promise<void> { await this.pool.query('ROLLBACK'); }
 * }
 * // MSR automatically creates DefaultTransactionManager wrapping PostgresDB
 *
 * // Custom implementation (advanced)
 * class CustomTransactionManager implements ITransactionManager {
 *   async begin(): Promise<void> {
 *     // Custom logic: distributed transactions, etc.
 *   }
 *   async commit(): Promise<void> {
 *     // Custom retry logic, savepoints, etc.
 *   }
 *   async rollback(): Promise<void> {
 *     // Custom cleanup logic
 *   }
 * }
 *
 * const handler: IDatabaseMigrationHandler = {
 *   db: myDB,
 *   transactionManager: new CustomTransactionManager(),  // Override
 *   // ...
 * };
 * ```
 */
export interface ITransactionManager {
    /**
     * Begin a new transaction.
     *
     * Called by MSR before executing migration(s) based on the configured
     * transaction mode.
     *
     * **PER_MIGRATION:** Called before each migration
     * **PER_BATCH:** Called once before all migrations
     * **NONE:** Never called
     *
     * @throws Error if transaction cannot be started
     *
     * @example
     * ```typescript
     * async begin(): Promise<void> {
     *   // Set isolation level if configured
     *   if (this.config.isolation) {
     *     await this.db.setIsolationLevel?.(this.config.isolation);
     *   }
     *
     *   // Begin transaction
     *   await this.db.beginTransaction();
     *
     *   // Log transaction start
     *   this.logger?.debug('Transaction started');
     * }
     * ```
     */
    begin(): Promise<void>;

    /**
     * Commit the current transaction.
     *
     * Called by MSR after successful migration execution. The default
     * implementation ({@link DefaultTransactionManager}) automatically retries
     * this operation on retriable errors (deadlocks, serialization failures).
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
     * @throws Error if commit fails after all retries
     *
     * @example
     * ```typescript
     * async commit(): Promise<void> {
     *   const maxRetries = this.config.retries ?? 3;
     *
     *   for (let attempt = 1; attempt <= maxRetries; attempt++) {
     *     try {
     *       await this.db.commit();
     *       return;  // Success!
     *     } catch (error) {
     *       if (attempt < maxRetries && this.isRetriable(error)) {
     *         const delay = this.calculateDelay(attempt);
     *         await this.sleep(delay);
     *         continue;
     *       }
     *       throw error;  // Give up
     *     }
     *   }
     * }
     * ```
     */
    commit(): Promise<void>;

    /**
     * Rollback the current transaction.
     *
     * Called by MSR when:
     * - Migration execution fails
     * - Commit fails after all retries
     * - Running in dry-run mode
     *
     * **Important:** Rollback should NOT be retried. If rollback fails, the
     * database may be in an inconsistent state.
     *
     * @throws Error if rollback fails (critical - manual intervention may be needed)
     *
     * @example
     * ```typescript
     * async rollback(): Promise<void> {
     *   try {
     *     await this.db.rollback();
     *     this.logger?.debug('Transaction rolled back');
     *   } catch (error) {
     *     this.logger?.error(`Rollback failed: ${error.message}`);
     *     throw error;  // Critical error - don't hide it
     *   }
     * }
     * ```
     */
    rollback(): Promise<void>;

    /**
     * Set the isolation level for the next transaction.
     *
     * Optional method - called before {@link begin} when isolation level is configured.
     * If not implemented, isolation level setting is skipped.
     *
     * @param level - SQL isolation level to set
     *
     * @example
     * ```typescript
     * async setIsolationLevel(level: IsolationLevel): Promise<void> {
     *   await this.db.setIsolationLevel?.(level);
     * }
     * ```
     */
    setIsolationLevel?(level: IsolationLevel): Promise<void>;
}
