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
import {IDatabaseMigrationHandler} from "./IDatabaseMigrationHandler";
import {IDB} from "./dao";

/**
 * Dependencies for MigrationScriptExecutor.
 *
 * Allows customization of service implementations through dependency injection.
 * The handler is required; all other dependencies are optional.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * **Breaking Change in v0.6.0:**
 * - Constructor signature changed to `constructor(dependencies, config?)`
 * - Handler moved from separate parameter to dependencies object
 * - All service interfaces now require generic type parameter
 *
 * @example
 * ```typescript
 * // Minimal usage - just handler
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler
 * });
 *
 * // With config
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler
 * }, config);
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
 * // Use silent output for testing
 * const executor = new MigrationScriptExecutor<IDB>({
 *     handler: myDatabaseHandler,
 *     renderStrategy: new SilentRenderStrategy()
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
export interface IMigrationExecutorDependencies<DB extends IDB> {
    /**
     * Database migration handler (REQUIRED).
     * Implements database-specific operations for migrations.
     *
     * **New in v0.6.0:** Moved from constructor parameter to dependencies object.
     *
     * @example
     * ```typescript
     * const handler: IDatabaseMigrationHandler<IDB> = {
     *     db: myDB,
     *     schemaVersion: mySchemaVersion,
     *     backup: myBackup,
     *     getName: () => 'My Database Handler',
     *     getVersion: () => '1.0.0'
     * };
     *
     * const executor = new MigrationScriptExecutor<IDB>({ handler });
     * ```
     */
    handler: IDatabaseMigrationHandler<DB>;
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
