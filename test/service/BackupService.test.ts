import { expect } from 'chai';
import fs from "fs";
import sinon from 'sinon';
import {BackupConfig, BackupService, Config, IDatabaseMigrationHandler} from "../../src";

describe('BackupService.prepareFilePath', () => {

    it('check folder', () => {
        // when
        const cfg:BackupConfig = new BackupConfig();
        let res:string = BackupService.prepareFilePath(cfg);

        // then
        expect(res).to.include('/backups/', 'Should have default folder')

        // when: folder updated
        cfg.folder = 'test-folder';
        res = BackupService.prepareFilePath(cfg);

        // then:
        expect(res.startsWith('test-folder/'), 'Should start with test-folder folder').to.be.true
    })

    it('check extension', () => {
        // having
        const cfg:BackupConfig = new BackupConfig();
        const ext:string = 'my-bkp-ext';
        cfg.extension = ext

        // when
        const res:string = BackupService.prepareFilePath(cfg);

        // then
        expect(res.endsWith(ext), 'Should have specified extension').to.be.true
    })

    it('check if timestamp is turned off', () => {
        // having
        const cfg:BackupConfig = new BackupConfig();
        cfg.timestamp = false

        // when
        const res:string = BackupService.prepareFilePath(cfg);

        // then
        expect(res).to.include('/backups/backup.bkp', 'Should not have timestamp in the file name')
    })
})

describe('BackupService', () => {

    it('deleteBackup: check when turned off', () => {
        // when
        const cfg = new Config();
        cfg.backup.deleteBackup = false;
        const bs = new BackupService({cfg: cfg} as IDatabaseMigrationHandler);

        // then
        bs.deleteBackup()
    })

    it('restore: check when no file', async () => {
        // when
        const cfg = new Config();
        cfg.backup.deleteBackup = false;
        const bs = new BackupService({cfg: cfg} as IDatabaseMigrationHandler);

        // then
        await expect(bs.restore()).to.be.rejectedWith("Cannot open undefined");
    })

    it('backup: file overwrite', async () => {
        // when
        const cfg = new Config();
        cfg.backup.deleteBackup = false;
        cfg.backup.timestamp = false;
        cfg.backup.suffix = `-backup-file-overwrite-${new Date().getTime()}`;
        const bs = new BackupService({
            cfg: cfg,
            async backup(): Promise<string> {
                return 'data'
            }
        } as IDatabaseMigrationHandler);

        // and: stub methods
        const fn = sinon.stub(fs, 'existsSync')
            .callsFake((v) => { return true })
        const fn2 = sinon.stub(fs, 'renameSync')
            .callsFake((v, v2) => {return true })

        // then
        await bs.backup()

        fn.restore()
        fn2.restore()
    })
})