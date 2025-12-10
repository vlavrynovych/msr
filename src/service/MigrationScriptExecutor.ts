import {MigrationScript} from "../model/MigrationScript";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {IMigrationResult} from "../interface/IMigrationResult";
import {IMigrationExecutorDependencies} from "../interface/IMigrationExecutorDependencies";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {Config} from "../model";
import {IValidationResult, IValidationIssue, IDB} from "../interface";
import {ILoaderRegistry} from "../interface/loader/ILoaderRegistry";
import {createMigrationServices} from "./MigrationServicesFactory";
import {CoreServices} from "./facade/CoreServices";
import {ExecutionServices} from "./facade/ExecutionServices";
import {OutputServices} from "./facade/OutputServices";
import {OrchestrationServices} from "./facade/OrchestrationServices";

/**
 * Main executor class for running database migrations.
 *
 * Orchestrates the entire migration workflow including:
 * - Automatic configuration loading (env vars → file → defaults)
 * - Creating backups before migrations
 * - Loading and tracking migration scripts
 * - Executing migrations in order with transaction support (v0.5.0)
 * - Restoring from backup on failure
 * - Displaying migration status and results
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * **New in v0.5.0:** Automatic transaction management with configurable modes
 * **Breaking Change in v0.6.0:** Constructor signature changed to `(dependencies, config?)`
 *
 * @example
 * ```typescript
 * import { MigrationScriptExecutor } from '@migration-script-runner/core';
 *
 * const handler = new MyDatabaseHandler();
 *
 * // Option 1: Minimal - just handler, uses waterfall config loading
 * const executor = new MigrationScriptExecutor<IDB>({ handler });
 * // Loads config from: MSR_* env vars → ./msr.config.js → defaults
 *
 * // Option 2: With explicit config
 * const config = new Config();
 * const executor = new MigrationScriptExecutor<IDB>({ handler }, config);
 *
 * // Run all pending migrations
 * await executor.up();
 *
 * // List all migrations
 * await executor.list();
 * ```
 */
export class MigrationScriptExecutor<DB extends IDB> {

    /** Configuration for the migration system */
    protected readonly config: Config;

    /** Database migration handler implementing database-specific operations */
    protected readonly handler: IDatabaseMigrationHandler<DB>;

    /** Registry for loading migration scripts of different types (TypeScript, SQL, etc.) */
    protected readonly loaderRegistry: ILoaderRegistry<DB>;

    /** Lifecycle hooks (stored for test access only - not for adapter use) */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly hooks?: IMigrationHooks<DB>;

    /** Core business logic services (scanning, validation, backup, rollback) */
    protected readonly core: CoreServices<DB>;

    /** Migration execution services (selector, runner, transaction manager) */
    protected readonly execution: ExecutionServices<DB>;

    /** Output services (logging and rendering) */
    protected readonly output: OutputServices<DB>;

    /** Orchestration services (workflow, validation, reporting, error handling, hooks, rollback) */
    protected readonly orchestration: OrchestrationServices<DB>;

    /**
     * Creates a new MigrationScriptExecutor instance.
     *
     * Initializes all required services (backup, schema version tracking, console rendering,
     * migration discovery) and displays the application banner.
     *
     * **Configuration Loading (Waterfall - v0.7.0):**
     * Uses ConfigLoader instance (from dependencies.configLoader or default):
     * 1. Start with built-in defaults
     * 2. Merge with config file (if exists)
     * 3. Merge with environment variables (MSR_*)
     * 4. Merge with dependencies.config (if provided)
     *
     * **Breaking Changes:**
     * - v0.7.0: Single parameter constructor `(dependencies)`. Config moved to dependencies.config.
     * - v0.6.0: Constructor signature changed from `(handler, config?, dependencies?)` to `(dependencies, config?)`.
     *
     * @param dependencies - Service dependencies including required handler, optional config and configLoader
     *
     * @example
     * ```typescript
     * // Minimal - just handler, uses waterfall config loading
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler
     * });
     *
     * // With explicit config (v0.7.0+)
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     config: new Config({ folder: './migrations' })
     * });
     *
     * // With custom config loader (v0.7.0+)
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     configLoader: new CustomConfigLoader()
     * });
     *
     * // With JSON output for CI/CD
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     renderStrategy: new JsonRenderStrategy()
     * });
     *
     * // With silent output for testing
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     renderStrategy: new SilentRenderStrategy(),
     *     logger: new SilentLogger()
     * });
     *
     * // With mock services for testing
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: mockHandler,
     *     config: testConfig,
     *     backupService: mockBackupService,
     *     migrationService: mockMigrationService
     * });
     * ```
     */
    constructor(dependencies: IMigrationExecutorDependencies<DB>) {
        // Initialize all services via factory
        const services = createMigrationServices(dependencies);

        // Store infrastructure
        this.config = services.config;
        this.handler = services.handler;
        this.loaderRegistry = services.loaderRegistry;
        this.hooks = services.hooks;  // For test access only

        // Store service facades
        this.core = services.core;
        this.execution = services.execution;
        this.output = services.output;
        this.orchestration = services.orchestration;

        if (this.config.showBanner) {
            this.output.renderer.drawFiglet();
        }
    }

    /**
     * Execute database migrations.
     *
     * This is the main method for running migrations. It:
     * 1. Creates a database backup (if configured)
     * 2. Initializes the schema version tracking table
     * 3. Loads all migration scripts and determines which need to run
     * 4. Executes pending migrations in chronological order
     * 5. Updates the schema version table after each successful migration
     * 6. Deletes the backup on success, or restores from backup on failure
     *
     * @param targetVersion - Optional target version to migrate to. If not provided, runs all pending migrations.
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
     * const executor = new MigrationScriptExecutor<DB>(handler, config);
     *
     * // Run all pending migrations
     * const result = await executor.up();
     *
     * // Or migrate to specific version
     * const result = await executor.up(202501220100);
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
    public async up(targetVersion?: number): Promise<IMigrationResult<DB>> {
        // Check database connection before proceeding
        await this.checkDatabaseConnection();

        // If targetVersion provided, delegate to workflow orchestrator
        if (targetVersion !== undefined) {
            return this.orchestration.workflow.migrateToVersion(targetVersion);
        }

        // Otherwise, run all pending migrations
        return this.orchestration.workflow.migrateAll();
    }

    /**
     * Check database connection before performing operations.
     *
     * Calls the database handler's checkConnection() method to verify connectivity.
     * Throws an error if the connection check fails, preventing wasted time and
     * resources on migration operations that would fail anyway.
     *
     * Subclasses can override this method to implement custom connection validation logic.
     *
     * @protected
     * @throws Error if database connection check fails
     */
    protected async checkDatabaseConnection(): Promise<void> {
        this.output.logger.debug('Checking database connection...');

        const isConnected = await this.handler.db.checkConnection();

        if (!isConnected) {
            const errorMsg = 'Database connection check failed. Cannot proceed with migration operations. ' +
                           'Please verify your database connection settings and ensure the database is accessible.';
            this.output.logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.output.logger.debug('Database connection verified successfully');
    }

    /**
     * Alias for up() method - executes database migrations.
     *
     * Provided for convenience and clarity. Delegates to up() method.
     *
     * @param targetVersion - Optional target version to migrate to. If not provided, runs all pending migrations.
     * @returns Promise resolving to a MigrationResult object
     *
     * @example
     * ```typescript
     * // Both of these are equivalent:
     * await executor.migrate();
     * await executor.up();
     *
     * // With target version:
     * await executor.migrate(202501220100);
     * await executor.up(202501220100);
     * ```
     */
    public async migrate(targetVersion?: number): Promise<IMigrationResult<DB>> {
        return this.up(targetVersion);
    }

    /**
     * - Duration of execution
     * - Whether the migration file still exists locally
     *
     * @param number - Maximum number of migrations to display (0 = all). Defaults to 0.
     *
     * @example
     * ```typescript
     * const executor = new MigrationScriptExecutor<DB>(handler);
     *
     * // List all migrations
     * await executor.list();
     *
     * // List only the last 10 migrations
     * await executor.list(10);
     * ```
     */
    public async list(number = 0) {
        // Temporarily override displayLimit if number is specified
        const originalLimit = this.config.displayLimit;
        if (number > 0) {
            this.config.displayLimit = number;
        }

        // Initialize schema version table BEFORE scanning
        // scan() needs to query the schema version table to get executed migrations
        await this.core.schemaVersion.init(this.config.tableName);

        const scripts = await this.core.scanner.scan();
        this.output.renderer.drawMigrated(scripts);

        // Restore original limit
        this.config.displayLimit = originalLimit;
    }

    /**
     * Validate pending and executed migrations without running them.
     *
     * This method performs comprehensive validation of migration scripts:
     * - Validates structure and interface of pending migrations
     * - Validates integrity of already-executed migrations (checksums, file existence)
     * - Checks down() method requirements based on rollback strategy
     * - Runs custom validators if configured
     *
     * Useful for CI/CD pipelines to validate migrations before deployment
     * without executing them or connecting to the database for initialization.
     *
     * @returns Validation results for all scripts (pending and migrated)
     * @throws {ValidationError} If validation fails (errors found or warnings in strict mode)
     *
     * @example
     * ```typescript
     * // In CI/CD pipeline
     * try {
     *   await executor.validate();
     *   console.log('✓ All migrations are valid');
     * } catch (error) {
     *   console.error('❌ Migration validation failed:', error.message);
     *   process.exit(1);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Pre-deployment validation
     * const results = await executor.validate();
     * console.log(`Validated ${results.pending.length} pending and ${results.migrated.length} executed migrations`);
     * ```
     */
    public async validate(): Promise<{pending: IValidationResult<DB>[], migrated: IValidationIssue[]}> {
        await this.orchestration.validation.validate();

        // Scan again to get results for return value (respecting config flags)
        const scripts = await this.core.scanner.scan();

        const pendingResults = this.config.validateBeforeRun
            ? await this.core.validation.validateAll(scripts.pending, this.config, this.loaderRegistry)
            : [];

        const migratedIssues = this.config.validateMigratedFiles
            ? await this.core.validation.validateMigratedFileIntegrity(scripts.migrated, this.config)
            : [];

        return {
            pending: pendingResults,
            migrated: migratedIssues
        };
    }

    /**
     * Create a database backup manually.
     *
     * Useful for manual backup workflows or when using BackupMode.MANUAL.
     * The backup file is created using the configured backup settings.
     *
     * @returns The absolute path to the created backup file
     *
     * @example
     * ```typescript
     * // Manual backup workflow
     * const backupPath = await executor.createBackup();
     * console.log(`Backup created: ${backupPath}`);
     *
     * try {
     *   await executor.migrate();
     * } catch (error) {
     *   await executor.restoreFromBackup(backupPath);
     * }
     * ```
     */
    public async createBackup(): Promise<string> {
        return this.core.backup.backup();
    }

    /**
     * Restore database from a backup file.
     *
     * Restores the database to the state captured in the specified backup file.
     * If no path is provided, restores from the most recently created backup.
     *
     * @param backupPath - Optional path to backup file. If not provided, uses the most recent backup.
     *
     * @example
     * ```typescript
     * // Restore from specific backup
     * await executor.restoreFromBackup('./backups/backup-2025-01-22.bkp');
     *
     * // Restore from most recent backup (created by createBackup())
     * await executor.restoreFromBackup();
     * ```
     */
    public async restoreFromBackup(backupPath?: string): Promise<void> {
        return this.core.backup.restore(backupPath);
    }

    /**
     * Delete the backup file from disk.
     *
     * Only deletes if config.backup.deleteBackup is true. Useful for manual
     * cleanup after successful migrations when using BackupMode.MANUAL or
     * BackupMode.CREATE_ONLY.
     *
     * @example
     * ```typescript
     * // Manual cleanup after successful migration
     * const backupPath = await executor.createBackup();
     * await executor.migrate();
     * executor.deleteBackup();
     * ```
     */
    public deleteBackup(): void {
        this.core.backup.deleteBackup();
    }

    /**
     * Roll back database to a specific target version.
     *
     * Delegates to MigrationRollbackManager to execute down() methods in reverse
     * chronological order and remove records from the schema version table.
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
     * const result = await executor.down(202501220100);
     * console.log(`Rolled back ${result.executed.length} migrations to version 202501220100`);
     * ```
     *
     * @example
     * ```typescript
     * // Emergency rollback in production
     * try {
     *   await executor.down(202501220100);
     *   console.log('✓ Database rolled back to version 202501220100');
     * } catch (error) {
     *   console.error('Rollback failed:', error);
     *   // Manual intervention required
     * }
     * ```
     */
    public async down(targetVersion: number): Promise<IMigrationResult<DB>> {
        return this.orchestration.rollback.rollbackToVersion(targetVersion);
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
    async execute(scripts: MigrationScript<DB>[]): Promise<MigrationScript<DB>[]> {
        return this.execution.runner.execute(scripts);
    }
}