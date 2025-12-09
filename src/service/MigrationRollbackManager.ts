import {IDB} from "../interface/dao";
import {IMigrationRollbackManager} from "../interface/service/IMigrationRollbackManager";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {MigrationScriptSelector} from "./MigrationScriptSelector";
import {ILogger} from "../interface/ILogger";
import {Config, MigrationScript} from "../model";
import {ILoaderRegistry} from "../interface/loader/ILoaderRegistry";
import {IMigrationValidationService} from "../interface";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {IMigrationErrorHandler} from "../interface/service/IMigrationErrorHandler";
import {IMigrationScanner} from "../interface/service/IMigrationScanner";
import {IMigrationResult} from "../interface/IMigrationResult";
import {IScripts} from "../interface/IScripts";

/**
 * Dependencies for MigrationRollbackManager.
 *
 * @template DB - Database interface type
 */
export interface MigrationRollbackManagerDependencies<DB extends IDB> {
    /**
     * Database migration handler implementing database-specific operations.
     */
    handler: IDatabaseMigrationHandler<DB>;

    /**
     * Service for tracking executed migrations in the database.
     */
    schemaVersionService: ISchemaVersionService<DB>;

    /**
     * Service for scanning and gathering complete migration state.
     */
    migrationScanner: IMigrationScanner<DB>;

    /**
     * Service for selecting which migrations to execute or roll back.
     */
    selector: MigrationScriptSelector<DB>;

    /**
     * Logger for rollback messages.
     */
    logger: ILogger;

    /**
     * Configuration for migration execution.
     */
    config: Config;

    /**
     * Registry for loading migration scripts of different types.
     */
    loaderRegistry: ILoaderRegistry<DB>;

    /**
     * Service for validating migration scripts before execution.
     */
    validationService: IMigrationValidationService<DB>;

    /**
     * Optional lifecycle hooks for rollback events.
     */
    hooks?: IMigrationHooks<DB>;

    /**
     * Service for handling migration errors and coordinating error recovery.
     */
    errorHandler: IMigrationErrorHandler<DB>;
}

/**
 * Manages version-based rollback operations.
 *
 * Extracted from MigrationScriptExecutor to separate rollback orchestration concerns.
 * Handles rolling back to specific target versions by executing down() methods
 * in reverse chronological order.
 *
 * **New in v0.7.0:** Part of MigrationScriptExecutor refactoring (#97 Phase 2)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const rollbackManager = new MigrationRollbackManager({
 *     handler: myDatabaseHandler,
 *     schemaVersionService,
 *     migrationScanner,
 *     selector,
 *     logger: new ConsoleLogger(),
 *     config: myConfig,
 *     loaderRegistry,
 *     validationService,
 *     hooks: myHooks,
 *     errorHandler
 * });
 *
 * // Roll back to specific version
 * const result = await rollbackManager.rollbackToVersion(202501220100);
 * ```
 */
export class MigrationRollbackManager<DB extends IDB> implements IMigrationRollbackManager<DB> {
    private readonly handler: IDatabaseMigrationHandler<DB>;
    private readonly schemaVersionService: ISchemaVersionService<DB>;
    private readonly migrationScanner: IMigrationScanner<DB>;
    private readonly selector: MigrationScriptSelector<DB>;
    private readonly logger: ILogger;
    private readonly config: Config;
    private readonly loaderRegistry: ILoaderRegistry<DB>;
    private readonly validationService: IMigrationValidationService<DB>;
    private readonly hooks?: IMigrationHooks<DB>;
    private readonly errorHandler: IMigrationErrorHandler<DB>;

    constructor(dependencies: MigrationRollbackManagerDependencies<DB>) {
        this.handler = dependencies.handler;
        this.schemaVersionService = dependencies.schemaVersionService;
        this.migrationScanner = dependencies.migrationScanner;
        this.selector = dependencies.selector;
        this.logger = dependencies.logger;
        this.config = dependencies.config;
        this.loaderRegistry = dependencies.loaderRegistry;
        this.validationService = dependencies.validationService;
        this.hooks = dependencies.hooks;
        this.errorHandler = dependencies.errorHandler;
    }

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
     */
    async rollbackToVersion(targetVersion: number): Promise<IMigrationResult<DB>> {
        await this.checkDatabaseConnection();
        this.logger.info(`Rolling back to version ${targetVersion}...`);

        await this.schemaVersionService.init(this.config.tableName);
        const scripts = await this.migrationScanner.scan();

        const toRollback = this.selector.getMigratedDownTo(scripts.migrated, targetVersion);

        if (!toRollback.length) {
            return this.handleNoRollbackNeeded(scripts, targetVersion);
        }

        await this.prepareRollbackScripts(toRollback);
        await this.hooks?.onStart?.(scripts.all.length, toRollback.length);

        this.logger.info(`Rolling back ${toRollback.length} migration(s)...`);

        try {
            const rolledBack = await this.executeRollbackScripts(toRollback);
            return await this.completeRollback(rolledBack, scripts, targetVersion);
        } catch (error) {
            return await this.errorHandler.handleRollbackError(error);
        }
    }

    /**
     * Check database connection before performing operations.
     *
     * @private
     * @throws Error if database connection check fails
     */
    private async checkDatabaseConnection(): Promise<void> {
        this.logger.debug('Checking database connection...');

        const isConnected = await this.handler.db.checkConnection();

        if (!isConnected) {
            const errorMsg = 'Database connection check failed. Cannot proceed with rollback operations. ' +
                           'Please verify your database connection settings and ensure the database is accessible.';
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.logger.debug('Database connection verified successfully');
    }

    /**
     * Handle case when no migrations need to be rolled back.
     *
     * @param scripts - All migration scripts
     * @param targetVersion - Target version to roll back to
     * @returns Migration result indicating no rollback was needed
     * @private
     */
    private handleNoRollbackNeeded(scripts: IScripts<DB>, targetVersion: number): IMigrationResult<DB> {
        this.logger.info(`Already at version ${targetVersion} or below - nothing to roll back`);

        return {
            success: true,
            executed: [],
            migrated: scripts.migrated,
            ignored: scripts.ignored
        };
    }

    /**
     * Prepare rollback scripts by initializing and validating them.
     *
     * @param toRollback - Migration scripts to prepare for rollback
     * @private
     */
    private async prepareRollbackScripts(toRollback: MigrationScript<DB>[]): Promise<void> {
        await Promise.all(toRollback.map(s => s.init(this.loaderRegistry)));

        if (this.config.validateBeforeRun && toRollback.length > 0) {
            await this.validationService.validateAll(toRollback, this.config, this.loaderRegistry);
        }

        if (this.config.validateMigratedFiles && toRollback.length > 0) {
            await this.validationService.validateMigratedFileIntegrity(toRollback, this.config);
        }
    }

    /**
     * Execute rollback scripts in reverse chronological order.
     *
     * @param toRollback - Migration scripts to roll back
     * @returns Array of rolled-back migration scripts
     * @private
     */
    private async executeRollbackScripts(toRollback: MigrationScript<DB>[]): Promise<MigrationScript<DB>[]> {
        const rolledBack: MigrationScript<DB>[] = [];

        for (const script of toRollback) {
            await this.rollbackSingleMigration(script);
            rolledBack.push(script);
        }

        return rolledBack;
    }

    /**
     * Roll back a single migration by executing its down() method.
     *
     * @param script - Migration script to roll back
     * @private
     * @throws Error if migration doesn't have down() method
     */
    private async rollbackSingleMigration(script: MigrationScript<DB>): Promise<void> {
        if (!script.script.down) {
            throw new Error(`Migration ${script.name} does not have a down() method - cannot roll back`);
        }

        this.logger.info(`Rolling back ${script.name}...`);

        await this.hooks?.onBeforeMigrate?.(script);

        script.startedAt = Date.now();
        const result = await script.script.down(this.handler.db, script, this.handler);
        script.finishedAt = Date.now();

        await this.hooks?.onAfterMigrate?.(script, result);
        await this.schemaVersionService.remove(script.timestamp);

        this.logger.info(`✓ Rolled back ${script.name}`);
    }

    /**
     * Complete rollback operation and return final result.
     *
     * @param rolledBack - Migration scripts that were rolled back
     * @param scripts - All migration scripts
     * @param targetVersion - Target version that was rolled back to
     * @returns Final migration result
     * @private
     */
    private async completeRollback(
        rolledBack: MigrationScript<DB>[],
        scripts: IScripts<DB>,
        targetVersion: number
    ): Promise<IMigrationResult<DB>> {
        this.logger.info(`Successfully rolled back to version ${targetVersion}!`);

        const result: IMigrationResult<DB> = {
            success: true,
            executed: rolledBack,
            migrated: scripts.migrated.filter(m => m.timestamp <= targetVersion),
            ignored: scripts.ignored
        };

        await this.hooks?.onComplete?.(result);
        return result;
    }
}
