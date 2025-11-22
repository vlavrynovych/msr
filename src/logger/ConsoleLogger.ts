import { ILogger } from "../interface/ILogger";

/**
 * Console logger implementation that outputs to the console.
 *
 * This is the default logger used by MSR. It delegates all logging
 * calls directly to the corresponding console methods.
 *
 * @example
 * ```typescript
 * const logger = new ConsoleLogger();
 * logger.info('Migration started');
 * logger.warn('Migration skipped');
 * logger.error('Migration failed');
 * ```
 */
export class ConsoleLogger implements ILogger {
    /**
     * Log an informational message to console.info.
     */
    info(message: string, ...args: unknown[]): void {
        console.info(message, ...args);
    }

    /**
     * Log a warning message to console.warn.
     */
    warn(message: string, ...args: unknown[]): void {
        console.warn(message, ...args);
    }

    /**
     * Log an error message to console.error.
     */
    error(message: string, ...args: unknown[]): void {
        console.error(message, ...args);
    }

    /**
     * Log a debug message to console.debug.
     */
    debug(message: string, ...args: unknown[]): void {
        console.debug(message, ...args);
    }

    /**
     * Log a general message to console.log.
     */
    log(message: string, ...args: unknown[]): void {
        console.log(message, ...args);
    }
}
