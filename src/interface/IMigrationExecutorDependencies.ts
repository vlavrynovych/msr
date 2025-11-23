import {IBackupService} from "./service/IBackupService";
import {ISchemaVersionService} from "./service/ISchemaVersionService";
import {IConsoleRenderer} from "./service/IConsoleRenderer";
import {IMigrationService} from "./service/IMigrationService";
import {ILogger} from "./ILogger";

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
 * // Inject mock services for testing
 * const executor = new MigrationScriptExecutor(handler, {
 *     backupService: mockBackupService,
 *     schemaVersionService: mockSchemaVersionService,
 *     consoleRenderer: mockRenderer,
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
     * Custom console renderer implementation.
     * If not provided, uses ConsoleRenderer with default configuration.
     */
    consoleRenderer?: IConsoleRenderer;

    /**
     * Custom migration service implementation.
     * If not provided, uses MigrationService with default configuration.
     */
    migrationService?: IMigrationService;

    /**
     * Logger instance to use across all services.
     * If not provided, uses ConsoleLogger.
     */
    logger?: ILogger;
}
