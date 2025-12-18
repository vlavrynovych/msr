import {IDatabaseMigrationHandler} from "./IDatabaseMigrationHandler";
import {IDB} from "./dao";
import {IExecutorOptions} from "./IExecutorOptions";
import {IConfigLoader} from "./IConfigLoader";

/**
 * Dependencies for MigrationScriptExecutor.
 *
 * Requires database migration handler and optionally allows customization of
 * configuration loading and all service implementations through dependency injection.
 *
 * **Generic Type Parameters:**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 * - `THandler` - Your specific handler type extending IDatabaseMigrationHandler<DB> (OPTIONAL, v0.8.0)
 *
 * @template DB - Database interface type
 * @template THandler - Handler interface type (defaults to IDatabaseMigrationHandler<DB>)
 *
 * **New in v0.7.0:**
 * - Extends IExecutorOptions for better adapter ergonomics
 * - Config moved from constructor's second parameter to this interface (via IExecutorOptions)
 * - Added configLoader for extensible configuration loading
 * - Single parameter constructor: `constructor(dependencies)`
 *
 * **Previous Versions:**
 * - v0.6.0: Constructor signature was `constructor(dependencies, config?)`
 *
 * @example
 * ```typescript
 * // Minimal usage - just handler
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler
 * });
 *
 * // With config (v0.7.0+)
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler,
 *     config: myConfig  // Now in dependencies object
 * });
 *
 * // With custom config loader (v0.7.0+)
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler,
 *     configLoader: new CustomConfigLoader()
 * });
 *
 * // Use custom logger across all services
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler,
 *     logger: new FileLogger('./migrations.log')
 * });
 *
 * // Use JSON output for CI/CD
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler,
 *     renderStrategy: new JsonRenderStrategy()
 * });
 *
 * // Inject mock services for testing
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: mockHandler,
 *     backupService: mockBackupService,
 *     schemaVersionService: mockSchemaVersionService,
 *     migrationRenderer: mockRenderer,
 *     migrationService: mockMigrationService
 * });
 * ```
 */
export interface IMigrationExecutorDependencies<
    DB extends IDB,
    THandler extends IDatabaseMigrationHandler<DB> = IDatabaseMigrationHandler<DB>
> extends IExecutorOptions<DB> {
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
    configLoader?: IConfigLoader;
}
