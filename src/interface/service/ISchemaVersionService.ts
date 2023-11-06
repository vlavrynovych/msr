import {IMigrationInfo} from "../IMigrationInfo";
import {MigrationScript} from "../../model";

export interface ISchemaVersionService {
    init(tableName:string):Promise<void>
    register(details:IMigrationInfo):Promise<any>
    getAllMigratedScripts():Promise<MigrationScript[]>
}