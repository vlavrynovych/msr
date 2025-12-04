import {IBackup, IDB, ISchemaVersion} from "./dao";
import {ITransactionManager} from "./service/ITransactionManager";

/**
 * Main interface for database-specific migration handling.
 *
 * This interface must be implemented for each database system you want to use with MSR.
 * It provides database connection, schema version tracking, and backup/restore functionality.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * Note: Configuration is now passed separately to the MigrationScriptExecutor constructor.
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * // With backup (recommended for production)
 * export class MyDatabaseHandler implements IDatabaseMigrationHandler<IDB> {
 *   db: IDB;
 *   schemaVersion: ISchemaVersion<IDB>;
 *   backup?: IBackup<IDB>;
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
 *
 *   getVersion(): string {
 *     return '1.0.0';
 *   }
 * }
 * ```
 */
export interface IDatabaseMigrationHandler<DB extends IDB> {
    /**
     * Get the name of the database handler.
     * Used for display in console output and logging.
     *
     * @returns Human-readable name of the handler (e.g., "PostgreSQL Handler")
     *
     * @example
     * ```typescript
     * getName(): string {
     *   return 'PostgreSQL Handler';
     * }
     * ```
     */
    getName(): string

    /**
     * Get the version of the database adapter/handler.
     * Used in execution summary logging to track which adapter version was used.
     *
     * @returns Semantic version string (e.g., "1.2.3")
     *
     * @example
     * ```typescript
     * getVersion(): string {
     *   return '1.2.3';
     * }
     * ```
     */
    getVersion(): string

    /**
     * Database connection/client interface.
     * Provides access to the database for executing queries during migrations.
     * Typed with the generic DB parameter (v0.6.0).
     */
    db: DB

    /**
     * Schema version tracking interface.
     * Handles creating and managing the table that tracks executed migrations.
     * Typed with the generic DB parameter (v0.6.0).
     */
    schemaVersion: ISchemaVersion<DB>

    /**
     * Backup and restore interface (optional).
     *
     * If provided, MSR will create backups before migrations and restore on failure.
     * If not provided, you can use down() methods for rollback or configure a
     * different rollback strategy via config.rollbackStrategy.
     * Typed with the generic DB parameter (v0.6.0).
     *
     * @see Config.rollbackStrategy for available rollback strategies
     */
    backup?: IBackup<DB>

    /**
     * Transaction manager for advanced transaction control (optional).
     *
     * If provided, MSR will use this custom transaction manager instead of creating
     * a default one. This allows complete control over transaction behavior including
     * custom retry logic, savepoints, distributed transactions, etc.
     * Typed with the generic DB parameter (v0.6.0).
     *
     * **If not provided:**
     * - MSR automatically creates {@link DefaultTransactionManager} if `db` implements {@link ITransactionalDB}
     * - No transactions if `db` does not implement {@link ITransactionalDB} and mode is NONE
     *
     * **New in v0.5.0**
     *
     * @see {@link ITransactionManager} for interface documentation
     * @see {@link ITransactionalDB} for database capability requirements
     * @see {@link Config.transaction} for transaction configuration
     *
     * @example
     * ```typescript
     * // Most users don't need this - just implement ITransactionalDB
     * class PostgresDB implements ITransactionalDB {
     *   async beginTransaction(): Promise<void> { await this.pool.query('BEGIN'); }
     *   async commit(): Promise<void> { await this.pool.query('COMMIT'); }
     *   async rollback(): Promise<void> { await this.pool.query('ROLLBACK'); }
     * }
     * // MSR automatically creates DefaultTransactionManager
     *
     * // Advanced: Custom transaction manager for special needs
     * class DistributedTransactionManager implements ITransactionManager<IDB> {
     *   async begin(): Promise<void> {
     *     // Begin transactions across multiple databases
     *   }
     *   async commit(): Promise<void> {
     *     // Two-phase commit protocol
     *   }
     *   async rollback(): Promise<void> {
     *     // Rollback all databases
     *   }
     * }
     *
     * const handler: IDatabaseMigrationHandler<IDB> = {
     *   db: myDB,
     *   schemaVersion: schemaVersionImpl,
     *   transactionManager: new DistributedTransactionManager(),  // Override default
     *   getName: () => 'Custom Handler',
     *   getVersion: () => '1.0.0'
     * };
     * ```
     */
    transactionManager?: ITransactionManager<DB>
}