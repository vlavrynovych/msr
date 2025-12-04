import * as fs from 'fs/promises';
import * as path from 'path';
import { IMetricsCollector } from '../../interface/IMetricsCollector';
import { MigrationScript } from '../../model/MigrationScript';
import { IDB } from '../../interface/dao';

/**
 * Configuration for CsvMetricsCollector.
 */
export interface CsvMetricsCollectorConfig {
    /** Path to output CSV file */
    filePath: string;
    /** Include CSV header row (default: true) */
    includeHeader?: boolean;
    /** CSV delimiter (default: ',') */
    delimiter?: string;
}

/**
 * CSV row data for a migration script.
 */
interface CsvRow {
    timestamp: string;
    migration: string;
    migrationTimestamp: number;
    durationMs: number | null;
    status: 'success' | 'failed';
    error: string;
}

/**
 * Metrics collector that writes data to CSV format.
 *
 * Perfect for analysis in Excel, Google Sheets, or data visualization tools.
 * Track migration performance trends over time, identify slow migrations,
 * generate charts and reports.
 *
 * **CSV Format:**
 * ```csv
 * timestamp,migration,migrationTimestamp,durationMs,status,error
 * 2025-01-15T10:30:00Z,V1_CreateUsers,1705315800000,823,success,
 * 2025-01-15T10:30:01Z,V2_AddEmail,1705315801000,645,success,
 * 2025-01-15T10:30:02Z,V3_AddIndex,1705315802000,,failed,Index already exists
 * ```
 *
 * @example
 * ```typescript
 * const executor = new MigrationScriptExecutor<IDB>({
 *   handler,
 *   metricsCollectors: [
 *     new CsvMetricsCollector({
 *       filePath: './metrics/migrations.csv',
 *       includeHeader: true
 *     })
 *   ]
 * }, config);
 *
 * await executor.up();
 *
 * // Open in Excel or Google Sheets for analysis
 * // Create pivot tables, charts, performance reports
 * ```
 *
 * @example Append to existing CSV file
 * ```typescript
 * // Set includeHeader: false to append without header
 * new CsvMetricsCollector({
 *   filePath: './metrics/history.csv',
 *   includeHeader: false  // Append rows only
 * })
 * ```
 */
export class CsvMetricsCollector implements IMetricsCollector {
    private readonly rows: CsvRow[] = [];
    private readonly delimiter: string;
    private readonly includeHeader: boolean;

    /**
     * Creates a new CsvMetricsCollector.
     *
     * @param config Configuration with file path and CSV options
     */
    constructor(private readonly config: CsvMetricsCollectorConfig) {
        this.delimiter = config.delimiter || ',';
        this.includeHeader = config.includeHeader !== false;
    }

    recordScriptComplete(script: MigrationScript<IDB>, duration: number): void {
        this.rows.push({
            timestamp: new Date().toISOString(),
            migration: script.name,
            migrationTimestamp: script.timestamp,
            durationMs: duration,
            status: 'success',
            error: ''
        });
    }

    recordScriptError(script: MigrationScript<IDB>, error: Error): void {
        this.rows.push({
            timestamp: new Date().toISOString(),
            migration: script.name,
            migrationTimestamp: script.timestamp,
            durationMs: null,
            status: 'failed',
            error: this.escapeCsvValue(error.message)
        });
    }

    /**
     * Write collected metrics to CSV file.
     * Creates parent directories if they don't exist.
     * Appends to file if includeHeader is false and file exists.
     */
    async close(): Promise<void> {
        if (this.rows.length === 0) {
            return; // Nothing to write
        }

        // Ensure directory exists
        const dir = path.dirname(this.config.filePath);
        await fs.mkdir(dir, { recursive: true });

        const lines: string[] = [];

        // Add header if requested
        if (this.includeHeader) {
            const header = ['timestamp', 'migration', 'migrationTimestamp', 'durationMs', 'status', 'error']
                .join(this.delimiter);
            lines.push(header);
        }

        // Add data rows
        this.rows.forEach(row => {
            const values = [
                row.timestamp,
                row.migration,
                row.migrationTimestamp.toString(),
                row.durationMs !== null ? row.durationMs.toString() : '',
                row.status,
                row.error
            ];
            lines.push(values.join(this.delimiter));
        });

        // Write or append to file
        const content = lines.join('\n') + '\n';

        if (this.includeHeader) {
            // Overwrite file (header included)
            await fs.writeFile(this.config.filePath, content, 'utf-8');
        } else {
            // Append to file (no header) - but add header if file doesn't exist
            const fileExists = await this.checkFileExists(this.config.filePath);

            if (fileExists) {
                // File exists, append without header
                await fs.appendFile(this.config.filePath, content, 'utf-8');
            } else {
                // File doesn't exist, create with header
                const header = ['timestamp', 'migration', 'migrationTimestamp', 'durationMs', 'status', 'error']
                    .join(this.delimiter);
                await fs.writeFile(this.config.filePath, header + '\n' + content, 'utf-8');
            }
        }
    }

    /**
     * Check if a file exists.
     * @param filePath Path to check
     * @returns true if file exists, false otherwise
     */
    private async checkFileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Escape CSV values that contain delimiter, quotes, or newlines.
     * Wraps value in quotes and escapes internal quotes.
     */
    private escapeCsvValue(value: string): string {
        // If value contains delimiter, quotes, or newlines, wrap in quotes
        if (value.includes(this.delimiter) || value.includes('"') || value.includes('\n')) {
            // Escape internal quotes by doubling them
            const escaped = value.replace(/"/g, '""');
            return `"${escaped}"`;
        }
        return value;
    }
}
