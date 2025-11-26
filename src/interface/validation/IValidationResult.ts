import {IValidationIssue} from "./IValidationIssue";
import {MigrationScript} from "../../model";

/**
 * Result of validating a single migration script.
 *
 * Contains validation status, any issues found, and reference to the validated script.
 */
export interface IValidationResult {
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
     * The migration script that was validated.
     */
    script: MigrationScript;
}
