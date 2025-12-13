import {IDB} from "../dao";
import {MigrationScript} from "../../model";

/**
 * Interface for executing migrations with lifecycle hooks.
 *
 * Responsibilities:
 * - Wrapping migration execution with onBeforeMigrate, onAfterMigrate hooks
 * - Handling onMigrationError when migrations fail
 * - Managing execution order and error propagation
 * - Tracking executed scripts for rollback scenarios
 *
 * Extracted from MigrationScriptExecutor for better separation of concerns.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const hookExecutor = new MigrationHookExecutor({
 *     runner,
 *     hooks
 * });
 *
 * const executed: MigrationScript<DB>[] = [];
 * await hookExecutor.executeWithHooks(pendingScripts, executed);
 * ```
 */
export interface IMigrationHookExecutor<DB extends IDB> {
    /**
     * Execute migration scripts sequentially with lifecycle hooks.
     *
     * Wraps each migration execution with onBeforeMigrate, onAfterMigrate, and
     * onMigrationError hooks. Updates the executedArray parameter directly as scripts
     * are executed, ensuring that executed migrations are available for rollback even
     * if a later migration fails.
     *
     * @param scripts - Array of migration scripts to execute
     * @param executedArray - Array to populate with executed migrations (modified in-place)
     *
     * @throws {Error} If any migration fails, execution stops and the error is propagated.
     *                 The executedArray will contain all migrations that were attempted
     *                 (including the failed one), making them available for rollback.
     *
     * @example
     * ```typescript
     * const executed: MigrationScript<DB>[] = [];
     * try {
     *     await hookExecutor.executeWithHooks(scripts, executed);
     * } catch (error) {
     *     // executed array contains all attempted migrations for rollback
     *     console.log(`Executed ${executed.length} before failure`);
     * }
     * ```
     */
    executeWithHooks(
        scripts: MigrationScript<DB>[],
        executedArray: MigrationScript<DB>[]
    ): Promise<void>;
}
