/**
 * Policy for handling missing down() methods during validation.
 *
 * Controls whether missing down() methods are treated as errors, warnings, or ignored.
 * This policy works in conjunction with the rollback strategy.
 */
export enum DownMethodPolicy {
    /**
     * Automatically determine based on rollback strategy (recommended).
     *
     * - DOWN strategy: Error if missing
     * - BOTH strategy: Warning if missing
     * - BACKUP/NONE strategy: Silent (no validation)
     */
    AUTO = 'AUTO',

    /**
     * Require down() method - validation error if missing.
     *
     * Use this when you want all migrations to be reversible via down() methods.
     */
    REQUIRED = 'REQUIRED',

    /**
     * Recommend down() method - validation warning if missing.
     *
     * Use this to encourage but not enforce down() methods.
     */
    RECOMMENDED = 'RECOMMENDED',

    /**
     * down() method is optional - no validation if missing.
     *
     * Use this when you rely on backup/restore for rollback.
     */
    OPTIONAL = 'OPTIONAL',
}
