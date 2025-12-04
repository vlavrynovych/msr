import {IMigrationInfo} from "../IMigrationInfo";
import {MigrationScript} from "../../model";
import {IDB} from "../dao";

/**
 * Service interface for schema version tracking operations.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 */
export interface ISchemaVersionService<DB extends IDB> {
    init(tableName:string):Promise<void>
    save(details:IMigrationInfo):Promise<void>
    getAllMigratedScripts():Promise<MigrationScript<DB>[]>
    remove(timestamp: number): Promise<void>
}