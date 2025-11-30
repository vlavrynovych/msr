import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    IExecutionSummary,
    IMigrationExecutionDetail,
    IConfigSnapshot,
    MigrationExecutionStatus,
    SummaryFormat
} from '../interface/logging/IExecutionSummary';
import {Config} from '../model/Config';
import {ILogger} from '../interface/ILogger';
import {IDatabaseMigrationHandler} from '../interface/IDatabaseMigrationHandler';

/**
 * Service for logging detailed execution summaries to files.
 *
 * Captures complete trace of migration runs including:
 * - Migration executions with timing
 * - Errors and stack traces
 * - Backup and rollback actions
 * - Configuration and environment details
 *
 * Supports JSON and text output formats with automatic file rotation.
 *
 * @example
 * ```typescript
 * const logger = new ExecutionSummaryLogger(config, consoleLogger, handler);
 *
 * // Start tracking
 * logger.startRun();
 *
 * // Record migrations
 * logger.recordMigrationStart('V202501010001_create_users', 202501010001);
 * // ... migration executes ...
 * logger.recordMigrationSuccess('V202501010001_create_users', 202501010001, 1000);
 *
 * // Record backup
 * logger.recordBackup('/backups/backup.bkp', 1024000);
 *
 * // Save summary
 * await logger.saveSummary(true, 1, 0, 1000);
 * ```
 */
export class ExecutionSummaryLogger {
    private summary: IExecutionSummary;
    private migrationDetails: Map<string, IMigrationExecutionDetail>;
    private runStartTime: Date;
    private msrVersion: string;

    constructor(
        private readonly config: Config,
        private readonly logger: ILogger,
        private readonly handler: IDatabaseMigrationHandler
    ) {
        this.migrationDetails = new Map();
        this.runStartTime = new Date();
        this.msrVersion = this.getMsrVersion();
        this.summary = this.createEmptySummary();
    }

    /**
     * Initialize a new execution summary run.
     * Call this at the start of migration execution.
     */
    startRun(): void {
        this.runStartTime = new Date();
        this.summary = this.createEmptySummary();
        this.migrationDetails.clear();
    }

    /**
     * Record the start of a migration execution.
     *
     * @param name - Migration name
     * @param timestamp - Migration timestamp
     */
    recordMigrationStart(name: string, timestamp: number): void {
        const detail: IMigrationExecutionDetail = {
            name,
            timestamp,
            startTime: new Date().toISOString(),
            endTime: '',
            duration: 0,
            status: MigrationExecutionStatus.SUCCESS
        };
        this.migrationDetails.set(name, detail);
    }

    /**
     * Record successful migration execution.
     *
     * @param name - Migration name
     * @param timestamp - Migration timestamp
     * @param duration - Execution duration in milliseconds
     */
    recordMigrationSuccess(name: string, timestamp: number, duration: number): void {
        const detail = this.migrationDetails.get(name);
        if (detail) {
            detail.endTime = new Date().toISOString();
            detail.duration = duration;
            detail.status = MigrationExecutionStatus.SUCCESS;
        }
    }

    /**
     * Record failed migration execution.
     *
     * @param name - Migration name
     * @param timestamp - Migration timestamp
     * @param error - Error that occurred
     */
    recordMigrationFailure(name: string, timestamp: number, error: Error): void {
        const detail = this.migrationDetails.get(name);
        if (detail) {
            detail.endTime = new Date().toISOString();
            detail.duration = new Date().getTime() - new Date(detail.startTime).getTime();
            detail.status = MigrationExecutionStatus.FAILED;
            detail.error = error.message;
            detail.stackTrace = error.stack;
        }
    }

    /**
     * Record that a migration was rolled back.
     *
     * @param name - Migration name
     */
    recordMigrationRollback(name: string): void {
        const detail = this.migrationDetails.get(name);
        if (detail) {
            detail.status = MigrationExecutionStatus.ROLLED_BACK;
        }
    }

    /**
     * Record backup creation.
     *
     * @param backupPath - Path to backup file
     * @param size - Backup file size in bytes (optional)
     */
    recordBackup(backupPath: string, size?: number): void {
        this.summary.backup = {
            created: true,
            path: backupPath,
            size
        };
    }

    /**
     * Record rollback action.
     *
     * @param strategy - Rollback strategy used
     * @param success - Whether rollback was successful
     * @param error - Error message if rollback failed
     */
    recordRollback(strategy: string, success: boolean, error?: string): void {
        this.summary.rollback = {
            triggered: true,
            strategy,
            success,
            error
        };
    }

    /**
     * Save the execution summary to file(s).
     *
     * @param success - Overall success status
     * @param executed - Number of migrations executed
     * @param failed - Number of migrations failed
     * @param totalDuration - Total execution duration in milliseconds
     */
    async saveSummary(
        success: boolean,
        executed: number,
        failed: number,
        totalDuration: number
    ): Promise<void> {
        const loggingConfig = this.config.logging;

        // Check if logging is enabled
        if (!loggingConfig.enabled) {
            return;
        }

        // Check if we should log successful runs
        if (success && !loggingConfig.logSuccessful) {
            return;
        }

        // Finalize summary
        this.summary.migrations = Array.from(this.migrationDetails.values());
        this.summary.result = {
            success,
            executed,
            failed,
            totalDuration
        };

        // Ensure log directory exists
        const logDir = loggingConfig.path || './logs/migrations';
        this.ensureDirectoryExists(logDir);

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const status = success ? 'success' : 'failed';
        const baseFilename = `migration-${status}-${timestamp}`;

        // Save in requested format(s)
        const format = loggingConfig.format || SummaryFormat.JSON;

        if (format === SummaryFormat.JSON || format === SummaryFormat.BOTH) {
            const jsonPath = path.join(logDir, `${baseFilename}.json`);
            await this.saveJsonSummary(jsonPath);
        }

        if (format === SummaryFormat.TEXT || format === SummaryFormat.BOTH) {
            const textPath = path.join(logDir, `${baseFilename}.txt`);
            await this.saveTextSummary(textPath);
        }

        // Perform file rotation if configured
        const maxFiles = loggingConfig.maxFiles || 0;
        if (maxFiles > 0) {
            await this.rotateSummaryFiles(logDir, maxFiles);
        }
    }

    /**
     * Get MSR Core version from package.json
     */
    private getMsrVersion(): string {
        try {
            // Using require here to dynamically load package.json at runtime
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const pkg = require('../../package.json');
            return pkg.version;
        } catch (error) {
            this.logger.warn('Could not read MSR version from package.json');
            return '0.0.0';
        }
    }

    /**
     * Create an empty execution summary with initial values.
     */
    private createEmptySummary(): IExecutionSummary {
        return {
            timestamp: this.runStartTime.toISOString(),
            msrVersion: this.msrVersion,
            adapterVersion: this.handler.getVersion(),
            handler: this.handler.getName(),
            config: this.createConfigSnapshot(),
            migrations: [],
            result: {
                success: false,
                executed: 0,
                failed: 0,
                totalDuration: 0
            }
        };
    }

    /**
     * Create a snapshot of the current configuration.
     */
    private createConfigSnapshot(): IConfigSnapshot {
        return {
            folder: this.config.folder,
            rollbackStrategy: this.config.rollbackStrategy,
            backupMode: this.config.backupMode,
            dryRun: this.config.dryRun,
            validateBeforeRun: this.config.validateBeforeRun
        };
    }

    /**
     * Ensure directory exists, create if it doesn't.
     */
    private ensureDirectoryExists(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Save summary in JSON format.
     */
    private async saveJsonSummary(filePath: string): Promise<void> {
        const json = JSON.stringify(this.summary, null, 2);
        fs.writeFileSync(filePath, json, 'utf-8');
        this.logger.info(`Execution summary saved: ${filePath}`);
    }

    /**
     * Save summary in human-readable text format.
     */
    private async saveTextSummary(filePath: string): Promise<void> {
        const lines: string[] = [];

        this.addHeaderSection(lines);
        this.addConfigSection(lines);
        this.addMigrationsSection(lines);
        this.addBackupSection(lines);
        this.addRollbackSection(lines);
        this.addResultSection(lines);

        const text = lines.join('\n');
        fs.writeFileSync(filePath, text, 'utf-8');
        this.logger.info(`Execution summary saved: ${filePath}`);
    }

    private addHeaderSection(lines: string[]): void {
        lines.push(
            '='.repeat(80),
            'MIGRATION EXECUTION SUMMARY',
            '='.repeat(80),
            '',
            `Timestamp:       ${this.summary.timestamp}`,
            `MSR Version:     ${this.summary.msrVersion}`,
            `Adapter Version: ${this.summary.adapterVersion}`,
            `Handler:         ${this.summary.handler}`,
            `Status:          ${this.summary.result.success ? 'SUCCESS' : 'FAILED'}`,
            ''
        );
    }

    private addConfigSection(lines: string[]): void {
        lines.push(
            '-'.repeat(80),
            'CONFIGURATION',
            '-'.repeat(80),
            `Folder:              ${this.summary.config.folder}`,
            `Rollback Strategy:   ${this.summary.config.rollbackStrategy}`,
            `Backup Mode:         ${this.summary.config.backupMode}`,
            `Dry Run:             ${this.summary.config.dryRun}`,
            `Validate Before Run: ${this.summary.config.validateBeforeRun}`,
            ''
        );
    }

    private addMigrationsSection(lines: string[]): void {
        if (this.summary.migrations.length === 0) return;

        lines.push(
            '-'.repeat(80),
            'MIGRATIONS EXECUTED',
            '-'.repeat(80)
        );

        for (const migration of this.summary.migrations) {
            this.addMigrationDetails(lines, migration);
        }
        lines.push('');
    }

    private addMigrationDetails(lines: string[], migration: any): void {
        lines.push(
            '',
            `Name:      ${migration.name}`,
            `Timestamp: ${migration.timestamp}`,
            `Status:    ${migration.status}`,
            `Duration:  ${migration.duration}ms`,
            `Started:   ${migration.startTime}`,
            `Ended:     ${migration.endTime}`
        );

        if (migration.error) {
            lines.push(`Error:     ${migration.error}`);
            if (migration.stackTrace) {
                lines.push('Stack Trace:', migration.stackTrace);
            }
        }
    }

    private addBackupSection(lines: string[]): void {
        if (!this.summary.backup) return;

        lines.push(
            '-'.repeat(80),
            'BACKUP',
            '-'.repeat(80),
            `Created: ${this.summary.backup.created}`
        );
        if (this.summary.backup.path) {
            lines.push(`Path:    ${this.summary.backup.path}`);
        }
        if (this.summary.backup.size) {
            lines.push(`Size:    ${this.summary.backup.size} bytes`);
        }
        lines.push('');
    }

    private addRollbackSection(lines: string[]): void {
        if (!this.summary.rollback) return;

        lines.push(
            '-'.repeat(80),
            'ROLLBACK',
            '-'.repeat(80),
            `Triggered: ${this.summary.rollback.triggered}`
        );
        if (this.summary.rollback.strategy) {
            lines.push(`Strategy:  ${this.summary.rollback.strategy}`);
        }
        if (this.summary.rollback.success !== undefined) {
            lines.push(`Success:   ${this.summary.rollback.success}`);
        }
        if (this.summary.rollback.error) {
            lines.push(`Error:     ${this.summary.rollback.error}`);
        }
        lines.push('');
    }

    private addResultSection(lines: string[]): void {
        lines.push(
            '-'.repeat(80),
            'RESULT',
            '-'.repeat(80),
            `Success:        ${this.summary.result.success}`,
            `Executed:       ${this.summary.result.executed}`,
            `Failed:         ${this.summary.result.failed}`,
            `Total Duration: ${this.summary.result.totalDuration}ms`,
            '',
            '='.repeat(80)
        );
    }

    /**
     * Rotate summary files, keeping only the most recent N files.
     *
     * @param logDir - Log directory path
     * @param maxFiles - Maximum number of files to keep
     */
    private async rotateSummaryFiles(logDir: string, maxFiles: number): Promise<void> {
        try {
            const files = fs.readdirSync(logDir);
            const summaryFiles = files
                .filter(f => f.startsWith('migration-') && (f.endsWith('.json') || f.endsWith('.txt')))
                .map(f => ({
                    name: f,
                    path: path.join(logDir, f),
                    mtime: fs.statSync(path.join(logDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

            // Delete oldest files beyond maxFiles limit
            if (summaryFiles.length > maxFiles) {
                const filesToDelete = summaryFiles.slice(maxFiles);
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                    this.logger.debug(`Deleted old summary file: ${file.name}`);
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to rotate summary files: ${(error as Error).message}`);
        }
    }
}
