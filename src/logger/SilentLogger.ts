import { ILogger } from "../interface/ILogger";

/**
 * Silent logger implementation that suppresses all output.
 *
 * Useful for:
 * - Testing (avoid cluttering test output)
 * - Library usage (when you want to handle logging yourself)
 * - Production (when you don't want any console output)
 *
 * @example
 * ```typescript
 * // Silent logger for tests
 * const logger = new SilentLogger();
 * const executor = new MigrationScriptExecutor<DB>(handler, logger);
 * await executor.migrate(); // No console output
 *
 * // Silent logger for library usage
 * const result = await executor.migrate();
 * if (result.success) {
 *   myOwnLogger.info('Migrations complete');
 * }
 * ```
 */
export class SilentLogger implements ILogger {
    /**
     * No-op info logging.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    info(message: string, ...args: unknown[]): void {
        // Intentionally empty - suppress output
    }

    /**
     * No-op warning logging.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    warn(message: string, ...args: unknown[]): void {
        // Intentionally empty - suppress output
    }

    /**
     * No-op error logging.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    error(message: string, ...args: unknown[]): void {
        // Intentionally empty - suppress output
    }

    /**
     * No-op debug logging.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    debug(message: string, ...args: unknown[]): void {
        // Intentionally empty - suppress output
    }

    /**
     * No-op general logging.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    log(message: string, ...args: unknown[]): void {
        // Intentionally empty - suppress output
    }
}
