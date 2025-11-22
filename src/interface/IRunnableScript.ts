import {IDatabaseMigrationHandler} from "./IDatabaseMigrationHandler";
import {IDB} from "./dao";
import {IMigrationInfo} from "./IMigrationInfo";

/**
 * Interface for migration script classes.
 *
 * Every migration script file must export a class that implements this interface.
 * The class must have an `up()` method that performs the actual migration logic.
 *
 * @example
 * ```typescript
 * // File: V202501220100_initial_setup.ts
 * import { IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB } from 'migration-script-runner';
 *
 * export default class InitialSetup implements IRunnableScript {
 *   async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
 *     // Your migration logic here
 *     await db.query('CREATE TABLE users (id INT, name VARCHAR(255))');
 *     return 'Users table created successfully';
 *   }
 * }
 * ```
 */
export interface IRunnableScript {
    /**
     * Execute the migration.
     *
     * This method contains the actual migration logic (creating tables, modifying schemas,
     * migrating data, etc.). It is called by the migration executor when the migration runs.
     *
     * @param db - Database connection/client for executing queries
     * @param info - Metadata about this migration (name, timestamp, username)
     * @param handler - Database handler with access to config and other services
     *
     * @returns A string describing the result of the migration (e.g., "3 tables created")
     *          This result is stored in the schema version tracking table.
     *
     * @throws {Error} If the migration fails, throw an error. The database will be
     *                 automatically restored from backup.
     *
     * @example
     * ```typescript
     * async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
     *   console.log(`Running migration: ${info.name}`);
     *
     *   // Execute migration queries
     *   await db.query('CREATE TABLE posts (id INT, title VARCHAR(255))');
     *   await db.query('CREATE INDEX idx_title ON posts(title)');
     *
     *   return 'Posts table and index created';
     * }
     * ```
     */
    up(db:IDB, info:IMigrationInfo, handler:IDatabaseMigrationHandler):Promise<string>;
}