/**
 * Configuration for migration locking mechanism.
 *
 * Controls how migration locks are acquired, maintained, and released
 * to prevent concurrent migration execution.
 *
 * **Default Strategy: Fail Fast**
 * - Timeout: 10 minutes (enough for most migrations)
 * - Retries: 0 (fail immediately if locked)
 * - Table: 'migration_locks' (standard name)
 *
 * **Use Cases:**
 * - Production: Enable with default timeout to prevent concurrent runs
 * - CI/CD: Enable to ensure sequential migrations across parallel builds
 * - Development: Disable for faster iteration without lock overhead
 * - Testing: Disable to allow parallel test execution
 *
 * @example
 * ```typescript
 * // Default configuration (fail fast)
 * const config = new Config({
 *   locking: new LockingConfig({
 *     enabled: true,
 *     timeout: 600_000, // 10 minutes
 *     retryAttempts: 0   // fail immediately
 *   })
 * });
 *
 * // Retry configuration (wait for lock)
 * const config = new Config({
 *   locking: new LockingConfig({
 *     enabled: true,
 *     timeout: 600_000,
 *     retryAttempts: 5,
 *     retryDelay: 2000  // wait 2s between retries
 *   })
 * });
 *
 * // Disabled for development
 * const config = new Config({
 *   locking: new LockingConfig({
 *     enabled: false
 *   })
 * });
 * ```
 */
export class LockingConfig {
    /**
     * Whether locking is enabled.
     *
     * When disabled, migrations run without acquiring locks.
     * Useful for development and testing.
     *
     * @default true
     */
    enabled: boolean;

    /**
     * Lock timeout in milliseconds.
     *
     * Maximum time a lock can be held before automatic expiration.
     * Should be longer than your longest expected migration duration.
     *
     * **Guidelines:**
     * - Short migrations (< 1 min): 300_000 (5 minutes)
     * - Medium migrations (1-5 min): 600_000 (10 minutes) ← default
     * - Long migrations (5-30 min): 1_800_000 (30 minutes)
     * - Very long migrations: 3_600_000 (1 hour)
     *
     * **Too Short:** Risk of lock expiring during valid migration
     * **Too Long:** Stale locks take longer to auto-cleanup
     *
     * @default 600_000 (10 minutes)
     */
    timeout: number;

    /**
     * Database table name for storing locks.
     *
     * Must match the table created by your database adapter.
     * Different table names allow multiple MSR instances to use
     * the same database without lock conflicts.
     *
     * @default 'migration_locks'
     */
    tableName: string;

    /**
     * Number of times to retry lock acquisition.
     *
     * When set to 0 (default), fails immediately if lock is held.
     * When set to N > 0, retries N times with retryDelay between attempts.
     *
     * **Fail Fast (retryAttempts = 0):**
     * - ✅ Immediate feedback if another migration is running
     * - ✅ No waiting in CI/CD pipelines
     * - ✅ Clear error message to user
     * - ❌ Less forgiving if migrations overlap briefly
     *
     * **Retry (retryAttempts > 0):**
     * - ✅ More resilient to brief lock contention
     * - ✅ Better for scheduled jobs that can wait
     * - ❌ Slower feedback on failure
     * - ❌ Can mask underlying concurrency issues
     *
     * @default 0 (fail fast)
     */
    retryAttempts: number;

    /**
     * Delay between retry attempts in milliseconds.
     *
     * Only used when retryAttempts > 0.
     *
     * **Guidelines:**
     * - Quick check: 1000 (1 second)
     * - Standard: 2000 (2 seconds)
     * - Polite: 5000 (5 seconds)
     *
     * Total wait time = retryAttempts × retryDelay
     * Example: 5 retries × 2000ms = 10 seconds maximum wait
     *
     * @default 1000 (1 second)
     */
    retryDelay: number;

    /**
     * Create a new LockingConfig instance.
     *
     * @param options Partial configuration options
     * @param options.enabled Whether locking is enabled (default: true)
     * @param options.timeout Lock timeout in milliseconds (default: 600000)
     * @param options.tableName Database table name (default: 'migration_locks')
     * @param options.retryAttempts Number of retry attempts (default: 0)
     * @param options.retryDelay Delay between retries in ms (default: 1000)
     */
    constructor(options?: Partial<LockingConfig>) {
        this.enabled = options?.enabled ?? true;
        this.timeout = options?.timeout ?? 600_000; // 10 minutes
        this.tableName = options?.tableName ?? 'migration_locks';
        this.retryAttempts = options?.retryAttempts ?? 0; // fail fast by default
        this.retryDelay = options?.retryDelay ?? 1000; // 1 second
    }

    /**
     * Validate configuration values.
     *
     * Ensures all values are within acceptable ranges.
     *
     * @throws {RangeError} If any value is out of acceptable range
     */
    validate(): void {
        if (this.timeout <= 0) {
            throw new RangeError(`LockingConfig.timeout must be positive, got ${this.timeout}`);
        }

        if (this.timeout > 3_600_000) {
            throw new RangeError(
                `LockingConfig.timeout should not exceed 1 hour (3600000ms), got ${this.timeout}`
            );
        }

        if (this.retryAttempts < 0) {
            throw new RangeError(
                `LockingConfig.retryAttempts must be non-negative, got ${this.retryAttempts}`
            );
        }

        if (this.retryAttempts > 100) {
            throw new RangeError(
                `LockingConfig.retryAttempts should not exceed 100, got ${this.retryAttempts}`
            );
        }

        if (this.retryDelay < 0) {
            throw new RangeError(
                `LockingConfig.retryDelay must be non-negative, got ${this.retryDelay}`
            );
        }

        if (this.retryDelay > 60_000) {
            throw new RangeError(
                `LockingConfig.retryDelay should not exceed 1 minute (60000ms), got ${this.retryDelay}`
            );
        }

        if (this.tableName.trim().length === 0) {
            throw new TypeError('LockingConfig.tableName must not be empty');
        }

        // Check for SQL injection attempts in table name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.tableName)) {
            throw new TypeError(
                `LockingConfig.tableName must be a valid SQL identifier (alphanumeric and underscore), got '${this.tableName}'`
            );
        }
    }
}
