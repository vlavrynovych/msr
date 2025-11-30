import { expect } from 'chai';
import { TypeScriptLoader, MigrationScript, SilentLogger } from '../../../src';
import path from 'node:path';

describe('TypeScriptLoader', () => {
    let loader: TypeScriptLoader;
    const fixturesPath = path.join(process.cwd(), 'test', 'fixtures', 'migrations');

    beforeEach(() => {
        loader = new TypeScriptLoader(new SilentLogger());
    });

    describe('getName()', () => {
        it('should return "TypeScriptLoader"', () => {
            expect(loader.getName()).to.equal('TypeScriptLoader');
        });
    });

    describe('canHandle()', () => {
        it('should handle .ts files', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.ts')).to.be.true;
        });

        it('should handle .js files', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.js')).to.be.true;
        });

        it('should handle uppercase extensions', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.TS')).to.be.true;
            expect(loader.canHandle('/path/to/V202501220100_test.JS')).to.be.true;
        });

        it('should not handle .sql files', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.up.sql')).to.be.false;
        });

        it('should not handle files without extensions', () => {
            expect(loader.canHandle('/path/to/V202501220100_test')).to.be.false;
        });

        it('should not handle other extensions', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.py')).to.be.false;
            expect(loader.canHandle('/path/to/V202501220100_test.rb')).to.be.false;
        });
    });

    describe('load()', () => {
        it('should load a valid TypeScript migration', async () => {
            const script = new MigrationScript(
                'V202311062345_valid.ts',
                path.join(fixturesPath, 'V202311062345_valid.ts'),
                202311062345
            );

            const runnable = await loader.load(script);

            expect(runnable).to.exist;
            expect(typeof runnable.up).to.equal('function');
        });

        it('should throw error for file with no exports', async () => {
            const script = new MigrationScript(
                'V202311062345_empty.ts',
                path.join(fixturesPath, 'V202311062345_empty.ts'),
                202311062345
            );

            try {
                await loader.load(script);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('Cannot parse migration script');
                // Error can be either "no executable content found" or an import error
            }
        });

        it('should throw error for file with multiple exports', async () => {
            const script = new MigrationScript(
                'V202311062345_multiple_exports.ts',
                path.join(fixturesPath, 'V202311062345_multiple_exports.ts'),
                202311062345
            );

            try {
                await loader.load(script);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('Cannot parse migration script');
                expect((error as Error).message).to.include('multiple executable instances were found');
            }
        });

        it('should throw error for non-existent file', async () => {
            const script = new MigrationScript(
                'V999999999999_nonexistent.ts',
                path.join(fixturesPath, 'V999999999999_nonexistent.ts'),
                999999999999
            );

            try {
                await loader.load(script);
                expect.fail('Should have thrown an error');
            } catch (error) {
                // Import error will be thrown before our error message
                expect((error as Error).message).to.exist;
            }
        });

        it('should load script with down() method', async () => {
            const script = new MigrationScript(
                'V202311062345_with_down.ts',
                path.join(fixturesPath, 'V202311062345_with_down.ts'),
                202311062345
            );

            const runnable = await loader.load(script);

            expect(runnable).to.exist;
            expect(typeof runnable.up).to.equal('function');
            expect(typeof runnable.down).to.equal('function');
        });

        it('should instantiate exported class', async () => {
            const script = new MigrationScript(
                'V202311062345_valid.ts',
                path.join(fixturesPath, 'V202311062345_valid.ts'),
                202311062345
            );

            const runnable = await loader.load(script);

            // Verify it's an instance (has constructor)
            expect(runnable.constructor).to.exist;
            expect(runnable.constructor.name).to.not.equal('Object');
        });

        it('should handle non-Error exceptions during loading', async () => {
            const script = new MigrationScript(
                'V202311062345_throws_string.ts',
                path.join(fixturesPath, 'V202311062345_throws_string.ts'),
                202311062345
            );

            try {
                await loader.load(script);
                expect.fail('Should have thrown an error');
            } catch (error) {
                // Should handle string exceptions that are not Error objects
                expect((error as Error).message).to.include('Cannot parse migration script');
            }
        });
    });
});
