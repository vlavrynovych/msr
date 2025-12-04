import {IMigrationScript} from "./IMigrationScript";
import {IDB} from "./IDB";

/**
 * Interface for managing the schema version tracking table.
 *
 * This interface handles creating, validating, and interacting with the database table
 * that tracks which migrations have been executed. Each database implementation must
 * provide its own implementation of this interface.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * // PostgreSQL implementation
 * export class PostgresSchemaVersion implements ISchemaVersion<IDB> {
 *   constructor(private db: IDB) {}
 *
 *   async isInitialized(tableName: string): Promise<boolean> {
 *     const result = await this.db.query(
 *       `SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = $1)`,
 *       [tableName]
 *     );
 *     return result.rows[0].exists;
 *   }
 *
 *   async createTable(tableName: string): Promise<boolean> {
 *     await this.db.query(`
 *       CREATE TABLE IF NOT EXISTS ${tableName} (
 *         timestamp BIGINT PRIMARY KEY,
 *         name VARCHAR(255) NOT NULL,
 *         ...
 *       )
 *     `);
 *     return true;
 *   }
 *
 *   async validateTable(tableName: string): Promise<boolean> {
 *     // Check if table has required columns
 *     const result = await this.db.query(`
 *       SELECT column_name FROM information_schema.columns
 *       WHERE table_name = $1
 *     `, [tableName]);
 *     const columns = result.rows.map(r => r.column_name);
 *     return columns.includes('timestamp') && columns.includes('name');
 *   }
 *
 *   migrationRecords: IMigrationScript<IDB> = new PostgresMigrationScript(this.db);
 * }
 * ```
 */
export interface ISchemaVersion<DB extends IDB> {
    /**
     * Check if the schema version tracking table has been initialized.
     *
     * This method checks whether the migration tracking table exists in the database.
     * It does not validate the table structure, only its existence.
     *
     * @param tableName - Name of the schema version tracking table
     * @returns Promise<boolean> - true if table exists, false otherwise
     *
     * @example
     * ```typescript
     * if (await schemaVersion.isInitialized('schema_version')) {
     *   console.log('Migration tracking table exists');
     * } else {
     *   await schemaVersion.createTable('schema_version');
     * }
     * ```
     */
    isInitialized(tableName: string): Promise<boolean>

    /**
     * Create the schema version tracking table in the database.
     *
     * Creates a table to track executed migrations. The table should include columns for:
     * - timestamp (primary key)
     * - name (migration filename)
     * - username (who executed the migration)
     * - started_at (when migration started)
     * - finished_at (when migration completed)
     * - result (migration result message)
     *
     * @param tableName - Name of the table to create
     * @returns Promise<boolean> - true if table was created successfully, false if it already exists
     *
     * @example
     * ```typescript
     * const created = await schemaVersion.createTable('schema_version');
     * if (created) {
     *   console.log('Created migration tracking table');
     * } else {
     *   console.log('Table already exists');
     * }
     * ```
     */
    createTable(tableName: string): Promise<boolean>

    /**
     * Validate the structure of the schema version tracking table.
     *
     * Checks that the table exists and has all required columns with correct data types.
     * This ensures the table structure is compatible with MSR's expectations.
     *
     * Required columns:
     * - timestamp: numeric/bigint (primary key)
     * - name: string/varchar
     * - username: string/varchar
     * - started_at: timestamp/datetime
     * - finished_at: timestamp/datetime
     * - result: string/text
     *
     * @param tableName - Name of the table to validate
     * @returns Promise<boolean> - true if table structure is valid, false if invalid or missing
     *
     * @throws {Error} May throw if unable to query table structure
     *
     * @example
     * ```typescript
     * try {
     *   const isValid = await schemaVersion.validateTable('schema_version');
     *   if (!isValid) {
     *     console.error('Migration table has invalid structure');
     *     // Consider dropping and recreating the table
     *   }
     * } catch (error) {
     *   console.error('Failed to validate table:', error);
     * }
     * ```
     */
    validateTable(tableName: string): Promise<boolean>

    /**
     * Interface for accessing migration execution records.
     *
     * Provides CRUD operations for the migration records stored in the schema version table.
     * Used to save new migration executions, retrieve migration history, and remove records
     * during rollback operations.
     * Typed with the generic DB parameter (v0.6.0).
     *
     * @see IMigrationScript for available operations (getAllExecuted, save, remove)
     *
     * @example
     * ```typescript
     * // Get all executed migrations
     * const executed = await schemaVersion.migrationRecords.getAllExecuted();
     * console.log(`Found ${executed.length} executed migrations`);
     *
     * // Save a new migration record
     * await schemaVersion.migrationRecords.save({
     *   timestamp: 202501220100,
     *   name: 'V202501220100_create_users.ts',
     *   username: 'admin',
     *   startedAt: Date.now(),
     *   finishedAt: Date.now(),
     *   result: 'Users table created'
     * });
     * ```
     */
    migrationRecords: IMigrationScript<DB>
}