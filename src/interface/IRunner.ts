import {Config} from "../model";
import {IBackup, IDB, IMigrationScript, ISchemaVersion} from "./dao";

export interface IRunner extends ISchemaVersion, IMigrationScript, IBackup{
    getName(): string
    cfg:Config
    db:IDB
}