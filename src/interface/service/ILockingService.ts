import { IDB } from '../dao';

/**
 * Status information about a migration lock.
 *
 * Provides details about the current lock state, including ownership,
 * timing, and process information.
 */
export interface ILockStatus {
    /**
     * Whether a lock is currently held.
     */
    isLocked: boolean;

    /**
     * Unique identifier of the executor holding the lock.
     * Format: `hostname-pid-uuid`
     * null if no lock is held.
     */
    lockedBy: string | null;

    /**
     * Timestamp when the lock was acquired.
     * null if no lock is held.
     */
    lockedAt: Date | null;

    /**
     * Timestamp when the lock will expire.
     * null if no lock is held.
     */
    expiresAt: Date | null;

    /**
     * Process ID component from the executor identifier.
     * Useful for debugging and identifying stale locks.
     */
    processId?: string;
}

/**
 * Service for managing migration execution locks.
 *
 * Prevents concurrent migrations from running simultaneously by implementing
 * a two-phase locking mechanism with ownership verification.
 *
 * **Two-Phase Locking Process:**
 * 1. **Acquire:** Attempt to obtain the lock with executor ID
 * 2. **Verify:** Confirm the lock is still held by this executor
 *
 * This prevents race conditions where multiple executors might acquire
 * the lock simultaneously due to network delays or clock skew.
 *
 * **Lock Lifecycle:**
 * - Lock includes timeout for automatic expiration
 * - Stale locks (expired) are automatically cleaned up
 * - Locks can be force-released if necessary
 *
 * **Implementation Notes:**
 * - Adapter-specific (PostgreSQL, MongoDB, etc.)
 * - Optional feature (check handler.lockingService existence)
 * - Database-backed (not in-memory) for multi-instance safety
 * - Executor ID format: `hostname-pid-uuid` for uniqueness
 *
 * @template DB - Database interface type extending IDB
 *
 * @example
 * ```typescript
 * // PostgreSQL implementation
 * class PostgreSqlLockingService implements ILockingService<PostgreSqlDB> {
 *   async acquireLock(executorId: string): Promise<boolean> {
 *     const result = await this.db.query(
 *       'INSERT INTO migration_locks (executor_id, locked_at, expires_at) ' +
 *       'VALUES ($1, NOW(), NOW() + INTERVAL \'10 minutes\') ' +
 *       'ON CONFLICT DO NOTHING RETURNING id',
 *       [executorId]
 *     );
 *     return result.rows.length > 0;
 *   }
 *
 *   async verifyLockOwnership(executorId: string): Promise<boolean> {
 *     const result = await this.db.query(
 *       'SELECT executor_id FROM migration_locks WHERE expires_at > NOW()',
 *       []
 *     );
 *     return result.rows[0]?.executor_id === executorId;
 *   }
 * }
 *
 * // Usage in handler
 * const handler: IDatabaseMigrationHandler<PostgreSqlDB> = {
 *   db: postgresDb,
 *   lockingService: new PostgreSqlLockingService(postgresDb, config.locking)
 * };
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface ILockingService<DB extends IDB> {
    /**
     * Attempt to acquire the migration lock.
     *
     * This is phase 1 of the two-phase locking process.
     * Tries to insert/update a lock record with the executor ID.
     *
     * **Implementation:**
     * - Use database-specific atomic operations (INSERT ... ON CONFLICT, etc.)
     * - Set lock expiration time based on config.locking.timeout
     * - Return true only if lock was successfully acquired
     * - Return false if lock is already held by another executor
     *
     * **Concurrency:**
     * Multiple executors may call this simultaneously.
     * Database must ensure only one succeeds (use constraints, transactions).
     *
     * @param executorId Unique identifier for this executor (hostname-pid-uuid)
     * @returns true if lock acquired, false if already locked by another
     * @throws Error if database operation fails
     *
     * @example
     * ```typescript
     * const executorId = `${hostname()}-${process.pid}-${randomUUID()}`;
     * const acquired = await lockingService.acquireLock(executorId);
     * if (!acquired) {
     *   throw new Error('Another migration is already running');
     * }
     * ```
     */
    acquireLock(executorId: string): Promise<boolean>;

    /**
     * Verify that this executor still owns the lock.
     *
     * This is phase 2 of the two-phase locking process.
     * Confirms the lock record still exists and belongs to this executor.
     *
     * **Critical for Safety:**
     * Even if acquireLock() returned true, the lock might have been:
     * - Expired due to clock skew between servers
     * - Force-released by an administrator
     * - Stolen by another executor due to race condition
     *
     * Always verify ownership before proceeding with migrations.
     *
     * @param executorId Unique identifier for this executor
     * @returns true if lock is still held by this executor, false otherwise
     * @throws Error if database operation fails
     *
     * @example
     * ```typescript
     * const acquired = await lockingService.acquireLock(executorId);
     * if (acquired) {
     *   const stillOwned = await lockingService.verifyLockOwnership(executorId);
     *   if (!stillOwned) {
     *     throw new Error('Lost lock ownership during verification');
     *   }
     *   // Safe to proceed with migrations
     * }
     * ```
     */
    verifyLockOwnership(executorId: string): Promise<boolean>;

    /**
     * Release the migration lock.
     *
     * Should be called in a finally block to ensure cleanup even on error.
     * Only releases if the executor still owns the lock.
     *
     * **Implementation:**
     * - Delete lock record where executor_id matches
     * - Ignore if lock doesn't exist (already released/expired)
     * - Log warning if lock was stolen by another executor
     *
     * @param executorId Unique identifier for this executor
     * @returns Promise that resolves when lock is released
     * @throws Error if database operation fails (not if lock missing)
     *
     * @example
     * ```typescript
     * try {
     *   await lockingService.acquireLock(executorId);
     *   await executeMigrations();
     * } finally {
     *   await lockingService.releaseLock(executorId);
     * }
     * ```
     */
    releaseLock(executorId: string): Promise<void>;

    /**
     * Get current lock status.
     *
     * Used by CLI `lock:status` command to display lock information.
     * Useful for debugging and monitoring.
     *
     * **Implementation:**
     * - Query lock table for current lock record
     * - Check if lock is expired (expires_at < NOW)
     * - Parse executor ID to extract process ID if possible
     * - Return null if no lock exists
     *
     * @returns Current lock status or null if no lock exists
     * @throws Error if database operation fails
     *
     * @example
     * ```typescript
     * const status = await lockingService.getLockStatus();
     * if (status?.isLocked) {
     *   console.log(`Locked by: ${status.lockedBy}`);
     *   console.log(`Expires: ${status.expiresAt}`);
     * } else {
     *   console.log('No active lock');
     * }
     * ```
     */
    getLockStatus(): Promise<ILockStatus | null>;

    /**
     * Force-release the migration lock regardless of ownership.
     *
     * **DANGEROUS:** Use only when certain no migration is running.
     * Used by CLI `lock:release --force` command.
     *
     * **Use Cases:**
     * - Stale lock from crashed process
     * - Emergency unlock during incident
     * - Testing and development
     *
     * **Implementation:**
     * - Delete lock record unconditionally
     * - Log warning about forced release
     * - Return success even if no lock exists
     *
     * @returns Promise that resolves when lock is forcibly released
     * @throws Error if database operation fails
     *
     * @example
     * ```typescript
     * // CLI command: msr lock:release --force
     * await lockingService.forceReleaseLock();
     * console.log('Lock forcibly released');
     * ```
     */
    forceReleaseLock(): Promise<void>;

    /**
     * Check for and clean up expired locks.
     *
     * Called automatically before attempting to acquire a lock.
     * Removes lock records where expires_at < NOW.
     *
     * **Implementation:**
     * - Delete lock records where expires_at < NOW
     * - Log information about cleaned locks
     * - Safe to call even if no expired locks exist
     *
     * @returns Promise that resolves when cleanup is complete
     * @throws Error if database operation fails
     *
     * @example
     * ```typescript
     * // Called automatically by acquireLock:
     * await lockingService.checkAndReleaseExpiredLock();
     * const acquired = await lockingService.acquireLock(executorId);
     * ```
     */
    checkAndReleaseExpiredLock(): Promise<void>;
}
