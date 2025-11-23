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
     * @returns Array of migration scripts that have been executed
     */
    getAll(): Promise<MigrationScript[]>;

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
}