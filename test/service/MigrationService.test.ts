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

    it('readMigrationScripts: folder not found', async () => {
        // when:
        const cfg = TestUtils.getConfig('non-existent-folder')
        const ms = new MigrationService()

        // then
        await expect(ms.readMigrationScripts(cfg)).to.be.rejectedWith("ENOENT: no such file or directory");
    })

    it('readMigrationScripts: should filter hidden files', async () => {
        // when:
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        // and: stub to include hidden files
        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                '.hidden_file',
                '.DS_Store',
                'V202311020036_test.ts',
                '..parent'
            ]);

        // when
        const res = await ms.readMigrationScripts(cfg);

        // then: should only include non-hidden file
        expect(res.length).eq(1, 'Should filter out hidden files');
        expect(res[0].name).eq('V202311020036_test.ts');

        readdirStub.restore();
    })

    it('readMigrationScripts: should handle duplicate timestamps', async () => {
        // when:
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        // and: stub to return files with duplicate timestamps
        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                'V202311020036_first.ts',
                'V202311020036_second.ts',
            ]);

        // when
        const res = await ms.readMigrationScripts(cfg);

        // then: should include both files (no deduplication at this level)
        expect(res.length).eq(2, 'Should include both files with same timestamp');
        expect(res[0].timestamp).eq(202311020036);
        expect(res[1].timestamp).eq(202311020036);
        expect(res[0].name).not.eq(res[1].name, 'Should have different names');

        readdirStub.restore();
    })

    it('readMigrationScripts: should handle files not matching pattern', async () => {
        // when:
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        // and: stub to return mixed files
        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                'V202311020036_valid.ts',
                'README.md',
                'config.json',
                'invalid_format.ts',
            ]);

        // when
        const res = await ms.readMigrationScripts(cfg);

        // then: should only include file matching pattern
        expect(res.length).eq(1, 'Should only include files matching pattern');
        expect(res[0].name).eq('V202311020036_valid.ts');

        readdirStub.restore();
    })

    it('readMigrationScripts: should handle large number of files', async () => {
        // when: create config with many files
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        // and: stub to return 100 valid migration files
        const sinon = await import('sinon');
        const files = Array.from({length: 100}, (_, i) =>
            `V${String(202301010000 + i).padStart(12, '0')}_migration.ts`
        );
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns(files);

        // when
        const start = Date.now();
        const res = await ms.readMigrationScripts(cfg);
        const duration = Date.now() - start;

        // then: should process all files efficiently
        expect(res.length).eq(100, 'Should process all 100 files');
        expect(duration).to.be.lessThan(1000, 'Should process quickly (< 1s)');

        // verify sorting/ordering is correct
        for (let i = 1; i < res.length; i++) {
            expect(res[i].timestamp).to.be.greaterThan(res[i-1].timestamp,
                'Files should maintain timestamp order');
        }

        readdirStub.restore();
    })

    it('readMigrationScripts: should handle special characters in filenames', async () => {
        // when:
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        // and: stub with special character filenames
        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                'V202311020036_test-with-dash.ts',
                'V202311020037_test_with_underscore.ts',
                'invalid_no_V_prefix.ts', // won't match pattern
            ]);

        // when
        const res = await ms.readMigrationScripts(cfg);

        // then
        expect(res.length).eq(2, 'Should handle dashes and underscores');
        expect(res.find(s => s.name.includes('dash'))).not.undefined;
        expect(res.find(s => s.name.includes('underscore'))).not.undefined;

        readdirStub.restore();
    })

    it('readMigrationScripts: should handle concurrent reads safely', async () => {
        // when: multiple concurrent reads
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        // when: call readMigrationScripts concurrently
        const promises = Array.from({length: 10}, () =>
            ms.readMigrationScripts(cfg)
        );

        // then: all should succeed with same results
        const results = await Promise.all(promises);

        expect(results.length).eq(10, 'All concurrent reads should succeed');
        results.forEach((res, i) => {
            expect(res.length).eq(results[0].length,
                `Result ${i} should have same length as first`);
            if (res.length > 0) {
                expect(res[0].timestamp).eq(results[0][0].timestamp,
                    'All results should be identical');
            }
        });
    })
})