/**
 * Standard exit codes for CLI commands.
 *
 * These codes follow common Unix/Linux exit code conventions to indicate
 * different types of failures, allowing scripts and CI/CD systems to react
 * appropriately to different error conditions.
 *
 * @example
 * ```typescript
 * import { EXIT_CODES } from './exitCodes';
 *
 * if (result.success) {
 *   process.exit(EXIT_CODES.SUCCESS);
 * } else {
 *   process.exit(EXIT_CODES.MIGRATION_FAILED);
 * }
 * ```
 */
export const EXIT_CODES = {
    /** Successful execution - no errors */
    SUCCESS: 0,

    /** General/unknown error */
    GENERAL_ERROR: 1,

    /** Migration validation failed */
    VALIDATION_ERROR: 2,

    /** Migration execution failed */
    MIGRATION_FAILED: 3,

    /** Rollback operation failed */
    ROLLBACK_FAILED: 4,

    /** Backup creation failed */
    BACKUP_FAILED: 5,

    /** Restore from backup failed */
    RESTORE_FAILED: 6,

    /** Database connection error */
    DATABASE_CONNECTION_ERROR: 7,
} as const;

/**
 * Type for exit code values.
 */
export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];
