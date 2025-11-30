import {IMigrationHooks} from '../interface/IMigrationHooks';
import {MigrationScript} from '../model/MigrationScript';
import {IMigrationResult} from '../interface/IMigrationResult';
import {ExecutionSummaryLogger} from '../service/ExecutionSummaryLogger';
import {Config} from '../model/Config';
import {ILogger} from '../interface/ILogger';

/**
 * Hook implementation that logs detailed execution summaries.
 *
 * Automatically tracks migration executions, errors, backups, and rollbacks,
 * saving detailed summaries to files based on configuration.
 *
 * This hook is automatically added to MigrationScriptExecutor when
 * `config.logging.enabled` is true.
 *
 * @example
 * ```typescript
 * // Automatically enabled via config
 * const config = new Config();
 * config.logging.enabled = true;
 * const executor = new MigrationScriptExecutor(handler, config);
 * // Summary logging happens automatically
 * ```
 *
 * @example
 * ```typescript
 * // Manual usage with CompositeHooks
 * const summaryHook = new ExecutionSummaryHook(config, logger, 'PostgreSQL');
 * const customHooks = new CompositeHooks([summaryHook, myCustomHook]);
 * const executor = new MigrationScriptExecutor(handler, config, {
 *     hooks: customHooks
 * });
 * ```
 */
export class ExecutionSummaryHook implements IMigrationHooks {
    private summaryLogger: ExecutionSummaryLogger;
    private startTime: number = 0;
    private migrationStartTimes: Map<string, number> = new Map();

    constructor(
        config: Config,
        logger: ILogger,
        handlerName: string
    ) {
        this.summaryLogger = new ExecutionSummaryLogger(config, logger, handlerName);
    }

    /**
     * Called when migration run starts.
     * Initializes summary tracking.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onStart(_totalMigrations: number, _pendingCount: number): Promise<void> {
        this.startTime = Date.now();
        this.summaryLogger.startRun();
    }

    /**
     * Called before a backup is created.
     */
    async onBeforeBackup?(): Promise<void> {
        // Nothing to do here
    }

    /**
     * Called after a backup is created.
     * Records backup information in summary.
     */
    async onAfterBackup?(backupPath: string): Promise<void> {
        this.summaryLogger.recordBackup(backupPath);
    }

    /**
     * Called before each migration executes.
     * Records migration start time.
     */
    async onBeforeMigrate(script: MigrationScript): Promise<void> {
        this.summaryLogger.recordMigrationStart(script.name, script.timestamp);
        this.migrationStartTimes.set(script.name, Date.now());
    }

    /**
     * Called after each migration executes successfully.
     * Records migration success with duration.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onAfterMigrate(script: MigrationScript, _result: string): Promise<void> {
        const startTime = this.migrationStartTimes.get(script.name) || Date.now();
        const duration = Date.now() - startTime;
        this.summaryLogger.recordMigrationSuccess(script.name, script.timestamp, duration);
        this.migrationStartTimes.delete(script.name);
    }

    /**
     * Called when a migration fails.
     * Records migration failure with error details.
     */
    async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
        this.summaryLogger.recordMigrationFailure(script.name, script.timestamp, error);
        this.migrationStartTimes.delete(script.name);
    }

    /**
     * Called when migration run completes successfully.
     * Saves execution summary to file.
     */
    async onComplete(result: IMigrationResult): Promise<void> {
        const totalDuration = Date.now() - this.startTime;
        await this.summaryLogger.saveSummary(
            result.success,
            result.executed.length,
            0,
            totalDuration
        );
    }

    /**
     * Called when migration run fails.
     * Records rollback and saves failure summary.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onError(_error: Error): Promise<void> {
        // Note: Rollback information is recorded separately via onBeforeRollback/onAfterRollback
        // Here we just save the summary
        const totalDuration = Date.now() - this.startTime;
        // We don't have direct access to executed count here, so we save with 0,1
        // The actual migration details are already recorded via onBeforeMigrate/onMigrationError
        await this.summaryLogger.saveSummary(false, 0, 1, totalDuration);
    }
}
