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
        cfg.backup.suffix = `-backup-file-overwrite-${Date.now()}`;
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return 'data'
                }
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

    it('backup: should handle write permission error', async () => {
        // having
        const cfg = new Config();
        cfg.backup.timestamp = false;
        cfg.backup.suffix = `-test-${Date.now()}`;
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return 'data'
                }
            }
        } as IDatabaseMigrationHandler);

        // and: stub writeFileSync to throw permission error
        const writeStub = sinon.stub(fs, 'writeFileSync')
            .throws(new Error('EACCES: permission denied'));

        // then
        await expect(bs.backup()).to.be.rejectedWith('EACCES: permission denied');

        writeStub.restore();
    })

    it('backup: should handle disk full error', async () => {
        // having
        const cfg = new Config();
        cfg.backup.timestamp = false;
        cfg.backup.suffix = `-test-${Date.now()}`;
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return 'data'
                }
            }
        } as IDatabaseMigrationHandler);

        // and: stub writeFileSync to throw disk full error
        const writeStub = sinon.stub(fs, 'writeFileSync')
            .throws(new Error('ENOSPC: no space left on device'));

        // then
        await expect(bs.backup()).to.be.rejectedWith('ENOSPC: no space left on device');

        writeStub.restore();
    })

    it('backup: should handle backup() method failure from handler', async () => {
        // having
        const cfg = new Config();
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    throw new Error('Database connection failed')
                }
            }
        } as IDatabaseMigrationHandler);

        // then
        await expect(bs.backup()).to.be.rejectedWith('Database connection failed');
    })

    it('restore: should handle corrupted backup data', async () => {
        // having
        const cfg = new Config();
        cfg.backup.timestamp = false;
        cfg.backup.suffix = `-corrupted-${Date.now()}`;
        let restoredData: string | undefined;
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return 'valid data'
                },
                async restore(data: string): Promise<any> {
                    restoredData = data;
                    if (data === 'corrupted') {
                        throw new Error('Failed to parse corrupted backup')
                    }
                    return Promise.resolve('restored')
                }
            }
        } as IDatabaseMigrationHandler);

        // and: create backup and then corrupt it
        await bs.backup();
        const readStub = sinon.stub(fs, 'readFileSync')
            .returns('corrupted' as any);

        // then
        await expect(bs.restore()).to.be.rejectedWith('Failed to parse corrupted backup');

        readStub.restore();
    })

    it('restore: should handle file read permission error', async () => {
        // having
        const cfg = new Config();
        cfg.backup.timestamp = false;
        cfg.backup.suffix = `-perm-test-${Date.now()}`;
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return 'data'
                },
                async restore(data: string): Promise<any> {
                    return Promise.resolve('restored')
                }
            }
        } as IDatabaseMigrationHandler);

        // and: create backup
        await bs.backup();

        // and: stub readFileSync to throw permission error
        const readStub = sinon.stub(fs, 'readFileSync')
            .throws(new Error('EACCES: permission denied'));

        // then
        await expect(bs.restore()).to.be.rejectedWith('EACCES: permission denied');

        readStub.restore();
    })

    it('deleteBackup: should handle file deletion error', async () => {
        // having
        const cfg = new Config();
        cfg.backup.deleteBackup = true;
        cfg.backup.timestamp = false;
        cfg.backup.suffix = `-delete-test-${Date.now()}`;
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return 'data'
                }
            }
        } as IDatabaseMigrationHandler);

        // and: create backup
        await bs.backup();

        // and: stub rmSync to throw error
        const rmStub = sinon.stub(fs, 'rmSync')
            .throws(new Error('EACCES: permission denied'));

        // then: should throw error
        expect(() => bs.deleteBackup()).to.throw('EACCES: permission denied');

        rmStub.restore();
    })

    it('deleteBackup: should handle already deleted file', () => {
        // having
        const cfg = new Config();
        cfg.backup.deleteBackup = true;
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return 'data'
                }
            }
        } as IDatabaseMigrationHandler);

        // when: delete without backup
        bs.deleteBackup();

        // then: should not throw (backupFile is undefined, early return)
        // No assertion needed, test passes if no exception
    })

    it('backup: should handle very large backup data', async () => {
        // having
        const cfg = new Config();
        cfg.backup.timestamp = false;
        cfg.backup.suffix = `-large-${Date.now()}`;
        const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string
        const bs = new BackupService({
            cfg: cfg,
            backup: {
                async backup(): Promise<string> {
                    return largeData
                }
            }
        } as IDatabaseMigrationHandler);

        // then: should handle large data without error
        await bs.backup();

        // cleanup
        bs.deleteBackup();
    })
})