import {Config, MigrationScript} from "../../model";

export interface IMigrationService {
    readMigrationScripts(cfg: Config): Promise<MigrationScript[]>
    getBeforeMigrateScript(cfg: Config): Promise<string | undefined>
}