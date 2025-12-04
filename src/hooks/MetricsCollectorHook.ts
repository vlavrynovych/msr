import { IMigrationHooks } from '../interface/IMigrationHooks';
import { IMetricsCollector, IMigrationContext } from '../interface/IMetricsCollector';
import { MigrationScript } from '../model/MigrationScript';
import { IMigrationResult } from '../interface/IMigrationResult';
import { ILogger } from '../interface/ILogger';
import { IDB } from '../interface/dao';

/**
 * Hook implementation that delegates to multiple IMetricsCollector instances.
 *
 * Translates hook lifecycle events into metrics collection calls.
 * Supports multiple collectors simultaneously (e.g., Prometheus + DataDog + Console).
 *
 * **Error Handling:**
 * Collector failures are logged but don't break migrations. If a metrics collector
 * throws an error, it's caught, logged, and execution continues.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const hook = new MetricsCollectorHook<IDB>([
 *   new ConsoleMetricsCollector(),
 *   new JsonMetricsCollector({ filePath: './metrics.json' })
 * ], logger);
 *
 * const executor = new MigrationScriptExecutor<IDB>({
 *   handler,
 *   hooks: hook
 * }, config);
 * ```
 */
export class MetricsCollectorHook<DB extends IDB = IDB> implements IMigrationHooks<DB> {
    private startTime: number = 0;
    private context: IMigrationContext | null = null;
    private backupStartTime: number = 0;

    /**
     * Creates a new MetricsCollectorHook.
     *
     * @param collectors Array of metrics collectors to delegate to
     * @param logger Optional logger for error reporting
     */
    constructor(
        private collectors: IMetricsCollector[],
        private logger?: ILogger
    ) {}

    /**
     * Called at the start of migration execution.
     * Records migration start and builds context.
     */
    async onStart(total: number, pending: number): Promise<void> {
        this.startTime = Date.now();
        this.context = {
            total,
            pending,
            executed: total - pending,
            startTime: this.startTime
        };

        await this.callCollectors(
            collector => collector.recordMigrationStart?.(this.context!),
            'recordMigrationStart'
        );
    }

    /**
     * Called when migration execution completes (success or failure).
     * Records completion and calls close() on all collectors.
     */
    async onComplete(result: IMigrationResult<DB>): Promise<void> {
        const duration = Date.now() - this.startTime;

        await this.callCollectors(
            collector => collector.recordMigrationComplete?.(result, duration),
            'recordMigrationComplete'
        );

        // Cleanup all collectors
        await this.callCollectors(
            collector => collector.close?.(),
            'close'
        );
    }

    /**
     * Called before each migration script execution.
     * Records script start.
     */
    async onBeforeMigrate(script: MigrationScript<DB>): Promise<void> {
        await this.callCollectors(
            collector => collector.recordScriptStart?.(script),
            'recordScriptStart'
        );
    }

    /**
     * Called after successful migration script execution.
     * Records script completion with duration calculated from script timing.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onAfterMigrate(script: MigrationScript<DB>, _result: string): Promise<void> {
        // Calculate duration from script timing info
        const duration = script.finishedAt && script.startedAt
            ? script.finishedAt - script.startedAt
            : 0;

        await this.callCollectors(
            collector => collector.recordScriptComplete?.(script, duration),
            'recordScriptComplete'
        );
    }

    /**
     * Called when a migration script fails.
     * Records script error.
     */
    async onMigrationError(script: MigrationScript<DB>, error: Error): Promise<void> {
        await this.callCollectors(
            collector => collector.recordScriptError?.(script, error),
            'recordScriptError'
        );
    }

    /**
     * Called when a general error occurs during migration.
     * Records general error.
     */
    async onError(error: Error): Promise<void> {
        await this.callCollectors(
            collector => collector.recordError?.(error),
            'recordError'
        );
    }

    /**
     * Called before backup creation.
     * Track start time for duration calculation.
     */
    async onBeforeBackup(): Promise<void> {
        this.backupStartTime = Date.now();
    }

    /**
     * Called after backup creation.
     * Records backup operation with calculated duration.
     */
    async onAfterBackup(backupPath: string): Promise<void> {
        const duration = Date.now() - this.backupStartTime;

        await this.callCollectors(
            collector => collector.recordBackup?.(backupPath, duration),
            'recordBackup'
        );
    }

    /**
     * Call all collectors in parallel with error handling.
     *
     * Collector failures are logged but don't break migrations.
     * Uses Promise.allSettled to ensure all collectors are called even if some fail.
     *
     * @param fn Function to call on each collector
     * @param methodName Method name for error logging
     */
    private async callCollectors(
        fn: (collector: IMetricsCollector) => void | Promise<void>,
        methodName: string
    ): Promise<void> {
        const results = await Promise.allSettled(
            this.collectors.map(async (collector) => {
                try {
                    await fn(collector);
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.logger?.warn(
                        `Metrics collector ${collector.constructor.name}.${methodName}() failed: ${errorMessage}`
                    );
                    throw error; // Re-throw for Promise.allSettled to capture
                }
            })
        );

        // Log summary if any collectors failed
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0 && this.logger) {
            this.logger.warn(
                `${failed.length}/${this.collectors.length} metrics collectors failed in ${methodName}()`
            );
        }
    }
}
