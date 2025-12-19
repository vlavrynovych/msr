import {IBackupService} from "./service/IBackupService";
import {ISchemaVersionService} from "./service/ISchemaVersionService";
import {IMigrationRenderer} from "./service/IMigrationRenderer";
import {IRenderStrategy} from "./service/IRenderStrategy";
import {IMigrationService} from "./service/IMigrationService";
import {IMigrationScanner} from "./service/IMigrationScanner";
import {IMigrationValidationService} from "./service/IMigrationValidationService";
import {IRollbackService} from "./service/IRollbackService";
import {ILogger} from "./ILogger";
import {IMigrationHooks} from "./IMigrationHooks";
import {ILoaderRegistry} from "./loader/ILoaderRegistry";
import {IDB} from "./dao";
import {IMetricsCollector} from "./IMetricsCollector";
import {Config} from "../model";

/**
 * Optional services and configuration for MigrationScriptExecutor.
 *
 * This interface contains all customizable services and configuration that can be overridden.
 * Used by both core MigrationScriptExecutor and database-specific adapters.
 *
 * **Generic Type Parameters:**
 * - `DB` - Your specific database interface extending IDB (REQUIRED, v0.7.0)
 * - `TConfig` - Your specific config type extending Config (OPTIONAL, v0.8.2, defaults to Config)
 *
 * @template DB - Database interface type
 * @template TConfig - Config type (defaults to base Config class)
 *
 * **New in v0.8.2:**
 * - Added TConfig generic parameter for custom config types
 * - Enables adapters to properly type database-specific config properties
 * - Fully backward compatible (defaults to Config)
 *
 * **New in v0.7.0:**
 * - Split from IMigrationExecutorDependencies for better adapter ergonomics
 * - Config moved from constructor parameter to this interface
 * - Adapters can extend this interface to add database-specific options
 *
 * @example
 * ```typescript
 * // Use with custom services (backward compatible)
 * const options: IExecutorOptions<IDB> = {
 *     config: myConfig,
 *     logger: new FileLogger('./migrations.log'),
 *     hooks: new SlackNotificationHooks(webhookUrl),
 *     metricsCollectors: [new ConsoleMetricsCollector()]
 * };
 *
 * // v0.8.2: Use with custom config type
 * class AppConfig extends Config {
 *     databaseUrl?: string;
 *     credentials?: string;
 * }
 *
 * const options: IExecutorOptions<IDB, AppConfig> = {
 *     config: new AppConfig({ databaseUrl: 'https://...' }),
 *     logger: myLogger
 * };
 *
 * // Adapter with custom config
 * interface IFirebaseOptions extends IExecutorOptions<IFirebaseDB, AppConfig> {
 *     // config is now typed as AppConfig, not base Config
 *     // Inherits: logger, hooks, all services
 * }
 * ```
 */
export interface IExecutorOptions<
    DB extends IDB,
    TConfig extends Config = Config
> {
    /**
     * Configuration for migration execution.
     * If not provided, will be loaded using ConfigLoader (from file or defaults).
     *
     * **New in v0.8.2:** Can be typed with custom config class using TConfig generic parameter.
     * **New in v0.7.0:** Moved from constructor's second parameter to this interface.
     *
     * @example
     * ```typescript
     * // Backward compatible - base Config
     * const options: IExecutorOptions<IDB> = {
     *     config: new Config({
     *         folder: './migrations',
     *         logLevel: 'debug'
     *     })
     * };
     *
     * // v0.8.2: Custom config type
     * class AppConfig extends Config {
     *     databaseUrl?: string;
     * }
     *
     * const options: IExecutorOptions<IDB, AppConfig> = {
     *     config: new AppConfig({
     *         folder: './migrations',
     *         databaseUrl: 'https://mydb.example.com'
     *     })
     * };
     * ```
     */
    config?: TConfig;

    /**
     * Custom backup service implementation.
     * If not provided, uses BackupService with default configuration.
     */
    backupService?: IBackupService;

    /**
     * Custom schema version tracking service implementation.
     * If not provided, uses SchemaVersionService with handler's schema version.
     */
    schemaVersionService?: ISchemaVersionService<DB>;

    /**
     * Custom migration renderer implementation.
     * If not provided, uses MigrationRenderer with default configuration.
     */
    migrationRenderer?: IMigrationRenderer<DB>;

    /**
     * Custom render strategy for migration output.
     * Determines the format of migration output (ASCII tables, JSON, silent, etc.).
     * If not provided, uses AsciiTableRenderStrategy (default ASCII tables).
     *
     * Note: This is ignored if migrationRenderer is provided.
     *
     * @example
     * ```typescript
     * // JSON output
     * renderStrategy: new JsonRenderStrategy()
     *
     * // Silent output
     * renderStrategy: new SilentRenderStrategy()
     * ```
     */
    renderStrategy?: IRenderStrategy<DB>;

    /**
     * Custom migration service implementation.
     * If not provided, uses MigrationService with default configuration.
     */
    migrationService?: IMigrationService<DB>;

    /**
     * Custom migration scanner implementation.
     * If not provided, uses MigrationScanner with default configuration.
     *
     * The scanner is responsible for gathering the complete state of migrations by:
     * - Querying the database for executed migrations
     * - Reading migration files from the filesystem
     * - Determining which migrations are pending, ignored, or already executed
     *
     * @example
     * ```typescript
     * // Use custom scanner
     * migrationScanner: new CustomMigrationScanner()
     * ```
     */
    migrationScanner?: IMigrationScanner<DB>;

    /**
     * Logger instance to use across all services.
     * If not provided, uses ConsoleLogger.
     */
    logger?: ILogger;

    /**
     * Custom migration validation service implementation.
     * If not provided, uses MigrationValidationService with config.customValidators.
     *
     * @example
     * ```typescript
     * // Use custom validation service
     * validationService: new CustomValidationService(logger)
     * ```
     */
    validationService?: IMigrationValidationService<DB>;

    /**
     * Lifecycle hooks for extending migration behavior.
     * If not provided, no hooks will be called during migration.
     * Typed with the generic DB parameter (v0.6.0).
     *
     * @example
     * ```typescript
     * // Add Slack notifications
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     hooks: new SlackNotificationHooks(webhookUrl)
     * });
     * ```
     */
    hooks?: IMigrationHooks<DB>;

    /**
     * Array of metrics collectors for observability (v0.6.0).
     *
     * Automatically wrapped in MetricsCollectorHook and combined with user-provided hooks.
     * Multiple collectors can be used simultaneously (e.g., Console + JSON + CSV).
     *
     * Collector failures are logged but don't break migrations.
     *
     * **Built-in Collectors:**
     * - ConsoleMetricsCollector - Real-time console output
     * - JsonMetricsCollector - Structured JSON for CI/CD
     * - CsvMetricsCollector - CSV format for Excel/Sheets analysis
     *
     * @example
     * ```typescript
     * // Single collector - console output
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     metricsCollectors: [new ConsoleMetricsCollector()]
     * });
     *
     * // Multiple collectors simultaneously
     * const executor = new MigrationScriptExecutor<IDB>({
     *     handler: myDatabaseHandler,
     *     metricsCollectors: [
     *         new ConsoleMetricsCollector(),
     *         new JsonMetricsCollector({ filePath: './metrics.json' }),
     *         new CsvMetricsCollector({ filePath: './metrics.csv' })
     *     ]
     * });
     *
     * // Custom collector for DataDog/CloudWatch
     * class DataDogCollector implements IMetricsCollector {
     *     recordScriptComplete(script, duration) {
     *         statsd.timing('migration.duration', duration);
     *     }
     * }
     * ```
     */
    metricsCollectors?: IMetricsCollector[];

    /**
     * Custom rollback service implementation.
     * If not provided, uses RollbackService with default configuration.
     *
     * The rollback service handles all rollback strategies (BACKUP, DOWN, BOTH, NONE)
     * and backup mode logic, determining when to create and restore backups.
     *
     * @example
     * ```typescript
     * // Use custom rollback service
     * rollbackService: new CustomRollbackService(handler, config, backupService, logger, hooks)
     * ```
     */
    rollbackService?: IRollbackService<DB>;

    /**
     * Custom loader registry for migration script loading.
     *
     * If not provided, uses LoaderRegistry.createDefault() which includes:
     * - TypeScriptLoader (handles .ts and .js files)
     * - SqlLoader (handles .up.sql and .down.sql files)
     *
     * Use this to register custom loaders for additional file types (Python, Ruby, shell scripts, etc.)
     * or to customize the behavior of existing loaders.
     *
     * @example
     * ```typescript
     * // Use default loaders
     * const executor = new MigrationScriptExecutor<DB>(handler);
     * // Automatically uses TypeScript and SQL loaders
     *
     * // Register custom loader
     * const registry = LoaderRegistry.createDefault();
     * registry.register(new PythonLoader());
     * const executor = new MigrationScriptExecutor<DB>(handler, {
     *     loaderRegistry: registry
     * });
     *
     * // Use only specific loaders
     * const registry = new LoaderRegistry<DB>();
     * registry.register(new TypeScriptLoader<DB>());
     * // SQL files will not be supported
     * ```
     */
    loaderRegistry?: ILoaderRegistry<DB>;
}
