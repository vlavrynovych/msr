/**
 * MSR Environment Variables - Organized by Category
 *
 * Environment variables are split into logical groups for better organization:
 * - **CoreEnvVars**: Basic configuration (folder, table name, dry run)
 * - **ValidationEnvVars**: Validation settings
 * - **LoggingEnvVars**: File logging configuration
 * - **BackupEnvVars**: Backup and restore settings
 * - **TransactionEnvVars**: Transaction management (v0.5.0+)
 *
 * For backward compatibility, all env vars are also available through the
 * unified `EnvironmentVariables` type.
 *
 * @example
 * ```typescript
 * // Use specific enum
 * import { CoreEnvVars } from './env';
 * process.env[CoreEnvVars.MSR_FOLDER] = './migrations';
 *
 * // Or use the unified ENV constant
 * import { ENV } from './env';
 * process.env[ENV.MSR_FOLDER] = './migrations';
 * ```
 */

export * from './CoreEnvVars';
export * from './ValidationEnvVars';
export * from './LoggingEnvVars';
export * from './BackupEnvVars';
export * from './TransactionEnvVars';

import { CoreEnvVars } from './CoreEnvVars';
import { ValidationEnvVars } from './ValidationEnvVars';
import { LoggingEnvVars } from './LoggingEnvVars';
import { BackupEnvVars } from './BackupEnvVars';
import { TransactionEnvVars } from './TransactionEnvVars';

/**
 * Unified type combining all MSR environment variable enums.
 *
 * Provides type-safe access to all env vars from different categories.
 *
 * @example
 * ```typescript
 * import { EnvironmentVariables } from './model/env';
 *
 * // Type-safe env var access
 * const folder: EnvironmentVariables = 'MSR_FOLDER';
 * ```
 */
export type EnvironmentVariables =
    | CoreEnvVars
    | ValidationEnvVars
    | LoggingEnvVars
    | BackupEnvVars
    | TransactionEnvVars;

/**
 * Namespace containing all environment variable values for convenient access.
 *
 * Provides a single object with all env var names, maintaining the original
 * API while benefiting from the logical grouping.
 *
 * @example
 * ```typescript
 * import { ENV } from './model/env';
 *
 * const folder = process.env[ENV.MSR_FOLDER];
 * const logging = process.env[ENV.MSR_LOGGING_ENABLED];
 * ```
 */
export const ENV = {
    // Core configuration
    ...CoreEnvVars,
    // Validation settings
    ...ValidationEnvVars,
    // Logging configuration
    ...LoggingEnvVars,
    // Backup configuration
    ...BackupEnvVars,
    // Transaction configuration
    ...TransactionEnvVars,
} as const;
