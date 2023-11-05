import {BackupConfig} from "./index";
import {IDAO} from "../interface";

export class Config {
    filePattern:RegExp = /^V(\d{12})_/
    folder:string = 'migrations'
    backup:BackupConfig = new BackupConfig()

    constructor(public dao: IDAO) {}
}