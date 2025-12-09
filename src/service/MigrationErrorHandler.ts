import {IDB} from "../interface/dao";
import {IMigrationErrorHandler} from "../interface/service/IMigrationErrorHandler";
import {ILogger} from "../interface/ILogger";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {IRollbackService} from "../interface/service";
import {MigrationScript} from "../model";

/**
 * Dependencies for MigrationErrorHandler.
 *
 * @template DB - Database interface type
 */
export interface MigrationErrorHandlerDependencies<DB extends IDB> {
    /**
     * Logger for error messages.
     */
    logger: ILogger;

    /**
     * Optional lifecycle hooks for error events.
     */
    hooks?: IMigrationHooks<DB>;

    /**
     * Rollback service for coordinating rollback on migration errors.
     */
    rollbackService: IRollbackService<DB>;
}

/**
 * Handles migration errors and coordinates error recovery.
 *
 * Extracted from MigrationScriptExecutor to separate error handling concerns.
 * Provides consistent error logging, hook execution, and rollback coordination.
 *
 * **New in v0.7.0:** Part of MigrationScriptExecutor refactoring (#97)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const errorHandler = new MigrationErrorHandler({
 *     logger: new ConsoleLogger(),
 *     hooks: myHooks,
 *     rollbackService: myRollbackService
 * });
 *
 * try {
 *     await executeMigration();
 * } catch (error) {
 *     await errorHandler.handleMigrationError(error, targetVersion, executed, backupPath, errors);
 * }
 * ```
 */
export class MigrationErrorHandler<DB extends IDB> implements IMigrationErrorHandler<DB> {
    private readonly logger: ILogger;
    private readonly hooks?: IMigrationHooks<DB>;
    private readonly rollbackService: IRollbackService<DB>;

    constructor(dependencies: MigrationErrorHandlerDependencies<DB>) {
        this.logger = dependencies.logger;
        this.hooks = dependencies.hooks;
        this.rollbackService = dependencies.rollbackService;
    }

    /**
     * Handle rollback failure.
     *
     * Logs the error, executes onError hook, and rethrows.
     * This is a terminal error - cannot recover from rollback failure.
     *
     * @param error - The error that occurred during rollback
     * @returns Never returns - always throws
     * @throws {Error} Always rethrows the error after logging and hooks
     */
    async handleRollbackError(error: unknown): Promise<never> {
        this.logger.error(`Rollback failed: ${(error as Error).message}`);
        await this.hooks?.onError?.(error as Error);
        throw error;
    }

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
     */
    async handleMigrationError(
        error: unknown,
        targetVersion: number,
        executedScripts: MigrationScript<DB>[],
        backupPath: string | undefined,
        errors: Error[]
    ): Promise<Error> {
        const err = error as Error;
        errors.push(err);
        this.logger.error(`Migration to version ${targetVersion} failed: ${err.message}`);
        await this.rollbackService.rollback(executedScripts, backupPath);
        return err;
    }

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
     */
    handleDryRunError(
        error: unknown,
        executedScripts: MigrationScript<DB>[]
    ): never {
        // Migration failed - rollback already happened in MigrationRunner
        this.logger.error('\n✗ Dry run failed - migrations would fail in production');
        this.logger.error(`  Failed at: ${executedScripts[executedScripts.length - 1]?.name || 'unknown'}`);
        throw error;
    }
}
