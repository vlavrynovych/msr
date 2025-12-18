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
     * Initialize lock storage structures (tables, indexes, paths).
     *
     * **NEW in v0.8.1:** Required lifecycle method for explicit storage setup.
     *
     * Creates the necessary database structures for lock storage before
     * first use. Enables fail-fast behavior by validating setup at
     * initialization rather than during first lock acquisition.
     *
     * **When to Implement:**
     * - Database adapters that need table/collection creation
     * - Adapters requiring indexes or constraints for lock uniqueness
     * - File-based or cloud storage that needs path/bucket setup
     *
     * **When NOT Needed:**
     * - In-memory locking (no persistent storage)
     * - Databases with auto-schema features
     * - Adapters using existing tables
     *
     * **Idempotency:**
     * Must be idempotent (safe to call multiple times).
     * Use `IF NOT EXISTS` or equivalent checks.
     *
     * **Error Handling:**
     * Should throw on setup failures (permissions, network, etc.)
     * to enable early failure detection.
     *
     * @returns Promise that resolves when storage is initialized
     * @throws Error if storage setup fails (permissions, network, schema conflicts)
     *
     * @example
     * ```typescript
     * // PostgreSQL: Create table with unique constraint
     * class PostgresLockingService implements ILockingService<IPostgresDB> {
     *   async initLockStorage(): Promise<void> {
     *     await this.db.query(`
     *       CREATE TABLE IF NOT EXISTS migration_locks (
     *         id SERIAL PRIMARY KEY,
     *         executor_id VARCHAR(255) UNIQUE NOT NULL,
     *         locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
     *         expires_at TIMESTAMP NOT NULL
     *       )
     *     `);
     *     // Create index for expired lock cleanup
     *     await this.db.query(`
     *       CREATE INDEX IF NOT EXISTS idx_migration_locks_expires_at
     *       ON migration_locks(expires_at)
     *     `);
     *   }
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Firebase: Validate database path access
     * class FirebaseLockingService implements ILockingService<IFirebaseDB> {
     *   async initLockStorage(): Promise<void> {
     *     const lockRef = this.db.database.ref(`${this.lockPath}/migrations/_lock`);
     *     try {
     *       // Verify we can read the lock path
     *       await lockRef.once('value');
     *     } catch (error) {
     *       throw new Error(
     *         `Failed to access lock storage at ${this.lockPath}: ${error.message}`
     *       );
     *     }
     *   }
     * }
     * ```
     *
     * @example
     * ```typescript
     * // MongoDB: Create collection with unique index
     * class MongoLockingService implements ILockingService<IMongoDBInterface> {
     *   async initLockStorage(): Promise<void> {
     *     const db = this.db.client.db();
     *
     *     // Create collection if it doesn't exist
     *     const collections = await db.listCollections(
     *       { name: 'migration_locks' }
     *     ).toArray();
     *
     *     if (collections.length === 0) {
     *       await db.createCollection('migration_locks');
     *     }
     *
     *     // Create unique index on executor_id
     *     await db.collection('migration_locks').createIndex(
     *       { executor_id: 1 },
     *       { unique: true }
     *     );
     *
     *     // Create TTL index for automatic expiration
     *     await db.collection('migration_locks').createIndex(
     *       { expires_at: 1 },
     *       { expireAfterSeconds: 0 }
     *     );
     *   }
     * }
     * ```
     */
    initLockStorage(): Promise<void>;

    /**
     * Verify lock storage is accessible and ready for use.
     *
     * **NEW in v0.8.1:** Required pre-flight check for storage accessibility.
     *
     * Performs a lightweight check to verify lock storage exists and
     * is accessible before attempting lock operations. Enables early
     * detection of configuration or permission issues.
     *
     * **When to Implement:**
     * - Adapters with remote storage (network connectivity check)
     * - Adapters requiring permissions validation
     * - Cloud storage with bucket/path access checks
     * - Pre-deployment validation in CI/CD
     *
     * **When NOT Needed:**
     * - In-memory locking (always accessible)
     * - Local file storage (OS handles accessibility)
     * - Databases with built-in connection checks
     *
     * **Implementation Guidelines:**
     * - Should be fast (simple read query, not full scan)
     * - Should NOT modify data (read-only check)
     * - Should NOT create storage (use initLockStorage for that)
     * - Return false on accessibility issues, don't throw
     *
     * **Difference from initLockStorage:**
     * - `initLockStorage()`: Creates storage, throws on failure
     * - `ensureLockStorageAccessible()`: Checks access, returns boolean
     *
     * @returns true if storage is accessible, false otherwise
     * @throws Should generally NOT throw - return false instead for better UX
     *
     * @example
     * ```typescript
     * // PostgreSQL: Check table exists and is readable
     * class PostgresLockingService implements ILockingService<IPostgresDB> {
     *   async ensureLockStorageAccessible(): Promise<boolean> {
     *     try {
     *       // Simple query to verify table exists and is readable
     *       await this.db.query(`
     *         SELECT 1 FROM migration_locks LIMIT 1
     *       `);
     *       return true;
     *     } catch (error) {
     *       // Table doesn't exist or no permissions
     *       return false;
     *     }
     *   }
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Firebase: Verify path is accessible
     * class FirebaseLockingService implements ILockingService<IFirebaseDB> {
     *   async ensureLockStorageAccessible(): Promise<boolean> {
     *     try {
     *       const lockRef = this.db.database.ref(`${this.lockPath}/migrations/_lock`);
     *       // Attempt to read (will fail if no permissions)
     *       await lockRef.once('value');
     *       return true;
     *     } catch (error) {
     *       // Permission denied or network error
     *       return false;
     *     }
     *   }
     * }
     * ```
     *
     * @example
     * ```typescript
     * // MongoDB: Check collection exists
     * class MongoLockingService implements ILockingService<IMongoDBInterface> {
     *   async ensureLockStorageAccessible(): Promise<boolean> {
     *     try {
     *       const db = this.db.client.db();
     *       const collections = await db.listCollections(
     *         { name: 'migration_locks' }
     *       ).toArray();
     *       return collections.length > 0;
     *     } catch (error) {
     *       // Database connection or permission error
     *       return false;
     *     }
     *   }
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Usage in handler initialization
     * class DatabaseHandler implements IDatabaseMigrationHandler<IDB> {
     *   async initialize(): Promise<void> {
     *     if (this.lockingService?.initLockStorage) {
     *       await this.lockingService.initLockStorage();
     *     }
     *
     *     if (this.lockingService?.ensureLockStorageAccessible) {
     *       const accessible = await this.lockingService.ensureLockStorageAccessible();
     *       if (!accessible) {
     *         throw new Error(
     *           'Lock storage is not accessible. ' +
     *           'Verify database permissions and run initLockStorage().'
     *         );
     *       }
     *     }
     *   }
     * }
     * ```
     */
    ensureLockStorageAccessible(): Promise<boolean>;

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
