import fs from "fs";
import moment from "moment";

import {BackupConfig} from "../model";
import {IBackupService, IDatabaseMigrationHandler} from "../interface";

export class BackupService implements IBackupService {

    private backupFile: string | undefined;

    public constructor(private handler: IDatabaseMigrationHandler) {}

    public async backup(): Promise<void> {
        console.info('Preparing backup...')
        await this._backup();
        console.info('Backup prepared successfully:\r\n', this.backupFile);
    }

    public async restore(): Promise<void> {
        console.info('Restoring from backup...');
        await this._restore()
        console.info('Restored to the previous state:\r\n', this.backupFile);
    }

    public deleteBackup() {
        if(!this.handler.cfg.backup.deleteBackup || !this.backupFile) return;
        console.log("Deleting backup file...")
        fs.rmSync(this.backupFile);
        this.backupFile = undefined;
        console.log("Backup file successfully deleted")
    }

    private async _restore(): Promise<void> {
        if (this.backupFile && fs.existsSync(this.backupFile)) {
            const data:string = fs.readFileSync(this.backupFile, 'utf8');
            return this.handler.backup.restore(data);
        }

        return Promise.reject(`Cannot open ${this.backupFile}`);
    }

    private async _backup(): Promise<string> {
        const data = await this.handler.backup.backup();
        const filePath = this.getFileName();
        fs.writeFileSync(filePath, data);
        this.backupFile = filePath;
        return filePath
    }

    private getFileName():string {
        const path:string = BackupService.prepareFilePath(this.handler.cfg.backup);
        if (fs.existsSync(path)) fs.renameSync(path, BackupService.prepareFilePath(this.handler.cfg.backup))
        return path;
    }

    static prepareFilePath(cfg:BackupConfig):string {
        const time:string = cfg.timestamp ? `-${moment().format(cfg.timestampFormat)}` : '';
        return `${cfg.folder}/${cfg.prefix}${cfg.custom}${time}${cfg.suffix}.${cfg.extension}`;
    }
}