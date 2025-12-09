import {IDB} from "../interface/dao";
import {IMigrationHookExecutor} from "../interface/service/IMigrationHookExecutor";
import {MigrationRunner} from "./MigrationRunner";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {MigrationScript} from "../model";

/**
 * Dependencies for MigrationHookExecutor.
 *
 * @template DB - Database interface type
 */
export interface MigrationHookExecutorDependencies<DB extends IDB> {
    /**
     * Migration runner for executing individual scripts.
     */
    runner: MigrationRunner<DB>;

    /**
     * Optional lifecycle hooks to execute during migration.
     */
    hooks?: IMigrationHooks<DB>;
}

/**
 * Executes migrations with lifecycle hooks.
 *
 * Extracted from MigrationScriptExecutor to separate hook orchestration concerns.
 * Wraps migration execution with onBeforeMigrate, onAfterMigrate, and onMigrationError hooks.
 *
 * Part of MigrationScriptExecutor refactoring to separate concerns.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const hookExecutor = new MigrationHookExecutor({
 *     runner: new MigrationRunner({
 *         handler,
 *         schemaVersionService,
 *         logger,
 *         config,
 *         transactionManager
 *     }),
 *     hooks: {
 *         onBeforeMigrate: async (script) => console.log(`Starting ${script.name}`),
 *         onAfterMigrate: async (script, result) => console.log(`Completed ${script.name}`),
 *         onMigrationError: async (script, error) => console.error(`Failed ${script.name}`)
 *     }
 * });
 *
 * const executed: MigrationScript<DB>[] = [];
 * await hookExecutor.executeWithHooks(pendingScripts, executed);
 * ```
 */
export class MigrationHookExecutor<DB extends IDB> implements IMigrationHookExecutor<DB> {
    private readonly runner: MigrationRunner<DB>;
    private readonly hooks?: IMigrationHooks<DB>;

    constructor(dependencies: MigrationHookExecutorDependencies<DB>) {
        this.runner = dependencies.runner;
        this.hooks = dependencies.hooks;
    }

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
     */
    async executeWithHooks(
        scripts: MigrationScript<DB>[],
        executedArray: MigrationScript<DB>[]
    ): Promise<void> {
        for (const script of scripts) {
            // Add script to executed array BEFORE execution
            // This ensures it's available for rollback cleanup if it fails
            executedArray.push(script);

            try {
                // Hook: Before migration
                if (this.hooks && this.hooks.onBeforeMigrate) {
                    await this.hooks.onBeforeMigrate(script);
                }

                // Execute the migration
                const result = await this.runner.executeOne(script);

                // Hook: After migration
                if (this.hooks && this.hooks.onAfterMigrate) {
                    await this.hooks.onAfterMigrate(result, result.result || '');
                }

                // Migration succeeded - result is returned by executeOne
                // Note: script is already in executedArray
            } catch (err) {
                // Hook: Migration error
                if (this.hooks && this.hooks.onMigrationError) {
                    await this.hooks.onMigrationError(script, err as Error);
                }

                // Re-throw to trigger rollback
                // Note: executedArray contains ALL attempted migrations including the failed one
                throw err;
            }
        }
    }
}
