import {BackupService} from "./BackupService";
import {MigrationRenderer} from "./MigrationRenderer";
import {IBackupService} from "../interface/service/IBackupService";
import {MigrationService} from "./MigrationService";
import {IMigrationService} from "../interface/service/IMigrationService";
import {MigrationScript} from "../model/MigrationScript";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {IScripts} from "../interface/IScripts";
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
import {Config, ValidationIssueType} from "../model";
import {MigrationValidationService} from "./MigrationValidationService";
import {IMigrationValidationService, IValidationResult, IValidationIssue} from "../interface";
import {ValidationError} from "../error/ValidationError";
import {RollbackService} from "./RollbackService";
import {IRollbackService} from "../interface/service/IRollbackService";
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
 * **New in v0.5.0:** Automatic transaction management with configurable modes
 *
 * @example
 * ```typescript
 * import { MigrationScriptExecutor } from '@migration-script-runner/core';
 *
 * const handler = new MyDatabaseHandler();
 *
 * // Option 1: No config - uses waterfall loading
 * const executor = new MigrationScriptExecutor(handler);
 * // Loads from: MSR_* env vars → ./msr.config.js → defaults
 *
 * // Option 2: With explicit config
 * const config = new Config();
 * const executor = new MigrationScriptExecutor(handler, config);
 *
 * // Run all pending migrations
 * await executor.up();
 *
 * // List all migrations
 * await executor.list();
 * ```
 */
export class MigrationScriptExecutor {

    /** Configuration for the migration system */
    private readonly config: Config;

    /** Service for creating and managing database backups */
    public readonly backupService: IBackupService;

    /** Service for tracking executed migrations in the database */
    public readonly schemaVersionService: ISchemaVersionService;

    /** Service for rendering migration output (tables, status messages) */
    public readonly migrationRenderer: IMigrationRenderer;

    /** Service for discovering and loading migration script files */
    public readonly migrationService: IMigrationService;

    /** Service for scanning and gathering complete migration state */
    public readonly migrationScanner: IMigrationScanner;

    /** Logger instance used across all services */
    public readonly logger: ILogger;

    /** Lifecycle hooks for extending migration behavior */
    public readonly hooks?: IMigrationHooks;

    /** Service for selecting which migrations to execute */
    private readonly selector: MigrationScriptSelector;

    /** Service for executing migration scripts */
    private runner: MigrationRunner;

    /** Service for validating migration scripts before execution */
    public readonly validationService: IMigrationValidationService;

    /** Service for handling rollback operations based on configured strategy */
    public readonly rollbackService: IRollbackService;

    /** Registry for loading migration scripts of different types (TypeScript, SQL, etc.) */
    private readonly loaderRegistry: ILoaderRegistry;

    /**
     * Transaction manager for database transactions (v0.5.0).
     * Auto-created if handler provides transactionManager or db implements ITransactionalDB.
     */
    private readonly transactionManager?: ITransactionManager;

    /**
     * Creates a new MigrationScriptExecutor instance.
     *
     * Initializes all required services (backup, schema version tracking, console rendering,
     * migration discovery) and displays the application banner.
     *
     * **Configuration Loading (Waterfall):**
     * If no config provided, automatically loads using ConfigLoader.load():
     * 1. Environment variables (MSR_*)
     * 2. Config file (./msr.config.js, ./msr.config.json, or MSR_CONFIG_FILE)
     * 3. Built-in defaults
     *
     * @param handler - Database migration handler implementing database-specific operations
     * @param config - Optional configuration for migrations. If not provided, uses waterfall loading.
     * @param dependencies - Optional service dependencies for dependency injection
     *
     * @example
     * ```typescript
     * // No config - uses waterfall loading (env vars → file → defaults)
     * const executor = new MigrationScriptExecutor(handler);
     *
     * // With explicit config
     * const config = new Config();
     * const executor = new MigrationScriptExecutor(handler, config);
     *
     * // With partial config overrides (merged with waterfall)
     * const executor = new MigrationScriptExecutor(handler, ConfigLoader.load({
     *     dryRun: true
     * }));
     *
     * // With JSON output for CI/CD
     * const executor = new MigrationScriptExecutor(handler, config, {
     *     renderStrategy: new JsonRenderStrategy()
     * });
     *
     * // With silent output for testing
     * const executor = new MigrationScriptExecutor(handler, config, {
     *     renderStrategy: new SilentRenderStrategy(),
     *     logger: new SilentLogger()
     * });
     *
     * // With mock services for testing
     * const executor = new MigrationScriptExecutor(handler, config, {
     *     backupService: mockBackupService,
     *     migrationService: mockMigrationService
     * });
     * ```
     */
    constructor(
        private readonly handler: IDatabaseMigrationHandler,
        config?: Config,
        dependencies?: IMigrationExecutorDependencies
    ) {
        // Use provided config or load using waterfall approach
        this.config = config ?? ConfigLoader.load();
        // Use provided logger or default to ConsoleLogger, wrapped with level awareness
        const baseLogger = dependencies?.logger ?? new ConsoleLogger();
        this.logger = new LevelAwareLogger(baseLogger, this.config.logLevel);

        // Setup hooks with automatic execution summary logging
        const hooks: IMigrationHooks[] = [];
        if (dependencies?.hooks) hooks.push(dependencies.hooks);
        if (this.config.logging.enabled) hooks.push(new ExecutionSummaryHook(this.config, this.logger, handler));
        this.hooks = hooks.length > 0 ? new CompositeHooks(hooks) : undefined;

        // Use provided loader registry or create default (TypeScript + SQL)
        this.loaderRegistry = dependencies?.loaderRegistry ?? LoaderRegistry.createDefault(this.logger);

        // Use provided dependencies or create defaults
        this.backupService = dependencies?.backupService
            ?? new BackupService(handler, this.config, this.logger);

        this.schemaVersionService = dependencies?.schemaVersionService
            ?? new SchemaVersionService(handler.schemaVersion);

        this.migrationRenderer = dependencies?.migrationRenderer
            ?? new MigrationRenderer(handler, this.config, this.logger, dependencies?.renderStrategy);

        this.migrationService = dependencies?.migrationService
            ?? new MigrationService(this.logger);

        this.selector = new MigrationScriptSelector();

        this.migrationScanner = dependencies?.migrationScanner
            ?? new MigrationScanner(
                this.migrationService,
                this.schemaVersionService,
                this.selector,
                this.config
            );

        // Create transaction manager if transactions are enabled (v0.5.0)
        this.transactionManager = this.createTransactionManager(handler);

        // Create MigrationRunner with transaction support (v0.5.0)
        this.runner = new MigrationRunner(
            handler,
            this.schemaVersionService,
            this.config,
            this.logger,
            this.transactionManager,
            this.hooks
        );

        this.validationService = dependencies?.validationService
            ?? new MigrationValidationService(this.logger, this.config.customValidators);

        this.rollbackService = dependencies?.rollbackService
            ?? new RollbackService(handler, this.config, this.backupService, this.logger, this.hooks);

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
    private createTransactionManager(handler: IDatabaseMigrationHandler): ITransactionManager | undefined {
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
            return new DefaultTransactionManager(
                handler.db,
                this.config.transaction,
                this.logger
            );
        }

        // Check for callback transaction support (NoSQL-style)
        if (isCallbackTransactional(handler.db)) {
            this.logger.debug('Auto-creating CallbackTransactionManager (db implements ICallbackTransactionalDB)');
            return new CallbackTransactionManager(
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
     * Check for hybrid SQL + TypeScript migrations and fail if transactions are enabled.
     *
     * When both SQL (.up.sql) and TypeScript (.ts/.js) migrations are present in the
     * pending batch, automatic transaction management cannot be used because:
     * - SQL files may contain their own BEGIN/COMMIT statements
     * - This creates conflicting transaction boundaries
     * - Each migration must manage its own transactions
     *
     * **New in v0.5.0**
     *
     * @param scripts - All migration scripts (pending migrations will be checked)
     * @throws Error if hybrid migrations detected with transaction mode enabled
     * @private
     *
     * @example
     * ```typescript
     * // Pending migrations:
     * // - V001_CreateTable.sql (contains: BEGIN; CREATE TABLE...; COMMIT;)
     * // - V002_InsertData.ts (TypeScript migration)
     *
     * // This method will:
     * // 1. Detect hybrid migrations (both SQL and TS)
     * // 2. Throw error if transaction mode is enabled
     * // → User must set config.transaction.mode = TransactionMode.NONE
     * ```
     */
    private async checkHybridMigrationsAndDisableTransactions(scripts: IScripts): Promise<void> {
        // Only check if we have pending migrations and transaction mode is not NONE
        if (scripts.pending.length === 0 || this.config.transaction.mode === TransactionMode.NONE) {
            return;
        }

        // Detect if pending migrations contain both SQL and TypeScript files
        const hasSqlMigrations = scripts.pending.some(script =>
            script.filepath.endsWith('.up.sql')
        );
        const hasTsMigrations = scripts.pending.some(script =>
            script.filepath.endsWith('.ts') || script.filepath.endsWith('.js')
        );

        // If hybrid migrations detected, fail with error
        if (hasSqlMigrations && hasTsMigrations) {
            const sqlFiles = scripts.pending
                .filter(s => s.filepath.endsWith('.up.sql'))
                .map(s => s.name)
                .join(', ');
            const tsFiles = scripts.pending
                .filter(s => s.filepath.endsWith('.ts') || s.filepath.endsWith('.js'))
                .map(s => s.name)
                .join(', ');

            throw new Error(
                `❌ Hybrid migrations detected: Cannot use automatic transaction management.\n\n` +
                `Pending migrations contain both SQL and TypeScript files:\n` +
                `  SQL files: ${sqlFiles}\n` +
                `  TypeScript/JavaScript files: ${tsFiles}\n\n` +
                `SQL files may contain their own BEGIN/COMMIT statements, which creates\n` +
                `conflicting transaction boundaries with automatic transaction management.\n\n` +
                `To fix this, choose ONE of these options:\n\n` +
                `1. Set transaction mode to NONE (each migration manages its own transactions):\n` +
                `   config.transaction.mode = TransactionMode.NONE;\n\n` +
                `2. Separate SQL and TypeScript migrations into different batches\n\n` +
                `3. Convert all migrations to use the same format (either all SQL or all TS)\n\n` +
                `Current transaction mode: ${this.config.transaction.mode}`
            );
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
     * const executor = new MigrationScriptExecutor(handler, config);
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
    public async up(targetVersion?: number): Promise<IMigrationResult> {
        // Check database connection before proceeding
        await this.checkDatabaseConnection();

        // If targetVersion provided, delegate to migrateTo logic
        if (targetVersion !== undefined) {
            return this.migrateToVersion(targetVersion);
        }

        // Otherwise, run all pending migrations
        return this.migrateAll();
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
    public async migrate(targetVersion?: number): Promise<IMigrationResult> {
        return this.up(targetVersion);
    }

    /**
     * Execute all pending database migrations (internal implementation).
     *
     * @private
     */
    private async migrateAll(): Promise<IMigrationResult> {
        let scripts: IScripts = {
            all: [],
            migrated: [],
            pending: [],
            ignored: [],
            executed: []
        };
        const errors: Error[] = [];
        let backupPath: string | undefined;

        try {
            this.logDryRunMode();
            await this.prepareForMigration();

            scripts = await this.scanAndValidate();
            backupPath = await this.createBackupIfNeeded();

            // Check for hybrid migrations and disable transactions if needed
            await this.checkHybridMigrationsAndDisableTransactions(scripts);

            this.renderMigrationStatus(scripts);
            await this.hooks?.onStart?.(scripts.all.length, scripts.pending.length);

            if (!scripts.pending.length) {
                return await this.handleNoPendingMigrations(scripts);
            }

            await this.executePendingMigrations(scripts);

            const result: IMigrationResult = {
                success: true,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored: scripts.ignored
            };

            await this.hooks?.onComplete?.(result);
            return result;
        } catch (err) {
            return await this.handleMigrationError(err, scripts, errors, backupPath);
        }
    }

    private logDryRunMode(): void {
        if (this.config.dryRun) {
            this.logger.info('🔍 DRY RUN MODE - No changes will be made\n');
        }
    }

    private async prepareForMigration(): Promise<void> {
        if (this.config.beforeMigrateName && !this.config.dryRun) {
            await this.executeBeforeMigrate();
        }
        await this.schemaVersionService.init(this.config.tableName);
    }

    private async scanAndValidate(): Promise<IScripts> {
        const scripts = await this.migrationScanner.scan();
        await Promise.all(scripts.pending.map(s => s.init(this.loaderRegistry)));

        if (this.config.validateBeforeRun && scripts.pending.length > 0) {
            await this.validateMigrations(scripts.pending);
        }

        if (this.config.validateMigratedFiles && scripts.migrated.length > 0) {
            await this.validateMigratedFileIntegrity(scripts.migrated);
        }

        // Validate transaction configuration (v0.5.0)
        if (this.config.transaction.mode !== TransactionMode.NONE && scripts.pending.length > 0) {
            await this.validateTransactionConfiguration(scripts.pending);
        }

        return scripts;
    }

    private async createBackupIfNeeded(): Promise<string | undefined> {
        if (!this.rollbackService.shouldCreateBackup() || this.config.dryRun) {
            return undefined;
        }

        await this.hooks?.onBeforeBackup?.();
        const backupPath = await this.backupService.backup();

        if (backupPath) {
            await this.hooks?.onAfterBackup?.(backupPath);
        }

        return backupPath;
    }

    private renderMigrationStatus(scripts: IScripts): void {
        this.migrationRenderer.drawMigrated(scripts);
        this.migrationRenderer.drawIgnored(scripts.ignored);
    }

    private async handleNoPendingMigrations(scripts: IScripts): Promise<IMigrationResult> {
        this.logNoPendingMigrations(scripts.ignored.length);
        this.backupService.deleteBackup();

        const result: IMigrationResult = {
            success: true,
            executed: [],
            migrated: scripts.migrated,
            ignored: scripts.ignored
        };

        await this.hooks?.onComplete?.(result);
        return result;
    }

    private logNoPendingMigrations(ignoredCount: number): void {
        if (!this.config.dryRun) {
            this.logger.info('Nothing to do');
            return;
        }

        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: 0 migration(s)`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
    }

    private async executePendingMigrations(scripts: IScripts): Promise<void> {
        this.logger.info('Processing...');
        this.migrationRenderer.drawPending(scripts.pending);

        if (!this.config.dryRun) {
            await this.executeWithHooks(scripts.pending, scripts.executed);
            this.migrationRenderer.drawExecuted(scripts.executed);
            this.logger.info('Migration finished successfully!');
            this.backupService.deleteBackup();
        } else {
            await this.executeDryRun(scripts);
        }
    }

    /**
     * Execute migrations in dry run mode with transaction testing.
     *
     * In dry run mode:
     * 1. Execute migrations inside real transactions (if enabled)
     * 2. Always rollback at the end (never commit)
     * 3. Mark all executed scripts with dryRun flag
     * 4. Test transaction logic without making permanent changes
     *
     * This allows testing:
     * - Migration logic works correctly
     * - Migrations work inside transactions
     * - Transaction timeout issues
     * - Potential deadlocks or conflicts
     *
     * **New in v0.5.0**
     *
     * @param scripts - Migration scripts to test
     * @private
     */
    private async executeDryRun(scripts: IScripts): Promise<void> {
        // If transactions are enabled, execute in transaction and rollback
        if (this.transactionManager) {
            this.logger.info(`\n🔍 Testing migrations inside ${this.config.transaction.mode} transaction(s)...\n`);

            try {
                // Execute migrations with transaction wrapping
                // MigrationRunner will automatically rollback instead of commit in dry run mode
                await this.executeWithHooks(scripts.pending, scripts.executed);

                // Mark all as dry run
                scripts.executed.forEach(s => s.dryRun = true);

                this.migrationRenderer.drawExecuted(scripts.executed);
                this.logger.info('\n✓ Dry run completed - all transactions rolled back');
                this.logger.info(`  Tested: ${scripts.executed.length} migration(s) inside transactions`);
                this.logger.info(`  Transaction mode: ${this.config.transaction.mode}`);
                if (this.config.transaction.isolation) {
                    this.logger.info(`  Isolation level: ${this.config.transaction.isolation}`);
                }
            } catch (error) {
                // Migration failed - rollback already happened in MigrationRunner
                this.logger.error('\n✗ Dry run failed - migrations would fail in production');
                this.logger.error(`  Failed at: ${scripts.executed[scripts.executed.length - 1]?.name || 'unknown'}`);
                throw error;
            }
        } else {
            // No transactions - just show what would execute
            this.logDryRunResults(scripts.pending.length, scripts.ignored.length);
        }
    }

    private logDryRunResults(pendingCount: number, ignoredCount: number): void {
        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: ${pendingCount} migration(s)`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
    }

    private async handleMigrationError(
        err: unknown,
        scripts: IScripts,
        errors: Error[],
        backupPath: string | undefined
    ): Promise<IMigrationResult> {
        this.logger.error(err as string);
        errors.push(err as Error);

        await this.rollbackService.rollback(scripts.executed, backupPath);
        await this.hooks?.onError?.(err as Error);

        return {
            success: false,
            executed: scripts.executed,
            migrated: scripts.migrated,
            ignored: scripts.ignored,
            errors
        };
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
    public async validate(): Promise<{pending: IValidationResult[], migrated: IValidationIssue[]}> {
        await this.checkDatabaseConnection();
        this.logger.info('🔍 Starting migration validation...\n');

        await this.schemaVersionService.init(this.config.tableName);
        const scripts = await this.migrationScanner.scan();

        const pendingResults = await this.validatePendingMigrations(scripts);
        const migratedIssues = await this.validateMigratedMigrations(scripts);

        this.logger.info('✅ All migration validation checks passed!\n');

        return {
            pending: pendingResults,
            migrated: migratedIssues
        };
    }

    private async validatePendingMigrations(scripts: IScripts): Promise<IValidationResult[]> {
        if (!this.config.validateBeforeRun) {
            this.logger.info('Skipping pending migration validation (validateBeforeRun is disabled)\n');
            return [];
        }

        if (scripts.pending.length === 0) {
            this.logger.info('No pending migrations to validate\n');
            return [];
        }

        this.logger.info(`Validating ${scripts.pending.length} pending migration(s)...`);
        const pendingResults = await this.validationService.validateAll(scripts.pending, this.config, this.loaderRegistry);

        this.handlePendingValidationResults(pendingResults, scripts.pending.length);

        return pendingResults;
    }

    private handlePendingValidationResults(results: IValidationResult[], totalCount: number): void {
        const resultsWithErrors = results.filter(r => !r.valid);
        const resultsWithWarnings = results.filter(r =>
            r.valid && r.issues.some(i => i.type === ValidationIssueType.WARNING)
        );

        if (resultsWithErrors.length > 0) {
            this.logValidationErrors(resultsWithErrors);
            throw new ValidationError('Pending migration validation failed', resultsWithErrors);
        }

        if (resultsWithWarnings.length > 0) {
            this.logValidationWarnings(resultsWithWarnings);

            if (this.config.strictValidation) {
                this.logger.error('\n❌ Strict validation enabled - warnings treated as errors');
                throw new ValidationError('Strict validation - warnings treated as errors', resultsWithWarnings);
            }
            this.logger.warn('');
        }

        this.logger.info(`✓ Validated ${totalCount} pending migration(s)\n`);
    }

    private logValidationErrors(results: IValidationResult[]): void {
        this.logger.error('❌ Pending migration validation failed:\n');
        for (const result of results) {
            this.logger.error(`  ${result.script.name}:`);
            const errors = result.issues.filter(i => i.type === ValidationIssueType.ERROR);
            for (const issue of errors) {
                this.logger.error(`    ❌ [${issue.code}] ${issue.message}`);
                if (issue.details) {
                    this.logger.error(`       ${issue.details}`);
                }
            }
        }
    }

    private logValidationWarnings(results: IValidationResult[]): void {
        this.logger.warn('⚠️  Pending migration validation warnings:\n');
        for (const result of results) {
            this.logger.warn(`  ${result.script.name}:`);
            const warnings = result.issues.filter(i => i.type === ValidationIssueType.WARNING);
            for (const issue of warnings) {
                this.logger.warn(`    ⚠️  [${issue.code}] ${issue.message}`);
                if (issue.details) {
                    this.logger.warn(`       ${issue.details}`);
                }
            }
        }
    }

    private async validateMigratedMigrations(scripts: IScripts): Promise<IValidationIssue[]> {
        if (!this.config.validateMigratedFiles) {
            this.logger.info('Skipping executed migration validation (validateMigratedFiles is disabled)\n');
            return [];
        }

        if (scripts.migrated.length === 0) {
            this.logger.info('No executed migrations to validate\n');
            return [];
        }

        this.logger.info(`Validating integrity of ${scripts.migrated.length} executed migration(s)...`);
        const migratedIssues = await this.validationService.validateMigratedFileIntegrity(scripts.migrated, this.config);

        if (migratedIssues.length > 0) {
            this.logMigratedFileIssues(migratedIssues);
            const errorResults = migratedIssues.map((issue: IValidationIssue) => ({
                valid: false,
                issues: [issue],
                script: {} as MigrationScript
            }));
            throw new ValidationError('Migration file integrity check failed', errorResults);
        }

        this.logger.info(`✓ All executed migrations verified\n`);
        return migratedIssues;
    }

    private logMigratedFileIssues(issues: IValidationIssue[]): void {
        this.logger.error('❌ Migration file integrity check failed:\n');
        for (const issue of issues) {
            this.logger.error(`  ❌ [${issue.code}] ${issue.message}`);
            if (issue.details) {
                this.logger.error(`     ${issue.details}`);
            }
        }
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
     * Migrate database up to a specific target version (internal implementation).
     *
     * Executes pending migrations up to and including the specified target version.
     * Migrations with timestamps > targetVersion will not be executed.
     *
     * @param targetVersion - The target version timestamp to migrate to
     * @returns Migration result containing executed migrations and overall status
     *
     * @throws {ValidationError} If migration validation fails
     * @throws {Error} If migration execution fails
     *
     * @private
     */
    private async migrateToVersion(targetVersion: number): Promise<IMigrationResult> {
        let scripts: IScripts = {
            all: [],
            migrated: [],
            pending: [],
            ignored: [],
            executed: []
        };
        const errors: Error[] = [];
        let backupPath: string | undefined;

        try {
            this.logDryRunModeForVersion(targetVersion);
            await this.prepareForMigration();

            scripts = await this.migrationScanner.scan();
            const pendingUpToTarget = this.selector.getPendingUpTo(scripts.migrated, scripts.all, targetVersion);

            await this.initAndValidateScripts(pendingUpToTarget, scripts.migrated);
            backupPath = await this.createBackupIfNeeded();

            this.renderMigrationStatus(scripts);
            await this.hooks?.onStart?.(scripts.all.length, pendingUpToTarget.length);

            if (!pendingUpToTarget.length) {
                return await this.handleNoMigrationsToTarget(scripts, targetVersion);
            }

            await this.executeMigrationsToVersion(pendingUpToTarget, scripts, targetVersion);

            const result: IMigrationResult = {
                success: true,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored: scripts.ignored
            };

            await this.hooks?.onComplete?.(result);
            return result;

        } catch (error) {
            errors.push(error as Error);
            this.logger.error(`Migration to version ${targetVersion} failed: ${(error as Error).message}`);
            await this.rollbackService.rollback(scripts.executed, backupPath);
            throw error;
        }
    }

    private logDryRunModeForVersion(targetVersion: number): void {
        if (this.config.dryRun) {
            this.logger.info(`🔍 DRY RUN MODE - No changes will be made (target: ${targetVersion})\n`);
        }
    }

    private async initAndValidateScripts(pending: MigrationScript[], migrated: MigrationScript[]): Promise<void> {
        await Promise.all(pending.map(s => s.init(this.loaderRegistry)));

        if (this.config.validateBeforeRun && pending.length > 0) {
            await this.validateMigrations(pending);
        }

        if (this.config.validateMigratedFiles && migrated.length > 0) {
            await this.validateMigratedFileIntegrity(migrated);
        }
    }

    private async handleNoMigrationsToTarget(scripts: IScripts, targetVersion: number): Promise<IMigrationResult> {
        this.logNoMigrationsToTarget(targetVersion, scripts.ignored.length);
        this.backupService.deleteBackup();

        const result: IMigrationResult = {
            success: true,
            executed: [],
            migrated: scripts.migrated,
            ignored: scripts.ignored
        };

        await this.hooks?.onComplete?.(result);
        return result;
    }

    private logNoMigrationsToTarget(targetVersion: number, ignoredCount: number): void {
        if (!this.config.dryRun) {
            this.logger.info(`Already at target version ${targetVersion} or beyond`);
            return;
        }

        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: 0 migration(s) to version ${targetVersion}`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
    }

    private async executeMigrationsToVersion(
        pending: MigrationScript[],
        scripts: IScripts,
        targetVersion: number
    ): Promise<void> {
        this.logger.info(`Migrating to version ${targetVersion}...`);
        this.migrationRenderer.drawPending(pending);

        if (!this.config.dryRun) {
            await this.executeWithHooks(pending, scripts.executed);
            this.migrationRenderer.drawExecuted(scripts.executed);
            this.logger.info(`Migration to version ${targetVersion} finished successfully!`);
            this.backupService.deleteBackup();
        } else {
            this.logDryRunResultsForVersion(pending.length, scripts.ignored.length, targetVersion);
        }
    }

    private logDryRunResultsForVersion(pendingCount: number, ignoredCount: number, targetVersion: number): void {
        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: ${pendingCount} migration(s) up to version ${targetVersion}`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
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
    public async down(targetVersion: number): Promise<IMigrationResult> {
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
            return await this.handleRollbackError(error);
        }
    }

    private handleNoRollbackNeeded(scripts: IScripts, targetVersion: number): IMigrationResult {
        this.logger.info(`Already at version ${targetVersion} or below - nothing to roll back`);

        return {
            success: true,
            executed: [],
            migrated: scripts.migrated,
            ignored: scripts.ignored
        };
    }

    private async prepareRollbackScripts(toRollback: MigrationScript[]): Promise<void> {
        await Promise.all(toRollback.map(s => s.init(this.loaderRegistry)));

        if (this.config.validateBeforeRun && toRollback.length > 0) {
            await this.validateMigrations(toRollback);
        }

        if (this.config.validateMigratedFiles && toRollback.length > 0) {
            await this.validateMigratedFileIntegrity(toRollback);
        }
    }

    private async executeRollbackScripts(toRollback: MigrationScript[]): Promise<MigrationScript[]> {
        const rolledBack: MigrationScript[] = [];

        for (const script of toRollback) {
            await this.rollbackSingleMigration(script);
            rolledBack.push(script);
        }

        return rolledBack;
    }

    private async rollbackSingleMigration(script: MigrationScript): Promise<void> {
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

    private async completeRollback(
        rolledBack: MigrationScript[],
        scripts: IScripts,
        targetVersion: number
    ): Promise<IMigrationResult> {
        this.logger.info(`Successfully rolled back to version ${targetVersion}!`);

        const result: IMigrationResult = {
            success: true,
            executed: rolledBack,
            migrated: scripts.migrated.filter(m => m.timestamp <= targetVersion),
            ignored: scripts.ignored
        };

        await this.hooks?.onComplete?.(result);
        return result;
    }

    private async handleRollbackError(error: unknown): Promise<never> {
        this.logger.error(`Rollback failed: ${(error as Error).message}`);
        await this.hooks?.onError?.(error as Error);
        throw error;
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
     * export default class BeforeMigrate implements IRunnableScript {
     *   async up(db, info, handler) {
     *     await db.query('DROP SCHEMA public CASCADE');
     *     await db.query('CREATE SCHEMA public');
     *     return 'Database reset complete';
     *   }
     * }
     * ```
     */

    /**
     * Validate migration scripts before execution.
     *
     * Runs built-in and custom validation on all pending migrations.
     * Throws ValidationError if any scripts have errors or warnings (in strict mode).
     *
     * @param scripts - Migration scripts to validate
     * @throws {ValidationError} If validation fails
     * @private
     */
    private async validateMigrations(scripts: MigrationScript[]): Promise<void> {
        this.logger.info(`Validating ${scripts.length} migration script(s)...`);

        const validationResults = await this.validationService.validateAll(scripts, this.config, this.loaderRegistry);

        // Separate results by type
        const resultsWithErrors = validationResults.filter(r => !r.valid);
        const resultsWithWarnings = validationResults.filter(r =>
            r.valid && r.issues.some(i => i.type === ValidationIssueType.WARNING)
        );

        this.handleValidationErrors(resultsWithErrors);
        this.handleValidationWarnings(resultsWithWarnings);

        this.logger.info(`✓ Validated ${scripts.length} migration script(s)`);
    }

    /**
     * Handle validation errors by logging and throwing ValidationError.
     * @private
     */
    private handleValidationErrors(resultsWithErrors: IValidationResult[]): void {
        if (resultsWithErrors.length === 0) {
            return;
        }

        this.logger.error('❌ Migration validation failed:\n');
        for (const result of resultsWithErrors) {
            this.displayValidationErrorsForScript(result);
        }
        throw new ValidationError('Migration validation failed', resultsWithErrors);
    }

    /**
     * Display validation errors for a single script.
     * @private
     */
    private displayValidationErrorsForScript(result: IValidationResult): void {
        this.logger.error(`  ${result.script.name}:`);
        const errors = result.issues.filter(i => i.type === ValidationIssueType.ERROR);
        for (const issue of errors) {
            this.displayValidationIssue(issue, 'error');
        }
    }

    /**
     * Handle validation warnings by logging and optionally throwing in strict mode.
     * @private
     */
    private handleValidationWarnings(resultsWithWarnings: IValidationResult[]): void {
        if (resultsWithWarnings.length === 0) {
            return;
        }

        this.logger.warn('⚠️  Migration validation warnings:\n');
        for (const result of resultsWithWarnings) {
            this.displayValidationWarningsForScript(result);
        }

        this.checkStrictValidationMode(resultsWithWarnings);
        this.logger.warn(''); // Empty line for spacing
    }

    /**
     * Display validation warnings for a single script.
     * @private
     */
    private displayValidationWarningsForScript(result: IValidationResult): void {
        this.logger.warn(`  ${result.script.name}:`);
        const warnings = result.issues.filter(i => i.type === ValidationIssueType.WARNING);
        for (const issue of warnings) {
            this.displayValidationIssue(issue, 'warn');
        }
    }

    /**
     * Display a single validation issue (error or warning).
     * @private
     */
    private displayValidationIssue(issue: IValidationIssue, level: 'error' | 'warn'): void {
        const icon = level === 'error' ? '❌' : '⚠️';
        const logMethod = level === 'error' ? this.logger.error.bind(this.logger) : this.logger.warn.bind(this.logger);

        logMethod(`    ${icon} [${issue.code}] ${issue.message}`);
        if (issue.details) {
            logMethod(`       ${issue.details}`);
        }
    }

    /**
     * Check strict validation mode and throw if warnings should be treated as errors.
     * @private
     */
    private checkStrictValidationMode(resultsWithWarnings: IValidationResult[]): void {
        if (this.config.strictValidation) {
            this.logger.error('\n❌ Strict validation enabled - warnings treated as errors');
            throw new ValidationError('Strict validation enabled - warnings treated as errors', resultsWithWarnings);
        }
    }

    /**
     * Validate integrity of already-executed migration files.
     *
     * Checks if previously-executed migration files still exist and haven't been modified.
     * Throws ValidationError if any integrity issues are found.
     *
     * @param scripts - Already-executed migration scripts
     * @throws {ValidationError} If integrity validation fails
     * @private
     */
    private async validateMigratedFileIntegrity(scripts: MigrationScript[]): Promise<void> {
        const issues = await this.validationService.validateMigratedFileIntegrity(scripts, this.config);

        if (issues.length > 0) {
            this.logger.error('❌ Migration file integrity check failed:\n');

            for (const issue of issues) {
                if (issue.type === ValidationIssueType.ERROR) {
                    this.logger.error(`  ❌ [${issue.code}] ${issue.message}`);
                    if (issue.details) {
                        this.logger.error(`     ${issue.details}`);
                    }
                }
            }

            // Create a validation result for the error
            const errorResults: IValidationResult[] = issues.map((issue: IValidationIssue) => ({
                valid: false,
                issues: [issue],
                script: scripts[0] // Placeholder - not used for integrity errors
            }));

            throw new ValidationError('Migration file integrity check failed', errorResults);
        }
    }

    /**
     * Validate transaction configuration and compatibility.
     *
     * Checks:
     * - Database supports transactions
     * - Isolation level compatibility
     * - Rollback strategy compatibility with transaction mode
     * - Transaction timeout warnings
     *
     * **New in v0.5.0**
     *
     * @param scripts - Pending migration scripts to execute
     * @throws {ValidationError} If transaction configuration is invalid
     */
    private async validateTransactionConfiguration(scripts: MigrationScript[]): Promise<void> {
        const issues = this.validationService.validateTransactionConfiguration(
            this.handler,
            this.config,
            scripts
        );

        if (issues.length === 0) {
            return; // No issues
        }

        // Log all issues (errors and warnings)
        const hasErrors = issues.some((i: IValidationIssue) => i.type === ValidationIssueType.ERROR);
        const hasWarnings = issues.some((i: IValidationIssue) => i.type === ValidationIssueType.WARNING);

        if (hasErrors) {
            this.logger.error('❌ Transaction configuration validation failed:\n');
        } else if (hasWarnings) {
            this.logger.warn('⚠️  Transaction configuration warnings:\n');
        }

        for (const issue of issues) {
            if (issue.type === ValidationIssueType.ERROR) {
                this.logger.error(`  ❌ ${issue.message}`);
                if (issue.details) {
                    this.logger.error(`     ${issue.details}`);
                }
            } else if (issue.type === ValidationIssueType.WARNING) {
                this.logger.warn(`  ⚠️  ${issue.message}`);
                if (issue.details) {
                    this.logger.warn(`     ${issue.details}`);
                }
            }
        }

        this.logger.log(''); // Empty line

        // Throw error only if there are actual errors (not warnings)
        if (hasErrors) {
            const errorResults: IValidationResult[] = issues
                .filter((i: IValidationIssue) => i.type === ValidationIssueType.ERROR)
                .map((issue: IValidationIssue) => ({
                    valid: false,
                    issues: [issue],
                    script: scripts[0] // Placeholder
                }));

            throw new ValidationError('Transaction configuration validation failed', errorResults);
        }
    }

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
        const beforeMigrateScript = new MigrationScript(
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
     * @private
     */
    private async executeWithHooks(scripts: MigrationScript[], executedArray: MigrationScript[]): Promise<void> {
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