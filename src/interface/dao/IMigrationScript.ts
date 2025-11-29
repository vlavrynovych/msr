import {MigrationScript} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";

/**
 * Interface for managing migration script records in the database.
 *
 * Implementations handle storing and retrieving migration execution metadata,
 * typically in a schema version table or collection.
 */
export interface IMigrationScript {
    /**
     * Retrieve all executed migrations from the database.
     *
     * Returns migration records in chronological order (oldest first) based on timestamp.
     * Each record includes execution metadata: timestamp, name, username, execution time,
     * duration, and result message.
     *
     * @returns Promise<MigrationScript[]> - Array of executed migration records
     *
     * @example
     * ```typescript
     * const executed = await migrationRecords.getAllExecuted();
     * console.log(`Found ${executed.length} executed migrations`);
     *
     * executed.forEach(migration => {
     *   console.log(`${migration.timestamp}: ${migration.name}`);
     *   console.log(`  Executed by ${migration.username} at ${migration.finishedAt}`);
     * });
     * ```
     */
    getAllExecuted(): Promise<MigrationScript[]>;

    /**
     * Save migration execution metadata to the database.
     *
     * Records when a migration was executed, by whom, and other details
     * to track migration history.
     *
     * @param details - Migration metadata including name, timestamp, username, etc.
     * @returns Promise that resolves when the save operation completes
     */
    save(details: IMigrationInfo): Promise<void>;

    /**
     * Remove migration record from the database by timestamp.
     *
     * Used when rolling back migrations to keep the schema version table
     * synchronized with the actual database state. After calling a migration's
     * down() method, this removes the corresponding record from the tracking table.
     *
     * @param timestamp - The timestamp of the migration to remove
     * @returns Promise that resolves when the remove operation completes
     *
     * @example
     * ```typescript
     * // After rolling back migration V202501220100
     * await migrations.remove(202501220100);
     * ```
     */
    remove(timestamp: number): Promise<void>;
}