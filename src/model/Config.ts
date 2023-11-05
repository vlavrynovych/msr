import {BackupConfig} from "./index";

export class Config {
    filePattern:RegExp = /^V(\d{12})_/
    folder:string = 'migrations'
    tableName:string = 'schema_version';
    backup:BackupConfig = new BackupConfig()
}