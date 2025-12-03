import {IValidationIssue} from "./IValidationIssue";
import {MigrationScript} from "../../model";
import {IDB} from "../dao";

/**
 * Result of validating a single migration script.
 *
 * Contains validation status, any issues found, and reference to the validated script.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 */
export interface IValidationResult<DB extends IDB> {
    /**
     * Whether validation passed (no errors).
     *
     * - `true`: Script is valid and can be executed
     * - `false`: Script has errors and cannot be executed
     *
     * Note: Warnings don't affect validity unless strictValidation is enabled.
     */
    valid: boolean;

    /**
     * All validation issues found (errors and warnings).
     *
     * Check the `type` property on each issue to distinguish between errors and warnings:
     * - Errors (type: ERROR) prevent migration execution
     * - Warnings (type: WARNING) don't prevent execution unless strictValidation is enabled
     */
    issues: IValidationIssue[];

    /**
     * The migration script that was validated (typed with generic DB parameter in v0.6.0).
     */
    script: MigrationScript<DB>;
}
