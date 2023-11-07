import { expect } from 'chai';
import {IMigrationInfo, IRunner} from "../../src";
import {TestUtils} from "../TestUtils";

describe('MigrationScript', () => {
    it('init: simple run', async () => {
        // when
        const ms = TestUtils.prepareMigration('V202311062345_valid.ts');
        expect(ms.script).is.undefined

        // and
        await ms.init();

        // then
        expect(ms.script).not.undefined
        expect(typeof ms.script.up === 'function').is.true
        expect(await ms.script.up({}, {} as IMigrationInfo, {} as IRunner)).eq('result string')
    })
})