/**
 * Transaction execution modes for migrations.
 *
 * Defines when and how database transactions are used during migration execution.
 * Each mode offers different trade-offs between safety, performance, and flexibility.
 *
 * @example
 * ```typescript
 * import { TransactionMode } from '@migration-script-runner/core';
 *
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
export enum TransactionMode {
    /**
     * Each migration runs in its own transaction.
     *
     * **Default mode** - Provides the best balance of safety and flexibility.
     *
     * **Behavior:**
     * - Each migration begins a new transaction before execution
     * - If migration succeeds: transaction commits
     * - If migration fails: transaction automatically rolls back
     * - Other successful migrations remain committed
     *
     * **Use Cases:**
     * - Standard migrations with independent changes
     * - Production deployments (recommended)
     * - When migrations should be isolated from each other
     *
     * **Benefits:**
     * - ✅ Safest option - failures don't affect successful migrations
     * - ✅ Each migration is atomic
     * - ✅ Easy to identify which migration failed
     * - ✅ Can resume from failure point
     *
     * **Trade-offs:**
     * - ⚠️ Multiple transaction overhead
     * - ⚠️ Can't rollback successful migrations in same run
     *
     * @example
     * ```typescript
     * config.transaction.mode = TransactionMode.PER_MIGRATION;
     *
     * // Execution:
     * // BEGIN; execute V001_create_users.ts; COMMIT;
     * // BEGIN; execute V002_create_posts.ts; COMMIT;
     * // BEGIN; execute V003_add_indexes.ts; ROLLBACK; (if this fails)
     * // Result: V001 and V002 are committed, V003 rolled back
     * ```
     */
    PER_MIGRATION = 'PER_MIGRATION',

    /**
     * All migrations run in a single batch transaction.
     *
     * **All-or-nothing semantics** - Either all migrations succeed together or all roll back.
     *
     * **Behavior:**
     * - One transaction begins before first migration
     * - All migrations execute within the same transaction
     * - If all succeed: single commit at the end
     * - If any fails: entire batch rolls back (including successful migrations)
     *
     * **Use Cases:**
     * - Tightly coupled migrations that must succeed together
     * - Schema changes that depend on each other
     * - When partial deployment is not acceptable
     * - Testing scenarios where you want to rollback everything
     *
     * **Benefits:**
     * - ✅ True atomic batch - all or nothing
     * - ✅ Single transaction overhead
     * - ✅ Consistent state guaranteed
     *
     * **Trade-offs:**
     * - ⚠️ One failure rolls back entire batch
     * - ⚠️ Long-running transaction (may hit timeouts)
     * - ⚠️ Can block other operations longer
     * - ⚠️ Must restart from beginning on failure
     *
     * @example
     * ```typescript
     * config.transaction.mode = TransactionMode.PER_BATCH;
     *
     * // Execution:
     * // BEGIN;
     * //   execute V001_create_users.ts;
     * //   execute V002_create_posts.ts;
     * //   execute V003_add_indexes.ts;  (if this fails...)
     * // ROLLBACK;  (all three migrations rolled back)
     * // Result: Database unchanged, must fix and retry all
     * ```
     */
    PER_BATCH = 'PER_BATCH',

    /**
     * No automatic transaction management.
     *
     * **Manual control** - Migration scripts manage their own transactions.
     *
     * **Behavior:**
     * - MSR does not begin/commit/rollback transactions
     * - Each migration script is responsible for transaction management
     * - Maximum flexibility for complex scenarios
     *
     * **Use Cases:**
     * - Long-running migrations that shouldn't be in transactions
     * - DDL operations that can't run in transactions (some databases)
     * - Custom transaction logic within migration scripts
     * - Database systems without transaction support
     * - Data migrations on large tables (avoid transaction log overflow)
     *
     * **Benefits:**
     * - ✅ Maximum flexibility
     * - ✅ No transaction overhead
     * - ✅ Can handle database-specific requirements
     * - ✅ Works with any database (NoSQL, key-value stores, etc.)
     *
     * **Trade-offs:**
     * - ⚠️ No automatic rollback on failure
     * - ⚠️ Migration scripts must handle transactions
     * - ⚠️ Requires careful error handling
     * - ⚠️ Risk of partial changes on failure
     *
     * @example
     * ```typescript
     * config.transaction.mode = TransactionMode.NONE;
     *
     * // Migration script handles transactions manually:
     * export default class V001_manual_transaction implements IRunnableScript {
     *   async up(db: IDB) {
     *     // Script manages transaction
     *     await db.query('BEGIN');
     *     try {
     *       await db.query('CREATE TABLE users ...');
     *       await db.query('INSERT INTO users ...');
     *       await db.query('COMMIT');
     *     } catch (error) {
     *       await db.query('ROLLBACK');
     *       throw error;
     *     }
     *   }
     * }
     * ```
     */
    NONE = 'NONE'
}
