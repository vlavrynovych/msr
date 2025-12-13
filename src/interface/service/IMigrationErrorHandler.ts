import {IDB} from "../dao";
import {MigrationScript} from "../../model";

/**
 * Interface for handling migration errors and coordinating error recovery.
 *
 * Responsibilities:
 * - Logging errors with appropriate context
 * - Executing error lifecycle hooks
 * - Coordinating error recovery (rollback)
 * - Providing consistent error handling across migration operations
 *
 * **New in v0.7.0:** Extracted from MigrationScriptExecutor for better separation of concerns (#97 Phase 1)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const errorHandler = new MigrationErrorHandler({
 *     logger,
 *     hooks,
 *     rollbackService
 * });
 *
 * try {
 *     await executeMigration();
 * } catch (error) {
 *     await errorHandler.handleMigrationError(error, scripts, backupPath);
 * }
 * ```
 */
export interface IMigrationErrorHandler<DB extends IDB> {
    /**
     * Handle rollback failure.
     *
     * Logs the error, executes onError hook, and rethrows.
     * This is a terminal error - cannot recover from rollback failure.
     *
     * @param error - The error that occurred during rollback
     * @returns Never returns - always throws
     * @throws {Error} Always rethrows the error after logging and hooks
     *
     * @example
     * ```typescript
     * try {
     *     await rollback();
     * } catch (error) {
     *     await errorHandler.handleRollbackError(error); // Logs, calls hooks, throws
     * }
     * ```
     */
    handleRollbackError(error: unknown): Promise<never>;

    /**
     * Handle migration execution error with rollback coordination.
     *
     * Logs the error with version context, adds to errors array,
     * coordinates rollback via rollback service, and returns the error
     * for the caller to throw.
     *
     * @param error - The error that occurred during migration
     * @param targetVersion - The version being migrated to
     * @param executedScripts - Scripts that were executed before failure
     * @param backupPath - Path to backup for rollback
     * @param errors - Array to append error to
     * @returns The error to be thrown by the caller
     *
     * @example
     * ```typescript
     * try {
     *     await executeScripts();
     * } catch (error) {
     *     const err = await errorHandler.handleMigrationError(
     *         error,
     *         targetVersion,
     *         scripts.executed,
     *         backupPath,
     *         errors
     *     );
     *     throw err;
     * }
     * ```
     */
    handleMigrationError(
        error: unknown,
        targetVersion: number,
        executedScripts: MigrationScript<DB>[],
        backupPath: string | undefined,
        errors: Error[]
    ): Promise<Error>;

    /**
     * Handle dry run failure.
     *
     * Logs failure message with context about which migration failed,
     * and rethrows. Dry run failures indicate migrations would fail in production.
     *
     * @param error - The error that occurred during dry run
     * @param executedScripts - Scripts that were tested before failure
     * @returns Never returns - always throws
     * @throws {Error} Always rethrows after logging
     *
     * @example
     * ```typescript
     * try {
     *     await dryRun();
     * } catch (error) {
     *     errorHandler.handleDryRunError(error, scripts.executed);
     * }
     * ```
     */
    handleDryRunError(
        error: unknown,
        executedScripts: MigrationScript<DB>[]
    ): never;
}
