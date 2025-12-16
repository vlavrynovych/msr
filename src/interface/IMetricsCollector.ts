import { MigrationScript } from '../model/MigrationScript';
import { IMigrationResult } from './IMigrationResult';
import { RollbackStrategy } from '../model/RollbackStrategy';
import { ValidationError } from '../error/ValidationError';
import { IDB } from './dao';

/**
 * Context provided at the start of migration execution.
 */
export interface IMigrationContext {
    /** Total number of migrations discovered */
    total: number;
    /** Number of pending migrations to be executed */
    pending: number;
    /** Number of already executed migrations */
    executed: number;
    /** Start timestamp */
    startTime: number;
}

/**
 * Interface for collecting metrics during migration execution.
 *
 * Implementations can send metrics to various backends:
 * - ConsoleMetricsCollector - console output for development/debugging
 * - JsonMetricsCollector - structured JSON format for CI/CD
 * - CsvMetricsCollector - CSV format for analysis in Excel/Sheets
 * - DataDogCollector - DataDog APM for monitoring
 * - CloudWatchCollector - AWS CloudWatch metrics
 *
 * All methods are optional - implement only what you need.
 * Failures in metrics collection do not break migrations.
 *
 * @example
 * ```typescript
 * class CustomMetricsCollector implements IMetricsCollector {
 *   recordScriptComplete(script: IMigrationScript, duration: number): void {
 *     console.log(`Migration ${script.name} took ${duration}ms`);
 *   }
 * }
 *
 * const executor = new MigrationScriptExecutor<IDB>({
 *   handler,
 *   metricsCollectors: [new CustomMetricsCollector()]
 * }, config);
 * ```
 */
export interface IMetricsCollector {
    /**
     * Record the start of entire migration process.
     *
     * @param context Migration context with pending/executed scripts
     */
    recordMigrationStart?(context: IMigrationContext): void | Promise<void>;

    /**
     * Record the completion of entire migration process.
     *
     * @param result Migration result with executed scripts and status
     * @param duration Total duration in milliseconds
     */
    recordMigrationComplete?(result: IMigrationResult<IDB>, duration: number): void | Promise<void>;

    /**
     * Record the start of individual migration script.
     *
     * @param script Migration script being executed
     */
    recordScriptStart?(script: MigrationScript<IDB>): void | Promise<void>;

    /**
     * Record successful completion of individual migration script.
     *
     * @param script Migration script that completed
     * @param duration Script execution duration in milliseconds
     */
    recordScriptComplete?(script: MigrationScript<IDB>, duration: number): void | Promise<void>;

    /**
     * Record migration script error.
     *
     * @param script Migration script that failed
     * @param error Error that occurred
     */
    recordScriptError?(script: MigrationScript<IDB>, error: Error): void | Promise<void>;

    /**
     * Record rollback attempt.
     *
     * @param strategy Rollback strategy used (BACKUP, DOWN, BOTH, NONE)
     * @param success Whether rollback succeeded
     * @param duration Rollback duration in milliseconds (if available)
     */
    recordRollback?(strategy: RollbackStrategy, success: boolean, duration?: number): void | Promise<void>;

    /**
     * Record validation errors discovered during pre-execution validation.
     *
     * @param errors List of validation errors
     */
    recordValidationErrors?(errors: ValidationError<IDB>[]): void | Promise<void>;

    /**
     * Record backup operation.
     *
     * @param backupPath Path to created backup file
     * @param duration Backup operation duration in milliseconds
     */
    recordBackup?(backupPath: string, duration: number): void | Promise<void>;

    /**
     * Record general error during migration process.
     *
     * @param error Error that occurred
     */
    recordError?(error: Error): void | Promise<void>;

    /**
     * Optional cleanup/flush when execution completes.
     * Called after migration completes (success or failure).
     * Use this to flush buffered metrics, close connections, write files, etc.
     */
    close?(): void | Promise<void>;
}
