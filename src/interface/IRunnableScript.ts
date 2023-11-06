import {IRunner} from "./IRunner";
import {IDB} from "./dao";
import {IMigrationInfo} from "./IMigrationInfo";

export interface IRunnableScript {
    up(dao:IDB, info:IMigrationInfo, runner:IRunner):Promise<string>;
}