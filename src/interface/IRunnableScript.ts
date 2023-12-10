import {IDatabaseMigrationHandler} from "./IDatabaseMigrationHandler";
import {IDB} from "./dao";
import {IMigrationInfo} from "./IMigrationInfo";

export interface IRunnableScript {
    up(db:IDB, info:IMigrationInfo, handler:IDatabaseMigrationHandler):Promise<string>;
}