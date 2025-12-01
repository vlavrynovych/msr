/**
 * SQL transaction isolation levels.
 *
 * Defines how concurrent transactions interact with each other.
 * Each level offers different trade-offs between consistency and performance.
 *
 * **Note:** Not all databases support all isolation levels. If an isolation level
 * is not supported by the database, it will be ignored (no error thrown).
 *
 * @see {@link https://en.wikipedia.org/wiki/Isolation_(database_systems) | Wikipedia: Isolation Levels}
 *
 * @example
 * ```typescript
 * import { IsolationLevel } from '@migration-script-runner/core';
 *
 * // Default (recommended for most cases)
 * config.transaction.isolation = IsolationLevel.READ_COMMITTED;
 *
 * // Maximum consistency (slowest)
 * config.transaction.isolation = IsolationLevel.SERIALIZABLE;
 * ```
 */
export enum IsolationLevel {
    /**
     * Read Uncommitted isolation level.
     *
     * **Lowest isolation** - Allows dirty reads, non-repeatable reads, and phantom reads.
     *
     * **Behavior:**
     * - Transactions can read uncommitted changes from other transactions
     * - No locks acquired for reads
     * - Fastest but least consistent
     *
     * **Problems:**
     * - 🔴 Dirty reads: Read uncommitted data that may be rolled back
     * - 🔴 Non-repeatable reads: Same query returns different results
     * - 🔴 Phantom reads: New rows appear in subsequent queries
     *
     * **Use Cases:**
     * - Read-heavy workloads where consistency is not critical
     * - Reporting/analytics where approximate data is acceptable
     * - When performance is paramount
     *
     * **Database Support:**
     * - ✅ PostgreSQL, MySQL, SQL Server
     * - ❌ Oracle (treats as READ_COMMITTED)
     *
     * @example
     * ```typescript
     * config.transaction.isolation = IsolationLevel.READ_UNCOMMITTED;
     * // Fast but risky - only use when consistency doesn't matter
     * ```
     */
    READ_UNCOMMITTED = 'READ UNCOMMITTED',

    /**
     * Read Committed isolation level.
     *
     * **Default for most databases** - Prevents dirty reads but allows non-repeatable reads.
     *
     * **Behavior:**
     * - Transactions only read committed data
     * - Locks released immediately after read
     * - Good balance of consistency and performance
     *
     * **Problems Prevented:**
     * - ✅ Dirty reads: Cannot read uncommitted data
     *
     * **Problems Allowed:**
     * - 🟡 Non-repeatable reads: Data can change between reads
     * - 🟡 Phantom reads: New rows can appear
     *
     * **Use Cases:**
     * - Most production migrations (recommended default)
     * - General-purpose transactions
     * - When you need consistency without locking overhead
     *
     * **Database Support:**
     * - ✅ PostgreSQL (default), Oracle (default), SQL Server, MySQL
     *
     * @example
     * ```typescript
     * config.transaction.isolation = IsolationLevel.READ_COMMITTED;
     * // Recommended default - good balance of safety and performance
     * ```
     */
    READ_COMMITTED = 'READ COMMITTED',

    /**
     * Repeatable Read isolation level.
     *
     * **Higher isolation** - Prevents dirty and non-repeatable reads.
     *
     * **Behavior:**
     * - Transactions see consistent snapshot of data
     * - Same query returns same results throughout transaction
     * - Locks held until transaction completes
     *
     * **Problems Prevented:**
     * - ✅ Dirty reads: Cannot read uncommitted data
     * - ✅ Non-repeatable reads: Data stays consistent
     *
     * **Problems Allowed:**
     * - 🟡 Phantom reads: New rows matching query can appear (in some databases)
     *
     * **Use Cases:**
     * - When consistent snapshot is required
     * - Financial calculations that must be consistent
     * - Multi-step migrations that need stable data
     *
     * **Database Support:**
     * - ✅ MySQL (default for InnoDB), PostgreSQL, SQL Server
     * - ⚠️ PostgreSQL: Actually implements snapshot isolation (stronger)
     *
     * @example
     * ```typescript
     * config.transaction.isolation = IsolationLevel.REPEATABLE_READ;
     * // Use when you need consistent snapshot throughout transaction
     * ```
     */
    REPEATABLE_READ = 'REPEATABLE READ',

    /**
     * Serializable isolation level.
     *
     * **Highest isolation** - Full ACID compliance, transactions appear sequential.
     *
     * **Behavior:**
     * - Transactions execute as if running one at a time
     * - Complete isolation from concurrent transactions
     * - Maximum locks, may block other transactions
     * - May cause more deadlocks
     *
     * **Problems Prevented:**
     * - ✅ Dirty reads: Cannot read uncommitted data
     * - ✅ Non-repeatable reads: Data stays consistent
     * - ✅ Phantom reads: No new rows appear
     *
     * **Use Cases:**
     * - Critical financial transactions
     * - When absolute consistency is required
     * - Compliance requirements (audit trails)
     * - Testing complex transaction scenarios
     *
     * **Trade-offs:**
     * - ⚠️ Slowest performance
     * - ⚠️ Higher chance of deadlocks
     * - ⚠️ Can block other operations
     * - ⚠️ May require more retries
     *
     * **Database Support:**
     * - ✅ PostgreSQL, Oracle, SQL Server, MySQL
     *
     * @example
     * ```typescript
     * config.transaction.isolation = IsolationLevel.SERIALIZABLE;
     * config.transaction.retries = 10;  // Increase retries due to deadlocks
     * // Use only when absolute consistency is required
     * ```
     */
    SERIALIZABLE = 'SERIALIZABLE'
}
