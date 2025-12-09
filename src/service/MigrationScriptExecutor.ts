import {BackupService} from "./BackupService";
import {MigrationRenderer} from "./MigrationRenderer";
import {IBackupService} from "../interface/service/IBackupService";
import {MigrationService} from "./MigrationService";
import {IMigrationService} from "../interface/service/IMigrationService";
import {MigrationScript} from "../model/MigrationScript";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {ISchemaVersion} from "../interface/dao/ISchemaVersion";
import {SchemaVersionService} from "./SchemaVersionService";
import {IMigrationResult} from "../interface/IMigrationResult";
import {ILogger} from "../interface/ILogger";
import {IMigrationExecutorDependencies} from "../interface/IMigrationExecutorDependencies";
import {IMigrationRenderer} from "../interface/service/IMigrationRenderer";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {ConsoleLogger} from "../logger";
import {LevelAwareLogger} from "../logger/LevelAwareLogger";
import {MigrationScriptSelector} from "./MigrationScriptSelector";
import {MigrationRunner} from "./MigrationRunner";
import {MigrationScanner} from "./MigrationScanner";
import {IMigrationScanner} from "../interface/service/IMigrationScanner";
import {Config} from "../model";
import {MigrationValidationService} from "./MigrationValidationService";
import {IMigrationValidationService, IValidationResult, IValidationIssue, IDB} from "../interface";
import {RollbackService} from "./RollbackService";
import {IRollbackService} from "../interface/service/IRollbackService";
import {MigrationErrorHandler} from "./MigrationErrorHandler";
import {IMigrationErrorHandler} from "../interface/service/IMigrationErrorHandler";
import {MigrationRollbackManager} from "./MigrationRollbackManager";
import {IMigrationRollbackManager} from "../interface/service/IMigrationRollbackManager";
import {MigrationHookExecutor} from "./MigrationHookExecutor";
import {IMigrationHookExecutor} from "../interface/service/IMigrationHookExecutor";
import {MigrationValidationOrchestrator} from "./MigrationValidationOrchestrator";
import {IMigrationValidationOrchestrator} from "../interface/service/IMigrationValidationOrchestrator";
import {MigrationReportingOrchestrator} from "./MigrationReportingOrchestrator";
import {IMigrationReportingOrchestrator} from "../interface/service/IMigrationReportingOrchestrator";
import {MigrationWorkflowOrchestrator} from "./MigrationWorkflowOrchestrator";
import {IMigrationWorkflowOrchestrator} from "../interface/service/IMigrationWorkflowOrchestrator";
import {LoaderRegistry} from "../loader/LoaderRegistry";
import {ILoaderRegistry} from "../interface/loader/ILoaderRegistry";
import {CompositeHooks} from "../hooks/CompositeHooks";
import {ExecutionSummaryHook} from "../hooks/ExecutionSummaryHook";
import {ConfigLoader} from "../util/ConfigLoader";
import {ITransactionManager} from "../interface/service/ITransactionManager";
import {DefaultTransactionManager} from "./DefaultTransactionManager";
import {CallbackTransactionManager} from "./CallbackTransactionManager";
import {isImperativeTransactional, isCallbackTransactional} from "../interface/dao/ITransactionalDB";
import {TransactionMode} from "../model/TransactionMode";
import {MetricsCollectorHook} from "../hooks/MetricsCollectorHook";

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
    private readonly config: Config;

    /** Database migration handler implementing database-specific operations */
    private readonly handler: IDatabaseMigrationHandler<DB>;

    /** Service for creating and managing database backups */
    public readonly backupService: IBackupService;

    /** Service for tracking executed migrations in the database */
    public readonly schemaVersionService: ISchemaVersionService<DB>;

    /** Service for rendering migration output (tables, status messages) */
    public readonly migrationRenderer: IMigrationRenderer<DB>;

    /** Service for discovering and loading migration script files */
    public readonly migrationService: IMigrationService<DB>;

    /** Service for scanning and gathering complete migration state */
    public readonly migrationScanner: IMigrationScanner<DB>;

    /** Logger instance used across all services */
    public readonly logger: ILogger;

    /** Lifecycle hooks for extending migration behavior */
    public readonly hooks?: IMigrationHooks<DB>;

    /** Service for selecting which migrations to execute */
    private readonly selector: MigrationScriptSelector<DB>;

    /** Service for executing migration scripts */
    private readonly runner: MigrationRunner<DB>;

    /** Service for validating migration scripts before execution */
    public readonly validationService: IMigrationValidationService<DB>;

    /** Service for handling rollback operations based on configured strategy */
    public readonly rollbackService: IRollbackService<DB>;

    /** Service for handling migration errors and coordinating error recovery */
    private readonly errorHandler: IMigrationErrorHandler<DB>;

    /** Service for managing version-based rollback operations */
    private readonly rollbackManager: IMigrationRollbackManager<DB>;

    /** Service for executing migrations with lifecycle hooks */
    private readonly hookExecutor: IMigrationHookExecutor<DB>;

    /** Service for orchestrating migration validation */
    private readonly validationOrchestrator: IMigrationValidationOrchestrator<DB>;

    /** Service for orchestrating migration reporting and display */
    private readonly reportingOrchestrator: IMigrationReportingOrchestrator<DB>;

    /** Service for orchestrating migration workflow execution */
    private readonly workflowOrchestrator: IMigrationWorkflowOrchestrator<DB>;

    /** Registry for loading migration scripts of different types (TypeScript, SQL, etc.) */
    private readonly loaderRegistry: ILoaderRegistry<DB>;

    /**
     * Transaction manager for database transactions (v0.5.0).
     * Auto-created if handler provides transactionManager or db implements ITransactionalDB.
     * Typed with the generic DB parameter (v0.6.0).
     */
    private readonly transactionManager?: ITransactionManager<DB>;

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
        // Extract handler from dependencies
        this.handler = dependencies.handler;

        // Use provided configLoader or create default instance
        const configLoader = dependencies.configLoader ?? new ConfigLoader();

        // Load config using configLoader, with dependencies.config as override
        this.config = dependencies.config ?? configLoader.load();
        // Use provided logger or default to ConsoleLogger, wrapped with level awareness
        const baseLogger = dependencies.logger ?? new ConsoleLogger();
        this.logger = new LevelAwareLogger(baseLogger, this.config.logLevel);

        // Setup hooks with automatic execution summary logging and metrics collection (v0.6.0)
        const hooks: IMigrationHooks<DB>[] = [];

        // Add MetricsCollectorHook if collectors provided (v0.6.0)
        if (dependencies.metricsCollectors && dependencies.metricsCollectors.length > 0) {
            hooks.push(new MetricsCollectorHook(dependencies.metricsCollectors, this.logger));
        }

        // Add user-provided hooks
        if (dependencies.hooks) hooks.push(dependencies.hooks);

        // Add execution summary hook if logging enabled
        if (this.config.logging.enabled) hooks.push(new ExecutionSummaryHook<DB>(this.config, this.logger, this.handler));

        // Combine all hooks or use undefined
        this.hooks = hooks.length > 0 ? new CompositeHooks<DB>(hooks) : undefined;

        // Use provided loader registry or create default (TypeScript + SQL)
        this.loaderRegistry = dependencies.loaderRegistry ?? LoaderRegistry.createDefault(this.logger);

        // Use provided dependencies or create defaults
        this.backupService = dependencies.backupService
            ?? new BackupService<DB>(this.handler, this.config, this.logger);

        this.schemaVersionService = dependencies.schemaVersionService
            ?? new SchemaVersionService<DB, ISchemaVersion<DB>>(this.handler.schemaVersion);

        this.migrationRenderer = dependencies.migrationRenderer
            ?? new MigrationRenderer<DB>(this.handler, this.config, this.logger, dependencies.renderStrategy);

        this.migrationService = dependencies.migrationService
            ?? new MigrationService<DB>(this.logger);

        this.selector = new MigrationScriptSelector<DB>();

        this.migrationScanner = dependencies.migrationScanner
            ?? new MigrationScanner<DB>(
                this.migrationService,
                this.schemaVersionService,
                this.selector,
                this.config
            );

        // Create transaction manager if transactions are enabled (v0.5.0)
        this.transactionManager = this.createTransactionManager(this.handler);

        // Create MigrationRunner with transaction support (v0.5.0)
        this.runner = new MigrationRunner<DB>(
            this.handler,
            this.schemaVersionService,
            this.config,
            this.logger,
            this.transactionManager,
            this.hooks
        );

        this.validationService = dependencies.validationService
            ?? new MigrationValidationService<DB>(this.logger, this.config.customValidators);

        this.rollbackService = dependencies.rollbackService
            ?? new RollbackService<DB>(this.handler, this.config, this.backupService, this.logger, this.hooks);

        // Initialize error handler
        this.errorHandler = new MigrationErrorHandler<DB>({
            logger: this.logger,
            hooks: this.hooks,
            rollbackService: this.rollbackService
        });

        // Initialize rollback manager
        this.rollbackManager = new MigrationRollbackManager<DB>({
            handler: this.handler,
            schemaVersionService: this.schemaVersionService,
            migrationScanner: this.migrationScanner,
            selector: this.selector,
            logger: this.logger,
            config: this.config,
            loaderRegistry: this.loaderRegistry,
            validationService: this.validationService,
            hooks: this.hooks,
            errorHandler: this.errorHandler
        });

        // Initialize hook executor
        this.hookExecutor = new MigrationHookExecutor<DB>({
            runner: this.runner,
            hooks: this.hooks
        });

        // Initialize validation orchestrator
        this.validationOrchestrator = new MigrationValidationOrchestrator<DB>({
            validationService: this.validationService,
            logger: this.logger,
            config: this.config,
            loaderRegistry: this.loaderRegistry,
            migrationScanner: this.migrationScanner,
            schemaVersionService: this.schemaVersionService,
            handler: this.handler
        });

        // Initialize reporting orchestrator
        this.reportingOrchestrator = new MigrationReportingOrchestrator<DB>({
            migrationRenderer: this.migrationRenderer,
            logger: this.logger,
            config: this.config
        });

        // Initialize workflow orchestrator
        this.workflowOrchestrator = new MigrationWorkflowOrchestrator<DB>({
            migrationScanner: this.migrationScanner,
            validationOrchestrator: this.validationOrchestrator,
            reportingOrchestrator: this.reportingOrchestrator,
            backupService: this.backupService,
            hookExecutor: this.hookExecutor,
            errorHandler: this.errorHandler,
            rollbackService: this.rollbackService,
            schemaVersionService: this.schemaVersionService,
            loaderRegistry: this.loaderRegistry,
            selector: this.selector,
            transactionManager: this.transactionManager,
            config: this.config,
            logger: this.logger,
            hooks: this.hooks,
            executeBeforeMigrate: () => this.executeBeforeMigrate()
        });

        if (this.config.showBanner) {
            this.migrationRenderer.drawFiglet();
        }
    }

    /**
     * Create transaction manager if transactions are enabled.
     *
     * Auto-creates appropriate transaction manager based on database interface:
     * - **Imperative (SQL)**: Creates {@link DefaultTransactionManager} for `ITransactionalDB`
     * - **Callback (NoSQL)**: Creates {@link CallbackTransactionManager} for `ICallbackTransactionalDB`
     *
     * **New in v0.5.0**
     *
     * @param handler - Database migration handler
     * @returns Transaction manager or undefined
     *
     * @example
     * ```typescript
     * // Automatic detection for PostgreSQL
     * const handler = {
     *   db: postgresDB,  // implements ITransactionalDB
     *   // ... other properties
     * };
     * // Creates DefaultTransactionManager automatically
     *
     * // Automatic detection for Firestore
     * const handler = {
     *   db: firestoreDB,  // implements ICallbackTransactionalDB
     *   // ... other properties
     * };
     * // Creates CallbackTransactionManager automatically
     * ```
     */
    private createTransactionManager(handler: IDatabaseMigrationHandler<DB>): ITransactionManager<DB> | undefined {
        // If transaction mode is NONE, don't create transaction manager
        if (this.config.transaction.mode === TransactionMode.NONE) {
            return undefined;
        }

        // If handler provides custom transaction manager, use it
        if (handler.transactionManager) {
            this.logger.debug('Using custom transaction manager from handler');
            return handler.transactionManager;
        }

        // Check for imperative transaction support (SQL-style)
        if (isImperativeTransactional(handler.db)) {
            this.logger.debug('Auto-creating DefaultTransactionManager (db implements ITransactionalDB)');
            return new DefaultTransactionManager<DB>(
                handler.db,
                this.config.transaction,
                this.logger
            );
        }

        // Check for callback transaction support (NoSQL-style)
        if (isCallbackTransactional(handler.db)) {
            this.logger.debug('Auto-creating CallbackTransactionManager (db implements ICallbackTransactionalDB)');
            return new CallbackTransactionManager<DB>(
                handler.db,
                this.config.transaction,
                this.logger
            );
        }

        // No transaction support available
        this.logger.warn(
            'Transaction mode is configured but database does not support transactions. ' +
            'Either implement ITransactionalDB (SQL) or ICallbackTransactionalDB (NoSQL), ' +
            'or provide a custom transactionManager in the handler.'
        );
        return undefined;
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
            return this.workflowOrchestrator.migrateToVersion(targetVersion);
        }

        // Otherwise, run all pending migrations
        return this.workflowOrchestrator.migrateAll();
    }

    /**
     * Check database connection before performing operations.
     *
     * Calls the database handler's checkConnection() method to verify connectivity.
     * Throws an error if the connection check fails, preventing wasted time and
     * resources on migration operations that would fail anyway.
     *
     * @private
     * @throws Error if database connection check fails
     */
    private async checkDatabaseConnection(): Promise<void> {
        this.logger.debug('Checking database connection...');

        const isConnected = await this.handler.db.checkConnection();

        if (!isConnected) {
            const errorMsg = 'Database connection check failed. Cannot proceed with migration operations. ' +
                           'Please verify your database connection settings and ensure the database is accessible.';
            this.logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        this.logger.debug('Database connection verified successfully');
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
        await this.schemaVersionService.init(this.config.tableName);

        const scripts = await this.migrationScanner.scan();
        this.migrationRenderer.drawMigrated(scripts);

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
        await this.validationOrchestrator.validate();

        // Scan again to get results for return value (respecting config flags)
        const scripts = await this.migrationScanner.scan();

        const pendingResults = this.config.validateBeforeRun
            ? await this.validationService.validateAll(scripts.pending, this.config, this.loaderRegistry)
            : [];

        const migratedIssues = this.config.validateMigratedFiles
            ? await this.validationService.validateMigratedFileIntegrity(scripts.migrated, this.config)
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
        return this.backupService.backup();
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
        return this.backupService.restore(backupPath);
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
        this.backupService.deleteBackup();
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
        return this.rollbackManager.rollbackToVersion(targetVersion);
    }

    /**
     * Execute the beforeMigrate script if it exists.
     *
     * Looks for a beforeMigrate.ts or beforeMigrate.js file in the migrations folder
     * and executes it before scanning for migrations. This allows the beforeMigrate
     * script to completely reset or erase the database (e.g., load a prod snapshot).
     *
     * The beforeMigrate script is NOT saved to the schema version table.
     *
     * @private
     *
     * @example
     * ```typescript
     * // migrations/beforeMigrate.ts
     * export default class BeforeMigrate implements IRunnableScript<DB> {
     *   async up(db, info, handler) {
     *     await db.query('DROP SCHEMA public CASCADE');
     *     await db.query('CREATE SCHEMA public');
     *     return 'Database reset complete';
     *   }
     * }
     * ```
     */
    private async executeBeforeMigrate(): Promise<void> {
        this.logger.info('Checking for beforeMigrate setup script...');

        const beforeMigratePath = await this.migrationService.findBeforeMigrateScript(this.config);
        if (!beforeMigratePath) {
            this.logger.info('No beforeMigrate script found, skipping setup phase');
            return;
        }

        this.logger.info(`Found beforeMigrate script: ${beforeMigratePath}`);
        this.logger.info('Executing beforeMigrate setup...');

        const startTime = Date.now();

        // Create a temporary MigrationScript for the beforeMigrate file
        const beforeMigrateScript = new MigrationScript<DB>(
            'beforeMigrate',
            beforeMigratePath,
            0 // No timestamp for beforeMigrate
        );

        // Initialize and execute directly (don't save to schema version table)
        await beforeMigrateScript.init(this.loaderRegistry);
        const result = await beforeMigrateScript.script.up(this.handler.db, beforeMigrateScript, this.handler);

        const duration = Date.now() - startTime;
        this.logger.info(`✓ beforeMigrate completed successfully in ${duration}ms`);
        if (result) {
            this.logger.info(`Result: ${result}`);
        }
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
        return this.runner.execute(scripts);
    }
}