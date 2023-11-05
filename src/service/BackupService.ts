import fs from "fs";
import {BackupConfig} from "../model";
import moment from "moment";
import {IRunner} from "../interface";

export class BackupService {

    private backupFile: string | undefined;

    public constructor(private msr: IRunner) {}

    public async backup(): Promise<any> {
        console.info('Preparing backup...')
        await this._backup();
        console.info('Backup prepared successfully:\r\n', this.backupFile);
    }

    public async restore(): Promise<any> {
        console.info('Restoring from backup...');
        await this._restore()
        console.info('Restored to the previous state:\r\n', this.backupFile);
    }

    public deleteBackup() {
        if(!this.msr.cfg.backup.deleteBackup || !this.backupFile) return;
        console.log("Deleting backup file...")
        fs.rmSync(this.backupFile);
        console.log("Backup file successfully deleted")
    }

    private async _restore(): Promise<string> {
        if (this.backupFile &&fs.existsSync(this.backupFile)) {
            const data:string = fs.readFileSync(this.backupFile, 'utf8');
            return this.msr.restore(data);
        }

        return Promise.reject(`Cannot open ${this.backupFile}`);
    }

    private async _backup(): Promise<string> {
        const data = await this.msr.backup();
        const filePath = this.getFileName();
        fs.writeFileSync(filePath, data);
        this.backupFile = filePath;
        return filePath
    }

    getFileName():string {
        const path:string = BackupService.prepareFilePath(this.msr.cfg.backup);
        if (fs.existsSync(path)) fs.renameSync(path, BackupService.prepareFilePath(this.msr.cfg.backup))
        return path;
    }

    static prepareFilePath(cfg:BackupConfig):string {
        const time:string = cfg.timestamp ? `-${moment().format(cfg.timestampFormat)}` : '';
        return `${cfg.folder}/${cfg.prefix}${cfg.custom}${time}${cfg.suffix}.${cfg.extension}`;
    }
}