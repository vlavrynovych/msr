import {Config, MigrationScript} from "../../model";

export interface IMigrationService {
    readMigrationScripts(cfg: Config): Promise<MigrationScript[]>
}