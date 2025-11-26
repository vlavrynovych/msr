/**
 * Standard validation error codes.
 *
 * These codes are used for programmatic error handling and categorization.
 * Each code represents a specific type of validation failure.
 */
export enum ValidationErrorCode {
    /**
     * Migration file could not be found at the specified path.
     */
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',

    /**
     * Migration file could not be imported (syntax error, module not found, etc.).
     */
    IMPORT_FAILED = 'IMPORT_FAILED',

    /**
     * Migration file doesn't export any class with an up() method.
     */
    NO_EXPORT = 'NO_EXPORT',

    /**
     * Migration file exports multiple classes with up() methods.
     * Only one migration class should be exported per file.
     */
    MULTIPLE_EXPORTS = 'MULTIPLE_EXPORTS',

    /**
     * Exported migration class cannot be instantiated (constructor throws).
     */
    NOT_INSTANTIABLE = 'NOT_INSTANTIABLE',

    /**
     * Migration class is missing the required up() method.
     */
    MISSING_UP_METHOD = 'MISSING_UP_METHOD',

    /**
     * The up() method doesn't have the correct signature.
     * Expected: up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string>
     */
    INVALID_UP_SIGNATURE = 'INVALID_UP_SIGNATURE',

    /**
     * The down() method exists but doesn't have the correct signature.
     * Expected: down(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string>
     */
    INVALID_DOWN_SIGNATURE = 'INVALID_DOWN_SIGNATURE',

    /**
     * Migration is missing down() method but DOWN rollback strategy requires it.
     */
    MISSING_DOWN_WITH_DOWN_STRATEGY = 'MISSING_DOWN_WITH_DOWN_STRATEGY',

    /**
     * Custom validation rule failed.
     */
    CUSTOM_VALIDATION_FAILED = 'CUSTOM_VALIDATION_FAILED',

    /**
     * Previously-executed migration file is missing.
     * The file was executed before but can no longer be found.
     */
    MIGRATED_FILE_MISSING = 'MIGRATED_FILE_MISSING',

    /**
     * Checksum of executed migration file has changed.
     * The file has been modified since it was executed.
     */
    MIGRATED_FILE_CHECKSUM_MISMATCH = 'MIGRATED_FILE_CHECKSUM_MISMATCH',
}

/**
 * Standard validation warning codes.
 *
 * Warnings indicate potential issues but don't prevent migration execution
 * (unless strictValidation is enabled).
 */
export enum ValidationWarningCode {
    /**
     * Migration is missing down() method but BOTH rollback strategy recommends it.
     * Backup will be used as fallback if migration fails.
     */
    MISSING_DOWN_WITH_BOTH_STRATEGY = 'MISSING_DOWN_WITH_BOTH_STRATEGY',
}
