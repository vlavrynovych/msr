import {IMigrationInfo} from "../IMigrationInfo";
import {MigrationScript} from "../../model";

export interface ISchemaVersionService {
    init(tableName:string):Promise<void>
    save(details:IMigrationInfo):Promise<void>
    getAllMigratedScripts():Promise<MigrationScript[]>
    remove(timestamp: number): Promise<void>
}