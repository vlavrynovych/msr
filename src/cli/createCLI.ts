import {Command} from 'commander';
import {MigrationScriptExecutor} from '../service/MigrationScriptExecutor';
import {IConfigLoader} from '../interface/IConfigLoader';
import {Config} from '../model/Config';
import {IDB} from '../interface';
import {ConfigLoader} from '../util/ConfigLoader';
import {mapFlagsToConfig, CLIFlags} from './utils/flagMapper';
import {
    addMigrateCommand,
    addListCommand,
    addDownCommand,
    addValidateCommand,
    addBackupCommand,
    addLockStatusCommand,
    addLockReleaseCommand
} from './commands';

/**
 * Options for creating a CLI instance.
 *
 * @template DB - Database interface type
 * @template TExecutor - Executor type (MigrationScriptExecutor or adapter extending it)
 */
export interface CLIOptions<DB extends IDB, TExecutor extends MigrationScriptExecutor<DB> = MigrationScriptExecutor<DB>> {
    /**
     * Factory function to create MigrationScriptExecutor instance.
     *
     * Receives the final merged Config (defaults → file → env vars → CLI flags)
     * and should return an instance of MigrationScriptExecutor or adapter that extends it.
     *
     * **NEW in v0.8.2:** Supports both synchronous and asynchronous executor creation.
     * Use async when your database adapter requires async initialization (connections, auth, etc).
     *
     * @param config - Final merged configuration with CLI flags applied
     * @returns MigrationScriptExecutor instance (or Promise) or adapter extending it
     *
     * @example
     * ```typescript
     * // Synchronous executor (backward compatible)
     * createExecutor: (config) => {
     *   const handler = new MongoHandler(config.mongoUri);
     *   return new MongoAdapter({ handler, config });
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Asynchronous executor (NEW in v0.8.2)
     * createExecutor: async (config) => {
     *   const handler = await FirebaseHandler.getInstance(config);
     *   return new FirebaseAdapter({ handler, config });
     * }
     * ```
     */
    createExecutor: (config: Config) => TExecutor | Promise<TExecutor>;

    /**
     * CLI metadata (optional).
     */
    name?: string;
    description?: string;
    version?: string;

    /**
     * Initial config to merge with defaults (optional).
     * Will be merged after waterfall config loading but before CLI flags.
     */
    config?: Partial<Config>;

    /**
     * Custom config loader (optional).
     * If not provided, uses default ConfigLoader.
     */
    configLoader?: IConfigLoader<Config>;

    /**
     * Optional callback to extend the CLI with custom commands.
     *
     * Called after base commands are registered but before program is returned.
     * Use this to add adapter-specific commands that call custom methods on your adapter.
     *
     * **NEW in v0.8.2:** createExecutor returns Promise to support async initialization.
     *
     * @param program - Commander program to extend with custom commands
     * @param createExecutor - Factory function that creates your adapter with merged config (returns Promise)
     *
     * @example
     * ```typescript
     * extendCLI: (program, createExecutor) => {
     *   program
     *     .command('vacuum')
     *     .description('Run VACUUM ANALYZE on PostgreSQL database')
     *     .action(async () => {
     *       const adapter = await createExecutor(); // NEW: await required
     *       await adapter.vacuum(); // Custom method on adapter
     *       console.log('✓ Vacuum completed');
     *       process.exit(0);
     *     });
     * }
     * ```
     */
    extendCLI?: (program: Command, createExecutor: () => Promise<TExecutor>) => void;

    /**
     * Optional callback to add adapter-specific CLI options.
     *
     * Called during program setup to register custom command-line flags for your adapter.
     * Use this to add database-specific options that are available on all commands.
     *
     * **NEW in v0.8.3**
     *
     * @param program - Commander program to add custom options to
     *
     * @example
     * ```typescript
     * // Firebase adapter with database URL and credentials flags
     * const program = createCLI({
     *   name: 'msr-firebase',
     *
     *   // Add custom options
     *   addCustomOptions: (program) => {
     *     program
     *       .option('--database-url <url>', 'Firebase Realtime Database URL')
     *       .option('--credentials <path>', 'Path to service account key file');
     *   },
     *
     *   // Map custom flags to config
     *   extendFlags: (config, flags) => {
     *     if (flags.databaseUrl) {
     *       config.databaseUrl = flags.databaseUrl;
     *     }
     *     if (flags.credentials) {
     *       config.applicationCredentials = flags.credentials;
     *     }
     *   },
     *
     *   createExecutor: async (config) => {
     *     // config.databaseUrl and config.applicationCredentials available here
     *     return FirebaseAdapter.getInstance({ config });
     *   }
     * });
     *
     * // Usage:
     * // npx msr-firebase migrate --database-url https://my-project.firebaseio.com --credentials ./key.json
     * ```
     */
    addCustomOptions?: (program: Command) => void;

    /**
     * Optional callback to map custom CLI flags to config properties.
     *
     * Called after standard config loading but before createExecutor, allowing you to
     * map your custom CLI flags to config properties. Custom flags have highest priority
     * in the config waterfall (override defaults → file → env → options.config → custom flags).
     *
     * **NEW in v0.8.3**
     *
     * @param config - Config object to update with custom flag values
     * @param flags - Parsed CLI flags from Commander.js (includes both standard and custom flags)
     *
     * @example
     * ```typescript
     * // MongoDB adapter mapping connection string and auth options
     * const program = createCLI({
     *   name: 'msr-mongodb',
     *
     *   addCustomOptions: (program) => {
     *     program
     *       .option('--mongo-uri <uri>', 'MongoDB connection string')
     *       .option('--auth-source [source]', 'Authentication database');
     *   },
     *
     *   extendFlags: (config, flags) => {
     *     if (flags.mongoUri) {
     *       config.mongoUri = flags.mongoUri;
     *     }
     *     if (flags.authSource) {
     *       config.authSource = flags.authSource;
     *     }
     *   },
     *
     *   createExecutor: (config) => new MongoAdapter({ config })
     * });
     * ```
     */
    extendFlags?: (config: Config, flags: CLIFlags) => void;
}

/**
 * Create a CLI program with base migration commands.
 *
 * This factory function creates a Commander.js program with all base MSR commands
 * (migrate, list, down, validate, backup) pre-configured. Adapters can extend
 * the CLI with custom commands using the `extendCLI` callback.
 *
 * **Configuration Loading (Waterfall):**
 * 1. Built-in defaults
 * 2. Config file (if --config-file flag provided)
 * 3. Environment variables (MSR_*)
 * 4. options.config (if provided)
 * 5. CLI flags (highest priority)
 *
 * The final merged config is passed to your `createExecutor` factory function,
 * allowing you to initialize your adapter with the correct configuration.
 *
 * @template DB - Database interface type
 * @template TExecutor - Executor type (inferred from createExecutor return type)
 * @param options - CLI creation options
 * @returns Commander program ready for parsing or extension
 *
 * @example
 * ```typescript
 * // Basic usage with adapter
 * import { createCLI } from '@migration-script-runner/core';
 * import { MongoAdapter } from './MongoAdapter';
 * import { MongoHandler } from './MongoHandler';
 *
 * const program = createCLI({
 *   name: 'msr-mongodb',
 *   description: 'MongoDB Migration Runner',
 *   version: '1.0.0',
 *   createExecutor: (config) => {
 *     const handler = new MongoHandler(config.mongoUri || 'mongodb://localhost');
 *     return new MongoAdapter({ handler, config });
 *   }
 * });
 *
 * program.parse(process.argv);
 * ```
 *
 * @example
 * ```typescript
 * // Extending with custom commands via extendCLI callback
 * class PostgresAdapter extends MigrationScriptExecutor<IPostgresDB> {
 *   async vacuum(): Promise<void> {
 *     await this.handler.db.query('VACUUM ANALYZE');
 *   }
 * }
 *
 * const program = createCLI({
 *   name: 'msr-postgres',
 *   createExecutor: (config) => new PostgresAdapter({ handler, config }),
 *
 *   // Add custom commands with full type safety
 *   extendCLI: (program, createExecutor) => {
 *     program
 *       .command('vacuum')
 *       .description('Run VACUUM ANALYZE on database')
 *       .action(async () => {
 *         const adapter = createExecutor(); // Typed as PostgresAdapter!
 *         await adapter.vacuum(); // ✓ TypeScript knows about vacuum()
 *         console.log('✓ Vacuum completed');
 *         process.exit(0);
 *       });
 *   }
 * });
 *
 * program.parse(process.argv);
 * ```
 */
export function createCLI<DB extends IDB, TExecutor extends MigrationScriptExecutor<DB> = MigrationScriptExecutor<DB>>(
    options: CLIOptions<DB, TExecutor>
): Command {
    const program = new Command();

    // Set CLI metadata
    program
        .name(options.name || 'msr')
        .description(options.description || 'Migration Script Runner')
        .version(options.version || '1.0.0');

    // Add common options to all commands
    program
        .option('-c, --config-file <path>', 'Configuration file path')
        .option('--folder <path>', 'Migrations folder')
        .option('--table-name <name>', 'Schema version table name')
        .option('--display-limit <number>', 'Maximum migrations to display', parseInt)
        .option('--dry-run', 'Simulate without executing')
        .option('--no-lock', 'Disable migration locking for this run')
        .option('--logger <type>', 'Logger type (console|file|silent)')
        .option('--log-level <level>', 'Log level (error|warn|info|debug)')
        .option('--log-file <path>', 'Log file path (required with --logger file)')
        .option('--format <format>', 'Output format (table|json)');

    // Call adapter's custom options callback if provided
    if (options.addCustomOptions) {
        options.addCustomOptions(program);
    }

    // Factory function to create executor based on parsed CLI flags
    const createExecutorWithFlags = async (): Promise<TExecutor> => {
        const opts = program.opts<CLIFlags>();

        // 1. Load base config using waterfall (defaults → file → env vars)
        const configLoader = options.configLoader || new ConfigLoader<Config>();
        const config = opts.configFile
            ? configLoader.load({}, {baseDir: opts.configFile})
            : configLoader.load(); // Uses waterfall without explicit file

        // 2. Merge with options.config if provided
        if (options.config) {
            Object.assign(config, options.config);
        }

        // 3. Map CLI flags to config (highest priority)
        const logger = mapFlagsToConfig(config, opts);

        // 4. Call adapter's custom flag mapper if provided (highest priority)
        if (options.extendFlags) {
            options.extendFlags(config, opts);
        }

        // 5. Call adapter's factory function with final merged config (supports both sync and async)
        const executorOrPromise = options.createExecutor(config);
        const executor = executorOrPromise instanceof Promise
            ? await executorOrPromise
            : executorOrPromise;

        // 6. If logger was created from CLI flags, override executor's logger
        if (logger) {
            // Note: This assumes executor has a way to set logger
            // We'll need to verify this works with the executor's implementation
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (executor as any).logger = logger;
        }

        return executor;
    };

    // Add base commands - pass factory function
    addMigrateCommand(program, createExecutorWithFlags);
    addListCommand(program, createExecutorWithFlags);
    addDownCommand(program, createExecutorWithFlags);
    addValidateCommand(program, createExecutorWithFlags);
    addBackupCommand(program, createExecutorWithFlags);
    addLockStatusCommand(program, createExecutorWithFlags);
    addLockReleaseCommand(program, createExecutorWithFlags);

    // Call extendCLI callback if provided
    if (options.extendCLI) {
        options.extendCLI(program, createExecutorWithFlags);
    }

    return program;
}
