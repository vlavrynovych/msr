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

/**
 * Optional dependencies for MigrationScriptExecutor.
 *
 * Allows customization of service implementations through dependency injection.
 * All dependencies are optional - if not provided, default implementations will be used.
 *
 * @example
 * ```typescript
 * // Use custom logger across all services
 * const executor = new MigrationScriptExecutor(handler, {
 *     logger: new FileLogger('./migrations.log')
 * });
 *
 * // Use JSON output for CI/CD
 * const executor = new MigrationScriptExecutor(handler, {
 *     renderStrategy: new JsonRenderStrategy()
 * });
 *
 * // Use silent output for testing
 * const executor = new MigrationScriptExecutor(handler, {
 *     renderStrategy: new SilentRenderStrategy()
 * });
 *
 * // Inject mock services for testing
 * const executor = new MigrationScriptExecutor(handler, {
 *     backupService: mockBackupService,
 *     schemaVersionService: mockSchemaVersionService,
 *     migrationRenderer: mockRenderer,
 *     migrationService: mockMigrationService
 * });
 *
 * // Partial customization
 * const executor = new MigrationScriptExecutor(handler, {
 *     backupService: new S3BackupService(config)
 * });
 * ```
 */
export interface IMigrationExecutorDependencies {
    /**
     * Custom backup service implementation.
     * If not provided, uses BackupService with default configuration.
     */
    backupService?: IBackupService;

    /**
     * Custom schema version tracking service implementation.
     * If not provided, uses SchemaVersionService with handler's schema version.
     */
    schemaVersionService?: ISchemaVersionService;

    /**
     * Custom migration renderer implementation.
     * If not provided, uses MigrationRenderer with default configuration.
     */
    migrationRenderer?: IMigrationRenderer;

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
    renderStrategy?: IRenderStrategy;

    /**
     * Custom migration service implementation.
     * If not provided, uses MigrationService with default configuration.
     */
    migrationService?: IMigrationService;

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
    migrationScanner?: IMigrationScanner;

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
    validationService?: IMigrationValidationService;

    /**
     * Lifecycle hooks for extending migration behavior.
     * If not provided, no hooks will be called during migration.
     *
     * @example
     * ```typescript
     * // Add Slack notifications
     * const executor = new MigrationScriptExecutor(handler, {
     *     hooks: new SlackNotificationHooks(webhookUrl)
     * });
     * ```
     */
    hooks?: IMigrationHooks;

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
    rollbackService?: IRollbackService;
}
