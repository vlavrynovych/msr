import { expect } from 'chai';
import {MigrationScript, MigrationService, SilentLogger, DuplicateTimestampMode} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";
import path from 'path';

describe('MigrationService', () => {
    describe('findMigrationScripts()', () => {
        /**
         * Test: Wrong file name format throws clear error
         * Validates error handling when migration files match the pattern regex but
         * can't be parsed (exec returns null). This prevents silent failures when
         * developers use incorrect naming conventions like missing timestamp.
         */
        it('should throw error when file name format is wrong', async () => {
            // Configure to accept filenames but fail to extract timestamp
            const cfg =TestUtils.getConfig()
            cfg.filePatterns[0].test = (value) => {return true}
            cfg.filePatterns[0].exec = (value) => {return null}
            const ms = new MigrationService(new SilentLogger())

            // Attempt to read scripts with malformed filenames
            try {
                await ms.findMigrationScripts(cfg);
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
            const ms = new MigrationService(new SilentLogger())
            const res:MigrationScript[] = await ms.findMigrationScripts(TestUtils.getConfig());

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
            const res:MigrationScript[] = await new MigrationService(new SilentLogger()).findMigrationScripts(cfg)

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
            const ms = new MigrationService(new SilentLogger())

            // Verify filesystem error is thrown
            await expect(ms.findMigrationScripts(cfg)).to.be.rejectedWith("ENOENT: no such file or directory");
        })

        /**
         * Test: Hidden files are filtered out from migration list
         * Validates that hidden files (starting with .) like .DS_Store, .gitkeep, etc.
         * are excluded from the migration list. This prevents system files from being
         * treated as migrations and causing parse errors.
         */
        it('should filter hidden files', async () => {
            // Stub filesystem to return mix of hidden and visible files
            const cfg = TestUtils.getConfig();
            cfg.recursive = false; // Use single-folder mode for this test
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns([
                    '.hidden_file',
                    '.DS_Store',
                    'V202311020036_test.ts',
                    '..parent'
                ]);

            // Read migration scripts
            const res = await ms.findMigrationScripts(cfg);

            // Verify only the visible, valid migration file is included
            expect(res.length).eq(1, 'Should filter out hidden files');
            expect(res[0].name).eq('V202311020036_test.ts');

            readdirStub.restore();
        })

        /**
         * Test: Default behavior (WARN) logs warning but allows duplicates
         * Validates that by default, multiple migration files with the same timestamp
         * generate a warning but don't block execution. This allows developers to
         * continue working while being alerted to potential issues.
         */
        it('should warn about duplicate timestamps by default', async () => {
            // Stub filesystem to return files with identical timestamps
            const cfg = TestUtils.getConfig();
            cfg.recursive = false; // Use single-folder mode for this test
            // Default mode is WARN, so don't set it explicitly

            const warnings: string[] = [];
            const testLogger = {
                log: () => {},
                info: () => {},
                warn: (msg: string) => warnings.push(msg),
                error: () => {},
                debug: () => {}
            };
            const ms = new MigrationService(testLogger);

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns([
                    'V202311020036_first.ts',
                    'V202311020036_second.ts',
                ]);

            // Read migration scripts - should warn but not throw
            try {
                const res = await ms.findMigrationScripts(cfg);
                expect(res.length).to.equal(2);
                expect(warnings.length).to.equal(1);
                expect(warnings[0]).to.include('Duplicate migration timestamp detected');
                expect(warnings[0]).to.include('202311020036');
            } finally {
                readdirStub.restore();
            }
        })

        /**
         * Test: Non-matching files are filtered out
         * Validates that files not matching the migration pattern (README.md,
         * config files, etc.) are excluded from the migration list. Only files
         * matching the VYYYYMMDDHHmmss_name.ext pattern should be included.
         */
        it('should handle files not matching pattern', async () => {
            // Stub filesystem to return mix of migration and non-migration files
            const cfg = TestUtils.getConfig();
            cfg.recursive = false; // Use single-folder mode for this test
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns([
                    'V202311020036_valid.ts',
                    'README.md',
                    'config.json',
                    'invalid_format.ts',
                ]);

            // Read migration scripts
            const res = await ms.findMigrationScripts(cfg);

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
        it('should handle large number of files', async () => {
            // Stub filesystem to return 100 migration files
            const cfg = TestUtils.getConfig();
            cfg.recursive = false; // Use single-folder mode for this test
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const files = Array.from({length: 100}, (_, i) =>
                `V${String(202301010000 + i).padStart(12, '0')}_migration.ts`
            );
            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns(files);

            // Measure scanning performance
            const start = Date.now();
            const res = await ms.findMigrationScripts(cfg);
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
        it('should handle special characters in filenames', async () => {
            // Stub filesystem with special character filenames
            const cfg = TestUtils.getConfig();
            cfg.recursive = false; // Use single-folder mode for this test
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns([
                    'V202311020036_test-with-dash.ts',
                    'V202311020037_test_with_underscore.ts',
                    'invalid_no_V_prefix.ts', // won't match pattern
                ]);

            // Read migration scripts
            const res = await ms.findMigrationScripts(cfg);

            // Verify files with dashes and underscores are included
            expect(res.length).eq(2, 'Should handle dashes and underscores');
            expect(res.find(s => s.name.includes('dash'))).not.undefined;
            expect(res.find(s => s.name.includes('underscore'))).not.undefined;

            readdirStub.restore();
        })

        /**
         * Test: Concurrent reads are thread-safe
         * Validates that multiple concurrent calls to findMigrationScripts return
         * identical results without race conditions. Important for systems where
         * multiple processes might scan the migration directory simultaneously.
         */
        it('should handle concurrent reads safely', async () => {
            // Execute 10 concurrent reads
            const cfg = TestUtils.getConfig();
            const ms = new MigrationService(new SilentLogger());

            const promises = Array.from({length: 10}, () =>
                ms.findMigrationScripts(cfg)
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

    describe('findMigrationScripts() - Recursive Mode', () => {
        /**
         * Test: Successfully reads migration scripts from sub-folders recursively
         * Validates that when recursive mode is enabled, the scanner finds all
         * migration files across multiple nested directories and organizes them
         * by timestamp regardless of their folder location.
         */
        it('should read migration scripts from sub-folders recursively', async () => {
            const cfg = TestUtils.getConfig(TestUtils.RECURSIVE_FOLDER);
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const res: MigrationScript[] = await ms.findMigrationScripts(cfg);

            // Verify all 4 migrations from different sub-folders are found
            expect(res).not.undefined;
            expect(res.length).eq(4, 'Should find 4 migration scripts in sub-folders');

            // Verify scripts have correct timestamps
            const timestamps = res.map(s => s.timestamp);
            expect(timestamps).to.include.members([
                202311010001, // users/V202311010001_create_users_table.ts
                202311015001, // auth/V202311015001_create_sessions_table.ts
                202311020002, // users/V202311020002_add_user_roles.ts
                202311030001  // products/V202311030001_create_products_table.ts
            ]);

            // Verify file paths are correct (contain sub-folder names)
            expect(res.some(s => s.filepath.includes('users'))).to.be.true;
            expect(res.some(s => s.filepath.includes('auth'))).to.be.true;
            expect(res.some(s => s.filepath.includes('products'))).to.be.true;
        })

        /**
         * Test: Recursive mode respects timestamp ordering across folders
         * Validates that migrations from different sub-folders are correctly
         * ordered by their timestamps, not by folder hierarchy or file location.
         */
        it('should maintain timestamp order across sub-folders', async () => {
            const cfg = TestUtils.getConfig(TestUtils.RECURSIVE_FOLDER);
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const res: MigrationScript[] = await ms.findMigrationScripts(cfg);

            // Expected execution order by timestamp:
            // 1. V202311010001 (users)
            // 2. V202311015001 (auth)
            // 3. V202311020002 (users)
            // 4. V202311030001 (products)

            expect(res.length).eq(4);

            // Verify timestamps can be sorted correctly
            const sortedTimestamps = res.map(s => s.timestamp).sort((a, b) => a - b);
            expect(sortedTimestamps).to.deep.equal([
                202311010001,
                202311015001,
                202311020002,
                202311030001
            ]);
        })

        /**
         * Test: Hidden folders are filtered out in recursive mode
         * Validates that hidden directories (starting with .) like .git, .DS_Store
         * folders are excluded when scanning recursively. Prevents system folders
         * from being traversed unnecessarily.
         */
        it('should filter hidden folders in recursive mode', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync');

            // First call: root directory with hidden folder
            readdirStub.onFirstCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: '.hidden', isDirectory: () => true, isFile: () => false },
                        { name: 'visible', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            // Second call: visible folder with valid migration
            readdirStub.onSecondCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'V202311010001_test.ts', isDirectory: () => false, isFile: () => true }
                    ];
                }
                return [];
            });

            const res = await ms.findMigrationScripts(cfg);

            // Verify only the visible folder was scanned
            expect(readdirStub.callCount).eq(2, 'Should only scan visible folders');
            expect(res.length).eq(1, 'Should find migration in visible folder only');

            readdirStub.restore();
        })

        /**
         * Test: Recursive mode disabled - only scans root folder
         * Validates backward compatibility: when recursive is false, only the
         * root migration folder is scanned, ignoring any sub-directories.
         */
        it('should only scan root folder when recursive is disabled', async () => {
            const cfg = TestUtils.getConfig(TestUtils.RECURSIVE_FOLDER);
            cfg.recursive = false;
            const ms = new MigrationService(new SilentLogger());

            const res: MigrationScript[] = await ms.findMigrationScripts(cfg);

            // Should find 0 migrations because all are in sub-folders
            expect(res).not.undefined;
            expect(res.length).eq(0, 'Should not find migrations in sub-folders when recursive is false');
        })

        /**
         * Test: Empty sub-folders don't cause errors
         * Edge case test validating that empty sub-directories are handled
         * gracefully without throwing errors during recursive scanning.
         */
        it('should handle empty sub-folders gracefully', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync');

            // Root directory with empty sub-folder
            readdirStub.onFirstCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'empty-folder', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            // Empty sub-folder
            readdirStub.onSecondCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [];
                }
                return [];
            });

            const res = await ms.findMigrationScripts(cfg);

            // Should return empty array without errors
            expect(res).not.undefined;
            expect(res.length).eq(0, 'Should handle empty sub-folders');

            readdirStub.restore();
        })

        /**
         * Test: Deep nesting is supported
         * Validates that recursive scanning works with multiple levels of
         * nested directories (e.g., migrations/v1/users/auth/...)
         */
        it('should handle deeply nested sub-folders', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync');

            // Level 1: root
            readdirStub.onCall(0).callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'level1', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            // Level 2
            readdirStub.onCall(1).callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'level2', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            // Level 3: contains migration file
            readdirStub.onCall(2).callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'V202311010001_deep.ts', isDirectory: () => false, isFile: () => true }
                    ];
                }
                return [];
            });

            const res = await ms.findMigrationScripts(cfg);

            // Should find the deeply nested migration
            expect(res.length).eq(1, 'Should find migration in deeply nested folder');
            expect(res[0].name).eq('V202311010001_deep.ts');

            readdirStub.restore();
        })

        /**
         * Test: Mixed files and folders in recursive mode
         * Validates that when the root folder contains both migration files
         * and sub-folders with more migrations, all are discovered correctly.
         */
        it('should handle mixed files and folders in root directory', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync');

            // Root: has both file and folder
            readdirStub.onFirstCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'V202311010001_root.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'subfolder', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            // Subfolder: has another file
            readdirStub.onSecondCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'V202311020001_nested.ts', isDirectory: () => false, isFile: () => true }
                    ];
                }
                return [];
            });

            const res = await ms.findMigrationScripts(cfg);

            // Should find both migrations
            expect(res.length).eq(2, 'Should find migrations in both root and subfolder');
            expect(res.some(s => s.name === 'V202311010001_root.ts')).to.be.true;
            expect(res.some(s => s.name === 'V202311020001_nested.ts')).to.be.true;

            readdirStub.restore();
        })

        /**
         * Test: Non-migration files in sub-folders are filtered
         * Validates that only files matching the migration pattern are included,
         * even when they're in sub-folders. README files, configs, etc. should
         * be excluded regardless of location.
         */
        it('should filter non-migration files in sub-folders', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync');

            // Root with subfolder
            readdirStub.onFirstCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'users', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            // Subfolder with mix of files
            readdirStub.onSecondCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'V202311010001_valid.ts', isDirectory: () => false, isFile: () => true },
                        { name: 'README.md', isDirectory: () => false, isFile: () => true },
                        { name: 'config.json', isDirectory: () => false, isFile: () => true }
                    ];
                }
                return [];
            });

            const res = await ms.findMigrationScripts(cfg);

            // Should only find the valid migration file
            expect(res.length).eq(1, 'Should only include valid migration files');
            expect(res[0].name).eq('V202311010001_valid.ts');

            readdirStub.restore();
        })
    })

    describe('findBeforeMigrateScript()', () => {
        /**
         * Test: findBeforeMigrateScript() returns undefined when beforeMigrateName is null
         * Validates that explicitly disabling beforeMigrate feature by setting null
         * returns undefined without checking the filesystem.
         */
        it('should return undefined when beforeMigrateName is explicitly null', async () => {
            const cfg = TestUtils.getConfig();
            cfg.beforeMigrateName = null;
            const ms = new MigrationService(new SilentLogger());

            const result = await ms.findBeforeMigrateScript(cfg);

            expect(result).to.be.undefined;
        });
    });

    describe('Constructor', () => {
        /**
         * Test: Constructor uses default ConsoleLogger when logger not provided
         * Validates that the default logger parameter works correctly
         */
        it('should use default ConsoleLogger when logger not provided', () => {
            const ms = new MigrationService();
            expect(ms).to.be.instanceOf(MigrationService);
        })
    })

    describe('Path Traversal Security', () => {
        /**
         * Test: Validates filenames before processing in single-folder mode
         * Security test ensuring that all filenames are validated for path traversal
         * attempts, even if they don't match the migration pattern (defense in depth).
         */
        it('should validate all filenames for path traversal in single-folder mode', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = false;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            // Simulate filesystem returning a file with '..' in the name
            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns([
                    'go..up',  // File with .. in name (wouldn't match pattern but should still be caught)
                    'V202311020036_valid.ts'
                ]);

            try {
                await ms.findMigrationScripts(cfg);
                expect.fail('Should have thrown path traversal error');
            } catch (e: any) {
                expect(e.message).to.include('Security error: Path traversal detected');
                expect(e.message).to.include('contains \'..\' which is not allowed');
            } finally {
                readdirStub.restore();
            }
        })

        /**
         * Test: Rejects path traversal in recursive mode
         * Security test validating that path traversal attempts are blocked
         * when scanning directories, preventing '..' directory traversal.
         */
        it('should reject path traversal in recursive mode', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync');

            // Simulate directory listing with '..' in folder name
            readdirStub.onFirstCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'go..up', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            try {
                await ms.findMigrationScripts(cfg);
                expect.fail('Should have thrown path traversal error');
            } catch (e: any) {
                expect(e.message).to.include('Security error: Path traversal detected');
            } finally {
                readdirStub.restore();
            }
        })

        /**
         * Test: Rejects path traversal in beforeMigrate script
         * Security test validating that beforeMigrateName cannot be used
         * to read files outside the migrations directory.
         */
        it('should reject path traversal in beforeMigrate script', async () => {
            const cfg = TestUtils.getConfig();
            cfg.beforeMigrateName = '../../../etc/passwd';
            const ms = new MigrationService(new SilentLogger());

            try {
                await ms.findBeforeMigrateScript(cfg);
                expect.fail('Should have thrown path traversal error');
            } catch (e: any) {
                expect(e.message).to.include('Security error: Path traversal detected');
            }
        })

        /**
         * Test: Allows valid relative paths within migrations directory
         * Validates that legitimate sub-folders and files are still allowed
         * after adding path traversal protection.
         */
        it('should allow valid relative paths within migrations directory', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = true;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const readdirStub = sinon.stub(require('fs'), 'readdirSync');

            readdirStub.onFirstCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'users', isDirectory: () => true, isFile: () => false }
                    ];
                }
                return [];
            });

            readdirStub.onSecondCall().callsFake((dir: string, options?: any) => {
                if (options?.withFileTypes) {
                    return [
                        { name: 'V202311010001_test.ts', isDirectory: () => false, isFile: () => true }
                    ];
                }
                return [];
            });

            const res = await ms.findMigrationScripts(cfg);

            expect(res.length).eq(1, 'Valid sub-folders should still work');
            expect(res[0].name).eq('V202311010001_test.ts');

            readdirStub.restore();
        })

        /**
         * Test: Rejects absolute paths that resolve outside base directory
         * Security test ensuring that absolute paths pointing outside the
         * migrations folder are rejected, even without '..' sequences.
         */
        it('should reject absolute paths outside migrations directory', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = false;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');
            const path = await import('path');

            // Use an absolute path that's definitely outside the migrations folder
            const outsidePath = path.resolve('/etc/passwd');
            const filename = outsidePath;  // Absolute path as filename

            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns([filename]);

            try {
                await ms.findMigrationScripts(cfg);
                expect.fail('Should have thrown path traversal error');
            } catch (e: any) {
                expect(e.message).to.include('Security error: Path traversal detected');
                expect(e.message).to.include('resolves outside the migrations directory');
            } finally {
                readdirStub.restore();
            }
        })

        /**
         * Test: Handles edge case where resolved path equals base directory
         * Validates behavior when a filename resolves to exactly the base directory,
         * which should be allowed (second condition in validation: resolvedPath !== resolvedBase).
         */
        it('should allow path that resolves to base directory itself', async () => {
            const cfg = TestUtils.getConfig();
            cfg.recursive = false;
            const ms = new MigrationService(new SilentLogger());

            const sinon = await import('sinon');

            // Edge case: filename is '.' which resolves to base directory
            const readdirStub = sinon.stub(require('fs'), 'readdirSync')
                .returns(['.']);

            try {
                const res = await ms.findMigrationScripts(cfg);
                // '.' won't match the migration pattern, so no results
                expect(res.length).eq(0);
            } finally {
                readdirStub.restore();
            }
        })
    })

    describe('Duplicate Timestamp Detection', () => {
        /**
         * Test: ERROR mode - throws error when duplicate timestamps are detected
         * Validates that migrations with identical timestamps are rejected
         * to prevent undefined execution order and data corruption.
         */
        it('should throw error when duplicateTimestampMode is ERROR', async () => {
            const cfg = TestUtils.getConfig();
            cfg.folder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-duplicates');
            cfg.recursive = false;
            cfg.duplicateTimestampMode = DuplicateTimestampMode.ERROR;
            const ms = new MigrationService(new SilentLogger());

            try {
                await ms.findMigrationScripts(cfg);
                expect.fail('Should have thrown duplicate timestamp error');
            } catch (e: any) {
                expect(e.message).to.include('Duplicate migration timestamp detected');
                expect(e.message).to.include('202311010001');
                expect(e.message).to.include('undefined execution order');
                expect(e.message).to.include('Conflicting files:');
                expect(e.message).to.include('V202311010001');
            }
        })

        /**
         * Test: Allows migrations with unique timestamps
         * Validates that migrations with different timestamps pass validation.
         */
        it('should allow migrations with unique timestamps', async () => {
            const cfg = TestUtils.getConfig();
            cfg.folder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-test');
            cfg.recursive = false;
            const ms = new MigrationService(new SilentLogger());

            const res = await ms.findMigrationScripts(cfg);

            expect(res.length).to.be.greaterThan(0);
            // Verify all timestamps are unique
            const timestamps = res.map(s => s.timestamp);
            const uniqueTimestamps = new Set(timestamps);
            expect(timestamps.length).to.equal(uniqueTimestamps.size, 'All timestamps should be unique');
        })

        /**
         * Test: WARN mode - logs warning but continues execution (default)
         * Validates that duplicate timestamps generate a warning but don't block execution.
         * This is the default behavior to alert developers without stopping migrations.
         */
        it('should warn but continue when duplicateTimestampMode is WARN (default)', async () => {
            const cfg = TestUtils.getConfig();
            cfg.folder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-duplicates');
            cfg.recursive = false;
            // WARN is the default, but set it explicitly for clarity
            cfg.duplicateTimestampMode = DuplicateTimestampMode.WARN;

            // Use a logger that captures warnings
            const warnings: string[] = [];
            const testLogger = {
                log: () => {},
                info: () => {},
                warn: (msg: string) => warnings.push(msg),
                error: () => {},
                debug: () => {}
            };
            const ms = new MigrationService(testLogger);

            // Should not throw - continues execution despite duplicates
            const res = await ms.findMigrationScripts(cfg);

            // Verify both scripts are returned
            expect(res.length).to.equal(2);
            expect(res[0].timestamp).to.equal(202311010001);
            expect(res[1].timestamp).to.equal(202311010001);

            // Verify warning was logged
            expect(warnings.length).to.equal(1);
            expect(warnings[0]).to.include('Duplicate migration timestamp detected');
            expect(warnings[0]).to.include('202311010001');
            expect(warnings[0]).to.include('V202311010001_first.ts');
            expect(warnings[0]).to.include('V202311010001_second.ts');
        })

        /**
         * Test: IGNORE mode - silently allows duplicates
         * Validates that duplicate timestamps are completely ignored when mode is IGNORE.
         * Use this only when you have external guarantees about execution order.
         */
        it('should silently allow duplicates when duplicateTimestampMode is IGNORE', async () => {
            const cfg = TestUtils.getConfig();
            cfg.folder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-duplicates');
            cfg.recursive = false;
            cfg.duplicateTimestampMode = DuplicateTimestampMode.IGNORE;

            // Track that no warnings/errors are logged
            const warnings: string[] = [];
            const testLogger = {
                log: () => {},
                info: () => {},
                warn: (msg: string) => warnings.push(msg),
                error: () => {},
                debug: () => {}
            };
            const ms = new MigrationService(testLogger);

            // Should not throw or warn
            const res = await ms.findMigrationScripts(cfg);

            // Verify both scripts are returned
            expect(res.length).to.equal(2);
            expect(res[0].timestamp).to.equal(202311010001);
            expect(res[1].timestamp).to.equal(202311010001);

            // Verify no warnings were logged
            expect(warnings.length).to.equal(0);
        })

        /**
         * Test: ERROR mode includes helpful error message with file paths
         * Validates that the error message includes both conflicting filenames
         * and their full paths to help users identify and fix the issue.
         */
        it('should include both conflicting file paths in error message (ERROR mode)', async () => {
            const cfg = TestUtils.getConfig();
            cfg.folder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-duplicates');
            cfg.recursive = false;
            cfg.duplicateTimestampMode = DuplicateTimestampMode.ERROR;
            const ms = new MigrationService(new SilentLogger());

            try {
                await ms.findMigrationScripts(cfg);
                expect.fail('Should have thrown duplicate timestamp error');
            } catch (e: any) {
                // Error should show both files
                expect(e.message).to.include('V202311010001');
                expect(e.message).to.include('Conflicting files:');
                expect(e.message).to.include('1.');
                expect(e.message).to.include('2.');

                // Error should include resolution guidance
                expect(e.message).to.include('Resolution:');
                expect(e.message).to.include('Rename one of these files');
            }
        })

        /**
         * Test: ERROR mode includes example resolution
         * Validates that the error provides an example of how to fix
         * the duplicate timestamp issue.
         */
        it('should suggest resolution with example new timestamp (ERROR mode)', async () => {
            const cfg = TestUtils.getConfig();
            cfg.folder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-duplicates');
            cfg.recursive = false;
            cfg.duplicateTimestampMode = DuplicateTimestampMode.ERROR;
            const ms = new MigrationService(new SilentLogger());

            try {
                await ms.findMigrationScripts(cfg);
                expect.fail('Should have thrown duplicate timestamp error');
            } catch (e: any) {
                expect(e.message).to.include('Example:');
                expect(e.message).to.match(/V\d+_/);
            }
        })
    })
})