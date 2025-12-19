import {IDatabaseMigrationHandler} from "./IDatabaseMigrationHandler";
import {IDB} from "./dao";
import {IExecutorOptions} from "./IExecutorOptions";
import {IConfigLoader} from "./IConfigLoader";
import {Config} from "../model";

/**
 * **INTERNAL API** - Dependencies for MigrationScriptExecutor constructor.
 *
 * Use this interface in your adapter's **private constructor** only.
 * This interface REQUIRES the database handler, which must be initialized before construction.
 *
 * **⚠️ For public factory methods, use `IExecutorOptions` instead!**
 * `IExecutorOptions` doesn't include the handler - you create it in your factory method,
 * then spread the options into this interface: `{ handler, ...options }`
 *
 * **Purpose:**
 * - Internal API for adapter constructors
 * - Extends `IExecutorOptions` but adds required `handler` property
 * - Used by MSR Core internals
 *
 * **Generic Type Parameters:**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 * - `THandler` - Your specific handler type extending IDatabaseMigrationHandler<DB> (OPTIONAL, v0.8.0, defaults to IDatabaseMigrationHandler<DB>)
 * - `TConfig` - Your specific config type extending Config (OPTIONAL, v0.8.2, defaults to Config)
 *
 * @template DB - Database interface type
 * @template THandler - Handler interface type (defaults to IDatabaseMigrationHandler<DB>)
 * @template TConfig - Config type (defaults to base Config class)
 * @internal
 * @since v0.6.0
 *
 * @example
 * ```typescript
 * // ✅ CORRECT: Use in private constructor
 * export class FirebaseRunner extends MigrationScriptExecutor<IFirebaseDB, FirebaseHandler> {
 *     private constructor(deps: IMigrationExecutorDependencies<IFirebaseDB, FirebaseHandler>) {
 *         super(deps);  // ✅ Has handler
 *     }
 *
 *     static async getInstance(options: IExecutorOptions<IFirebaseDB>): Promise<FirebaseRunner> {
 *         const handler = await FirebaseHandler.connect(options.config);
 *         return new FirebaseRunner({ handler, ...options });  // Spread IExecutorOptions
 *     }
 * }
 *
 * // ✅ CORRECT: Sync adapter
 * export class SimpleAdapter extends MigrationScriptExecutor<IDB, SimpleHandler> {
 *     constructor(options: IExecutorOptions<IDB>) {
 *         const handler = new SimpleHandler(options.config);  // Create handler
 *         super({ handler, ...options });  // Pass to base constructor
 *     }
 * }
 *
 * // ❌ WRONG: Using IExecutorOptions in constructor
 * class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
 *     constructor(options: IExecutorOptions<IDB>) {  // ❌ Missing handler!
 *         super(options);  // ❌ Runtime Error: Handler is required
 *     }
 * }
 * ```
 *
 * @see {@link IExecutorOptions} - Public API for factory methods (no handler)
 * @see https://github.com/migration-script-runner/msr-core/blob/master/docs/guides/cli-adapter-development.md
 */
export interface IMigrationExecutorDependencies<
    DB extends IDB,
    THandler extends IDatabaseMigrationHandler<DB> = IDatabaseMigrationHandler<DB>,
    TConfig extends Config = Config
> extends IExecutorOptions<DB, TConfig> {
    /**
     * Database migration handler (REQUIRED).
     * Implements database-specific operations for migrations.
     *
     * **New in v0.8.0:** Can be typed with specific handler type using THandler generic parameter.
     * **New in v0.6.0:** Moved from constructor parameter to dependencies object.
     *
     * @example
     * ```typescript
     * // Basic usage - handler type inferred
     * const handler: IDatabaseMigrationHandler<IDB> = {
     *     db: myDB,
     *     schemaVersion: mySchemaVersion,
     *     backup: myBackup,
     *     getName: () => 'My Database Handler',
     *     getVersion: () => '1.0.0'
     * };
     *
     * const executor = new MigrationScriptExecutor<IDB>({ handler });
     *
     * // v0.8.0: Specify handler type for better type safety in adapters
     * class MyAdapter extends MigrationScriptExecutor<IDB, MyHandler> {
     *     // this.handler is now typed as MyHandler instead of IDatabaseMigrationHandler<IDB>
     * }
     * ```
     */
    handler: THandler;

    /**
     * Config loader for loading and processing configuration (v0.7.0).
     *
     * If not provided, uses ConfigLoader instance with default behavior.
     * Adapters can provide custom ConfigLoader implementations to add
     * database-specific environment variable handling.
     *
     * @example
     * ```typescript
     * // Use default ConfigLoader
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler
     * });
     * // ConfigLoader automatically used
     *
     * // Use custom ConfigLoader
     * class MyConfigLoader extends ConfigLoader {
     *     applyEnvironmentVariables(config: Config): void {
     *         super.applyEnvironmentVariables(config);
     *         // Add custom env vars
     *         if (process.env.MY_DB_HOST) {
     *             (config as any).host = process.env.MY_DB_HOST;
     *         }
     *     }
     * }
     *
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     configLoader: new MyConfigLoader()
     * });
     * ```
     */
    configLoader?: IConfigLoader<TConfig>;
}
