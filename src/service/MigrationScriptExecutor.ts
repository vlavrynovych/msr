import _ from 'lodash';
import * as os from 'os'
import {
    BackupService,
    ConsoleRenderer,
    IBackupService,
    MigrationService,
    IMigrationService,
    MigrationScript,
    IDatabaseMigrationHandler,
    ISchemaVersionService,
    IScripts,
    SchemaVersionService,
    Utils,
    IMigrationResult,
    ILogger,
    IMigrationExecutorDependencies,
    IConsoleRenderer
} from "../index";
import {ConsoleLogger} from "../logger";
import {MigrationScriptSelector} from "./MigrationScriptSelector";

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

    /** Service for selecting which migrations to execute */
    private readonly selector: MigrationScriptSelector;

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

        // Use provided dependencies or create defaults
        this.backupService = dependencies?.backupService
            ?? new BackupService(handler, this.logger);

        this.schemaVersionService = dependencies?.schemaVersionService
            ?? new SchemaVersionService(handler.schemaVersion);

        this.consoleRenderer = dependencies?.consoleRenderer
            ?? new ConsoleRenderer(handler, this.logger);

        this.migrationService = dependencies?.migrationService
            ?? new MigrationService(this.logger);

        this.selector = new MigrationScriptSelector();

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

        try {
            // inits
            await this.backupService.backup()
            await this.schemaVersionService.init(this.handler.cfg.tableName)

            // collects information about migrations
            scripts = await Utils.promiseAll({
                migrated: this.schemaVersionService.getAllMigratedScripts(),
                all: this.migrationService.readMigrationScripts(this.handler.cfg)
            }) as IScripts;
            this.consoleRenderer.drawMigrated(scripts, this.handler.cfg.displayLimit)

            // defines scripts which should be executed
            scripts.todo = this.getTodo(scripts.migrated, scripts.all);
            ignored = this.getIgnored(scripts.migrated, scripts.all);
            this.consoleRenderer.drawIgnoredTable(ignored);
            await Promise.all(scripts.todo.map(s => s.init()))

            if (!scripts.todo.length) {
                this.logger.info('Nothing to do');
                this.backupService.deleteBackup();
                return {
                    success: true,
                    executed: [],
                    migrated: scripts.migrated,
                    ignored
                };
            }

            this.logger.info('Processing...');
            this.consoleRenderer.drawTodoTable(scripts.todo);
            scripts.executed = await this.execute(scripts.todo);
            this.consoleRenderer.drawExecutedTable(scripts.executed);
            this.logger.info('Migration finished successfully!');
            this.backupService.deleteBackup();

            return {
                success: true,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored
            };
        } catch (err) {
            this.logger.error(err as string)
            errors.push(err as Error);
            await this.backupService.restore();
            this.backupService.deleteBackup();

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
     * Execute migration scripts sequentially in chronological order.
     *
     * Runs each migration one at a time, ensuring migrations execute in the correct order
     * based on their timestamps. Records the current username and execution timestamps
     * for each migration.
     *
     * @param scripts - Array of migration scripts to execute
     * @returns Array of executed migrations with results and timing information
     *
     * @throws {Error} If any migration fails, execution stops and the error is propagated
     *
     * @private
     */
    async execute(scripts: MigrationScript[]): Promise<MigrationScript[]> {
        scripts = _.orderBy(scripts, ['timestamp'], ['asc'])
        const executed: MigrationScript[] = [];
        const username:string = os.userInfo().username;

        // prepares queue of migration tasks
        const tasks = _.orderBy(scripts, ['timestamp'], ['asc'])
            .map((s: MigrationScript) => {
                s.username = username;
                return async () => {
                    executed.push(await this.task(s))
                }
            });

        // runs migrations
        await tasks.reduce(async (promise, nextTask) => {
                await promise
                return nextTask()
            }, Promise.resolve());

        return executed;
    }

    /**
     * Execute a single migration script and save its result.
     *
     * Runs the migration's `up()` method, records execution timing, saves the
     * migration metadata to the schema version table, and returns the completed
     * migration with all metadata populated.
     *
     * @param script - Migration script to execute
     * @returns The executed migration with result and timing information
     *
     * @throws {Error} If the migration's up() method throws an error
     *
     * @private
     */
    async task(script:MigrationScript) {
        this.logger.log(`${script.name}: processing...`);

        script.startedAt = Date.now()
        script.result = await script.script.up(this.handler.db, script, this.handler);
        script.finishedAt = Date.now();

        await this.schemaVersionService.save(script);
        return script
    }
}