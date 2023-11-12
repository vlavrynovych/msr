import {Config} from "../model";
import {IBackup, IDB, IMigrationScript, ISchemaVersion} from "./dao";

export interface IDatabaseMigrationHandler extends ISchemaVersion, IMigrationScript, IBackup{
    getName(): string
    cfg:Config
    db:IDB
}