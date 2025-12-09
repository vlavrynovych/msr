import {IDB, IValidationIssue, IValidationResult} from "../interface";
import {IMigrationValidationOrchestrator} from "../interface/service/IMigrationValidationOrchestrator";
import {IMigrationValidationService} from "../interface/service/IMigrationValidationService";
import {ILogger} from "../interface/ILogger";
import {Config, ValidationIssueType} from "../model";
import {ILoaderRegistry} from "../interface/loader/ILoaderRegistry";
import {MigrationScript} from "../model";
import {ValidationError} from "../error/ValidationError";
import {IMigrationScanner} from "../interface/service/IMigrationScanner";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";

/**
 * Dependencies for MigrationValidationOrchestrator.
 *
 * @template DB - Database interface type
 */
export interface MigrationValidationOrchestratorDependencies<DB extends IDB> {
    /**
     * Validation service for performing script validation.
     */
    validationService: IMigrationValidationService<DB>;

    /**
     * Logger for validation messages.
     */
    logger: ILogger;

    /**
     * Configuration settings.
     */
    config: Config;

    /**
     * Loader registry for file type handling.
     */
    loaderRegistry: ILoaderRegistry<DB>;

    /**
     * Migration scanner for discovering migration files.
     */
    migrationScanner: IMigrationScanner<DB>;

    /**
     * Schema version service for database initialization.
     */
    schemaVersionService: ISchemaVersionService<DB>;

    /**
     * Database migration handler.
     */
    handler: IDatabaseMigrationHandler<DB>;
}

/**
 * Orchestrates migration validation.
 *
 * Extracted from MigrationScriptExecutor to separate validation concerns.
 * Handles validation of pending and executed migrations with comprehensive
 * error and warning logging.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const validationOrchestrator = new MigrationValidationOrchestrator({
 *     validationService,
 *     logger,
 *     config,
 *     loaderRegistry,
 *     migrationScanner,
 *     schemaVersionService,
 *     handler
 * });
 *
 * // CI/CD validation
 * await validationOrchestrator.validate();
 * ```
 */
export class MigrationValidationOrchestrator<DB extends IDB> implements IMigrationValidationOrchestrator<DB> {
    private readonly validationService: IMigrationValidationService<DB>;
    private readonly logger: ILogger;
    private readonly config: Config;
    private readonly loaderRegistry: ILoaderRegistry<DB>;
    private readonly migrationScanner: IMigrationScanner<DB>;
    private readonly schemaVersionService: ISchemaVersionService<DB>;
    private readonly handler: IDatabaseMigrationHandler<DB>;

    constructor(dependencies: MigrationValidationOrchestratorDependencies<DB>) {
        this.validationService = dependencies.validationService;
        this.logger = dependencies.logger;
        this.config = dependencies.config;
        this.loaderRegistry = dependencies.loaderRegistry;
        this.migrationScanner = dependencies.migrationScanner;
        this.schemaVersionService = dependencies.schemaVersionService;
        this.handler = dependencies.handler;
    }

    /**
     * Validates all pending and migrated migrations.
     *
     * This is the main entry point for CI/CD validation. It validates both
     * pending and already-executed migrations, displaying comprehensive
     * error and warning messages.
     *
     * @throws {Error} If strict validation mode is enabled and any validation issues are found
     */
    public async validate(): Promise<void> {
        await this.checkDatabaseConnection();
        this.logger.info('🔍 Starting migration validation...\n');

        await this.schemaVersionService.init(this.config.tableName);
        const scripts = await this.migrationScanner.scan();

        await this.validatePendingMigrations(scripts.pending);
        await this.validateMigratedMigrations(scripts.migrated);

        this.logger.info('✅ All migration validation checks passed!\n');
    }

    /**
     * Validates pending migration scripts with comprehensive logging.
     *
     * Validates pending scripts and displays detailed error and warning messages.
     * Used during CI/CD validation to check scripts before execution.
     *
     * @param pendingScripts - Array of pending migration scripts to validate
     * @returns Validation results for all pending scripts
     */
    public async validatePendingMigrations(
        pendingScripts: MigrationScript<DB>[]
    ): Promise<IValidationResult<DB>[]> {
        if (!this.config.validateBeforeRun) {
            this.logger.info('Skipping pending migration validation (validateBeforeRun is disabled)\n');
            return [];
        }

        if (pendingScripts.length === 0) {
            this.logger.info('No pending migrations to validate\n');
            return [];
        }

        this.logger.info(`Validating ${pendingScripts.length} pending migration(s)...`);
        const pendingResults = await this.validationService.validateAll(pendingScripts, this.config, this.loaderRegistry);

        this.handlePendingValidationResults(pendingResults, pendingScripts.length);

        return pendingResults;
    }

    /**
     * Validates migrated scripts with file integrity checks and logging.
     *
     * Validates already-executed scripts and checks file integrity.
     * Displays detailed error messages for any issues found.
     * Used during CI/CD validation to ensure consistency.
     *
     * @param migratedScripts - Array of migrated scripts to validate
     */
    public async validateMigratedMigrations(
        migratedScripts: MigrationScript<DB>[]
    ): Promise<IValidationIssue[]> {
        if (!this.config.validateMigratedFiles) {
            this.logger.info('Skipping executed migration validation (validateMigratedFiles is disabled)\n');
            return [];
        }

        if (migratedScripts.length === 0) {
            this.logger.info('No executed migrations to validate\n');
            return [];
        }

        this.logger.info(`Validating integrity of ${migratedScripts.length} executed migration(s)...`);
        const migratedIssues = await this.validationService.validateMigratedFileIntegrity(migratedScripts, this.config);

        if (migratedIssues.length > 0) {
            this.logMigratedFileIssues(migratedIssues);
            const errorResults = migratedIssues.map((issue: IValidationIssue) => ({
                valid: false,
                issues: [issue],
                script: {} as MigrationScript<DB>
            }));
            throw new ValidationError('Migration file integrity check failed', errorResults);
        }

        this.logger.info(`✓ All executed migrations verified\n`);
        return migratedIssues;
    }

    /**
     * Validates migration scripts before execution.
     *
     * Internal method called during migration flow. Validates scripts
     * and enforces strict mode if enabled.
     *
     * @param scripts - Array of scripts to validate
     * @throws {ValidationError} If validation fails in strict mode
     */
    public async validateMigrations(scripts: MigrationScript<DB>[]): Promise<void> {
        this.logger.info(`Validating ${scripts.length} migration script(s)...`);

        const validationResults = await this.validationService.validateAll(scripts, this.config, this.loaderRegistry);

        // Separate results by type
        const resultsWithErrors = validationResults.filter(r => !r.valid);
        const resultsWithWarnings = validationResults.filter(r =>
            r.valid && r.issues.some((i: IValidationIssue) => i.type === ValidationIssueType.WARNING)
        );

        this.handleValidationErrors(resultsWithErrors);
        this.handleValidationWarnings(resultsWithWarnings);

        this.logger.info(`✓ Validated ${scripts.length} migration script(s)`);
    }

    /**
     * Validates file integrity of migrated scripts.
     *
     * Internal method called during migration flow. Checks if migration files
     * have been modified or deleted after execution.
     *
     * @param migratedScripts - Array of migrated scripts to check
     * @throws {ValidationError} If file integrity issues are found in strict mode
     */
    public async validateMigratedFileIntegrity(
        migratedScripts: MigrationScript<DB>[]
    ): Promise<void> {
        const issues = await this.validationService.validateMigratedFileIntegrity(migratedScripts, this.config);

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
            const errorResults: IValidationResult<DB>[] = issues.map((issue: IValidationIssue) => ({
                valid: false,
                issues: [issue],
                script: migratedScripts[0] // Placeholder - not used for integrity errors
            }));

            throw new ValidationError('Migration file integrity check failed', errorResults);
        }
    }

    /**
     * Validates transaction configuration for migration scripts.
     *
     * Internal method called during migration flow. Ensures transaction
     * configuration is valid for the scripts being executed.
     *
     * @param scripts - Array of scripts to validate transaction config for
     * @throws {ValidationError} If transaction configuration is invalid
     */
    public async validateTransactionConfiguration(scripts: MigrationScript<DB>[]): Promise<void> {
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
            const errorResults: IValidationResult<DB>[] = issues
                .filter((i: IValidationIssue) => i.type === ValidationIssueType.ERROR)
                .map((issue: IValidationIssue) => ({
                    valid: false,
                    issues: [issue],
                    script: scripts[0] // Placeholder
                }));

            throw new ValidationError('Transaction configuration validation failed', errorResults);
        }
    }

    /**
     * Check database connection before validation.
     * @private
     */
    private async checkDatabaseConnection(): Promise<void> {
        const isConnected = await this.handler.db.checkConnection();
        if (!isConnected) {
            throw new Error('Database connection check failed');
        }
    }

    /**
     * Handle pending validation results by checking for errors and warnings.
     * @private
     */
    private handlePendingValidationResults(results: IValidationResult<DB>[], totalCount: number): void {
        const resultsWithErrors = results.filter(r => !r.valid);
        const resultsWithWarnings = results.filter(r =>
            r.valid && r.issues.some((i: IValidationIssue) => i.type === ValidationIssueType.WARNING)
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

    /**
     * Log validation errors for pending migrations.
     * @private
     */
    private logValidationErrors(results: IValidationResult<DB>[]): void {
        this.logger.error('❌ Pending migration validation failed:\n');
        for (const result of results) {
            this.logger.error(`  ${result.script.name}:`);
            const errors = result.issues.filter((i: IValidationIssue) => i.type === ValidationIssueType.ERROR);
            for (const issue of errors) {
                this.logger.error(`    ❌ [${issue.code}] ${issue.message}`);
                if (issue.details) {
                    this.logger.error(`       ${issue.details}`);
                }
            }
        }
    }

    /**
     * Log validation warnings for pending migrations.
     * @private
     */
    private logValidationWarnings(results: IValidationResult<DB>[]): void {
        this.logger.warn('⚠️  Pending migration validation warnings:\n');
        for (const result of results) {
            this.logger.warn(`  ${result.script.name}:`);
            const warnings = result.issues.filter((i: IValidationIssue) => i.type === ValidationIssueType.WARNING);
            for (const issue of warnings) {
                this.logger.warn(`    ⚠️  [${issue.code}] ${issue.message}`);
                if (issue.details) {
                    this.logger.warn(`       ${issue.details}`);
                }
            }
        }
    }

    /**
     * Log migrated file integrity issues.
     * @private
     */
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
     * Handle validation errors by logging and throwing ValidationError.
     * @private
     */
    private handleValidationErrors(resultsWithErrors: IValidationResult<DB>[]): void {
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
    private displayValidationErrorsForScript(result: IValidationResult<DB>): void {
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
    private handleValidationWarnings(resultsWithWarnings: IValidationResult<DB>[]): void {
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
    private displayValidationWarningsForScript(result: IValidationResult<DB>): void {
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
    private checkStrictValidationMode(resultsWithWarnings: IValidationResult<DB>[]): void {
        if (this.config.strictValidation) {
            this.logger.error('\n❌ Strict validation enabled - warnings treated as errors');
            throw new ValidationError('Strict validation enabled - warnings treated as errors', resultsWithWarnings);
        }
    }
}
