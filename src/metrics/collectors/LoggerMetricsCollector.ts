import { IMetricsCollector, IMigrationContext } from '../../interface/IMetricsCollector';
import { MigrationScript } from '../../model/MigrationScript';
import { IMigrationResult } from '../../interface/IMigrationResult';
import { RollbackStrategy } from '../../model/RollbackStrategy';
import { ValidationError } from '../../error/ValidationError';
import { IDB } from '../../interface/dao';
import { ILogger } from '../../interface/ILogger';

/**
 * Configuration for LoggerMetricsCollector.
 */
export interface LoggerMetricsCollectorConfig {
    /** Logger instance to use for output */
    logger: ILogger;
    /** Prefix for all metrics messages (default: '[METRICS]') */
    prefix?: string;
}

/**
 * Metrics collector that outputs metrics through an ILogger instance.
 *
 * Integrates with MSR's logging infrastructure, allowing metrics to be
 * sent to any logger implementation (FileLogger, CloudLogger, CompositeLogger, etc.).
 * Respects log levels and provides production-ready metrics collection.
 *
 * **Use this when:**
 * - You need metrics in production environments
 * - You want metrics integrated with existing logging infrastructure
 * - You need to control metrics visibility via log levels
 * - You want metrics sent to files, cloud services, or multiple destinations
 *
 * **Use ConsoleMetricsCollector when:**
 * - You're developing locally and want quick feedback
 * - You want zero configuration metrics output
 * - You don't need log level control
 *
 * @example Basic usage
 * ```typescript
 * const logger = new FileLogger('./logs/metrics.log');
 *
 * const executor = new MigrationScriptExecutor<IDB>({
 *   handler,
 *   metricsCollectors: [
 *     new LoggerMetricsCollector({ logger })
 *   ]
 * }, config);
 *
 * await executor.up();
 * // Metrics written to ./logs/metrics.log
 * ```
 *
 * @example Multiple destinations with CompositeLogger
 * ```typescript
 * const logger = new CompositeLogger([
 *   new FileLogger('./logs/app.log'),
 *   new CloudLogger({ service: 'datadog' })
 * ]);
 *
 * new LoggerMetricsCollector({ logger })
 * // Metrics sent to both file and cloud service
 * ```
 *
 * @example Custom prefix
 * ```typescript
 * new LoggerMetricsCollector({
 *   logger,
 *   prefix: '[PERF]'  // Use custom prefix instead of [METRICS]
 * })
 * ```
 */
export class LoggerMetricsCollector implements IMetricsCollector {
    private scriptStartTimes: Map<string, number> = new Map();
    protected readonly logger: ILogger;
    private readonly prefix: string;

    /**
     * Creates a new LoggerMetricsCollector.
     *
     * @param config Configuration with logger and optional prefix
     */
    constructor(config: LoggerMetricsCollectorConfig) {
        this.logger = config.logger;
        this.prefix = config.prefix || '[METRICS]';
    }

    recordMigrationStart(context: IMigrationContext): void {
        this.logger.info(
            `${this.prefix} Migration started - ${context.pending} pending scripts, ` +
            `${context.executed} already executed`
        );
    }

    recordScriptStart(script: MigrationScript<IDB>): void {
        this.scriptStartTimes.set(script.name, Date.now());
        this.logger.info(`${this.prefix} ${script.name} started`);
    }

    recordScriptComplete(script: MigrationScript<IDB>, duration: number): void {
        this.scriptStartTimes.delete(script.name);
        this.logger.info(`${this.prefix} ${script.name} completed in ${duration}ms`);
    }

    recordScriptError(script: MigrationScript<IDB>, error: Error): void {
        this.scriptStartTimes.delete(script.name);
        this.logger.error(`${this.prefix} ${script.name} failed: ${error.message}`);
    }

    recordMigrationComplete(result: IMigrationResult<IDB>, duration: number): void {
        const status = result.success ? 'success' : 'failed';
        const executedCount = result.executed.length;
        const failedCount = result.errors?.length || 0;

        if (result.success) {
            this.logger.info(
                `${this.prefix} Migration completed - ${executedCount} scripts in ${duration}ms (${status})`
            );
        } else {
            this.logger.error(
                `${this.prefix} Migration failed - ${executedCount} succeeded, ${failedCount} failed in ${duration}ms`
            );
        }
    }

    recordRollback(strategy: RollbackStrategy, success: boolean, duration?: number): void {
        const durationStr = duration !== undefined ? ` in ${duration}ms` : '';
        const status = success ? 'succeeded' : 'failed';
        this.logger.info(`${this.prefix} Rollback (${strategy}) ${status}${durationStr}`);
    }

    recordValidationErrors(errors: ValidationError<IDB>[]): void {
        this.logger.warn(`${this.prefix} Validation errors: ${errors.length} issues found`);
        errors.forEach(err => {
            this.logger.warn(`${this.prefix}   - ${err.message}`);
        });
    }

    recordBackup(backupPath: string, duration: number): void {
        this.logger.info(`${this.prefix} Backup created in ${duration}ms: ${backupPath}`);
    }

    recordError(error: Error): void {
        this.logger.error(`${this.prefix} Error: ${error.message}`);
    }

    close(): void {
        // Log any scripts that were started but never completed (shouldn't happen)
        if (this.scriptStartTimes.size > 0) {
            this.logger.warn(
                `${this.prefix} Warning: ${this.scriptStartTimes.size} scripts never completed`
            );
            this.scriptStartTimes.forEach((startTime, scriptName) => {
                const duration = Date.now() - startTime;
                this.logger.warn(`${this.prefix}   - ${scriptName} (running for ${duration}ms)`);
            });
        }
    }
}
