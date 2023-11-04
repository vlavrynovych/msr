import fs from "fs";
import {BackupOptions, Config} from "../model";
import moment from "moment";

export class BackupService {

    private backupFile: string | undefined;

    public constructor(private cfg: Config) {}

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
        if(!this.cfg.backupOptions.deleteBackup || !this.backupFile) return;
        console.log("Deleting backup file...")
        fs.rmSync(this.backupFile);
        console.log("Backup file successfully deleted")
    }

    private async _restore(): Promise<string> {
        if (this.backupFile &&fs.existsSync(this.backupFile)) {
            let data = fs.readFileSync(this.backupFile, 'utf8');
            return this.cfg.dao.restore(data);
        }

        return Promise.reject(`Cannot open ${this.backupFile}`);
    }

    private async _backup(): Promise<string> {
        let data = await this.cfg.dao.backup();
        let filePath = this.getFileName(this.cfg.backupOptions);
        fs.writeFileSync(filePath, data);
        this.backupFile = filePath;
        return filePath
    }

    getFileName(bo:BackupOptions) {
        let path = this.prepareFilePath(bo);
        if (fs.existsSync(path)) fs.renameSync(path, this.prepareFilePath(bo))
        return path;
    }

    prepareFilePath(bo:BackupOptions) {
        let time = bo.timestamp ? `-${moment().format(bo.timestampFormat)}` : '';
        return `${this.cfg.folders.backups}/${bo.prefix}${bo.custom}${time}${bo.suffix}.${bo.extension}`;
    }
}