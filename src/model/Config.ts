import {BackupConfig} from "./index";

export class Config {
    filePattern:RegExp = /^V(\d{12})_/
    folder:string = `${process.cwd()}/migrations`
    tableName:string = 'schema_version';
    backup:BackupConfig = new BackupConfig()

    /**
     * Limits the number of migrated scripts displayed in console output.
     * Set to 0 to show all scripts (default).
     * Example: displayLimit: 10 will show only the last 10 most recent migrations.
     */
    displayLimit:number = 0
}