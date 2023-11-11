import { expect } from 'chai';
import {MigrationScript, MigrationService} from "../../src";
import {TestUtils} from "../TestUtils";

describe('MigrationService', () => {


    it('readMigrationScripts: wrong file name format', async () => {
        // when:
        const cfg =TestUtils.getConfig()
        cfg.filePattern.test = (value) => {return true}
        cfg.filePattern.exec = (value) => {return null}
        const ms = new MigrationService()

        // then
        await expect(ms.readMigrationScripts(cfg)).to.be.rejectedWith("Wrong file name format");
    })

    it('readMigrationScripts: success', async () => {
        // when:
        const ms = new MigrationService()
        const res:MigrationScript[] = await ms.readMigrationScripts(TestUtils.getConfig());

        // then
        expect(res).not.undefined
        expect(res.length).eq(1, '1 script should be found')

        const script:MigrationScript = res[0];
        expect(script).not.undefined
        expect(script.script).is.undefined
        expect(script.name).not.undefined
        expect(script.filepath).not.undefined
        expect(script.timestamp).not.undefined
        expect(script.timestamp > 0).is.true
        expect(script.timestamp).eq(202311020036)
    })

    it('readMigrationScripts: empty folder', async () => {
        // when:
        const cfg = TestUtils.getConfig(TestUtils.EMPTY_FOLDER)
        const res:MigrationScript[] = await new MigrationService().readMigrationScripts(cfg)

        // then
        expect(res).not.undefined
        expect(res.length).eq(0, 'Should be 0 migrations in empty folder')
    })
})