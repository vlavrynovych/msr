import fs from "fs";
import moment from "moment";

import {BackupConfig, Config} from "../model";
import {IBackupService, IDatabaseMigrationHandler, ILogger} from "../interface";
import {ConsoleLogger} from "../logger";

/**
 * Service for creating, restoring, and managing database backup files.
 *
 * Handles the entire backup lifecycle:
 * - Creating backups before migrations run
 * - Restoring database state if migrations fail
 * - Cleaning up backup files after successful migrations
 *
 * @example
 * ```typescript
 * const service = new BackupService(handler);
 *
 * await service.backup();        // Create backup before migration
 * // ... run migrations ...
 * await service.restore();       // Restore if migration fails
 * service.deleteBackup();        // Clean up if migration succeeds
 * ```
 */
export class BackupService implements IBackupService {

    /** Path to the currently active backup file */
    private backupFile: string | undefined;

    /**
     * Creates a new BackupService.
     *
     * @param handler - Database migration handler for backup operations
     * @param config - Configuration including backup settings
     * @param logger - Logger instance for output (defaults to ConsoleLogger)
     */
    public constructor(
        private handler: IDatabaseMigrationHandler,
        private config: Config,
        private logger: ILogger = new ConsoleLogger()
    ) {}

    /**
     * Create a database backup file.
     *
     * Calls the database handler's backup() method to serialize the database state,
     * generates a filename based on the backup configuration, and writes the backup
     * data to disk.
     *
     * @returns The absolute path to the created backup file
     *
     * @example
     * ```typescript
     * const backupPath = await service.backup();
     * console.log(`Backup created: ${backupPath}`);
     * // Backup file created: ./backups/backup-2025-01-22-01-30-45.bkp
     * ```
     */
    public async backup(): Promise<string> {
        this.logger.info('Preparing backup...')
        await this._backup();
        this.logger.info('Backup prepared successfully:\r\n', this.backupFile);

        if (!this.backupFile) {
            throw new Error('Backup file path is undefined after backup operation');
        }

        return this.backupFile;
    }

    /**
     * Restore database from the backup file.
     *
     * Reads the backup file and calls the database handler's restore() method
     * to restore the database to its previous state. Called automatically if
     * a migration fails.
     *
     * @throws {Error} If backup file doesn't exist or cannot be read
     *
     * @example
     * ```typescript
     * try {
     *   await runMigrations();
     * } catch (error) {
     *   await service.restore(); // Restore to backup
     * }
     * ```
     */
    public async restore(): Promise<void> {
        this.logger.info('Restoring from backup...');
        await this._restore()
        this.logger.info('Restored to the previous state:\r\n', this.backupFile);
    }

    /**
     * Delete the backup file from disk.
     *
     * Only deletes if `config.backup.deleteBackup` is true. Called automatically
     * after successful migrations or after restore completes.
     *
     * @example
     * ```typescript
     * // After successful migration
     * service.deleteBackup(); // Removes backup file
     * ```
     */
    public deleteBackup() {
        if(!this.config.backup.deleteBackup || !this.backupFile) return;
        this.logger.log("Deleting backup file...")
        fs.rmSync(this.backupFile);
        this.backupFile = undefined;
        this.logger.log("Backup file successfully deleted")
    }

    private async _restore(): Promise<void> {
        if (this.backupFile && fs.existsSync(this.backupFile)) {
            const data:string = fs.readFileSync(this.backupFile, 'utf8');
            return this.handler.backup.restore(data);
        }

        return Promise.reject(`Cannot open ${this.backupFile}`);
    }

    private async _backup(): Promise<string> {
        const data = await this.handler.backup.backup();
        const filePath = this.getFileName();
        fs.writeFileSync(filePath, data);
        this.backupFile = filePath;
        return filePath
    }

    /**
     * Get backup file name, archiving any existing file.
     *
     * If a backup file already exists at the target path, it is renamed
     * with a timestamp suffix to prevent data loss. This ensures that
     * previous backups are preserved rather than overwritten.
     *
     * @returns The path to use for the new backup file
     * @private
     */
    private getFileName():string {
        const path:string = BackupService.prepareFilePath(this.config.backup);

        // Archive existing backup file to prevent overwriting
        if (fs.existsSync(path)) {
            const archivePath = `${path}.old-${Date.now()}`;
            fs.renameSync(path, archivePath);
        }

        return path;
    }

    /**
     * Generate backup file path based on configuration.
     *
     * Constructs the full backup filename using prefix, custom name, timestamp,
     * suffix, and extension from the backup configuration.
     *
     * @param cfg - Backup configuration
     * @returns Full path to backup file
     *
     * @example
     * ```typescript
     * const config = new BackupConfig();
     * config.folder = './backups';
     * config.prefix = 'db';
     * config.timestamp = true;
     * config.timestampFormat = 'YYYYMMDD-HHmmss';
     *
     * const path = BackupService.prepareFilePath(config);
     * // Returns: './backups/db-20250122-013045.bkp'
     * ```
     */
    static prepareFilePath(cfg:BackupConfig):string {
        const time:string = cfg.timestamp ? `-${moment().format(cfg.timestampFormat)}` : '';
        return `${cfg.folder}/${cfg.prefix}${cfg.custom}${time}${cfg.suffix}.${cfg.extension}`;
    }
}