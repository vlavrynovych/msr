import {IValidationResult, IValidationIssue} from "../validation";
import {MigrationScript, Config} from "../../model";
import {ILoaderRegistry} from "../loader/ILoaderRegistry";
import {IDatabaseMigrationHandler} from "../IDatabaseMigrationHandler";
import {IDB} from "../dao";

/**
 * Interface for migration validation service.
 *
 * Validates migration scripts before execution to detect issues early.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 */
export interface IMigrationValidationService<DB extends IDB> {
    /**
     * Validate all migration scripts.
     *
     * @param scripts - Migration scripts to validate (typed with generic DB parameter in v0.6.0)
     * @param config - Migration configuration
     * @param loaderRegistry - Loader registry for initializing scripts during validation
     * @returns Array of validation results (typed with generic DB parameter in v0.6.0)
     */
    validateAll(scripts: MigrationScript<DB>[], config: Config, loaderRegistry: ILoaderRegistry<DB>): Promise<IValidationResult<DB>[]>;

    /**
     * Validate a single migration script.
     *
     * @param script - Migration script to validate (typed with generic DB parameter in v0.6.0)
     * @param config - Migration configuration
     * @param loaderRegistry - Loader registry for initializing scripts during validation
     * @returns Validation result (typed with generic DB parameter in v0.6.0)
     */
    validateOne(script: MigrationScript<DB>, config: Config, loaderRegistry: ILoaderRegistry<DB>): Promise<IValidationResult<DB>>;

    /**
     * Validate integrity of already-executed migration files.
     *
     * @param migratedScripts - Already-executed migration scripts (typed with generic DB parameter in v0.6.0)
     * @param config - Migration configuration
     * @returns Array of validation issues found
     */
    validateMigratedFileIntegrity(migratedScripts: MigrationScript<DB>[], config: Config): Promise<IValidationIssue[]>;

    /**
     * Validate transaction configuration and compatibility.
     *
     * **New in v0.5.0**
     *
     * @param handler - Database migration handler (typed with generic DB parameter in v0.6.0)
     * @param config - Migration configuration
     * @param scripts - Migration scripts to execute (typed with generic DB parameter in v0.6.0)
     * @returns Array of validation issues found
     */
    validateTransactionConfiguration(handler: IDatabaseMigrationHandler<DB>, config: Config, scripts: MigrationScript<DB>[]): IValidationIssue[];
}
