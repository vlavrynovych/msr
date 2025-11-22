import fs from 'fs';
import path from 'path';
import { ILogger } from '../interface';

/**
 * Configuration options for FileLogger.
 */
export interface FileLoggerConfig {
    /**
     * Path to the log file.
     * @default './logs/migration.log'
     */
    logPath?: string;

    /**
     * Maximum file size in bytes before rotation.
     * @default 10485760 (10MB)
     */
    maxFileSize?: number;

    /**
     * Maximum number of rotated log files to keep.
     * @default 5
     */
    maxFiles?: number;

    /**
     * Whether to include timestamps in log messages.
     * @default true
     */
    includeTimestamp?: boolean;

    /**
     * Date format for timestamps (moment.js format).
     * @default 'YYYY-MM-DD HH:mm:ss.SSS'
     */
    timestampFormat?: string;
}

/**
 * File-based logger implementation with automatic log rotation.
 *
 * Writes all log messages to a file with configurable rotation based on file size.
 * When the log file reaches the maximum size, it's rotated and a new file is created.
 *
 * **Features:**
 * - Automatic log rotation based on file size
 * - Configurable number of backup files
 * - Timestamp support with custom formats
 * - Automatic directory creation
 * - Synchronous writes for reliability
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const logger = new FileLogger();
 * logger.info('Migration started');
 *
 * // Custom configuration
 * const logger = new FileLogger({
 *   logPath: '/var/log/migrations.log',
 *   maxFileSize: 5 * 1024 * 1024, // 5MB
 *   maxFiles: 10,
 *   includeTimestamp: true
 * });
 * ```
 */
export class FileLogger implements ILogger {
    private readonly logPath: string;
    private readonly maxFileSize: number;
    private readonly maxFiles: number;
    private readonly includeTimestamp: boolean;
    private readonly timestampFormat: string;

    /**
     * Creates a new FileLogger instance.
     *
     * @param config - Configuration options for the logger
     */
    constructor(config: FileLoggerConfig = {}) {
        this.logPath = config.logPath || './logs/migration.log';
        this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB default
        this.maxFiles = config.maxFiles || 5;
        this.includeTimestamp = config.includeTimestamp !== false; // default true
        this.timestampFormat = config.timestampFormat || 'YYYY-MM-DD HH:mm:ss.SSS';

        // Ensure log directory exists
        this.ensureLogDirectory();
    }

    /**
     * Log an informational message.
     */
    info(message: string, ...args: unknown[]): void {
        this.writeLog('INFO', message, ...args);
    }

    /**
     * Log a warning message.
     */
    warn(message: string, ...args: unknown[]): void {
        this.writeLog('WARN', message, ...args);
    }

    /**
     * Log an error message.
     */
    error(message: string, ...args: unknown[]): void {
        this.writeLog('ERROR', message, ...args);
    }

    /**
     * Log a debug message.
     */
    debug(message: string, ...args: unknown[]): void {
        this.writeLog('DEBUG', message, ...args);
    }

    /**
     * Log a general message.
     */
    log(message: string, ...args: unknown[]): void {
        this.writeLog('LOG', message, ...args);
    }

    /**
     * Write a log message to the file.
     *
     * @private
     */
    private writeLog(level: string, message: string, ...args: unknown[]): void {
        const timestamp = this.includeTimestamp ? this.getTimestamp() : '';
        const argsStr = args.length > 0 ? ' ' + args.map(arg => this.stringify(arg)).join(' ') : '';
        const logMessage = timestamp
            ? `[${timestamp}] [${level}] ${message}${argsStr}\n`
            : `[${level}] ${message}${argsStr}\n`;

        // Check if rotation is needed before writing
        this.rotateIfNeeded();

        // Write to file synchronously to ensure logs aren't lost
        fs.appendFileSync(this.logPath, logMessage, 'utf8');
    }

    /**
     * Get current timestamp in configured format.
     *
     * @private
     */
    private getTimestamp(): string {
        const now = new Date();

        // Simple timestamp formatting without moment.js dependency
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * Convert an argument to a string representation.
     *
     * @private
     */
    private stringify(arg: unknown): string {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
        if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;

        try {
            return JSON.stringify(arg);
        } catch {
            return String(arg);
        }
    }

    /**
     * Ensure the log directory exists.
     *
     * @private
     */
    private ensureLogDirectory(): void {
        const logDir = path.dirname(this.logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    /**
     * Check if log rotation is needed and perform rotation if necessary.
     *
     * @private
     */
    private rotateIfNeeded(): void {
        if (!fs.existsSync(this.logPath)) {
            return; // No file to rotate
        }

        const stats = fs.statSync(this.logPath);
        if (stats.size >= this.maxFileSize) {
            this.rotate();
        }
    }

    /**
     * Perform log file rotation.
     *
     * Rotates existing log files by renaming them with incrementing numbers.
     * Deletes the oldest log file if the maximum number of files is reached.
     *
     * Example rotation:
     * - migration.log -> migration.log.1
     * - migration.log.1 -> migration.log.2
     * - migration.log.2 -> migration.log.3
     * - migration.log.4 -> deleted (if maxFiles = 5)
     *
     * @private
     */
    private rotate(): void {
        // Delete the oldest log file if it exists
        const oldestLogPath = `${this.logPath}.${this.maxFiles}`;
        if (fs.existsSync(oldestLogPath)) {
            fs.unlinkSync(oldestLogPath);
        }

        // Rotate existing backup files
        for (let i = this.maxFiles - 1; i >= 1; i--) {
            const currentLogPath = `${this.logPath}.${i}`;
            const nextLogPath = `${this.logPath}.${i + 1}`;

            if (fs.existsSync(currentLogPath)) {
                fs.renameSync(currentLogPath, nextLogPath);
            }
        }

        // Rotate the current log file to .1
        if (fs.existsSync(this.logPath)) {
            fs.renameSync(this.logPath, `${this.logPath}.1`);
        }
    }

    /**
     * Get the current log file size in bytes.
     *
     * @returns File size in bytes, or 0 if file doesn't exist
     */
    public getFileSize(): number {
        if (!fs.existsSync(this.logPath)) {
            return 0;
        }
        return fs.statSync(this.logPath).size;
    }

    /**
     * Get the list of all log files (current + rotated).
     *
     * @returns Array of log file paths that exist
     */
    public getLogFiles(): string[] {
        const files: string[] = [];

        if (fs.existsSync(this.logPath)) {
            files.push(this.logPath);
        }

        for (let i = 1; i <= this.maxFiles; i++) {
            const rotatedPath = `${this.logPath}.${i}`;
            if (fs.existsSync(rotatedPath)) {
                files.push(rotatedPath);
            }
        }

        return files;
    }

    /**
     * Clear all log files (current + rotated).
     *
     * Useful for testing or manual cleanup.
     */
    public clearLogs(): void {
        const files = this.getLogFiles();
        files.forEach(file => {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        });
    }
}
