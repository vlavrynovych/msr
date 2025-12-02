/**
 * Log level for controlling output verbosity.
 *
 * Levels (in order of priority):
 * - `'error'`: Highest priority - only errors
 * - `'warn'`: Warnings and errors
 * - `'info'`: Normal operation (default)
 * - `'debug'`: Lowest priority - detailed debugging information
 *
 * @example
 * ```typescript
 * // Set log level in config
 * config.logLevel = 'debug';
 *
 * // Create level-aware logger
 * const logger = new LevelAwareLogger(new ConsoleLogger(), 'debug');
 * ```
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Logger interface for abstracting output operations.
 *
 * This interface allows MSR to separate I/O concerns from business logic,
 * making the library more testable and flexible. Users can provide custom
 * implementations to redirect output to files, cloud logging services, or
 * suppress output entirely.
 *
 * @example
 * ```typescript
 * // Using the default console logger
 * const executor = new MigrationScriptExecutor(handler);
 *
 * // Using a silent logger (no output)
 * const executor = new MigrationScriptExecutor(handler, new SilentLogger());
 *
 * // Using a custom logger
 * class MyLogger implements ILogger {
 *   info(message: string, ...args: unknown[]): void {
 *     // Send to your logging service
 *   }
 *   // ... implement other methods
 * }
 * const executor = new MigrationScriptExecutor(handler, new MyLogger());
 * ```
 */
export interface ILogger {
    /**
     * Log an informational message.
     *
     * @param message - The message to log
     * @param args - Additional arguments to include in the log
     */
    info(message: string, ...args: unknown[]): void;

    /**
     * Log a warning message.
     *
     * @param message - The warning message to log
     * @param args - Additional arguments to include in the log
     */
    warn(message: string, ...args: unknown[]): void;

    /**
     * Log an error message.
     *
     * @param message - The error message to log
     * @param args - Additional arguments to include in the log
     */
    error(message: string, ...args: unknown[]): void;

    /**
     * Log a debug message.
     *
     * @param message - The debug message to log
     * @param args - Additional arguments to include in the log
     */
    debug(message: string, ...args: unknown[]): void;

    /**
     * Log a general message (maps to console.log).
     *
     * @param message - The message to log
     * @param args - Additional arguments to include in the log
     */
    log(message: string, ...args: unknown[]): void;
}
