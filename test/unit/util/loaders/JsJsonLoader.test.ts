import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { JsJsonLoader } from '../../../../src/util/loaders/JsJsonLoader';

describe('JsJsonLoader', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders');
    let loader: JsJsonLoader;

    before(() => {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    beforeEach(() => {
        loader = new JsJsonLoader();
    });

    after(() => {
        // Clean up test files
        if (fs.existsSync(testDir)) {
            fs.readdirSync(testDir).forEach(file => {
                fs.unlinkSync(path.join(testDir, file));
            });
            fs.rmdirSync(testDir);
        }
    });

    describe('supportedExtensions', () => {
        /**
         * Test: Supported extensions property
         * Validates that the loader declares correct supported extensions.
         */
        it('should support .js and .json extensions', () => {
            expect(loader.supportedExtensions).to.deep.equal(['.js', '.json']);
        });
    });

    describe('canLoad', () => {
        /**
         * Test: Can load .js files
         * Validates that the loader identifies .js files as loadable.
         */
        it('should return true for .js files', () => {
            expect(loader.canLoad('config.js')).to.be.true;
            expect(loader.canLoad('/path/to/config.js')).to.be.true;
        });

        /**
         * Test: Can load .json files
         * Validates that the loader identifies .json files as loadable.
         */
        it('should return true for .json files', () => {
            expect(loader.canLoad('config.json')).to.be.true;
            expect(loader.canLoad('/path/to/config.json')).to.be.true;
        });

        /**
         * Test: Case-insensitive extension matching
         * Validates that extension matching works regardless of case.
         */
        it('should match extensions case-insensitively', () => {
            expect(loader.canLoad('config.JS')).to.be.true;
            expect(loader.canLoad('config.Json')).to.be.true;
            expect(loader.canLoad('config.JSON')).to.be.true;
        });

        /**
         * Test: Cannot load unsupported file types
         * Validates that the loader rejects unsupported file types.
         */
        it('should return false for unsupported file types', () => {
            expect(loader.canLoad('config.yaml')).to.be.false;
            expect(loader.canLoad('config.toml')).to.be.false;
            expect(loader.canLoad('config.xml')).to.be.false;
            expect(loader.canLoad('config.txt')).to.be.false;
        });
    });

    describe('load - JSON files', () => {
        /**
         * Test: Load valid JSON file
         * Validates that JSON files are correctly parsed.
         */
        it('should load valid JSON file', () => {
            const testFile = path.join(testDir, 'test.json');
            const testData = { folder: './migrations', tableName: 'schema_version' };

            fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));

            const result = loader.load(testFile);

            expect(result).to.deep.equal(testData);
        });

        /**
         * Test: Load JSON with nested objects
         * Validates that complex JSON structures are preserved.
         */
        it('should load JSON with nested objects', () => {
            const testFile = path.join(testDir, 'nested.json');
            const testData = {
                folder: './migrations',
                transaction: {
                    mode: 'PER_MIGRATION',
                    retries: 3
                }
            };

            fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));

            const result = loader.load(testFile);

            expect(result).to.deep.equal(testData);
        });

        /**
         * Test: Load JSON with arrays
         * Validates that arrays in JSON are correctly parsed.
         */
        it('should load JSON with arrays', () => {
            const testFile = path.join(testDir, 'arrays.json');
            const testData = {
                filePatterns: ['*.up.sql', '*.down.sql'],
                tags: ['migration', 'database']
            };

            fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));

            const result = loader.load(testFile);

            expect(result).to.deep.equal(testData);
        });

        /**
         * Test: Throw error for invalid JSON
         * Validates that malformed JSON causes an error.
         */
        it('should throw error for invalid JSON', () => {
            const testFile = path.join(testDir, 'invalid.json');

            fs.writeFileSync(testFile, '{ invalid json }');

            expect(() => loader.load(testFile)).to.throw();
        });
    });

    describe('load - JavaScript files', () => {
        /**
         * Test: Load JS file with module.exports
         * Validates that CommonJS exports are correctly loaded.
         */
        it('should load JS file with module.exports', () => {
            const testFile = path.join(testDir, 'module-exports.js');
            const testData = { folder: './migrations', tableName: 'schema_version' };

            fs.writeFileSync(testFile, `module.exports = ${JSON.stringify(testData)};`);

            const result = loader.load(testFile);

            expect(result).to.deep.equal(testData);
        });

        /**
         * Test: Load JS file with exports.default
         * Validates that ES6 default exports are correctly loaded.
         */
        it('should load JS file with exports.default', () => {
            const testFile = path.join(testDir, 'default-export.js');
            const testData = { folder: './migrations', tableName: 'schema_version' };

            fs.writeFileSync(testFile, `exports.default = ${JSON.stringify(testData)};`);

            const result = loader.load(testFile);

            expect(result).to.deep.equal(testData);
        });

        /**
         * Test: Load JS file with dynamic content
         * Validates that JavaScript files can contain executable code.
         */
        it('should load JS file with dynamic content', () => {
            const testFile = path.join(testDir, 'dynamic.js');

            fs.writeFileSync(testFile, `
                module.exports = {
                    folder: './migrations',
                    tableName: 'schema_version',
                    generated: new Date('2024-01-01').toISOString()
                };
            `);

            const result = loader.load<any>(testFile);

            expect(result.folder).to.equal('./migrations');
            expect(result.tableName).to.equal('schema_version');
            expect(result.generated).to.equal('2024-01-01T00:00:00.000Z');
        });
    });

    describe('load - Error handling', () => {
        /**
         * Test: Throw error for non-existent file
         * Validates that loading a missing file throws an error.
         */
        it('should throw error for non-existent file', () => {
            const testFile = path.join(testDir, 'non-existent.json');

            expect(() => loader.load(testFile)).to.throw();
        });

        /**
         * Test: Throw error with helpful message
         * Validates that error messages include the file path.
         */
        it('should throw error with helpful message for invalid files', () => {
            const testFile = path.join(testDir, 'error-test.json');

            fs.writeFileSync(testFile, '{ bad json');

            try {
                loader.load(testFile);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                expect((error as Error).message).to.include(testFile);
            }
        });
    });

    describe('load - Path resolution', () => {
        /**
         * Test: Load file with relative path
         * Validates that relative paths are correctly resolved.
         */
        it('should resolve relative paths', () => {
            const testFile = path.join(testDir, 'relative.json');
            const testData = { folder: './migrations' };

            fs.writeFileSync(testFile, JSON.stringify(testData));

            // Get relative path from current directory
            const relativePath = path.relative(process.cwd(), testFile);
            const result = loader.load(relativePath);

            expect(result).to.deep.equal(testData);
        });

        /**
         * Test: Load file with absolute path
         * Validates that absolute paths work correctly.
         */
        it('should handle absolute paths', () => {
            const testFile = path.join(testDir, 'absolute.json');
            const testData = { folder: './migrations' };

            fs.writeFileSync(testFile, JSON.stringify(testData));

            const absolutePath = path.resolve(testFile);
            const result = loader.load(absolutePath);

            expect(result).to.deep.equal(testData);
        });
    });

    describe('load - Type safety', () => {
        /**
         * Test: Generic type parameter
         * Validates that the loader supports TypeScript generics.
         */
        it('should support generic type parameter', () => {
            const testFile = path.join(testDir, 'typed.json');

            interface TestConfig {
                folder: string;
                tableName: string;
            }

            const testData: TestConfig = {
                folder: './migrations',
                tableName: 'schema_version'
            };

            fs.writeFileSync(testFile, JSON.stringify(testData));

            const result = loader.load<TestConfig>(testFile);

            expect(result.folder).to.equal('./migrations');
            expect(result.tableName).to.equal('schema_version');
        });
    });
});
