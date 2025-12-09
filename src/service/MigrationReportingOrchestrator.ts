import {IDB} from "../interface/dao";
import {IMigrationReportingOrchestrator} from "../interface/service/IMigrationReportingOrchestrator";
import {IMigrationRenderer} from "../interface/service/IMigrationRenderer";
import {ILogger} from "../interface/ILogger";
import {Config} from "../model/Config";
import {IScripts} from "../interface/IScripts";
import {MigrationScript} from "../model";

/**
 * Dependencies for MigrationReportingOrchestrator.
 *
 * @template DB - Database interface type
 */
export interface MigrationReportingOrchestratorDependencies<DB extends IDB> {
    /**
     * Renderer for visual migration output.
     */
    migrationRenderer: IMigrationRenderer<DB>;

    /**
     * Logger for migration messages.
     */
    logger: ILogger;

    /**
     * Configuration settings.
     */
    config: Config;
}

/**
 * Orchestrates migration reporting and display.
 *
 * Extracted from MigrationScriptExecutor to separate reporting concerns.
 * Handles all visual output and status logging for migrations.
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
 * reportingOrchestrator.renderMigrationStatus(scripts);
 * reportingOrchestrator.logDryRunMode();
 * ```
 */
export class MigrationReportingOrchestrator<DB extends IDB> implements IMigrationReportingOrchestrator<DB> {
    private readonly migrationRenderer: IMigrationRenderer<DB>;
    private readonly logger: ILogger;
    private readonly config: Config;

    constructor(dependencies: MigrationReportingOrchestratorDependencies<DB>) {
        this.migrationRenderer = dependencies.migrationRenderer;
        this.logger = dependencies.logger;
        this.config = dependencies.config;
    }

    /**
     * Renders migration status showing migrated and ignored scripts.
     *
     * @param scripts - All migration scripts categorized
     */
    public renderMigrationStatus(scripts: IScripts<DB>): void {
        this.migrationRenderer.drawMigrated(scripts);
        this.migrationRenderer.drawIgnored(scripts.ignored);
    }

    /**
     * Renders pending migrations that will be executed.
     *
     * @param pending - Pending migration scripts
     */
    public renderPendingMigrations(pending: MigrationScript<DB>[]): void {
        this.migrationRenderer.drawPending(pending);
    }

    /**
     * Renders executed migrations after completion.
     *
     * @param executed - Executed migration scripts
     */
    public renderExecutedMigrations(executed: MigrationScript<DB>[]): void {
        this.migrationRenderer.drawExecuted(executed);
    }

    /**
     * Logs message when there are no pending migrations to execute.
     *
     * @param ignoredCount - Number of ignored migrations
     */
    public logNoPendingMigrations(ignoredCount: number): void {
        if (!this.config.dryRun) {
            this.logger.info('Nothing to do');
            return;
        }

        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: 0 migration(s)`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
    }

    /**
     * Logs dry run mode activation message.
     */
    public logDryRunMode(): void {
        if (this.config.dryRun) {
            this.logger.info('🔍 DRY RUN MODE - No changes will be made\n');
        }
    }

    /**
     * Logs dry run completion results.
     *
     * @param pendingCount - Number of pending migrations
     * @param ignoredCount - Number of ignored migrations
     */
    public logDryRunResults(pendingCount: number, ignoredCount: number): void {
        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: ${pendingCount} migration(s)`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
    }

    /**
     * Logs dry run mode activation for version-specific migration.
     *
     * @param targetVersion - Target version for migration
     */
    public logDryRunModeForVersion(targetVersion: number): void {
        if (this.config.dryRun) {
            this.logger.info(`🔍 DRY RUN MODE - No changes will be made (target: ${targetVersion})\n`);
        }
    }

    /**
     * Logs message when already at target version or beyond.
     *
     * @param targetVersion - Target version
     * @param ignoredCount - Number of ignored migrations
     */
    public logNoMigrationsToTarget(targetVersion: number, ignoredCount: number): void {
        if (!this.config.dryRun) {
            this.logger.info(`Already at target version ${targetVersion} or beyond`);
            return;
        }

        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: 0 migration(s) to version ${targetVersion}`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
    }

    /**
     * Logs dry run completion results for version-specific migration.
     *
     * @param pendingCount - Number of pending migrations
     * @param ignoredCount - Number of ignored migrations
     * @param targetVersion - Target version
     */
    public logDryRunResultsForVersion(pendingCount: number, ignoredCount: number, targetVersion: number): void {
        this.logger.info(`\n✓ Dry run completed - no changes made`);
        this.logger.info(`  Would execute: ${pendingCount} migration(s) up to version ${targetVersion}`);
        if (ignoredCount > 0) {
            this.logger.info(`  Would ignore: ${ignoredCount} migration(s)`);
        }
    }

    /**
     * Logs dry run transaction testing start message.
     *
     * @param transactionMode - Transaction mode being tested
     */
    public logDryRunTransactionTesting(transactionMode: string): void {
        this.logger.info(`\n🔍 Testing migrations inside ${transactionMode} transaction(s)...\n`);
    }

    /**
     * Logs dry run transaction testing completion with details.
     *
     * @param executedCount - Number of migrations tested
     * @param transactionMode - Transaction mode tested
     * @param isolationLevel - Transaction isolation level (optional)
     */
    public logDryRunTransactionComplete(executedCount: number, transactionMode: string, isolationLevel?: string): void {
        this.logger.info('\n✓ Dry run completed - all transactions rolled back');
        this.logger.info(`  Tested: ${executedCount} migration(s) inside transactions`);
        this.logger.info(`  Transaction mode: ${transactionMode}`);
        if (isolationLevel) {
            this.logger.info(`  Isolation level: ${isolationLevel}`);
        }
    }

    /**
     * Logs migration completion success message.
     */
    public logMigrationSuccess(): void {
        this.logger.info('Migration finished successfully!');
    }

    /**
     * Logs version-specific migration completion success message.
     *
     * @param targetVersion - Target version achieved
     */
    public logMigrationSuccessForVersion(targetVersion: number): void {
        this.logger.info(`Migration to version ${targetVersion} finished successfully!`);
    }

    /**
     * Logs processing start message.
     */
    public logProcessingStart(): void {
        this.logger.info('Processing...');
    }

    /**
     * Logs migration to version start message.
     *
     * @param targetVersion - Target version
     */
    public logMigrationToVersionStart(targetVersion: number): void {
        this.logger.info(`Migrating to version ${targetVersion}...`);
    }
}
