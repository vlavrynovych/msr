import {MigrationScript} from "../model";
import {IDB} from "./dao";

/**
 * Result returned from migration operations.
 *
 * Contains information about the migration execution including success status,
 * which scripts were executed, and any errors that occurred.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const executor = new MigrationScriptExecutor<IDB>(handler);
 * const result = await executor.migrate();
 *
 * if (result.success) {
 *   console.log(`Successfully executed ${result.executed.length} migrations`);
 * } else {
 *   console.error('Migration failed:', result.errors);
 * }
 * ```
 */
export interface IMigrationResult<DB extends IDB> {
    /**
     * Whether the migration operation completed successfully.
     * - true: All migrations executed without errors
     * - false: One or more migrations failed, or an error occurred during the process
     */
    success: boolean;

    /**
     * All migrations that were executed during this run.
     * Includes migrations that completed successfully before a failure occurred.
     * Typed with the generic DB parameter (v0.6.0).
     */
    executed: MigrationScript<DB>[];

    /**
     * Previously migrated scripts (from database history).
     * Shows the migration history before this execution.
     * Typed with the generic DB parameter (v0.6.0).
     */
    migrated: MigrationScript<DB>[];

    /**
     * Scripts that were ignored because they have timestamps older than
     * the last executed migration. These represent out-of-order migrations
     * that won't be executed.
     * Typed with the generic DB parameter (v0.6.0).
     */
    ignored: MigrationScript<DB>[];

    /**
     * Errors that occurred during migration execution.
     * Only present when success is false.
     */
    errors?: Error[];
}
