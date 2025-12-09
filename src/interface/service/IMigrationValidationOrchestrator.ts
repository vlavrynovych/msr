import {IDB} from "../dao";
import {MigrationScript} from "../../model";
import {IValidationResult, IValidationIssue} from "../validation";

/**
 * Interface for orchestrating migration validation.
 *
 * Responsibilities:
 * - Validating pending migrations with comprehensive logging
 * - Validating executed migrations with file integrity checks
 * - Validating scripts before migration execution
 * - Validating transaction configuration
 * - Enforcing strict validation mode
 * - Displaying validation errors and warnings
 *
 * Extracted from MigrationScriptExecutor for better separation of concerns.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const validationOrchestrator = new MigrationValidationOrchestrator({
 *     validationService,
 *     logger,
 *     config,
 *     loaderRegistry
 * });
 *
 * // CI/CD validation
 * await validationOrchestrator.validate();
 *
 * // Validate before migration execution
 * await validationOrchestrator.validateMigrations(scripts);
 * ```
 */
export interface IMigrationValidationOrchestrator<DB extends IDB> {
    /**
     * Validates all pending and migrated migrations.
     *
     * This is the main entry point for CI/CD validation. It validates both
     * pending and already-executed migrations, displaying comprehensive
     * error and warning messages.
     *
     * @throws {Error} If strict validation mode is enabled and any validation issues are found
     *
     * @example
     * ```typescript
     * // In CI/CD pipeline
     * try {
     *     await validationOrchestrator.validate();
     *     console.log('All migrations valid');
     * } catch (error) {
     *     console.error('Validation failed:', error.message);
     *     process.exit(1);
     * }
     * ```
     */
    validate(): Promise<void>;

    /**
     * Validates pending migration scripts with comprehensive logging.
     *
     * Validates pending scripts and displays detailed error and warning messages.
     * Used during CI/CD validation to check scripts before execution.
     *
     * @param pendingScripts - Array of pending migration scripts to validate
     * @returns Validation results for all pending scripts
     *
     * @example
     * ```typescript
     * const results = await validationOrchestrator.validatePendingMigrations(pendingScripts);
     * console.log(`Found ${results.length} validation results`);
     * ```
     */
    validatePendingMigrations(
        pendingScripts: MigrationScript<DB>[]
    ): Promise<IValidationResult<DB>[]>;

    /**
     * Validates migrated scripts with file integrity checks and logging.
     *
     * Validates already-executed scripts and checks file integrity.
     * Displays detailed error messages for any issues found.
     * Used during CI/CD validation to ensure consistency.
     *
     * @param migratedScripts - Array of migrated scripts to validate
     * @returns Array of validation issues found
     *
     * @example
     * ```typescript
     * const issues = await validationOrchestrator.validateMigratedMigrations(migratedScripts);
     * ```
     */
    validateMigratedMigrations(
        migratedScripts: MigrationScript<DB>[]
    ): Promise<IValidationIssue[]>;

    /**
     * Validates migration scripts before execution.
     *
     * Internal method called during migration flow. Validates scripts
     * and enforces strict mode if enabled.
     *
     * @param scripts - Array of scripts to validate
     * @throws {Error} If validation fails in strict mode
     *
     * @example
     * ```typescript
     * // Called internally during migration execution
     * await validationOrchestrator.validateMigrations(scriptsToExecute);
     * ```
     */
    validateMigrations(scripts: MigrationScript<DB>[]): Promise<void>;

    /**
     * Validates file integrity of migrated scripts.
     *
     * Internal method called during migration flow. Checks if migration files
     * have been modified or deleted after execution.
     *
     * @param migratedScripts - Array of migrated scripts to check
     * @throws {Error} If file integrity issues are found in strict mode
     *
     * @example
     * ```typescript
     * // Called internally during migration execution
     * await validationOrchestrator.validateMigratedFileIntegrity(migratedScripts);
     * ```
     */
    validateMigratedFileIntegrity(
        migratedScripts: MigrationScript<DB>[]
    ): Promise<void>;

    /**
     * Validates transaction configuration for migration scripts.
     *
     * Internal method called during migration flow. Ensures transaction
     * configuration is valid for the scripts being executed.
     *
     * @param scripts - Array of scripts to validate transaction config for
     * @throws {Error} If transaction configuration is invalid
     *
     * @example
     * ```typescript
     * // Called internally during migration execution
     * await validationOrchestrator.validateTransactionConfiguration(scripts);
     * ```
     */
    validateTransactionConfiguration(scripts: MigrationScript<DB>[]): Promise<void>;
}
