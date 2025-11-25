import {IBackup, IDB, ISchemaVersion} from "./dao";

/**
 * Main interface for database-specific migration handling.
 *
 * This interface must be implemented for each database system you want to use with MSR.
 * It provides database connection, schema version tracking, and backup/restore functionality.
 *
 * Note: Configuration is now passed separately to the MigrationScriptExecutor constructor.
 *
 * @example
 * ```typescript
 * // With backup (recommended for production)
 * export class MyDatabaseHandler implements IDatabaseMigrationHandler {
 *   db: IDB;
 *   schemaVersion: ISchemaVersion;
 *   backup?: IBackup;
 *
 *   constructor() {
 *     this.db = new MyDBConnection();
 *     this.schemaVersion = new MySchemaVersion(this.db);
 *     this.backup = new MyBackup(this.db); // Optional
 *   }
 *
 *   getName(): string {
 *     return 'My Database Handler v1.0';
 *   }
 * }
 *
 * // Without backup (using down() migrations instead)
 * export class MyDatabaseHandler implements IDatabaseMigrationHandler {
 *   db: IDB;
 *   schemaVersion: ISchemaVersion;
 *   // No backup property - will use down() methods for rollback
 *
 *   constructor() {
 *     this.db = new MyDBConnection();
 *     this.schemaVersion = new MySchemaVersion(this.db);
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
     * Backup and restore interface (optional).
     *
     * If provided, MSR will create backups before migrations and restore on failure.
     * If not provided, you can use down() methods for rollback or configure a
     * different rollback strategy via config.rollbackStrategy.
     *
     * @see Config.rollbackStrategy for available rollback strategies
     */
    backup?: IBackup
}