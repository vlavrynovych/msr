import {BackupService} from "./BackupService";
import {ConsoleRenderer} from "./ConsoleRenderer";
import {IBackupService} from "../interface/service/IBackupService";
import {MigrationService} from "./MigrationService";
import {IMigrationService} from "../interface/service/IMigrationService";
import {MigrationScript} from "../model/MigrationScript";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {IScripts} from "../interface/IScripts";
import {SchemaVersionService} from "./SchemaVersionService";
import {Utils} from "./Utils";
import {IMigrationResult} from "../interface/IMigrationResult";
import {ILogger} from "../interface/ILogger";
import {IMigrationExecutorDependencies} from "../interface/IMigrationExecutorDependencies";
import {IConsoleRenderer} from "../interface/service/IConsoleRenderer";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {ConsoleLogger} from "../logger";
import {MigrationScriptSelector} from "./MigrationScriptSelector";
import {MigrationRunner} from "./MigrationRunner";

/**
 * Main executor class for running database migrations.
 *
 * Orchestrates the entire migration workflow including:
 * - Creating backups before migrations
 * - Loading and tracking migration scripts
 * - Executing migrations in order
 * - Restoring from backup on failure
 * - Displaying migration status and results
 *
 * @example
 * ```typescript
 * import { MigrationScriptExecutor, Config } from 'migration-script-runner';
 *
 * const config = new Config();
 * const handler = new MyDatabaseHandler(config);
 * const executor = new MigrationScriptExecutor(handler);
 *
 * // Run all pending migrations
 * await executor.migrate();
 *
 * // Or list all migrations
 * await executor.list();
 * ```
 */
export class MigrationScriptExecutor {

    /** Service for creating and managing database backups */
    public readonly backupService: IBackupService;

    /** Service for tracking executed migrations in the database */
    public readonly schemaVersionService: ISchemaVersionService;

    /** Service for rendering console output (tables, status messages) */
    public readonly consoleRenderer: IConsoleRenderer;

    /** Service for discovering and loading migration script files */
    public readonly migrationService: IMigrationService;

    /** Logger instance used across all services */
    public readonly logger: ILogger;

    /** Lifecycle hooks for extending migration behavior */
    public readonly hooks?: IMigrationHooks;

    /** Service for selecting which migrations to execute */
    private readonly selector: MigrationScriptSelector;

    /** Service for executing migration scripts */
    private readonly runner: MigrationRunner;

    /**
     * Creates a new MigrationScriptExecutor instance.
     *
     * Initializes all required services (backup, schema version tracking, console rendering,
     * migration discovery) and displays the application banner.
     *
     * @param handler - Database migration handler implementing database-specific operations
     * @param dependencies - Optional service dependencies for dependency injection
     *
     * @example
     * ```typescript
     * // Default behavior (backward compatible)
     * const executor = new MigrationScriptExecutor(handler);
     *
     * // With JSON output for CI/CD
     * const executor = new MigrationScriptExecutor(handler, {
     *     renderStrategy: new JsonRenderStrategy()
     * });
     *
     * // With silent output for testing
     * const executor = new MigrationScriptExecutor(handler, {
     *     renderStrategy: new SilentRenderStrategy()
     * });
     *
     * // With custom logger
     * const executor = new MigrationScriptExecutor(handler, {
     *     logger: new SilentLogger()
     * });
     *
     * // With mock services for testing
     * const executor = new MigrationScriptExecutor(handler, {
     *     backupService: mockBackupService,
     *     migrationService: mockMigrationService
     * });
     * ```
     */
    constructor(
        private handler: IDatabaseMigrationHandler,
        dependencies?: IMigrationExecutorDependencies
    ) {
        // Use provided logger or default to ConsoleLogger
        this.logger = dependencies?.logger ?? new ConsoleLogger();

        // Use provided hooks if available
        this.hooks = dependencies?.hooks;

        // Use provided dependencies or create defaults
        this.backupService = dependencies?.backupService
            ?? new BackupService(handler, this.logger);

        this.schemaVersionService = dependencies?.schemaVersionService
            ?? new SchemaVersionService(handler.schemaVersion);

        this.consoleRenderer = dependencies?.consoleRenderer
            ?? new ConsoleRenderer(handler, this.logger, dependencies?.renderStrategy);

        this.migrationService = dependencies?.migrationService
            ?? new MigrationService(this.logger);

        this.selector = new MigrationScriptSelector();
        this.runner = new MigrationRunner(handler, this.schemaVersionService, this.logger);

        this.consoleRenderer.drawFiglet();
    }

    /**
     * Execute all pending database migrations.
     *
     * This is the main method for running migrations. It:
     * 1. Creates a database backup
     * 2. Initializes the schema version tracking table
     * 3. Loads all migration scripts and determines which need to run
     * 4. Executes pending migrations in chronological order
     * 5. Updates the schema version table after each successful migration
     * 6. Deletes the backup on success, or restores from backup on failure
     *
     * @returns Promise resolving to a MigrationResult object containing:
     *          - success: true if all migrations completed successfully, false otherwise
     *          - executed: array of migrations that were executed during this run
     *          - migrated: array of previously executed migrations from database history
     *          - ignored: array of migrations with timestamps older than the last executed
     *          - errors: array of errors if any occurred (only present when success is false)
     *
     * @example
     * ```typescript
     * const executor = new MigrationScriptExecutor(handler);
     *
     * // Run all pending migrations
     * const result = await executor.migrate();
     *
     * if (result.success) {
     *   console.log(`Executed ${result.executed.length} migrations`);
     *   process.exit(0);
     * } else {
     *   console.error('Migration failed:', result.errors);
     *   process.exit(1);
     * }
     * ```
     */
    public async migrate(): Promise<IMigrationResult> {
        let scripts: IScripts = {
            all: [],
            migrated: [],
            todo: [],
            executed: []
        };
        let ignored: MigrationScript[] = [];
        const errors: Error[] = [];
        let backupPath: string | undefined;

        try {
            // Hook: Before backup
            await this.hooks?.onBeforeBackup?.();

            // Create backup
            backupPath = await this.backupService.backup();

            // Hook: After backup
            if (backupPath) {
                await this.hooks?.onAfterBackup?.(backupPath);
            }

            await this.schemaVersionService.init(this.handler.cfg.tableName);

            // Collect information about migrations
            scripts = await Utils.promiseAll({
                migrated: this.schemaVersionService.getAllMigratedScripts(),
                all: this.migrationService.readMigrationScripts(this.handler.cfg)
            }) as IScripts;
            this.consoleRenderer.drawMigrated(scripts, this.handler.cfg.displayLimit);

            // Define scripts which should be executed
            scripts.todo = this.getTodo(scripts.migrated, scripts.all);
            ignored = this.getIgnored(scripts.migrated, scripts.all);
            this.consoleRenderer.drawIgnoredTable(ignored);
            await Promise.all(scripts.todo.map(s => s.init()));

            // Hook: Start (after we know what will be executed)
            await this.hooks?.onStart?.(scripts.all.length, scripts.todo.length);

            if (!scripts.todo.length) {
                this.logger.info('Nothing to do');
                this.backupService.deleteBackup();

                const result: IMigrationResult = {
                    success: true,
                    executed: [],
                    migrated: scripts.migrated,
                    ignored
                };

                // Hook: Complete
                await this.hooks?.onComplete?.(result);

                return result;
            }

            this.logger.info('Processing...');
            this.consoleRenderer.drawTodoTable(scripts.todo);

            // Execute migrations with hooks
            scripts.executed = await this.executeWithHooks(scripts.todo);

            this.consoleRenderer.drawExecutedTable(scripts.executed);
            this.logger.info('Migration finished successfully!');
            this.backupService.deleteBackup();

            const result: IMigrationResult = {
                success: true,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored
            };

            // Hook: Complete
            await this.hooks?.onComplete?.(result);

            return result;
        } catch (err) {
            this.logger.error(err as string);
            errors.push(err as Error);

            // Hook: Before restore
            await this.hooks?.onBeforeRestore?.();

            await this.backupService.restore();

            // Hook: After restore
            await this.hooks?.onAfterRestore?.();

            this.backupService.deleteBackup();

            // Hook: Error
            await this.hooks?.onError?.(err as Error);

            return {
                success: false,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored,
                errors
            };
        }
    }

    /**
     * Display all migrations with their execution status.
     *
     * Shows a formatted table with:
     * - Timestamp and name of each migration
     * - Execution date/time for completed migrations
     * - Duration of execution
     * - Whether the migration file still exists locally
     *
     * @param number - Maximum number of migrations to display (0 = all). Defaults to 0.
     *
     * @example
     * ```typescript
     * const executor = new MigrationScriptExecutor(handler);
     *
     * // List all migrations
     * await executor.list();
     *
     * // List only the last 10 migrations
     * await executor.list(10);
     * ```
     */
    public async list(number = 0) {
        const scripts = await Utils.promiseAll({
            migrated: this.schemaVersionService.getAllMigratedScripts(),
            all: this.migrationService.readMigrationScripts(this.handler.cfg)
        }) as IScripts;

        this.consoleRenderer.drawMigrated(scripts, number)
    }

    /**
     * Determine which migration scripts need to be executed.
     *
     * Delegates to MigrationScriptSelector to compare all discovered migration files
     * against already-executed migrations.
     *
     * @param migrated - Array of previously executed migrations from the database
     * @param all - Array of all migration script files discovered in the migrations folder
     * @returns Array of migration scripts that need to be executed
     *
     * @private
     */
    getTodo(migrated:MigrationScript[], all:MigrationScript[]): MigrationScript[] {
        return this.selector.getTodo(migrated, all);
    }

    /**
     * Get scripts that were ignored due to being older than the last migration.
     *
     * Delegates to MigrationScriptSelector to identify out-of-order migrations.
     *
     * @param migrated - Array of previously executed migrations from the database
     * @param all - Array of all migration script files discovered in the migrations folder
     * @returns Array of ignored migration scripts
     *
     * @private
     */
    getIgnored(migrated:MigrationScript[], all:MigrationScript[]): MigrationScript[] {
        return this.selector.getIgnored(migrated, all);
    }

    /**
     * Execute migration scripts sequentially with lifecycle hooks.
     *
     * Wraps each migration execution with onBeforeMigrate, onAfterMigrate, and
     * onMigrationError hooks. If no migration hooks are registered, delegates
     * to the regular execute() method for backward compatibility.
     *
     * @param scripts - Array of migration scripts to execute
     * @returns Array of executed migrations with results and timing information
     *
     * @throws {Error} If any migration fails, execution stops and the error is propagated
     *
     * @private
     */
    private async executeWithHooks(scripts: MigrationScript[]): Promise<MigrationScript[]> {
        const executed: MigrationScript[] = [];

        for (const script of scripts) {
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

                executed.push(result);
            } catch (err) {
                // Hook: Migration error
                if (this.hooks && this.hooks.onMigrationError) {
                    await this.hooks.onMigrationError(script, err as Error);
                }

                // Re-throw to trigger rollback
                throw err;
            }
        }

        return executed;
    }

    /**
     * Execute migration scripts sequentially in chronological order.
     *
     * Delegates to MigrationRunner to run each migration one at a time in the correct order.
     *
     * @param scripts - Array of migration scripts to execute
     * @returns Array of executed migrations with results and timing information
     *
     * @throws {Error} If any migration fails, execution stops and the error is propagated
     *
     * @private
     */
    async execute(scripts: MigrationScript[]): Promise<MigrationScript[]> {
        return this.runner.execute(scripts);
    }
}