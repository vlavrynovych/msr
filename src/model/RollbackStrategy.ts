/**
 * Rollback strategy for handling migration failures.
 *
 * Determines how MSR responds when a migration fails:
 * - `BACKUP`: Create database backup before migrations, restore on failure (default)
 * - `DOWN`: Call down() methods on failed migrations for rollback
 * - `BOTH`: Create backup AND use down() methods (safest - tries down() first, backup on down() failure)
 * - `NONE`: No automatic rollback (not recommended - database may be left in inconsistent state)
 *
 * @example
 * ```typescript
 * import { RollbackStrategy, Config } from '@migration-script-runner/core';
 *
 * const config = new Config();
 *
 * // Use backup/restore (default, recommended for production)
 * config.rollbackStrategy = RollbackStrategy.BACKUP;
 *
 * // Use down() migrations for rollback
 * config.rollbackStrategy = RollbackStrategy.DOWN;
 *
 * // Use both strategies for maximum safety
 * config.rollbackStrategy = RollbackStrategy.BOTH;
 *
 * // No rollback (dangerous - use with caution)
 * config.rollbackStrategy = RollbackStrategy.NONE;
 * ```
 */
export enum RollbackStrategy {
    /**
     * Create database backup before migrations, restore on failure (default).
     * Requires: handler.backup implementation
     */
    BACKUP = 'backup',

    /**
     * Call down() methods on failed migrations for rollback.
     * Requires: down() methods in migration scripts
     */
    DOWN = 'down',

    /**
     * Create backup AND use down() methods (safest).
     * Tries down() first, falls back to backup if down() fails.
     * Requires: Both handler.backup and down() methods
     */
    BOTH = 'both',

    /**
     * No automatic rollback (not recommended).
     * Database will be left in potentially inconsistent state on failure.
     */
    NONE = 'none'
}
