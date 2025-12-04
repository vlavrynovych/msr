import { LoggerMetricsCollector } from './LoggerMetricsCollector';
import { ConsoleLogger } from '../../logger/ConsoleLogger';

/**
 * Metrics collector that outputs metrics to console.
 *
 * Convenience wrapper around LoggerMetricsCollector that uses ConsoleLogger.
 * Useful for development and debugging. Provides real-time feedback
 * during migration execution with timing information.
 *
 * This is a zero-configuration collector - just instantiate and use.
 * For production environments or integration with existing logging infrastructure,
 * consider using LoggerMetricsCollector with a custom logger.
 *
 * @example
 * ```typescript
 * const executor = new MigrationScriptExecutor<IDB>({
 *   handler,
 *   metricsCollectors: [new ConsoleMetricsCollector()]
 * }, config);
 *
 * // Output:
 * // [METRICS] Migration started - 3 pending scripts
 * // [METRICS] V1_CreateUsers started
 * // [METRICS] V1_CreateUsers completed in 823ms
 * // [METRICS] Migration completed - 3 scripts in 2450ms (success)
 * ```
 *
 * @example For production, use LoggerMetricsCollector instead
 * ```typescript
 * // Production-ready with file logging
 * const logger = new FileLogger('./logs/metrics.log');
 * new LoggerMetricsCollector({ logger })
 *
 * // Or with cloud logging
 * const logger = new CloudLogger({ service: 'datadog' });
 * new LoggerMetricsCollector({ logger })
 * ```
 */
export class ConsoleMetricsCollector extends LoggerMetricsCollector {
    /**
     * Creates a new ConsoleMetricsCollector.
     *
     * Uses ConsoleLogger internally to output metrics to console.
     */
    constructor() {
        super({
            logger: new ConsoleLogger(),
            prefix: '[METRICS]'
        });
    }
}
