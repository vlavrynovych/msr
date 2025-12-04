import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IMetricsCollector, IMigrationContext } from '../../interface/IMetricsCollector';
import { MigrationScript } from '../../model/MigrationScript';
import { IMigrationResult } from '../../interface/IMigrationResult';
import { RollbackStrategy } from '../../model/RollbackStrategy';
import { ValidationError } from '../../error/ValidationError';
import { IDB } from '../../interface/dao';

/**
 * Configuration for JsonMetricsCollector.
 */
export interface JsonMetricsCollectorConfig {
    /** Path to output JSON file */
    filePath: string;
    /** Pretty-print JSON with indentation (default: true) */
    pretty?: boolean;
}

/**
 * Collected metrics data structure.
 */
interface MetricsData {
    summary: {
        startTime: string;
        endTime?: string;
        totalDuration?: number;
        migrationsExecuted: number;
        migrationsSucceeded: number;
        migrationsFailed: number;
        success: boolean;
    };
    migrations: Array<{
        name: string;
        timestamp: number;
        startTime: string;
        endTime?: string;
        duration?: number;
        status: 'pending' | 'running' | 'success' | 'failed';
        error?: string;
    }>;
    rollbacks: Array<{
        timestamp: string;
        strategy: RollbackStrategy;
        success: boolean;
        duration?: number;
    }>;
    backups: Array<{
        timestamp: string;
        path: string;
        duration: number;
    }>;
    validationErrors: Array<{
        timestamp: string;
        message: string;
        severity: string;
    }>;
    errors: Array<{
        timestamp: string;
        message: string;
        stack?: string;
    }>;
}

/**
 * Metrics collector that writes structured JSON to a file.
 *
 * Perfect for CI/CD pipelines - parse JSON to generate reports,
 * fail builds if migrations are too slow, track performance over time, etc.
 *
 * **Output Format:**
 * ```json
 * {
 *   "summary": {
 *     "totalDuration": 2453,
 *     "migrationsExecuted": 3,
 *     "migrationsSucceeded": 3,
 *     "migrationsFailed": 0,
 *     "success": true
 *   },
 *   "migrations": [
 *     {
 *       "name": "V1_CreateUsers",
 *       "duration": 823,
 *       "status": "success"
 *     }
 *   ]
 * }
 * ```
 *
 * @example
 * ```typescript
 * const executor = new MigrationScriptExecutor<IDB>({
 *   handler,
 *   metricsCollectors: [
 *     new JsonMetricsCollector({
 *       filePath: './metrics/migrations.json',
 *       pretty: true
 *     })
 *   ]
 * }, config);
 *
 * await executor.up();
 *
 * // Read and parse metrics
 * const metrics = JSON.parse(fs.readFileSync('./metrics/migrations.json', 'utf-8'));
 * console.log(`Total duration: ${metrics.summary.totalDuration}ms`);
 * ```
 */
export class JsonMetricsCollector implements IMetricsCollector {
    private readonly metrics: MetricsData;
    private startTime: number = 0;

    /**
     * Creates a new JsonMetricsCollector.
     *
     * @param config Configuration with file path and formatting options
     */
    constructor(private readonly config: JsonMetricsCollectorConfig) {
        this.metrics = {
            summary: {
                startTime: '',
                migrationsExecuted: 0,
                migrationsSucceeded: 0,
                migrationsFailed: 0,
                success: false
            },
            migrations: [],
            rollbacks: [],
            backups: [],
            validationErrors: [],
            errors: []
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recordMigrationStart(_context: IMigrationContext): void {
        this.startTime = Date.now();
        this.metrics.summary.startTime = new Date().toISOString();
        // Note: Cannot initialize migrations here as we don't have script details
        // They will be added as scripts start executing
    }

    recordScriptStart(script: MigrationScript<IDB>): void {
        // Add migration if not exists (first time seeing it)
        let migration = this.metrics.migrations.find(m => m.name === script.name);
        if (migration) {
            migration.status = 'running';
            migration.startTime = new Date().toISOString();
        } else {
            migration = {
                name: script.name,
                timestamp: script.timestamp,
                startTime: new Date().toISOString(),
                status: 'running'
            };
            this.metrics.migrations.push(migration);
        }
    }

    recordScriptComplete(script: MigrationScript<IDB>, duration: number): void {
        const migration = this.metrics.migrations.find(m => m.name === script.name);
        if (migration) {
            migration.status = 'success';
            migration.endTime = new Date().toISOString();
            migration.duration = duration;
        }
        this.metrics.summary.migrationsSucceeded++;
    }

    recordScriptError(script: MigrationScript<IDB>, error: Error): void {
        const migration = this.metrics.migrations.find(m => m.name === script.name);
        if (migration) {
            migration.status = 'failed';
            migration.endTime = new Date().toISOString();
            migration.error = error.message;
        }
        this.metrics.summary.migrationsFailed++;
    }

    recordMigrationComplete(result: IMigrationResult<IDB>, duration: number): void {
        this.metrics.summary.endTime = new Date().toISOString();
        this.metrics.summary.totalDuration = duration;
        this.metrics.summary.migrationsExecuted = result.executed.length;
        this.metrics.summary.success = result.success;
    }

    recordRollback(strategy: RollbackStrategy, success: boolean, duration?: number): void {
        this.metrics.rollbacks.push({
            timestamp: new Date().toISOString(),
            strategy,
            success,
            duration
        });
    }

    recordValidationErrors(errors: ValidationError<IDB>[]): void {
        errors.forEach(err => {
            this.metrics.validationErrors.push({
                timestamp: new Date().toISOString(),
                message: err.message,
                severity: 'error' // ValidationError doesn't have severity property
            });
        });
    }

    recordBackup(backupPath: string, duration: number): void {
        this.metrics.backups.push({
            timestamp: new Date().toISOString(),
            path: backupPath,
            duration
        });
    }

    recordError(error: Error): void {
        this.metrics.errors.push({
            timestamp: new Date().toISOString(),
            message: error.message,
            stack: error.stack
        });
    }

    /**
     * Write collected metrics to JSON file.
     * Creates parent directories if they don't exist.
     */
    async close(): Promise<void> {
        // Ensure directory exists
        const dir = path.dirname(this.config.filePath);
        await fs.mkdir(dir, { recursive: true });

        // Write JSON
        const json = this.config.pretty === false
            ? JSON.stringify(this.metrics)
            : JSON.stringify(this.metrics, null, 2);

        await fs.writeFile(this.config.filePath, json, 'utf-8');
    }
}
