import {
    IValidationResult,
    IValidationIssue,
    IMigrationValidator,
    IMigrationValidationService
} from "../interface";
import {
    Config,
    MigrationScript,
    ValidationErrorCode,
    ValidationWarningCode,
    ValidationIssueType,
    DownMethodPolicy,
    RollbackStrategy
} from "../model";
import {ILogger} from "../interface/ILogger";
import {ConsoleLogger} from "../logger";
import fs from "fs";
import {ChecksumService} from "./ChecksumService";
import {ILoaderRegistry} from "../interface/loader/ILoaderRegistry";

/**
 * Service for validating migration scripts before execution.
 *
 * Performs built-in validation (structure, interface) and custom validation
 * (via IMigrationValidator implementations). Validation runs before database
 * initialization and backup creation for fast failure.
 *
 * @example
 * ```typescript
 * const validator = new MigrationValidationService(logger);
 * const results = await validator.validateAll(scripts, config);
 *
 * // Check for errors
 * const hasErrors = results.some(r => !r.valid);
 * if (hasErrors) {
 *   console.error('Validation failed!');
 * }
 * ```
 */
export class MigrationValidationService implements IMigrationValidationService {
    /**
     * Creates a new MigrationValidationService.
     *
     * @param logger - Logger instance for output
     * @param customValidators - Optional custom validators to run after built-in validation
     */
    constructor(
        private logger: ILogger = new ConsoleLogger(),
        private customValidators?: IMigrationValidator[]
    ) {}

    /**
     * Validate all migration scripts.
     *
     * Runs built-in validation on each script, then custom validators if provided.
     * Returns results for all scripts regardless of individual failures.
     *
     * @param scripts - Migration scripts to validate
     * @param config - Migration configuration
     * @param loaderRegistry - Loader registry for initializing scripts during validation
     * @returns Array of validation results (one per script)
     *
     * @example
     * ```typescript
     * const results = await validator.validateAll(pendingScripts, config, loaderRegistry);
     *
     * // Separate errors and warnings
     * const errors = results.filter(r => !r.valid);
     * const warnings = results.filter(r =>
     *   r.valid && r.issues.some(i => i.type === ValidationIssueType.WARNING)
     * );
     * ```
     */
    async validateAll(scripts: MigrationScript[], config: Config, loaderRegistry: ILoaderRegistry): Promise<IValidationResult[]> {
        const results: IValidationResult[] = [];

        for (const script of scripts) {
            const result = await this.validateOne(script, config, loaderRegistry);
            results.push(result);
        }

        return results;
    }

    /**
     * Validate a single migration script.
     *
     * Performs validation in this order:
     * 1. Built-in structural validation (exports, instantiation, methods)
     * 2. Built-in interface validation (method signatures)
     * 3. down() method validation (based on policy)
     * 4. Custom validators (if provided)
     *
     * @param script - Migration script to validate
     * @param config - Migration configuration
     * @param loaderRegistry - Loader registry for initializing scripts during validation
     * @returns Validation result with any issues found
     */
    async validateOne(script: MigrationScript, config: Config, loaderRegistry: ILoaderRegistry): Promise<IValidationResult> {
        const issues: IValidationIssue[] = [];

        // Built-in validation
        await this.validateStructure(script, loaderRegistry, issues);
        await this.validateInterface(script, issues);
        await this.validateDownMethod(script, config, issues);

        // Custom validation (only if built-in passed)
        const hasErrors = issues.some(i => i.type === ValidationIssueType.ERROR);
        if (!hasErrors && this.customValidators && this.customValidators.length > 0) {
            for (const validator of this.customValidators) {
                try {
                    const customResult = await validator.validate(script, config);
                    issues.push(...customResult.issues);
                } catch (error) {
                    issues.push({
                        type: ValidationIssueType.ERROR,
                        code: ValidationErrorCode.CUSTOM_VALIDATION_FAILED,
                        message: `Custom validator threw error: ${(error as Error).message}`,
                        details: (error as Error).stack
                    });
                }
            }
        }

        // Determine if valid (no errors)
        const valid = !issues.some(i => i.type === ValidationIssueType.ERROR);

        return {
            valid,
            issues,
            script
        };
    }

    /**
     * Validate migration script structure.
     *
     * Checks:
     * - File exists at the specified path
     * - Script can be loaded (init() succeeds)
     * - Script is instantiable
     * - Script exports exactly one migration class
     *
     * @param script - Migration script to validate
     * @param loaderRegistry - Loader registry for initializing scripts
     * @param issues - Array to collect validation issues
     */
    private async validateStructure(script: MigrationScript, loaderRegistry: ILoaderRegistry, issues: IValidationIssue[]): Promise<void> {
        // Check if file exists
        if (!fs.existsSync(script.filepath)) {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: ValidationErrorCode.FILE_NOT_FOUND,
                message: 'Migration script file not found',
                details: script.filepath
            });
            return; // Can't continue validation if file doesn't exist
        }

        try {
            // Try to initialize the script (loads and instantiates)
            await script.init(loaderRegistry);
        } catch (error) {
            const errorMessage = (error as Error).message;

            // Categorize the error
            if (errorMessage.includes('no executable content found')) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: ValidationErrorCode.NO_EXPORT,
                    message: 'Migration script does not export a class with an up() method',
                    details: script.filepath
                });
            } else if (errorMessage.includes('multiple executable instances were found')) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: ValidationErrorCode.MULTIPLE_EXPORTS,
                    message: 'Migration script exports multiple classes with up() methods',
                    details: 'Only one migration class should be exported per file'
                });
            } else if (errorMessage.includes('Cannot parse migration script')) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: ValidationErrorCode.IMPORT_FAILED,
                    message: 'Failed to import migration script',
                    details: errorMessage
                });
            } else {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: ValidationErrorCode.NOT_INSTANTIABLE,
                    message: 'Migration script class cannot be instantiated',
                    details: errorMessage
                });
            }
        }
    }

    /**
     * Validate migration script interface (method signatures).
     *
     * Checks:
     * - up() method exists
     * - up() is a function
     * - up() returns a Promise (is async)
     * - down() method signature (if present)
     *
     * @param script - Migration script to validate
     * @param issues - Array to collect validation issues
     */
    private async validateInterface(script: MigrationScript, issues: IValidationIssue[]): Promise<void> {
        // If structure validation failed, script.script won't be available
        if (!script.script) {
            return;
        }

        // Check up() method
        if (!script.script.up) {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: ValidationErrorCode.MISSING_UP_METHOD,
                message: 'Migration script is missing required up() method',
                details: script.name
            });
            return;
        }

        if (typeof script.script.up !== 'function') {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: ValidationErrorCode.INVALID_UP_SIGNATURE,
                message: 'up() must be a function',
                details: `Found type: ${typeof script.script.up}`
            });
            return;
        }

        // Check if up() is async (returns Promise)
        // We can't perfectly validate the signature without executing, but we can check some basics
        const upFunction = script.script.up;
        const isAsync = upFunction.constructor.name === 'AsyncFunction';

        if (!isAsync) {
            // This is a warning rather than error because the function might return a Promise manually
            issues.push({
                type: ValidationIssueType.WARNING,
                code: 'UP_NOT_ASYNC_FUNCTION',
                message: 'up() method is not declared as async',
                details: 'Ensure up() returns Promise<string>. Declare with async keyword or return new Promise(...)'
            });
        }

        // Check down() method if present
        if (script.script.down) {
            if (typeof script.script.down !== 'function') {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: ValidationErrorCode.INVALID_DOWN_SIGNATURE,
                    message: 'down() must be a function',
                    details: `Found type: ${typeof script.script.down}`
                });
            }

            const downFunction = script.script.down;
            const isDownAsync = downFunction.constructor.name === 'AsyncFunction';

            if (!isDownAsync) {
                issues.push({
                    type: ValidationIssueType.WARNING,
                    code: 'DOWN_NOT_ASYNC_FUNCTION',
                    message: 'down() method is not declared as async',
                    details: 'Ensure down() returns Promise<string>. Declare with async keyword or return new Promise(...)'
                });
            }
        }
    }

    /**
     * Validate down() method based on configuration policy.
     *
     * Checks whether down() method is required, recommended, or optional
     * based on downMethodPolicy and rollbackStrategy.
     *
     * @param script - Migration script to validate
     * @param config - Migration configuration
     * @param issues - Array to collect validation issues
     */
    private async validateDownMethod(
        script: MigrationScript,
        config: Config,
        issues: IValidationIssue[]
    ): Promise<void> {
        // If structure validation failed, script.script won't be available
        if (!script.script) {
            return;
        }

        const hasDown = script.script.down && typeof script.script.down === 'function';

        // Determine policy
        let policy = config.downMethodPolicy;

        if (policy === DownMethodPolicy.AUTO) {
            // Auto-detect based on rollback strategy
            switch (config.rollbackStrategy) {
                case RollbackStrategy.DOWN:
                    policy = DownMethodPolicy.REQUIRED;
                    break;
                case RollbackStrategy.BOTH:
                    policy = DownMethodPolicy.RECOMMENDED;
                    break;
                case RollbackStrategy.BACKUP:
                case RollbackStrategy.NONE:
                default:
                    policy = DownMethodPolicy.OPTIONAL;
                    break;
            }
        }

        // Apply policy
        if (!hasDown) {
            switch (policy) {
                case DownMethodPolicy.REQUIRED:
                    issues.push({
                        type: ValidationIssueType.ERROR,
                        code: ValidationErrorCode.MISSING_DOWN_WITH_DOWN_STRATEGY,
                        message: 'Migration is missing required down() method',
                        details: `Rollback strategy is ${config.rollbackStrategy} which requires down() methods for rollback`
                    });
                    break;

                case DownMethodPolicy.RECOMMENDED:
                    issues.push({
                        type: ValidationIssueType.WARNING,
                        code: ValidationWarningCode.MISSING_DOWN_WITH_BOTH_STRATEGY,
                        message: 'Migration is missing recommended down() method',
                        details: 'Add a down() method to enable fast rollback. Backup will be used as fallback.'
                    });
                    break;

                case DownMethodPolicy.OPTIONAL:
                    // No validation needed
                    break;
            }
        }
    }

    /**
     * Validate integrity of already-executed migration files.
     *
     * Checks:
     * - File existence (if validateMigratedFilesLocation is true)
     * - File checksum matches stored checksum (if file exists and has stored checksum)
     *
     * @param migratedScripts - Already-executed migration scripts
     * @param config - Migration configuration
     * @returns Array of validation issues found
     *
     * @example
     * ```typescript
     * const issues = await validator.validateMigratedFileIntegrity(migratedScripts, config);
     * if (issues.length > 0) {
     *   console.error('Migration integrity check failed!');
     * }
     * ```
     */
    public async validateMigratedFileIntegrity(
        migratedScripts: MigrationScript[],
        config: Config
    ): Promise<IValidationIssue[]> {
        const issues: IValidationIssue[] = [];

        if (!config.validateMigratedFiles) {
            return issues; // Feature disabled
        }

        this.logger.info(`Validating integrity of ${migratedScripts.length} executed migration(s)...`);

        for (const script of migratedScripts) {
            // Check if file exists
            const fileExists = fs.existsSync(script.filepath);

            if (!fileExists) {
                if (config.validateMigratedFilesLocation) {
                    // Strict mode: missing file is an error
                    issues.push({
                        type: ValidationIssueType.ERROR,
                        code: ValidationErrorCode.MIGRATED_FILE_MISSING,
                        message: `Previously-executed migration file is missing: ${script.name}`,
                        details: `Expected at: ${script.filepath}`
                    });
                } else {
                    // Lenient mode: missing file is just a warning
                    this.logger.warn(`⚠️  Migration file missing (allowed): ${script.name}`);
                }
                continue; // Can't check checksum if file doesn't exist
            }

            // Check checksum if stored
            if (script.checksum) {
                try {
                    const currentChecksum = ChecksumService.calculateChecksum(
                        script.filepath,
                        config.checksumAlgorithm
                    );

                    if (currentChecksum !== script.checksum) {
                        issues.push({
                            type: ValidationIssueType.ERROR,
                            code: ValidationErrorCode.MIGRATED_FILE_CHECKSUM_MISMATCH,
                            message: `Migration file has been modified after execution: ${script.name}`,
                            details: `Expected checksum: ${script.checksum}, Current: ${currentChecksum}`
                        });
                    }
                } catch (error) {
                    issues.push({
                        type: ValidationIssueType.ERROR,
                        code: ValidationErrorCode.IMPORT_FAILED,
                        message: `Failed to read migration file for checksum validation: ${script.name}`,
                        details: (error as Error).message
                    });
                }
            }
        }

        if (issues.length === 0) {
            this.logger.info(`✓ All executed migrations verified`);
        }

        return issues;
    }
}
