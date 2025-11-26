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
import {MigrationScriptSelector} from "./MigrationScriptSelector";
import {MigrationRunner} from "./MigrationRunner";
import {MigrationScanner} from "./MigrationScanner";
import {IMigrationScanner} from "../interface/service/IMigrationScanner";
import {Config, RollbackStrategy, ValidationIssueType} from "../model";
import {MigrationValidationService} from "./MigrationValidationService";
import {IMigrationValidationService, IValidationResult, IValidationIssue} from "../interface";
import {ValidationError} from "../error/ValidationError";

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
 * const handler = new MyDatabaseHandler();
 * const executor = new MigrationScriptExecutor(handler, config);
 *
 * // Run all pending migrations
 * await executor.migrate();
 *
 * // Or list all migrations
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
    private readonly runner: MigrationRunner;

    /** Service for validating migration scripts before execution */
    public readonly validationService: IMigrationValidationService;

    /**
     * Creates a new MigrationScriptExecutor instance.
     *
     * Initializes all required services (backup, schema version tracking, console rendering,
     * migration discovery) and displays the application banner.
     *
     * @param handler - Database migration handler implementing database-specific operations
     * @param config - Configuration for migrations (folder, pattern, table name, backup settings)
     * @param dependencies - Optional service dependencies for dependency injection
     *
     * @example
     * ```typescript
     * // Basic usage
     * const config = new Config();
     * const executor = new MigrationScriptExecutor(handler, config);
     *
     * // With JSON output for CI/CD
     * const executor = new MigrationScriptExecutor(handler, config, {
     *     renderStrategy: new JsonRenderStrategy()
     * });
     *
     * // With silent output for testing
     * const executor = new MigrationScriptExecutor(handler, config, {
     *     renderStrategy: new SilentRenderStrategy()
     * });
     *
     * // With custom logger
     * const executor = new MigrationScriptExecutor(handler, config, {
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
        private handler: IDatabaseMigrationHandler,
        config: Config,
        dependencies?: IMigrationExecutorDependencies
    ) {
        this.config = config;
        // Use provided logger or default to ConsoleLogger
        this.logger = dependencies?.logger ?? new ConsoleLogger();

        // Use provided hooks if available
        this.hooks = dependencies?.hooks;

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

        this.runner = new MigrationRunner(handler, this.schemaVersionService, this.config, this.logger);

        this.validationService = dependencies?.validationService
            ?? new MigrationValidationService(this.logger, this.config.customValidators);

        this.migrationRenderer.drawFiglet();
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
            pending: [],
            ignored: [],
            executed: []
        };
        const errors: Error[] = [];
        let backupPath: string | undefined;

        try {
            // Execute beforeMigrate script if it exists - BEFORE scanning migrations
            // This allows beforeMigrate to erase/reset the database (e.g., load prod snapshot)
            // Note: beforeMigrate runs BEFORE init() to allow complete database reset
            if (this.config.beforeMigrateName) {
                await this.executeBeforeMigrate();
            }

            // Scan migrations BEFORE any database operations
            scripts = await this.migrationScanner.scan();

            // Initialize migration scripts (load and parse)
            await Promise.all(scripts.pending.map(s => s.init()));

            // Validate pending migration scripts BEFORE database init and backup
            // This provides fast failure if scripts have issues
            if (this.config.validateBeforeRun && scripts.pending.length > 0) {
                await this.validateMigrations(scripts.pending);
            }

            // Validate integrity of already-executed migrations
            // Check if migrated files still exist and haven't been modified
            if (this.config.validateMigratedFiles && scripts.migrated.length > 0) {
                await this.validateMigratedFileIntegrity(scripts.migrated);
            }

            // Now that validation passed, initialize database and create backup
            await this.schemaVersionService.init(this.config.tableName);

            // Conditionally create backup based on rollback strategy
            if (this.shouldCreateBackup()) {
                // Hook: Before backup
                await this.hooks?.onBeforeBackup?.();

                // Create backup
                backupPath = await this.backupService.backup();

                // Hook: After backup
                if (backupPath) {
                    await this.hooks?.onAfterBackup?.(backupPath);
                }
            }

            // Display migration status
            this.migrationRenderer.drawMigrated(scripts);
            this.migrationRenderer.drawIgnored(scripts.ignored);

            // Hook: Start (after we know what will be executed)
            await this.hooks?.onStart?.(scripts.all.length, scripts.pending.length);

            if (!scripts.pending.length) {
                this.logger.info('Nothing to do');
                this.backupService.deleteBackup();

                const result: IMigrationResult = {
                    success: true,
                    executed: [],
                    migrated: scripts.migrated,
                    ignored: scripts.ignored
                };

                // Hook: Complete
                await this.hooks?.onComplete?.(result);

                return result;
            }

            this.logger.info('Processing...');
            this.migrationRenderer.drawPending(scripts.pending);

            // Execute migrations with hooks
            // Note: executeWithHooks modifies scripts.executed directly for rollback tracking
            await this.executeWithHooks(scripts.pending, scripts.executed);

            this.migrationRenderer.drawExecuted(scripts.executed);
            this.logger.info('Migration finished successfully!');
            this.backupService.deleteBackup();

            const result: IMigrationResult = {
                success: true,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored: scripts.ignored
            };

            // Hook: Complete
            await this.hooks?.onComplete?.(result);

            return result;
        } catch (err) {
            this.logger.error(err as string);
            errors.push(err as Error);

            // Handle rollback based on configured strategy
            // scripts.executed contains ALL attempted migrations (including the failed one)
            await this.handleRollback(scripts.executed, backupPath);

            // Hook: Error
            await this.hooks?.onError?.(err as Error);

            return {
                success: false,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored: scripts.ignored,
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
        // Temporarily override displayLimit if number is specified
        const originalLimit = this.config.displayLimit;
        if (number > 0) {
            this.config.displayLimit = number;
        }

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
        this.logger.info('🔍 Starting migration validation...\n');

        // Scan for all migrations (pending and executed)
        const scripts = await this.migrationScanner.scan();

        // Note: Do NOT call init() here - let validation service handle it
        // This allows validation to catch and properly categorize init errors

        // Validate pending migrations
        let pendingResults: IValidationResult[] = [];
        if (scripts.pending.length > 0 && this.config.validateBeforeRun) {
            this.logger.info(`Validating ${scripts.pending.length} pending migration(s)...`);
            pendingResults = await this.validationService.validateAll(scripts.pending, this.config);

            // Display validation results
            const resultsWithErrors = pendingResults.filter(r => !r.valid);
            const resultsWithWarnings = pendingResults.filter(r =>
                r.valid && r.issues.some(i => i.type === ValidationIssueType.WARNING)
            );

            if (resultsWithErrors.length > 0) {
                this.logger.error('❌ Pending migration validation failed:\n');
                for (const result of resultsWithErrors) {
                    this.logger.error(`  ${result.script.name}:`);
                    const errors = result.issues.filter(i => i.type === ValidationIssueType.ERROR);
                    for (const issue of errors) {
                        this.logger.error(`    ❌ [${issue.code}] ${issue.message}`);
                        if (issue.details) {
                            this.logger.error(`       ${issue.details}`);
                        }
                    }
                }
                throw new ValidationError('Pending migration validation failed', resultsWithErrors);
            }

            if (resultsWithWarnings.length > 0) {
                this.logger.warn('⚠️  Pending migration validation warnings:\n');
                for (const result of resultsWithWarnings) {
                    this.logger.warn(`  ${result.script.name}:`);
                    const warnings = result.issues.filter(i => i.type === ValidationIssueType.WARNING);
                    for (const issue of warnings) {
                        this.logger.warn(`    ⚠️  [${issue.code}] ${issue.message}`);
                        if (issue.details) {
                            this.logger.warn(`       ${issue.details}`);
                        }
                    }
                }

                if (this.config.strictValidation) {
                    this.logger.error('\n❌ Strict validation enabled - warnings treated as errors');
                    throw new ValidationError('Strict validation - warnings treated as errors', resultsWithWarnings);
                }
                this.logger.warn('');
            }

            this.logger.info(`✓ Validated ${scripts.pending.length} pending migration(s)\n`);
        } else if (scripts.pending.length === 0) {
            this.logger.info('No pending migrations to validate\n');
        } else {
            this.logger.info('Skipping pending migration validation (validateBeforeRun is disabled)\n');
        }

        // Validate integrity of executed migrations
        let migratedIssues: IValidationIssue[] = [];
        if (scripts.migrated.length > 0 && this.config.validateMigratedFiles) {
            this.logger.info(`Validating integrity of ${scripts.migrated.length} executed migration(s)...`);
            migratedIssues = await this.validationService.validateMigratedFileIntegrity(scripts.migrated, this.config);

            if (migratedIssues.length > 0) {
                this.logger.error('❌ Migration file integrity check failed:\n');
                for (const issue of migratedIssues) {
                    this.logger.error(`  ❌ [${issue.code}] ${issue.message}`);
                    if (issue.details) {
                        this.logger.error(`     ${issue.details}`);
                    }
                }

                const errorResults = migratedIssues.map((issue: IValidationIssue) => ({
                    valid: false,
                    issues: [issue],
                    script: {} as MigrationScript
                }));
                throw new ValidationError('Migration file integrity check failed', errorResults);
            }

            this.logger.info(`✓ All executed migrations verified\n`);
        } else if (scripts.migrated.length === 0) {
            this.logger.info('No executed migrations to validate\n');
        } else {
            this.logger.info('Skipping executed migration validation (validateMigratedFiles is disabled)\n');
        }

        this.logger.info('✅ All migration validation checks passed!\n');

        return {
            pending: pendingResults,
            migrated: migratedIssues
        };
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
     * Determine if backup should be created based on rollback strategy and handler configuration.
     *
     * @returns true if backup should be created, false otherwise
     * @private
     */
    private shouldCreateBackup(): boolean {
        const strategy = this.config.rollbackStrategy;
        const hasBackup = !!this.handler.backup;

        // Need backup interface for BACKUP or BOTH strategies
        return hasBackup && (strategy === RollbackStrategy.BACKUP || strategy === RollbackStrategy.BOTH);
    }

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

        const validationResults = await this.validationService.validateAll(scripts, this.config);

        // Separate results by type
        const resultsWithErrors = validationResults.filter(r => !r.valid);
        const resultsWithWarnings = validationResults.filter(r =>
            r.valid && r.issues.some(i => i.type === ValidationIssueType.WARNING)
        );

        // Display validation errors
        if (resultsWithErrors.length > 0) {
            this.logger.error('❌ Migration validation failed:\n');
            for (const result of resultsWithErrors) {
                this.logger.error(`  ${result.script.name}:`);
                const errors = result.issues.filter(i => i.type === ValidationIssueType.ERROR);
                for (const issue of errors) {
                    this.logger.error(`    ❌ [${issue.code}] ${issue.message}`);
                    if (issue.details) {
                        this.logger.error(`       ${issue.details}`);
                    }
                }
            }
            throw new ValidationError('Migration validation failed', resultsWithErrors);
        }

        // Display validation warnings
        if (resultsWithWarnings.length > 0) {
            this.logger.warn('⚠️  Migration validation warnings:\n');
            for (const result of resultsWithWarnings) {
                this.logger.warn(`  ${result.script.name}:`);
                const warnings = result.issues.filter(i => i.type === ValidationIssueType.WARNING);
                for (const issue of warnings) {
                    this.logger.warn(`    ⚠️  [${issue.code}] ${issue.message}`);
                    if (issue.details) {
                        this.logger.warn(`       ${issue.details}`);
                    }
                }
            }

            // In strict mode, treat warnings as errors
            if (this.config.strictValidation) {
                this.logger.error('\n❌ Strict validation enabled - warnings treated as errors');
                throw new ValidationError('Strict validation enabled - warnings treated as errors', resultsWithWarnings);
            }

            this.logger.warn(''); // Empty line for spacing
        }

        this.logger.info(`✓ Validated ${scripts.length} migration script(s)`);
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
     * Handle rollback after migration failure based on configured strategy.
     *
     * @param executedScripts - Scripts that were attempted (including the failed one)
     * @param backupPath - Path to backup file (if created)
     * @private
     */
    private async handleRollback(executedScripts: MigrationScript[], backupPath: string | undefined): Promise<void> {
        const strategy = this.config.rollbackStrategy;

        switch (strategy) {
            case RollbackStrategy.BACKUP:
                await this.rollbackWithBackup(backupPath);
                break;

            case RollbackStrategy.DOWN:
                await this.rollbackWithDown(executedScripts);
                break;

            case RollbackStrategy.BOTH:
                await this.rollbackWithBoth(executedScripts, backupPath);
                break;

            case RollbackStrategy.NONE:
                this.logger.warn('⚠️  No rollback configured - database may be in inconsistent state');
                break;
        }
    }

    /**
     * Rollback using backup/restore strategy.
     *
     * @param backupPath - Path to backup file
     * @private
     */
    private async rollbackWithBackup(backupPath: string | undefined): Promise<void> {
        if (!backupPath) {
            this.logger.warn('No backup available for restore');
            return;
        }

        // Hook: Before restore
        if (this.hooks && this.hooks.onBeforeRestore) {
            await this.hooks.onBeforeRestore();
        }

        this.logger.info('Restoring from backup...');
        await this.backupService.restore();

        // Hook: After restore
        if (this.hooks && this.hooks.onAfterRestore) {
            await this.hooks.onAfterRestore();
        }

        this.backupService.deleteBackup();
        this.logger.info('✓ Database restored from backup');
    }

    /**
     * Rollback using down() methods strategy.
     *
     * Calls down() on all attempted migrations in reverse order.
     * This includes the failed migration (last in array) to clean up partial changes.
     *
     * @param attemptedScripts - All scripts that were attempted (including the failed one)
     * @private
     */
    private async rollbackWithDown(attemptedScripts: MigrationScript[]): Promise<void> {
        if (attemptedScripts.length === 0) {
            this.logger.info('No migrations to rollback');
            return;
        }

        this.logger.info(`Rolling back ${attemptedScripts.length} migration(s) using down() methods...`);

        // Roll back all attempted migrations in reverse order
        // The failed migration is last in the array, so it will be rolled back first
        for (const script of attemptedScripts.reverse()) {
            if (script.script.down) {
                this.logger.info(`Rolling back: ${script.name}`);
                await script.script.down(this.handler.db, script, this.handler);
            } else {
                this.logger.warn(`⚠️  No down() method for ${script.name} - skipping rollback`);
            }
        }

        this.logger.info('✓ Rollback completed using down() methods');
    }

    /**
     * Rollback using both strategies (down first, backup as fallback).
     *
     * @param attemptedScripts - All scripts that were attempted (including the failed one)
     * @param backupPath - Path to backup file
     * @private
     */
    private async rollbackWithBoth(attemptedScripts: MigrationScript[], backupPath: string | undefined): Promise<void> {
        try {
            // Try down() methods first (includes failed migration cleanup)
            await this.rollbackWithDown(attemptedScripts);
        } catch (downError) {
            this.logger.error(`down() rollback failed: ${downError}`);
            this.logger.info('Falling back to backup restore...');

            // Fallback to backup if down() fails
            await this.rollbackWithBackup(backupPath);
        }
    }

    private async executeBeforeMigrate(): Promise<void> {
        this.logger.info('Checking for beforeMigrate setup script...');

        const beforeMigratePath = await this.migrationService.getBeforeMigrateScript(this.config);
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
        await beforeMigrateScript.init();
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