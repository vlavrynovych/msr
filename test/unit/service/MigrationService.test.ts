import { expect } from 'chai';
import sinon from 'sinon';
import { MigrationService, SilentLogger } from '../../../src';

describe('MigrationService - Unit Tests', () => {
    afterEach(() => {
        sinon.restore();
    });

    describe('validateFileName - Path Resolution Edge Cases', () => {
        /**
         * Test: Validates the second security check in validateFileName
         * This test covers the branch where a filename doesn't contain '..'
         * but still resolves outside the base directory through path resolution.
         *
         * Covers: Line 72 in MigrationService.ts (throw statement)
         * Branch: (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase)
         */
        it('should reject paths that resolve outside base directory without .. sequences', () => {
            const ms = new MigrationService(new SilentLogger());
            const pathModule = require('path');

            // Mock path.resolve to simulate a case where the resolved path
            // ends up outside the base directory (e.g., through symlinks, Windows paths, etc.)
            const originalResolve = pathModule.resolve;
            const resolveStub = sinon.stub(pathModule, 'resolve');

            const baseDir = '/migrations';
            const fileName = 'sneaky-symlink-file.ts';

            // First call: resolve the fullPath (baseDir + fileName)
            // Return a path that's outside the base directory
            resolveStub.onCall(0).returns('/etc/passwd');

            // Second call: resolve the baseDir
            resolveStub.onCall(1).returns('/migrations');

            // Stub readdirSync to return our test filename
            const fsModule = require('fs');
            const readdirStub = sinon.stub(fsModule, 'readdirSync')
                .returns([fileName]);

            // Attempt to read migration scripts - should throw security error
            const config = { folder: baseDir, filePattern: /.*/, recursive: false };

            return (ms as any).readMigrationScripts(config)
                .then(() => {
                    expect.fail('Should have thrown path traversal error');
                })
                .catch((e: Error) => {
                    expect(e.message).to.include('Security error: Path traversal detected');
                    expect(e.message).to.include('resolves outside the migrations directory');
                })
                .finally(() => {
                    readdirStub.restore();
                    resolveStub.restore();
                });
        });

        /**
         * Test: Validates that paths resolving to exactly the base directory are allowed
         * This covers the edge case where resolvedPath === resolvedBase, which should
         * NOT throw an error (the second part of the AND condition prevents the throw).
         */
        it('should allow paths that resolve to exactly the base directory', () => {
            const ms = new MigrationService(new SilentLogger());
            const pathModule = require('path');

            const resolveStub = sinon.stub(pathModule, 'resolve');

            const baseDir = '/migrations';
            const fileName = '.';  // Current directory

            // Both resolve to the same path (base directory)
            resolveStub.returns('/migrations');

            // Stub readdirSync
            const fsModule = require('fs');
            const readdirStub = sinon.stub(fsModule, 'readdirSync')
                .returns([fileName]);

            const config = { folder: baseDir, filePattern: /^V.*\.ts$/, recursive: false };

            return (ms as any).readMigrationScripts(config)
                .then((result: any[]) => {
                    // Should not throw - '.' resolves to base directory which is allowed
                    // Won't match pattern so no results, but no error
                    expect(result).to.be.an('array');
                })
                .finally(() => {
                    readdirStub.restore();
                    resolveStub.restore();
                });
        });

        /**
         * Test: Normal case - file within base directory
         * Validates that legitimate files pass validation
         */
        it('should allow normal files within base directory', () => {
            const ms = new MigrationService(new SilentLogger());
            const pathModule = require('path');

            const resolveStub = sinon.stub(pathModule, 'resolve');
            const joinStub = sinon.stub(pathModule, 'join');

            const baseDir = '/migrations';
            const fileName = 'V202311010001_test.ts';

            // Setup proper path resolution
            joinStub.withArgs(baseDir, fileName).returns('/migrations/V202311010001_test.ts');
            resolveStub.withArgs('/migrations/V202311010001_test.ts').returns('/migrations/V202311010001_test.ts');
            resolveStub.withArgs(baseDir).returns('/migrations');

            // Also need path.sep
            Object.defineProperty(pathModule, 'sep', { value: '/', configurable: true });

            const fsModule = require('fs');
            const readdirStub = sinon.stub(fsModule, 'readdirSync')
                .returns([fileName]);

            const config = { folder: baseDir, filePattern: /^V(\d+)_(.+)\.ts$/, recursive: false };

            return (ms as any).readMigrationScripts(config)
                .then((result: any[]) => {
                    expect(result).to.be.an('array');
                    expect(result.length).to.be.greaterThan(0);
                    expect(result[0].name).to.equal(fileName);
                })
                .finally(() => {
                    readdirStub.restore();
                    joinStub.restore();
                    resolveStub.restore();
                });
        });
    });
});
