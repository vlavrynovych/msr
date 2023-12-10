import {MigrationScript} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";

export interface IMigrationScript {
    getAll():Promise<MigrationScript[]>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    save(details: IMigrationInfo): Promise<any>;
}