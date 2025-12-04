import { ILogger, LogLevel } from '../interface/ILogger';

/**
 * Logger wrapper that filters messages based on configured log level.
 *
 * Implements log level hierarchy:
 * - error (0): Highest priority
 * - warn (1)
 * - info (2): Default
 * - debug (3): Lowest priority
 *
 * Each level includes all higher priority levels.
 * For example, 'warn' will show both warnings and errors.
 *
 * @example
 * ```typescript
 * // Wrap existing logger with level filtering
 * const consoleLogger = new ConsoleLogger();
 * const logger = new LevelAwareLogger(consoleLogger, 'debug');
 *
 * // All log methods available
 * logger.debug('This will be shown');
 * logger.info('This will be shown');
 * logger.warn('This will be shown');
 * logger.error('This will be shown');
 * ```
 *
 * @example
 * ```typescript
 * // With 'error' level, only errors are shown
 * const logger = new LevelAwareLogger(new ConsoleLogger(), 'error');
 *
 * logger.debug('This will be filtered');
 * logger.info('This will be filtered');
 * logger.warn('This will be filtered');
 * logger.error('This will be shown');
 * ```
 */
export class LevelAwareLogger implements ILogger {
    private readonly levels = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    };

    private readonly currentLevel: number;

    /**
     * Creates a new level-aware logger.
     *
     * @param logger - Underlying logger implementation to wrap
     * @param logLevel - Minimum log level to display (default: 'info')
     *
     * @example
     * ```typescript
     * const logger = new LevelAwareLogger(
     *   new ConsoleLogger(),
     *   'debug'
     * );
     * ```
     */
    constructor(
        private readonly logger: ILogger,
        logLevel: LogLevel = 'info'
    ) {
        this.currentLevel = this.levels[logLevel];
    }

    /**
     * Log an informational message.
     * Only displayed if log level is 'info' or 'debug'.
     *
     * @param message - The message to log
     * @param args - Additional arguments to include in the log
     */
    info(message: string, ...args: unknown[]): void {
        if (this.currentLevel >= this.levels.info) {
            this.logger.info(message, ...args);
        }
    }

    /**
     * Log a warning message.
     * Only displayed if log level is 'warn', 'info', or 'debug'.
     *
     * @param message - The warning message to log
     * @param args - Additional arguments to include in the log
     */
    warn(message: string, ...args: unknown[]): void {
        if (this.currentLevel >= this.levels.warn) {
            this.logger.warn(message, ...args);
        }
    }

    /**
     * Log an error message.
     * Always displayed regardless of log level.
     *
     * @param message - The error message to log
     * @param args - Additional arguments to include in the log
     */
    error(message: string, ...args: unknown[]): void {
        if (this.currentLevel >= this.levels.error) {
            this.logger.error(message, ...args);
        }
    }

    /**
     * Log a debug message.
     * Only displayed if log level is 'debug'.
     *
     * @param message - The debug message to log
     * @param args - Additional arguments to include in the log
     */
    debug(message: string, ...args: unknown[]): void {
        if (this.currentLevel >= this.levels.debug) {
            this.logger.debug(message, ...args);
        }
    }

    /**
     * Log a general message (maps to console.log).
     * Always displayed regardless of log level.
     *
     * @param message - The message to log
     * @param args - Additional arguments to include in the log
     */
    log(message: string, ...args: unknown[]): void {
        // log() always outputs (not filtered by level)
        this.logger.log(message, ...args);
    }
}
