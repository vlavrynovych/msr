import { ILogger } from "../interface/ILogger";

/**
 * Logger that forwards log messages to multiple logger implementations.
 *
 * CompositeLogger allows you to log to multiple destinations simultaneously
 * (e.g., console + file, console + cloud service, etc.). All registered loggers
 * receive every log message at their respective log levels.
 *
 * @example
 * ```typescript
 * // Log to both console and file
 * const logger = new CompositeLogger([
 *     new ConsoleLogger(),
 *     new FileLogger('/var/log/migrations.log')
 * ]);
 *
 * const executor = new MigrationScriptExecutor<DB>(handler, { logger });
 * ```
 *
 * @example
 * ```typescript
 * // Log to console, file, and cloud service
 * const logger = new CompositeLogger([
 *     new ConsoleLogger(),
 *     new FileLogger('/var/log/migrations.log'),
 *     new CloudWatchLogger()
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Add loggers dynamically
 * const logger = new CompositeLogger();
 * logger.addLogger(new ConsoleLogger());
 * logger.addLogger(new FileLogger('/tmp/migrations.log'));
 * ```
 */
export class CompositeLogger implements ILogger {

    /**
     * Array of logger instances that will receive log messages.
     */
    private readonly loggers: ILogger[];

    /**
     * Creates a new CompositeLogger instance.
     *
     * @param loggers - Optional array of logger instances to forward messages to.
     *                  Loggers can also be added later via addLogger().
     *
     * @example
     * ```typescript
     * // Create with loggers
     * const logger = new CompositeLogger([
     *     new ConsoleLogger(),
     *     new FileLogger('app.log')
     * ]);
     * ```
     *
     * @example
     * ```typescript
     * // Create empty, add loggers later
     * const logger = new CompositeLogger();
     * logger.addLogger(new ConsoleLogger());
     * ```
     */
    constructor(loggers: ILogger[] = []) {
        this.loggers = [...loggers];
    }

    /**
     * Add a logger to the composite.
     *
     * The logger will start receiving all subsequent log messages at all levels.
     *
     * @param logger - Logger instance to add
     *
     * @example
     * ```typescript
     * const composite = new CompositeLogger([new ConsoleLogger()]);
     * composite.addLogger(new FileLogger('migrations.log'));
     * // Now logs to both console and file
     * ```
     */
    public addLogger(logger: ILogger): void {
        this.loggers.push(logger);
    }

    /**
     * Remove a logger from the composite.
     *
     * The logger will stop receiving log messages. Useful for dynamically
     * enabling/disabling specific log destinations.
     *
     * @param logger - Logger instance to remove
     * @returns true if logger was found and removed, false otherwise
     *
     * @example
     * ```typescript
     * const fileLogger = new FileLogger('temp.log');
     * const composite = new CompositeLogger([
     *     new ConsoleLogger(),
     *     fileLogger
     * ]);
     *
     * // Later, stop file logging
     * composite.removeLogger(fileLogger);
     * ```
     */
    public removeLogger(logger: ILogger): boolean {
        const index = this.loggers.indexOf(logger);
        if (index !== -1) {
            this.loggers.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get all registered loggers.
     *
     * Returns a copy of the loggers array to prevent external modification.
     *
     * @returns Array of registered logger instances
     *
     * @example
     * ```typescript
     * const composite = new CompositeLogger([
     *     new ConsoleLogger(),
     *     new FileLogger('app.log')
     * ]);
     *
     * console.log(`Logging to ${composite.getLoggers().length} destinations`);
     * // Output: Logging to 2 destinations
     * ```
     */
    public getLoggers(): ILogger[] {
        return [...this.loggers];
    }

    /**
     * Log an informational message to all registered loggers.
     *
     * @param message - The message to log
     * @param args - Additional arguments to include in the log
     */
    public info(message: string, ...args: unknown[]): void {
        this.loggers.forEach(logger => logger.info(message, ...args));
    }

    /**
     * Log a warning message to all registered loggers.
     *
     * @param message - The warning message to log
     * @param args - Additional arguments to include in the log
     */
    public warn(message: string, ...args: unknown[]): void {
        this.loggers.forEach(logger => logger.warn(message, ...args));
    }

    /**
     * Log an error message to all registered loggers.
     *
     * @param message - The error message to log
     * @param args - Additional arguments to include in the log
     */
    public error(message: string, ...args: unknown[]): void {
        this.loggers.forEach(logger => logger.error(message, ...args));
    }

    /**
     * Log a debug message to all registered loggers.
     *
     * @param message - The debug message to log
     * @param args - Additional arguments to include in the log
     */
    public debug(message: string, ...args: unknown[]): void {
        this.loggers.forEach(logger => logger.debug(message, ...args));
    }

    /**
     * Log a general message to all registered loggers.
     *
     * @param message - The message to log
     * @param args - Additional arguments to include in the log
     */
    public log(message: string, ...args: unknown[]): void {
        this.loggers.forEach(logger => logger.log(message, ...args));
    }
}
