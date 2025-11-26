/**
 * Type of validation issue.
 */
export enum ValidationIssueType {
    /**
     * Error - blocks migration execution.
     */
    ERROR = 'ERROR',

    /**
     * Warning - doesn't block execution unless strictValidation is enabled.
     */
    WARNING = 'WARNING',
}
