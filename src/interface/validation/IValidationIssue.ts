import {ValidationIssueType} from "../../model/ValidationIssueType";

/**
 * A validation issue found in a migration script.
 *
 * Can be either an error (blocking) or warning (non-blocking).
 * Errors prevent migration execution, warnings are logged but allow execution
 * (unless strictValidation mode is enabled).
 */
export interface IValidationIssue {
    /**
     * Type of validation issue (ERROR or WARNING).
     *
     * - ERROR: Blocks migration execution
     * - WARNING: Doesn't block execution (unless strictValidation enabled)
     */
    type: ValidationIssueType;

    /**
     * Issue code for programmatic handling.
     *
     * @example 'MISSING_UP_METHOD', 'INVALID_UP_SIGNATURE', 'MISSING_DOWN_METHOD'
     */
    code: string;

    /**
     * Human-readable message describing the issue.
     *
     * @example 'Migration script must export a class with an up() method'
     */
    message: string;

    /**
     * Optional additional context, details, or suggestion.
     *
     * For errors, this might contain expected vs actual values.
     * For warnings, this might contain a suggestion for fixing.
     *
     * @example 'Expected: up(db, info, handler), Found: up(db)'
     * @example 'Add a down() method to enable rollback without backup'
     */
    details?: string;
}
