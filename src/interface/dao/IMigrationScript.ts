import {MigrationScript} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";

export interface IMigrationScript {
    getAll():Promise<MigrationScript[]>;
    register(details: IMigrationInfo): Promise<any>;
}