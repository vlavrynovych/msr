import {IValidationResult, IDB} from "../interface";

/**
 * Error thrown when migration validation fails.
 *
 * Contains all validation results that have errors, allowing
 * for detailed error reporting and programmatic handling.
 *
 * @template DB - Database interface type
 */
export class ValidationError<DB extends IDB> extends Error {
    /**
     * Validation results that contain errors.
     */
    public readonly validationResults: IValidationResult<DB>[];

    /**
     * Creates a new ValidationError.
     *
     * @param message - Error message
     * @param validationResults - Validation results with errors
     */
    constructor(message: string, validationResults: IValidationResult<DB>[]) {
        super(message);
        this.name = 'ValidationError';
        this.validationResults = validationResults;

        // Maintains proper stack trace for where error was thrown (V8 only)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ValidationError);
        }
    }

    /**
     * Get total count of validation errors across all results.
     */
    get errorCount(): number {
        return this.validationResults.reduce(
            (count, result) => count + result.issues.filter(i => i.type === 'ERROR').length,
            0
        );
    }

    /**
     * Get total count of validation warnings across all results.
     */
    get warningCount(): number {
        return this.validationResults.reduce(
            (count, result) => count + result.issues.filter(i => i.type === 'WARNING').length,
            0
        );
    }
}
