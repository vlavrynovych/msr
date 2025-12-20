import {Config} from '../../model/Config';
import {ConsoleLogger} from '../../logger/ConsoleLogger';
import {FileLogger} from '../../logger/FileLogger';
import {SilentLogger} from '../../logger/SilentLogger';
import {ILogger} from '../../interface/ILogger';

/**
 * Common CLI flags that map to Config properties.
 *
 * Supports both standard MSR flags and custom adapter-specific flags
 * via index signature.
 */
export interface CLIFlags {
    configFile?: string;
    folder?: string;
    tableName?: string;
    displayLimit?: number;
    dryRun?: boolean;
    noLock?: boolean;
    logger?: 'console' | 'file' | 'silent';
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    logFile?: string;
    format?: 'table' | 'json';

    /**
     * Allow dynamic custom flags from adapters.
     *
     * Custom flags defined via customOptions in createCLI will be accessible here.
     *
     * @example
     * ```typescript
     * // With customOptions: [{ flags: '--database-url <url>', configKey: 'databaseUrl' }]
     * const flags: CLIFlags = {
     *   databaseUrl: 'https://my-project.firebaseio.com'
     * };
     * ```
     */
    [key: string]: string | number | boolean | undefined;
}

/**
 * Maps CLI flags to Config object.
 *
 * Takes CLI flag values and updates the provided Config object accordingly.
 * Handles standard MSR flags and special cases like logger creation.
 *
 * Custom adapter-specific flags should be handled by the mapCustomFlags callback in CLIOptions.
 *
 * @param config - Config object to update
 * @param flags - CLI flags from commander
 * @returns Logger instance based on flags, or undefined to keep existing logger
 *
 * @example
 * ```typescript
 * const config = new Config();
 * const logger = mapFlagsToConfig(config, {
 *   folder: './migrations',
 *   displayLimit: 20,
 *   logger: 'console',
 *   logLevel: 'info'
 * });
 * ```
 */
export function mapFlagsToConfig(config: Config, flags: CLIFlags): ILogger | undefined {
    // Map simple config properties
    if (flags.folder !== undefined) {
        config.folder = flags.folder;
    }

    if (flags.tableName !== undefined) {
        config.tableName = flags.tableName;
    }

    if (flags.displayLimit !== undefined) {
        config.displayLimit = flags.displayLimit;
    }

    if (flags.dryRun !== undefined) {
        config.dryRun = flags.dryRun;
    }

    if (flags.noLock !== undefined) {
        config.locking.enabled = !flags.noLock;
    }

    // Handle logger creation
    let logger: ILogger | undefined;

    if (flags.logger) {
        switch (flags.logger) {
            case 'console':
                logger = new ConsoleLogger();
                break;
            case 'file':
                if (!flags.logFile) {
                    throw new Error('--log-file is required when using --logger file');
                }
                logger = new FileLogger({logPath: flags.logFile});
                break;
            case 'silent':
                logger = new SilentLogger();
                break;
        }
    }

    return logger;
}
