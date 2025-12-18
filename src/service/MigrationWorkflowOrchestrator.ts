import {IDB} from "../interface/dao";
import {IMigrationWorkflowOrchestrator} from "../interface/service/IMigrationWorkflowOrchestrator";
import {IMigrationResult} from "../interface/IMigrationResult";
import {IScripts} from "../interface/IScripts";
import {MigrationScript} from "../model/MigrationScript";
import {Config, TransactionMode} from "../model";
import {ILogger} from "../interface/ILogger";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {IMigrationScanner} from "../interface/service/IMigrationScanner";
import {IMigrationValidationOrchestrator} from "../interface/service/IMigrationValidationOrchestrator";
import {IMigrationReportingOrchestrator} from "../interface/service/IMigrationReportingOrchestrator";
import {IBackupService} from "../interface/service/IBackupService";
import {IMigrationHookExecutor} from "../interface/service/IMigrationHookExecutor";
import {IMigrationErrorHandler} from "../interface/service/IMigrationErrorHandler";
import {IRollbackService} from "../interface/service/IRollbackService";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {ILoaderRegistry} from "../interface/loader/ILoaderRegistry";
import {MigrationScriptSelector} from "./MigrationScriptSelector";
import {ITransactionManager} from "../interface/service/ITransactionManager";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {IMigrationService} from "../interface/service/IMigrationService";
import {LockingOrchestrator} from "./LockingOrchestrator";
import {randomUUID} from "node:crypto";
import {hostname} from "node:os";

/**
 * Dependencies for MigrationWorkflowOrchestrator.
 *
 * @template DB - Database interface type
 */
export interface MigrationWorkflowOrchestratorDependencies<DB extends IDB> {
    /**
     * Service for scanning and discovering migration scripts.
     */
    migrationScanner: IMigrationScanner<DB>;

    /**
     * Service for orchestrating migration validation.
     */
    validationOrchestrator: IMigrationValidationOrchestrator<DB>;

    /**
     * Service for orchestrating migration reporting and display.
     */
    reportingOrchestrator: IMigrationReportingOrchestrator<DB>;

    /**
     * Service for creating and managing backups.
     */
    backupService: IBackupService;

    /**
     * Service for executing migrations with hooks.
     */
    hookExecutor: IMigrationHookExecutor<DB>;

    /**
     * Service for handling migration errors.
     */
    errorHandler: IMigrationErrorHandler<DB>;

    /**
     * Service for rollback operations.
     */
    rollbackService: IRollbackService<DB>;

    /**
     * Service for tracking executed migrations in database.
     */
    schemaVersionService: ISchemaVersionService<DB>;

    /**
     * Registry for loading migration scripts of different types.
     */
    loaderRegistry: ILoaderRegistry<DB>;

    /**
     * Service for selecting which migrations to execute.
     */
    selector: MigrationScriptSelector<DB>;

    /**
     * Transaction manager for database transactions (optional).
     */
    transactionManager?: ITransactionManager<DB>;

    /**
     * Configuration settings.
     */
    config: Config;

    /**
     * Logger for migration messages.
     */
    logger: ILogger;

    /**
     * Lifecycle hooks for extending migration behavior (optional).
     */
    hooks?: IMigrationHooks<DB>;

    /**
     * Database migration handler for executing scripts.
     */
    handler: IDatabaseMigrationHandler<DB>;

    /**
     * Service for discovering and loading migration script files.
     */
    migrationService: IMigrationService<DB>;
}

/**
 * Orchestrates migration workflow execution.
 *
 * Extracted from MigrationScriptExecutor to separate workflow orchestration concerns.
 * Coordinates all services to execute the complete migration workflow including:
 * - Preparation (schema version table, beforeMigrate script)
 * - Scanning and validation
 * - Backup creation
 * - Migration execution
 * - Dry run mode handling
 * - Error handling and rollback
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const workflowOrchestrator = new MigrationWorkflowOrchestrator({
 *     migrationScanner,
 *     validationOrchestrator,
 *     reportingOrchestrator,
 *     backupService,
 *     hookExecutor,
 *     errorHandler,
 *     rollbackService,
 *     schemaVersionService,
 *     loaderRegistry,
 *     selector,
 *     transactionManager,
 *     config,
 *     logger,
 *     hooks
 * });
 *
 * const result = await workflowOrchestrator.migrateAll();
 * ```
 */
export class MigrationWorkflowOrchestrator<DB extends IDB> implements IMigrationWorkflowOrchestrator<DB> {
    private readonly migrationScanner: IMigrationScanner<DB>;
    private readonly validationOrchestrator: IMigrationValidationOrchestrator<DB>;
    private readonly reportingOrchestrator: IMigrationReportingOrchestrator<DB>;
    private readonly backupService: IBackupService;
    private readonly hookExecutor: IMigrationHookExecutor<DB>;
    private readonly errorHandler: IMigrationErrorHandler<DB>;
    private readonly rollbackService: IRollbackService<DB>;
    private readonly schemaVersionService: ISchemaVersionService<DB>;
    private readonly loaderRegistry: ILoaderRegistry<DB>;
    private readonly selector: MigrationScriptSelector<DB>;
    private readonly transactionManager?: ITransactionManager<DB>;
    private readonly config: Config;
    private readonly logger: ILogger;
    private readonly hooks?: IMigrationHooks<DB>;
    private readonly handler: IDatabaseMigrationHandler<DB>;
    private readonly migrationService: IMigrationService<DB>;
    private readonly lockingOrchestrator?: LockingOrchestrator<DB>;

    constructor(dependencies: MigrationWorkflowOrchestratorDependencies<DB>) {
        this.migrationScanner = dependencies.migrationScanner;
        this.validationOrchestrator = dependencies.validationOrchestrator;
        this.reportingOrchestrator = dependencies.reportingOrchestrator;
        this.backupService = dependencies.backupService;
        this.hookExecutor = dependencies.hookExecutor;
        this.errorHandler = dependencies.errorHandler;
        this.rollbackService = dependencies.rollbackService;
        this.schemaVersionService = dependencies.schemaVersionService;
        this.loaderRegistry = dependencies.loaderRegistry;
        this.selector = dependencies.selector;
        this.transactionManager = dependencies.transactionManager;
        this.config = dependencies.config;
        this.logger = dependencies.logger;
        this.hooks = dependencies.hooks;
        this.handler = dependencies.handler;
        this.migrationService = dependencies.migrationService;

        // Create locking orchestrator if handler provides locking service
        if (dependencies.handler.lockingService) {
            this.lockingOrchestrator = new LockingOrchestrator(
                dependencies.handler.lockingService,
                dependencies.config.locking,
                dependencies.logger
                // TODO: Add ILockingHooks support - currently IMigrationHooks doesn't include locking hooks
            );
        }
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
     * Generate unique executor ID for lock tracking.
     *
     * Format: hostname-pid-uuid
     * Example: macbook-pro-12345-a1b2c3d4-e5f6-7890-abcd-ef1234567890
     *
     * @private
     * @returns Unique executor identifier
     */
    private generateExecutorId(): string {
        return `${hostname()}-${process.pid}-${randomUUID()}`;
    }

    /**
     * Acquire migration lock with retry logic.
     *
     * Delegates to LockingOrchestrator which implements:
     * 1. Clean up expired locks
     * 2. Attempt to acquire lock (with retries if configured)
     * 3. Verify ownership of acquired lock (two-phase locking)
     * 4. Invoke hooks for observability
     *
     * @private
     * @param executorId - Unique identifier for this executor
     * @returns Promise that resolves when lock is acquired and verified
     * @throws Error if lock acquisition fails or ownership verification fails
     */
    private async acquireLockWithRetries(executorId: string): Promise<void> {
        if (!this.lockingOrchestrator) {
            return; // Locking not configured
        }

        if (!this.config.locking.enabled) {
            this.logger.debug('Locking is disabled in configuration, skipping lock acquisition');
            return;
        }

        // Clean up expired locks before attempting acquisition
        await this.lockingOrchestrator.checkAndReleaseExpiredLock();

        // Attempt to acquire lock (orchestrator handles retry logic and hooks)
        const acquired = await this.lockingOrchestrator.acquireLock(executorId);

        if (!acquired) {
            // Get current lock status for error message
            const status = await this.lockingOrchestrator.getLockStatus();
            const lockInfo = status?.isLocked
                ? `currently held by: ${status.lockedBy}${status.expiresAt ? ` (expires: ${status.expiresAt.toISOString()})` : ''}`
                : 'lock status unknown';

            throw new Error(
                `Failed to acquire migration lock after ${this.config.locking.retryAttempts + 1} attempt(s). ` +
                `Another migration is likely running (${lockInfo}). ` +
                `If you believe this is a stale lock, use: msr lock:release --force`
            );
        }
    }

    /**
     * Release migration lock.
     *
     * Delegates to LockingOrchestrator for consistent lock release with hooks.
     * Safe to call even if lock was never acquired.
     * Logs errors but doesn't throw to ensure cleanup can continue.
     *
     * @private
     * @param executorId - Unique identifier for this executor
     */
    private async releaseLock(executorId: string): Promise<void> {
        if (!this.lockingOrchestrator) {
            return; // Locking not configured
        }

        if (!this.config.locking.enabled) {
            return; // Locking disabled
        }

        try {
            await this.lockingOrchestrator.releaseLock(executorId);
        } catch (error) {
            // Log but don't throw - we don't want lock release failure to mask original error
            this.logger.warn(`Failed to release migration lock: ${error}`);
        }
    }

    /**
     * Execute all pending database migrations.
     */
    public async migrateAll(): Promise<IMigrationResult<DB>> {
        // Generate unique executor ID and acquire lock before starting
        const executorId = this.generateExecutorId();
        await this.acquireLockWithRetries(executorId);

        let scripts: IScripts<DB> = {
            all: [],
            migrated: [],
            pending: [],
            ignored: [],
            executed: []
        };
        const errors: Error[] = [];
        let backupPath: string | undefined;

        try {
            this.reportingOrchestrator.logDryRunMode();
            await this.prepareForMigration();

            scripts = await this.scanAndValidate();
            backupPath = await this.createBackupIfNeeded();

            // Check for hybrid migrations and disable transactions if needed
            await this.checkHybridMigrationsAndDisableTransactions(scripts);

            this.reportingOrchestrator.renderMigrationStatus(scripts);
            await this.hooks?.onStart?.(scripts.all.length, scripts.pending.length);

            if (!scripts.pending.length) {
                return await this.handleNoPendingMigrations(scripts);
            }

            await this.executePendingMigrations(scripts);

            const result: IMigrationResult<DB> = {
                success: true,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored: scripts.ignored
            };

            await this.hooks?.onComplete?.(result);
            return result;
        } catch (err) {
            // Handle migration error inline - migrateAll returns failure result instead of throwing
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
        } finally {
            // Always release lock, even on error
            await this.releaseLock(executorId);
        }
    }

    /**
     * Execute migrations up to a specific target version.
     */
    public async migrateToVersion(targetVersion: number): Promise<IMigrationResult<DB>> {
        // Generate unique executor ID and acquire lock before starting
        const executorId = this.generateExecutorId();
        await this.acquireLockWithRetries(executorId);

        let scripts: IScripts<DB> = {
            all: [],
            migrated: [],
            pending: [],
            ignored: [],
            executed: []
        };
        const errors: Error[] = [];
        let backupPath: string | undefined;

        try {
            this.reportingOrchestrator.logDryRunModeForVersion(targetVersion);
            await this.prepareForMigration();

            scripts = await this.migrationScanner.scan();
            const pendingUpToTarget = this.selector.getPendingUpTo(scripts.migrated, scripts.all, targetVersion);

            await this.initAndValidateScripts(pendingUpToTarget, scripts.migrated);
            backupPath = await this.createBackupIfNeeded();

            this.reportingOrchestrator.renderMigrationStatus(scripts);
            await this.hooks?.onStart?.(scripts.all.length, pendingUpToTarget.length);

            if (!pendingUpToTarget.length) {
                return await this.handleNoMigrationsToTarget(scripts, targetVersion);
            }

            await this.executeMigrationsToVersion(pendingUpToTarget, scripts, targetVersion);

            const result: IMigrationResult<DB> = {
                success: true,
                executed: scripts.executed,
                migrated: scripts.migrated,
                ignored: scripts.ignored
            };

            await this.hooks?.onComplete?.(result);
            return result;

        } catch (error) {
            throw await this.errorHandler.handleMigrationError(error, targetVersion, scripts.executed, backupPath, errors);
        } finally {
            // Always release lock, even on error
            await this.releaseLock(executorId);
        }
    }

    /**
     * Prepare for migration execution.
     *
     * - Execute beforeMigrate script if configured
     * - Initialize schema version table
     *
     * @private
     */
    private async prepareForMigration(): Promise<void> {
        if (this.config.beforeMigrateName && !this.config.dryRun) {
            await this.executeBeforeMigrate();
        }
        await this.schemaVersionService.init(this.config.tableName);
    }

    /**
     * Scan for migration scripts and validate them.
     *
     * @private
     * @returns Scanned and validated migration scripts
     */
    private async scanAndValidate(): Promise<IScripts<DB>> {
        const scripts = await this.migrationScanner.scan();
        await Promise.all(scripts.pending.map(s => s.init(this.loaderRegistry)));

        if (this.config.validateBeforeRun && scripts.pending.length > 0) {
            await this.validationOrchestrator.validateMigrations(scripts.pending);
        }

        if (this.config.validateMigratedFiles && scripts.migrated.length > 0) {
            await this.validationOrchestrator.validateMigratedFileIntegrity(scripts.migrated);
        }

        // Validate transaction configuration (v0.5.0)
        if (this.config.transaction.mode !== TransactionMode.NONE && scripts.pending.length > 0) {
            await this.validationOrchestrator.validateTransactionConfiguration(scripts.pending);
        }

        return scripts;
    }

    /**
     * Create backup if needed based on rollback strategy and configuration.
     *
     * @private
     * @returns Backup file path or undefined
     */
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

    /**
     * Handle case when there are no pending migrations to execute.
     *
     * @private
     * @param scripts - Migration scripts
     * @returns Migration result with no executed migrations
     */
    private async handleNoPendingMigrations(scripts: IScripts<DB>): Promise<IMigrationResult<DB>> {
        this.reportingOrchestrator.logNoPendingMigrations(scripts.ignored.length);
        this.backupService.deleteBackup();

        const result: IMigrationResult<DB> = {
            success: true,
            executed: [],
            migrated: scripts.migrated,
            ignored: scripts.ignored
        };

        await this.hooks?.onComplete?.(result);
        return result;
    }

    /**
     * Execute pending migrations (normal or dry run mode).
     *
     * @private
     * @param scripts - Migration scripts to execute
     */
    private async executePendingMigrations(scripts: IScripts<DB>): Promise<void> {
        this.reportingOrchestrator.logProcessingStart();
        this.reportingOrchestrator.renderPendingMigrations(scripts.pending);

        if (!this.config.dryRun) {
            await this.hookExecutor.executeWithHooks(scripts.pending, scripts.executed);
            this.reportingOrchestrator.renderExecutedMigrations(scripts.executed);
            this.reportingOrchestrator.logMigrationSuccess();
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
     * @param scripts - Migration scripts to test
     * @private
     */
    private async executeDryRun(scripts: IScripts<DB>): Promise<void> {
        // If transactions are enabled, execute in transaction and rollback
        if (this.transactionManager) {
            this.reportingOrchestrator.logDryRunTransactionTesting(this.config.transaction.mode);

            try {
                // Execute migrations with transaction wrapping
                // MigrationRunner will automatically rollback instead of commit in dry run mode
                await this.hookExecutor.executeWithHooks(scripts.pending, scripts.executed);

                // Mark all as dry run
                scripts.executed.forEach(s => s.dryRun = true);

                this.reportingOrchestrator.renderExecutedMigrations(scripts.executed);
                this.reportingOrchestrator.logDryRunTransactionComplete(
                    scripts.executed.length,
                    this.config.transaction.mode,
                    this.config.transaction.isolation
                );
            } catch (error) {
                // Migration failed - rollback already happened in MigrationRunner
                this.errorHandler.handleDryRunError(error, scripts.executed);
            }
        } else {
            // No transactions - just show what would execute
            this.reportingOrchestrator.logDryRunResults(scripts.pending.length, scripts.ignored.length);
        }
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
     * @param scripts - All migration scripts (pending migrations will be checked)
     * @throws Error if hybrid migrations detected with transaction mode enabled
     * @private
     */
    private async checkHybridMigrationsAndDisableTransactions(scripts: IScripts<DB>): Promise<void> {
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
     * Initialize and validate scripts for version-specific migration.
     *
     * @private
     * @param pending - Pending migration scripts to initialize and validate
     * @param migrated - Already executed migration scripts
     */
    private async initAndValidateScripts(pending: MigrationScript<DB>[], migrated: MigrationScript<DB>[]): Promise<void> {
        await Promise.all(pending.map(s => s.init(this.loaderRegistry)));

        if (this.config.validateBeforeRun && pending.length > 0) {
            await this.validationOrchestrator.validateMigrations(pending);
        }

        if (this.config.validateMigratedFiles && migrated.length > 0) {
            await this.validationOrchestrator.validateMigratedFileIntegrity(migrated);
        }
    }

    /**
     * Handle case when already at target version or beyond.
     *
     * @private
     * @param scripts - Migration scripts
     * @param targetVersion - Target version
     * @returns Migration result with no executed migrations
     */
    private async handleNoMigrationsToTarget(scripts: IScripts<DB>, targetVersion: number): Promise<IMigrationResult<DB>> {
        this.reportingOrchestrator.logNoMigrationsToTarget(targetVersion, scripts.ignored.length);
        this.backupService.deleteBackup();

        const result: IMigrationResult<DB> = {
            success: true,
            executed: [],
            migrated: scripts.migrated,
            ignored: scripts.ignored
        };

        await this.hooks?.onComplete?.(result);
        return result;
    }

    /**
     * Execute migrations up to target version (normal or dry run mode).
     *
     * @private
     * @param pending - Pending migration scripts to execute
     * @param scripts - All migration scripts
     * @param targetVersion - Target version
     */
    private async executeMigrationsToVersion(
        pending: MigrationScript<DB>[],
        scripts: IScripts<DB>,
        targetVersion: number
    ): Promise<void> {
        this.reportingOrchestrator.logMigrationToVersionStart(targetVersion);
        this.reportingOrchestrator.renderPendingMigrations(pending);

        if (!this.config.dryRun) {
            await this.hookExecutor.executeWithHooks(pending, scripts.executed);
            this.reportingOrchestrator.renderExecutedMigrations(scripts.executed);
            this.reportingOrchestrator.logMigrationSuccessForVersion(targetVersion);
            this.backupService.deleteBackup();
        } else {
            this.reportingOrchestrator.logDryRunResultsForVersion(pending.length, scripts.ignored.length, targetVersion);
        }
    }
}
