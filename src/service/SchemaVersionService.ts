import {MigrationScript} from "../model";
import {IMigrationInfo, ISchemaVersion, ISchemaVersionService} from "../interface";

/**
 * Service for managing the schema version tracking table.
 *
 * Handles initialization, validation, and CRUD operations for the database table
 * that tracks which migrations have been executed.
 *
 * @template T - Type of schema version implementation
 */
export class SchemaVersionService<T extends ISchemaVersion> implements ISchemaVersionService{
    /**
     * Creates a new SchemaVersionService.
     *
     * @param service - Database-specific implementation of {@link ISchemaVersion}
     */
    constructor(private service: T) {}

    /**
     * Initialize the schema version tracking table.
     *
     * Checks if the table exists, creates it if needed, and validates its structure.
     * This must be called before any migrations run.
     *
     * @param tableName - Name of the table to initialize (from config.tableName)
     *
     * @throws {Error} If table creation fails
     * @throws {Error} If table structure validation fails
     *
     * @example
     * ```typescript
     * const service = new SchemaVersionService(schemaVersionImpl);
     * await service.init('schema_version');
     * ```
     */
    public async init(tableName:string):Promise<void> {
        const init = await this.service.isInitialized(tableName);
        if(!init) {
            const created = await this.service.createTable(tableName);
            if(!created) throw new Error("Cannot create table")
        }
        const isValid = await this.service.validateTable(tableName);
        if(!isValid) throw new Error("Schema version table is invalid")
    }

    /**
     * Save migration execution metadata to the tracking table.
     *
     * Records information about a successfully executed migration including
     * timestamp, name, execution time, username, and result.
     *
     * @param details - Migration metadata to save
     * @returns Promise resolving to the result of the database operation
     *
     * @example
     * ```typescript
     * const info: IMigrationInfo = {
     *   name: 'V202501220100_test.ts',
     *   timestamp: 202501220100,
     *   startedAt: 1737504000000,
     *   finishedAt: 1737504005000,
     *   username: 'developer',
     *   result: 'Migration completed'
     * };
     * await service.save(info);
     * ```
     */
    public async save(details:IMigrationInfo):Promise<void> {
        return this.service.migrations.save(details);
    }

    /**
     * Retrieve all previously executed migrations from the tracking table.
     *
     * @returns Array of MigrationScript objects with execution metadata
     *
     * @example
     * ```typescript
     * const executed = await service.getAllMigratedScripts();
     * console.log(`${executed.length} migrations have been executed`);
     * ```
     */
    public async getAllMigratedScripts():Promise<MigrationScript[]> {
        return await this.service.migrations.getAll();
    }
}