/**
 * Defines how the migration system handles duplicate timestamps in migration files.
 *
 * Duplicate timestamps can cause undefined execution order, but may be acceptable
 * during development or when migrations are organized in ways that guarantee order
 * (e.g., subdirectories with known precedence).
 */
export enum DuplicateTimestampMode {
    /**
     * Log a warning when duplicate timestamps are detected, but continue execution.
     * This is the recommended default - it alerts developers to potential issues
     * without blocking migrations.
     *
     * @default
     */
    WARN = 'warn',

    /**
     * Throw an error and halt execution when duplicate timestamps are detected.
     * Use this in production environments where timestamp uniqueness is critical
     * for maintaining data integrity and migration order.
     */
    ERROR = 'error',

    /**
     * Silently ignore duplicate timestamps - no warning or error.
     * Use this only when you have external guarantees about execution order
     * (e.g., migrations organized in subdirectories with defined precedence).
     */
    IGNORE = 'ignore'
}
