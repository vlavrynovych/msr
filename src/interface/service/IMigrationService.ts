import {MigrationScript} from "../../model";

export interface IMigrationService {
    readMigrationScripts(): Promise<MigrationScript[]>
}