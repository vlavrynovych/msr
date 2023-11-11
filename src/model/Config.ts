import {BackupConfig} from "./index";

export class Config {
    filePattern:RegExp = /^V(\d{12})_/
    folder:string = `${process.cwd()}/migrations`
    tableName:string = 'schema_version';
    backup:BackupConfig = new BackupConfig()
}