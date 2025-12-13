import {IDB} from "../dao";
import {IScripts} from "../IScripts";
import {MigrationScript} from "../../model";

/**
 * Interface for orchestrating migration reporting and display.
 *
 * Responsibilities:
 * - Rendering migration status (pending, executed, migrated, ignored)
 * - Logging dry run results
 * - Displaying migration progress
 * - Coordinating with migration renderer for visual output
 *
 * Extracted from MigrationScriptExecutor for better separation of concerns.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const reportingOrchestrator = new MigrationReportingOrchestrator({
 *     migrationRenderer,
 *     logger,
 *     config
 * });
 *
 * // Render migration status
 * reportingOrchestrator.renderMigrationStatus(scripts);
 *
 * // Log dry run mode
 * reportingOrchestrator.logDryRunMode();
 * ```
 */
export interface IMigrationReportingOrchestrator<DB extends IDB> {
    /**
     * Renders migration status showing migrated and ignored scripts.
     *
     * Displays tables/lists of already-executed and ignored migrations.
     *
     * @param scripts - All migration scripts categorized
     *
     * @example
     * ```typescript
     * reportingOrchestrator.renderMigrationStatus(scripts);
     * ```
     */
    renderMigrationStatus(scripts: IScripts<DB>): void;

    /**
     * Renders pending migrations that will be executed.
     *
     * Displays table/list of migrations about to be executed.
     *
     * @param pending - Pending migration scripts
     *
     * @example
     * ```typescript
     * reportingOrchestrator.renderPendingMigrations(scripts.pending);
     * ```
     */
    renderPendingMigrations(pending: MigrationScript<DB>[]): void;

    /**
     * Renders executed migrations after completion.
     *
     * Displays table/list of successfully executed migrations.
     *
     * @param executed - Executed migration scripts
     *
     * @example
     * ```typescript
     * reportingOrchestrator.renderExecutedMigrations(scripts.executed);
     * ```
     */
    renderExecutedMigrations(executed: MigrationScript<DB>[]): void;

    /**
     * Logs message when there are no pending migrations to execute.
     *
     * Different messages for normal vs dry run mode.
     *
     * @param ignoredCount - Number of ignored migrations
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logNoPendingMigrations(scripts.ignored.length);
     * ```
     */
    logNoPendingMigrations(ignoredCount: number): void;

    /**
     * Logs dry run mode activation message.
     *
     * Displays indicator that no changes will be made.
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logDryRunMode();
     * ```
     */
    logDryRunMode(): void;

    /**
     * Logs dry run completion results.
     *
     * Displays summary of what would have been executed.
     *
     * @param pendingCount - Number of pending migrations
     * @param ignoredCount - Number of ignored migrations
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logDryRunResults(scripts.pending.length, scripts.ignored.length);
     * ```
     */
    logDryRunResults(pendingCount: number, ignoredCount: number): void;

    /**
     * Logs dry run mode activation for version-specific migration.
     *
     * @param targetVersion - Target version for migration
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logDryRunModeForVersion(5);
     * ```
     */
    logDryRunModeForVersion(targetVersion: number): void;

    /**
     * Logs message when already at target version or beyond.
     *
     * Different messages for normal vs dry run mode.
     *
     * @param targetVersion - Target version
     * @param ignoredCount - Number of ignored migrations
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logNoMigrationsToTarget(5, scripts.ignored.length);
     * ```
     */
    logNoMigrationsToTarget(targetVersion: number, ignoredCount: number): void;

    /**
     * Logs dry run completion results for version-specific migration.
     *
     * @param pendingCount - Number of pending migrations
     * @param ignoredCount - Number of ignored migrations
     * @param targetVersion - Target version
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logDryRunResultsForVersion(3, 2, 5);
     * ```
     */
    logDryRunResultsForVersion(pendingCount: number, ignoredCount: number, targetVersion: number): void;

    /**
     * Logs dry run transaction testing start message.
     *
     * Displays transaction mode being tested.
     *
     * @param transactionMode - Transaction mode being tested
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logDryRunTransactionTesting('PER_MIGRATION');
     * ```
     */
    logDryRunTransactionTesting(transactionMode: string): void;

    /**
     * Logs dry run transaction testing completion with details.
     *
     * Displays transaction details and rollback confirmation.
     *
     * @param executedCount - Number of migrations tested
     * @param transactionMode - Transaction mode tested
     * @param isolationLevel - Transaction isolation level (optional)
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logDryRunTransactionComplete(3, 'PER_MIGRATION', 'READ COMMITTED');
     * ```
     */
    logDryRunTransactionComplete(executedCount: number, transactionMode: string, isolationLevel?: string): void;

    /**
     * Logs migration completion success message.
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logMigrationSuccess();
     * ```
     */
    logMigrationSuccess(): void;

    /**
     * Logs version-specific migration completion success message.
     *
     * @param targetVersion - Target version achieved
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logMigrationSuccessForVersion(5);
     * ```
     */
    logMigrationSuccessForVersion(targetVersion: number): void;

    /**
     * Logs processing start message.
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logProcessingStart();
     * ```
     */
    logProcessingStart(): void;

    /**
     * Logs migration to version start message.
     *
     * @param targetVersion - Target version
     *
     * @example
     * ```typescript
     * reportingOrchestrator.logMigrationToVersionStart(5);
     * ```
     */
    logMigrationToVersionStart(targetVersion: number): void;
}
