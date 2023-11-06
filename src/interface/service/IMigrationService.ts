import {MigrationScript} from "../../model";

export interface IMigrationService {
    readMigrationScripts(): Promise<MigrationScript[]>
    validate(scripts:MigrationScript[]):Promise<boolean> | never
}