import {IDB} from "../dao";
import {IMigrationResult} from "../IMigrationResult";

/**
 * Interface for managing version-based rollback operations.
 *
 * Responsibilities:
 * - Orchestrating rollback to specific target versions
 * - Executing down() methods in reverse chronological order
 * - Coordinating with schema version service and hooks
 * - Validating scripts before rollback
 * - Providing consistent rollback workflow
 *
 * **New in v0.7.0:** Extracted from MigrationScriptExecutor for better separation of concerns (#97 Phase 2)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const rollbackManager = new MigrationRollbackManager({
 *     handler,
 *     schemaVersionService,
 *     selector,
 *     logger,
 *     config,
 *     loaderRegistry,
 *     validationService,
 *     hooks,
 *     errorHandler
 * });
 *
 * // Roll back to specific version
 * const result = await rollbackManager.rollbackToVersion(202501220100);
 * ```
 */
export interface IMigrationRollbackManager<DB extends IDB> {
    /**
     * Roll back database to a specific target version.
     *
     * Calls down() methods on migrations with timestamps > targetVersion in reverse
     * chronological order, and removes their records from the schema version table.
     *
     * @param targetVersion - The target version timestamp to roll back to
     * @returns Migration result containing rolled-back migrations and overall status
     *
     * @throws {Error} If any down() method fails or migration doesn't have down()
     * @throws {Error} If target version is invalid or not found
     *
     * @example
     * ```typescript
     * // Roll back to a specific version
     * const result = await rollbackManager.rollbackToVersion(202501220100);
     * console.log(`Rolled back ${result.executed.length} migrations`);
     * ```
     */
    rollbackToVersion(targetVersion: number): Promise<IMigrationResult<DB>>;
}
