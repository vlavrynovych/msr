import { expect } from 'chai';
import {BackupService, Config, IDAO} from "../../src";

const dao: IDAO = {
    restore(data: string): Promise<any> {
        return Promise.resolve("undefined");
    },
    backup(): Promise<string> {
        return Promise.resolve("test");
    },
    getName(): string {
        return "Firebase"
    }
}

describe('BackupService.prepareFilePath', () => {
    const cfg:Config = new Config(dao);

    it('check folder', () => {
        // when
        let res:string = BackupService.prepareFilePath(cfg);

        // then
        expect(res.startsWith('backups/'), 'Should have default folder').to.be.true

        // when: folder updated
        cfg.folders.backups = 'test-folder';
        res = BackupService.prepareFilePath(cfg);

        // then:
        expect(res.startsWith('test-folder/'), 'Should start with test-folder folder').to.be.true
    })

    it('check extension', () => {
        // having
        const ext:string = 'my-bkp-ext';
        cfg.backupOptions.extension = ext

        // when
        const res:string = BackupService.prepareFilePath(cfg);

        // then
        expect(res.endsWith(ext), 'Should have specified extension').to.be.true
    })
})