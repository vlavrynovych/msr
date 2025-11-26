import {IValidationResult, IValidationIssue} from "../validation";
import {MigrationScript, Config} from "../../model";

/**
 * Interface for migration validation service.
 *
 * Validates migration scripts before execution to detect issues early.
 */
export interface IMigrationValidationService {
    /**
     * Validate all migration scripts.
     *
     * @param scripts - Migration scripts to validate
     * @param config - Migration configuration
     * @returns Array of validation results
     */
    validateAll(scripts: MigrationScript[], config: Config): Promise<IValidationResult[]>;

    /**
     * Validate a single migration script.
     *
     * @param script - Migration script to validate
     * @param config - Migration configuration
     * @returns Validation result
     */
    validateOne(script: MigrationScript, config: Config): Promise<IValidationResult>;

    /**
     * Validate integrity of already-executed migration files.
     *
     * @param migratedScripts - Already-executed migration scripts
     * @param config - Migration configuration
     * @returns Array of validation issues found
     */
    validateMigratedFileIntegrity(migratedScripts: MigrationScript[], config: Config): Promise<IValidationIssue[]>;
}
