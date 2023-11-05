import { expect } from 'chai';
import {BackupConfig, BackupService} from "../../src";

describe('BackupService.prepareFilePath', () => {


    it('check folder', () => {
        // when
        const cfg:BackupConfig = new BackupConfig();
        let res:string = BackupService.prepareFilePath(cfg);

        // then
        expect(res.startsWith('backups/'), 'Should have default folder').to.be.true

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
})