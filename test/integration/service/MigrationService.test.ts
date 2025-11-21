import { expect } from 'chai';
import {MigrationScript, MigrationService} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

describe('MigrationService', () => {

    /**
     * Test: Wrong file name format throws clear error
     * Validates error handling when migration files match the pattern regex but
     * can't be parsed (exec returns null). This prevents silent failures when
     * developers use incorrect naming conventions like missing timestamp.
     */
    it('should throw error when file name format is wrong', async () => {
        // Configure to accept filenames but fail to extract timestamp
        const cfg =TestUtils.getConfig()
        cfg.filePattern.test = (value) => {return true}
        cfg.filePattern.exec = (value) => {return null}
        const ms = new MigrationService()

        // Attempt to read scripts with malformed filenames
        try {
            await ms.readMigrationScripts(cfg);
            expect.fail('Should have thrown');
        } catch (e: any) {
            // Verify clear error message helps developers fix naming
            expect(e.message).to.eq("Wrong file name format");
            expect(e).to.be.instanceOf(Error);
        }
    })

    /**
     * Test: Successfully reads valid migration scripts from directory
     * Validates the happy path: reading migration files from a directory and
     * parsing their metadata (timestamp, name, filepath). The script content
     * should NOT be loaded yet (lazy loading pattern).
     */
    it('should read valid migration scripts successfully', async () => {
        // Read migration scripts from test directory
        const ms = new MigrationService()
        const res:MigrationScript[] = await ms.readMigrationScripts(TestUtils.getConfig());

        // Verify one script was found with correct metadata
        expect(res).not.undefined
        expect(res.length).eq(1, '1 script should be found')

        const script:MigrationScript = res[0];
        expect(script).not.undefined
        expect(script.script).is.undefined // Content not loaded yet (lazy loading)
        expect(script.name).not.undefined
        expect(script.filepath).not.undefined
        expect(script.timestamp).not.undefined
        expect(script.timestamp > 0).is.true
        expect(script.timestamp).eq(202311020036)
    })

    /**
     * Test: Empty directory returns empty array
     * Edge case test validating that a directory with no migration files
     * returns an empty array rather than throwing an error. This is the
     * expected behavior for projects with no migrations yet.
     */
    it('should return empty array for empty folder', async () => {
        // Read from empty test directory
        const cfg = TestUtils.getConfig(TestUtils.EMPTY_FOLDER)
        const res:MigrationScript[] = await new MigrationService().readMigrationScripts(cfg)

        // Verify empty array is returned without errors
        expect(res).not.undefined
        expect(res.length).eq(0, 'Should be 0 migrations in empty folder')
    })

    /**
     * Test: Non-existent directory throws filesystem error
     * Error handling test validating that attempting to read from a non-existent
     * directory fails with a clear filesystem error. Helps developers catch
     * misconfigured migration paths.
     */
    it('should throw error when folder is not found', async () => {
        // Attempt to read from non-existent directory
        const cfg = TestUtils.getConfig('non-existent-folder')
        const ms = new MigrationService()

        // Verify filesystem error is thrown
        await expect(ms.readMigrationScripts(cfg)).to.be.rejectedWith("ENOENT: no such file or directory");
    })

    /**
     * Test: Hidden files are filtered out from migration list
     * Validates that hidden files (starting with .) like .DS_Store, .gitkeep, etc.
     * are excluded from the migration list. This prevents system files from being
     * treated as migrations and causing parse errors.
     */
    it('readMigrationScripts: should filter hidden files', async () => {
        // Stub filesystem to return mix of hidden and visible files
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                '.hidden_file',
                '.DS_Store',
                'V202311020036_test.ts',
                '..parent'
            ]);

        // Read migration scripts
        const res = await ms.readMigrationScripts(cfg);

        // Verify only the visible, valid migration file is included
        expect(res.length).eq(1, 'Should filter out hidden files');
        expect(res[0].name).eq('V202311020036_test.ts');

        readdirStub.restore();
    })

    /**
     * Test: Duplicate timestamps are allowed (handled at execution level)
     * Validates that multiple migration files with the same timestamp are all
     * included in the results. Timestamp deduplication happens at the execution
     * level, not during discovery. This allows developers to fix conflicts.
     */
    it('readMigrationScripts: should handle duplicate timestamps', async () => {
        // Stub filesystem to return files with identical timestamps
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                'V202311020036_first.ts',
                'V202311020036_second.ts',
            ]);

        // Read migration scripts
        const res = await ms.readMigrationScripts(cfg);

        // Verify both files are included (conflict resolution happens later)
        expect(res.length).eq(2, 'Should include both files with same timestamp');
        expect(res[0].timestamp).eq(202311020036);
        expect(res[1].timestamp).eq(202311020036);
        expect(res[0].name).not.eq(res[1].name, 'Should have different names');

        readdirStub.restore();
    })

    /**
     * Test: Non-matching files are filtered out
     * Validates that files not matching the migration pattern (README.md,
     * config files, etc.) are excluded from the migration list. Only files
     * matching the VYYYYMMDDHHmmss_name.ext pattern should be included.
     */
    it('readMigrationScripts: should handle files not matching pattern', async () => {
        // Stub filesystem to return mix of migration and non-migration files
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                'V202311020036_valid.ts',
                'README.md',
                'config.json',
                'invalid_format.ts',
            ]);

        // Read migration scripts
        const res = await ms.readMigrationScripts(cfg);

        // Verify only the valid migration file is included
        expect(res.length).eq(1, 'Should only include files matching pattern');
        expect(res[0].name).eq('V202311020036_valid.ts');

        readdirStub.restore();
    })

    /**
     * Test: Large number of migration files performs efficiently
     * Performance test with 100 migration files. Validates that scanning a
     * large migration directory completes quickly (< 1s) and that files are
     * returned in correct timestamp order. Important for projects with many
     * migrations accumulated over time.
     */
    it('readMigrationScripts: should handle large number of files', async () => {
        // Stub filesystem to return 100 migration files
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        const sinon = await import('sinon');
        const files = Array.from({length: 100}, (_, i) =>
            `V${String(202301010000 + i).padStart(12, '0')}_migration.ts`
        );
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns(files);

        // Measure scanning performance
        const start = Date.now();
        const res = await ms.readMigrationScripts(cfg);
        const duration = Date.now() - start;

        // Verify all files processed quickly and in correct order
        expect(res.length).eq(100, 'Should process all 100 files');
        expect(duration).to.be.lessThan(1000, 'Should process quickly (< 1s)');

        // Verify timestamp ordering is maintained
        for (let i = 1; i < res.length; i++) {
            expect(res[i].timestamp).to.be.greaterThan(res[i-1].timestamp,
                'Files should maintain timestamp order');
        }

        readdirStub.restore();
    })

    /**
     * Test: Special characters in filenames are handled
     * Validates that migration filenames with dashes, underscores, and other
     * special characters are parsed correctly. Common pattern: V{timestamp}_{description}.ts
     * where description can contain hyphens and underscores.
     */
    it('readMigrationScripts: should handle special characters in filenames', async () => {
        // Stub filesystem with special character filenames
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        const sinon = await import('sinon');
        const readdirStub = sinon.stub(require('fs'), 'readdirSync')
            .returns([
                'V202311020036_test-with-dash.ts',
                'V202311020037_test_with_underscore.ts',
                'invalid_no_V_prefix.ts', // won't match pattern
            ]);

        // Read migration scripts
        const res = await ms.readMigrationScripts(cfg);

        // Verify files with dashes and underscores are included
        expect(res.length).eq(2, 'Should handle dashes and underscores');
        expect(res.find(s => s.name.includes('dash'))).not.undefined;
        expect(res.find(s => s.name.includes('underscore'))).not.undefined;

        readdirStub.restore();
    })

    /**
     * Test: Concurrent reads are thread-safe
     * Validates that multiple concurrent calls to readMigrationScripts return
     * identical results without race conditions. Important for systems where
     * multiple processes might scan the migration directory simultaneously.
     */
    it('readMigrationScripts: should handle concurrent reads safely', async () => {
        // Execute 10 concurrent reads
        const cfg = TestUtils.getConfig();
        const ms = new MigrationService();

        const promises = Array.from({length: 10}, () =>
            ms.readMigrationScripts(cfg)
        );

        // Wait for all reads to complete
        const results = await Promise.all(promises);

        // Verify all reads succeeded with identical results
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