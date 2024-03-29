import {Config} from "../model";
import {IBackup, IDB, ISchemaVersion} from "./dao";

export interface IDatabaseMigrationHandler {
    getName(): string
    cfg: Config
    db: IDB
    schemaVersion: ISchemaVersion
    backup: IBackup
}