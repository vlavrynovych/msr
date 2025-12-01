/**
 * Environment variables for logging configuration.
 *
 * Control file-based logging of migration operations, useful for
 * audit trails and troubleshooting.
 *
 * @example
 * ```typescript
 * // Enable file logging
 * process.env[LoggingEnvVars.MSR_LOGGING_ENABLED] = 'true';
 * process.env[LoggingEnvVars.MSR_LOGGING_PATH] = './logs';
 *
 * // Or use JSON format
 * process.env[LoggingEnvVars.MSR_LOGGING] = JSON.stringify({
 *   enabled: true,
 *   path: './logs',
 *   maxFiles: 30
 * });
 * ```
 */
export enum LoggingEnvVars {
    /**
     * Complete logging configuration as JSON (alternative to dot-notation).
     */
    MSR_LOGGING = 'MSR_LOGGING',

    /**
     * Enable file logging.
     * @default false
     */
    MSR_LOGGING_ENABLED = 'MSR_LOGGING_ENABLED',

    /**
     * Directory for log files.
     * @default './migrations-logs'
     */
    MSR_LOGGING_PATH = 'MSR_LOGGING_PATH',

    /**
     * Maximum number of log files to retain.
     * @default 10
     */
    MSR_LOGGING_MAX_FILES = 'MSR_LOGGING_MAX_FILES',

    /**
     * Moment.js format for log timestamps.
     * @default 'YYYY-MM-DD'
     */
    MSR_LOGGING_TIMESTAMP_FORMAT = 'MSR_LOGGING_TIMESTAMP_FORMAT',

    /**
     * Log successful migrations (in addition to failures).
     * @default false
     */
    MSR_LOGGING_LOG_SUCCESSFUL = 'MSR_LOGGING_LOG_SUCCESSFUL',
}
