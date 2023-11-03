import {BackupOptions} from "./index";
import {IDAO} from "../interface";

export class Config {
    filePattern:RegExp = /^V(\d{12})_/;
    folders = {
        migrations: 'migrations',
        backups: 'backups'
    }
    backupOptions:BackupOptions = new BackupOptions();

    constructor(public dao: IDAO) {}
}