import {IDB} from "../dao";
import {IMigrationResult} from "../IMigrationResult";

/**
 * Interface for orchestrating migration workflow execution.
 *
 * Responsibilities:
 * - Coordinating migration preparation, scanning, validation, backup, execution
 * - Orchestrating dry run mode execution
 * - Handling version-specific migrations
 * - Coordinating hooks, reporting, and error handling
 *
 * Extracted from MigrationScriptExecutor for better separation of concerns.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const workflowOrchestrator = new MigrationWorkflowOrchestrator({
 *     migrationScanner,
 *     validationOrchestrator,
 *     reportingOrchestrator,
 *     backupService,
 *     hookExecutor,
 *     errorHandler,
 *     rollbackService,
 *     schemaVersionService,
 *     loaderRegistry,
 *     selector,
 *     transactionManager,
 *     config,
 *     logger,
 *     hooks
 * });
 *
 * // Execute all pending migrations
 * const result = await workflowOrchestrator.migrateAll();
 *
 * // Execute migrations up to specific version
 * const result = await workflowOrchestrator.migrateToVersion(202501220100);
 * ```
 */
export interface IMigrationWorkflowOrchestrator<DB extends IDB> {
    /**
     * Execute all pending database migrations.
     *
     * Orchestrates the complete migration workflow:
     * 1. Log dry run mode (if enabled)
     * 2. Prepare for migration (initialize schema version table, execute beforeMigrate)
     * 3. Scan and validate migration scripts
     * 4. Create backup if needed
     * 5. Check for hybrid migrations
     * 6. Render migration status
     * 7. Execute pending migrations or handle no pending migrations
     * 8. Handle errors with rollback
     *
     * @returns Migration result with executed, migrated, ignored scripts and status
     *
     * @example
     * ```typescript
     * const result = await workflowOrchestrator.migrateAll();
     * if (result.success) {
     *     console.log(`Executed ${result.executed.length} migrations`);
     * } else {
     *     console.error('Migration failed:', result.errors);
     * }
     * ```
     */
    migrateAll(): Promise<IMigrationResult<DB>>;

    /**
     * Execute migrations up to a specific target version.
     *
     * Orchestrates version-specific migration workflow:
     * 1. Log dry run mode for version (if enabled)
     * 2. Prepare for migration
     * 3. Scan scripts and select pending up to target version
     * 4. Initialize and validate selected scripts
     * 5. Create backup if needed
     * 6. Render migration status
     * 7. Execute migrations to target or handle early return
     * 8. Handle errors with rollback
     *
     * @param targetVersion - Target version timestamp to migrate to
     * @returns Migration result with executed migrations and status
     *
     * @example
     * ```typescript
     * // Migrate to specific version
     * const result = await workflowOrchestrator.migrateToVersion(202501220100);
     * console.log(`Migrated to version ${targetVersion}`);
     * ```
     */
    migrateToVersion(targetVersion: number): Promise<IMigrationResult<DB>>;
}
