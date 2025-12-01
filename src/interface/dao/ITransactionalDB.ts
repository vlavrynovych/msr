import { IDB } from './IDB';

/**
 * Interface for transactional database connections.
 *
 * Extends IDB with transaction management capabilities. Databases implementing this
 * interface can participate in MSR's automatic transaction management with retry logic.
 *
 * **New in v0.5.0**
 *
 * @example
 * ```typescript
 * // PostgreSQL implementation
 * import { Pool } from 'pg';
 * import { ITransactionalDB } from '@migration-script-runner/core';
 *
 * class PostgresDB implements ITransactionalDB {
 *   constructor(private pool: Pool) {}
 *
 *   async checkConnection(): Promise<boolean> {
 *     try {
 *       await this.pool.query('SELECT 1');
 *       return true;
 *     } catch {
 *       return false;
 *     }
 *   }
 *
 *   async beginTransaction(): Promise<void> {
 *     await this.pool.query('BEGIN');
 *   }
 *
 *   async commit(): Promise<void> {
 *     await this.pool.query('COMMIT');
 *   }
 *
 *   async rollback(): Promise<void> {
 *     await this.pool.query('ROLLBACK');
 *   }
 *
 *   async setIsolationLevel(level: IsolationLevel): Promise<void> {
 *     await this.pool.query(`SET TRANSACTION ISOLATION LEVEL ${level}`);
 *   }
 * }
 *
 * // Usage with MSR
 * const handler: IDatabaseMigrationHandler = {
 *   db: new PostgresDB(pool),
 *   schemaVersion: schemaVersionImpl,
 *   getName: () => 'PostgreSQL Handler',
 *   getVersion: () => '1.0.0'
 * };
 * ```
 */
export interface ITransactionalDB extends IDB {
    /**
     * Begin a new database transaction.
     *
     * Called automatically by MSR before executing migrations based on the
     * configured transaction mode.
     *
     * @throws Error if transaction cannot be started
     *
     * @example
     * ```typescript
     * // PostgreSQL
     * async beginTransaction(): Promise<void> {
     *   await this.pool.query('BEGIN');
     * }
     *
     * // MySQL
     * async beginTransaction(): Promise<void> {
     *   await this.connection.beginTransaction();
     * }
     *
     * // MongoDB
     * async beginTransaction(): Promise<void> {
     *   this.session = this.client.startSession();
     *   this.session.startTransaction();
     * }
     * ```
     */
    beginTransaction(): Promise<void>;

    /**
     * Commit the current transaction.
     *
     * Called automatically by MSR after successful migration execution.
     * MSR will automatically retry this operation on retriable errors (deadlocks,
     * serialization failures, connection issues).
     *
     * @throws Error if commit fails (will trigger retry or rollback)
     *
     * @example
     * ```typescript
     * // PostgreSQL
     * async commit(): Promise<void> {
     *   await this.pool.query('COMMIT');
     * }
     *
     * // MySQL
     * async commit(): Promise<void> {
     *   await this.connection.commit();
     * }
     *
     * // MongoDB
     * async commit(): Promise<void> {
     *   await this.session?.commitTransaction();
     *   this.session?.endSession();
     * }
     * ```
     */
    commit(): Promise<void>;

    /**
     * Rollback the current transaction.
     *
     * Called automatically by MSR when migration execution fails or when
     * running in dry-run mode.
     *
     * @throws Error if rollback fails (critical error - transaction may be in inconsistent state)
     *
     * @example
     * ```typescript
     * // PostgreSQL
     * async rollback(): Promise<void> {
     *   await this.pool.query('ROLLBACK');
     * }
     *
     * // MySQL
     * async rollback(): Promise<void> {
     *   await this.connection.rollback();
     * }
     *
     * // MongoDB
     * async rollback(): Promise<void> {
     *   await this.session?.abortTransaction();
     *   this.session?.endSession();
     * }
     * ```
     */
    rollback(): Promise<void>;

    /**
     * Set the isolation level for the next transaction.
     *
     * Optional method - not all databases support all isolation levels.
     * If not implemented or isolation level not supported, MSR silently
     * ignores the setting.
     *
     * **Called before beginTransaction()** when `config.transaction.isolation` is set.
     *
     * @param level - SQL isolation level to set
     *
     * @example
     * ```typescript
     * // PostgreSQL
     * async setIsolationLevel(level: IsolationLevel): Promise<void> {
     *   await this.pool.query(`SET TRANSACTION ISOLATION LEVEL ${level}`);
     * }
     *
     * // MySQL
     * async setIsolationLevel(level: IsolationLevel): Promise<void> {
     *   await this.connection.query(`SET TRANSACTION ISOLATION LEVEL ${level}`);
     * }
     *
     * // SQLite (doesn't support isolation levels)
     * // Don't implement this method - MSR will skip it
     * ```
     */
    setIsolationLevel?(level: string): Promise<void>;
}

/**
 * Interface for callback-based transactional database connections (NoSQL-style).
 *
 * Used by NoSQL databases that use callback-based transaction APIs like Firestore,
 * MongoDB with sessions, and DynamoDB transactions.
 *
 * Unlike {@link ITransactionalDB} which uses imperative begin/commit/rollback,
 * this interface wraps all operations in a callback that is automatically
 * committed on success or rolled back on exception.
 *
 * **New in v0.5.0**
 *
 * @typeParam TxContext - Database-specific transaction context type
 *
 * @example
 * ```typescript
 * // Firestore implementation
 * import { Firestore, Transaction } from '@google-cloud/firestore';
 * import { ICallbackTransactionalDB } from '@migration-script-runner/core';
 *
 * class FirestoreDB implements ICallbackTransactionalDB<Transaction> {
 *   constructor(private firestore: Firestore) {}
 *
 *   async checkConnection(): Promise<boolean> {
 *     try {
 *       await this.firestore.collection('_health').limit(1).get();
 *       return true;
 *     } catch {
 *       return false;
 *     }
 *   }
 *
 *   async runTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T> {
 *     return this.firestore.runTransaction(callback);
 *   }
 * }
 *
 * // Usage in migration
 * export const up = async (db, info, handler) => {
 *   const firestore = (db as FirestoreDB).firestore;
 *
 *   await db.runTransaction!(async (tx: Transaction) => {
 *     const docRef = firestore.collection('users').doc('user1');
 *     const doc = await tx.get(docRef);
 *     tx.update(docRef, { migrated: true, version: info.version });
 *   });
 * };
 * ```
 */
export interface ICallbackTransactionalDB<TxContext = unknown> extends IDB {
    /**
     * Execute a transaction callback.
     *
     * All database operations must be performed within the callback using
     * the provided transaction context. The transaction is automatically:
     * - Committed if callback completes successfully
     * - Rolled back if callback throws an error
     * - Retried by the database if conflicts occur (implementation-dependent)
     *
     * @param callback - Function receiving database-specific transaction context
     * @returns Promise resolving to callback return value
     *
     * @example
     * ```typescript
     * // Firestore
     * await db.runTransaction<void, FirebaseFirestore.Transaction>(async (tx) => {
     *   const doc = await tx.get(docRef);
     *   tx.update(docRef, { count: doc.data().count + 1 });
     * });
     *
     * // MongoDB with sessions
     * await db.runTransaction<void, ClientSession>(async (session) => {
     *   await collection.updateOne(
     *     { _id: 'user1' },
     *     { $set: { migrated: true } },
     *     { session }
     *   );
     * });
     * ```
     */
    runTransaction<T>(callback: (tx: TxContext) => Promise<T>): Promise<T>;
}

/**
 * Union type for any database supporting transactions (either style).
 *
 * Use this when you need to accept either imperative or callback-style
 * transactional databases.
 *
 * **New in v0.5.0**
 *
 * @typeParam TxContext - Transaction context type for callback-style databases
 */
export type AnyTransactionalDB<TxContext = unknown> =
    | ITransactionalDB
    | ICallbackTransactionalDB<TxContext>;

/**
 * Type guard to check if database supports imperative transactions (SQL-style).
 *
 * Checks for begin/commit/rollback methods typical of SQL databases.
 *
 * **New in v0.5.0**
 *
 * @param db - Database instance to check
 * @returns true if database implements ITransactionalDB, false otherwise
 *
 * @example
 * ```typescript
 * import { isImperativeTransactional } from '@migration-script-runner/core';
 *
 * if (isImperativeTransactional(handler.db)) {
 *   // SQL-style transactions
 *   await handler.db.beginTransaction();
 *   // ... operations ...
 *   await handler.db.commit();
 * }
 * ```
 */
export function isImperativeTransactional(db: IDB): db is ITransactionalDB {
    return (
        'beginTransaction' in db &&
        'commit' in db &&
        'rollback' in db
    );
}

/**
 * Type guard to check if database supports callback transactions (NoSQL-style).
 *
 * Checks for runTransaction method typical of NoSQL databases like Firestore.
 *
 * **New in v0.5.0**
 *
 * @param db - Database instance to check
 * @returns true if database implements ICallbackTransactionalDB, false otherwise
 *
 * @example
 * ```typescript
 * import { isCallbackTransactional } from '@migration-script-runner/core';
 *
 * if (isCallbackTransactional<Transaction>(handler.db)) {
 *   // NoSQL-style transactions
 *   await handler.db.runTransaction(async (tx) => {
 *     // ... operations with tx ...
 *   });
 * }
 * ```
 */
export function isCallbackTransactional<TxContext = unknown>(
    db: IDB
): db is ICallbackTransactionalDB<TxContext> {
    return 'runTransaction' in db;
}

/**
 * Type guard to check if database supports any transaction style.
 *
 * Checks for either imperative (begin/commit/rollback) or callback (runTransaction)
 * transaction support.
 *
 * **New in v0.5.0**
 *
 * @param db - Database instance to check
 * @returns true if database supports any transaction style, false otherwise
 *
 * @example
 * ```typescript
 * import { isTransactionalDB } from '@migration-script-runner/core';
 *
 * if (isTransactionalDB(handler.db)) {
 *   // Database supports transactions (either style)
 *   console.log('Transactions supported');
 * } else {
 *   console.warn('No transaction support - use TransactionMode.NONE');
 * }
 * ```
 */
export function isTransactionalDB(db: IDB): db is AnyTransactionalDB {
    return isImperativeTransactional(db) || isCallbackTransactional(db);
}
