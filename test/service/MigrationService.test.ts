import { expect } from 'chai';
import {Config, MigrationService} from "../../src";

describe('MigrationService', () => {


    it('readMigrationScripts: wrong file name format', async () => {
        // when:
        const cfg = new Config()
        cfg.filePattern.test = (value) => {return true}
        cfg.filePattern.exec = (value) => {return null}
        const ms = new MigrationService(cfg)

        // then
        await expect(ms.readMigrationScripts()).to.be.rejectedWith("Wrong file name format");
    })
})