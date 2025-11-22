import {Config} from "../model";
import {IBackup, IDB, ISchemaVersion} from "./dao";

/**
 * Main interface for database-specific migration handling.
 *
 * This interface must be implemented for each database system you want to use with MSR.
 * It provides database connection, schema version tracking, and backup/restore functionality.
 *
 * @example
 * ```typescript
 * export class MyDatabaseHandler implements IDatabaseMigrationHandler {
 *   cfg: Config;
 *   db: IDB;
 *   schemaVersion: ISchemaVersion;
 *   backup: IBackup;
 *
 *   constructor(config: Config) {
 *     this.cfg = config;
 *     this.db = new MyDBConnection();
 *     this.schemaVersion = new MySchemaVersion(this.db);
 *     this.backup = new MyBackup(this.db);
 *   }
 *
 *   getName(): string {
 *     return 'My Database Handler v1.0';
 *   }
 * }
 * ```
 */
export interface IDatabaseMigrationHandler {
    /**
     * Get the name and version of the database handler.
     * Used for display in console output.
     *
     * @returns Human-readable name of the handler (e.g., "PostgreSQL Handler v1.0")
     *
     * @example
     * ```typescript
     * getName(): string {
     *   return 'PostgreSQL Handler v1.0';
     * }
     * ```
     */
    getName(): string

    /**
     * Configuration for the migration system.
     * Contains migration folder, file pattern, table name, backup settings, etc.
     */
    cfg: Config

    /**
     * Database connection/client interface.
     * Provides access to the database for executing queries during migrations.
     */
    db: IDB

    /**
     * Schema version tracking interface.
     * Handles creating and managing the table that tracks executed migrations.
     */
    schemaVersion: ISchemaVersion

    /**
     * Backup and restore interface.
     * Handles creating database backups before migrations and restoring on failure.
     */
    backup: IBackup
}