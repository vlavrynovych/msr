import {MigrationScript} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";

export interface IMigrationScript {
    getAll():Promise<MigrationScript[]>;
    save(details: IMigrationInfo): Promise<void>;
}