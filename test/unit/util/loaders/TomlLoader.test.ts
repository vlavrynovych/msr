import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { TomlLoader } from '../../../../src/util/loaders/TomlLoader';

describe('TomlLoader', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders');
    let loader: TomlLoader;

    before(() => {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    beforeEach(() => {
        loader = new TomlLoader();
    });

    after(() => {
        // Clean up test files
        if (fs.existsSync(testDir)) {
            fs.readdirSync(testDir).forEach(file => {
                if (file.endsWith('.toml')) {
                    fs.unlinkSync(path.join(testDir, file));
                }
            });
        }
    });

    describe('supportedExtensions', () => {
        /**
         * Test: Supported extensions property
         * Validates that the loader declares correct supported extensions.
         */
        it('should support .toml extension', () => {
            expect(loader.supportedExtensions).to.deep.equal(['.toml']);
        });
    });

    describe('canLoad', () => {
        /**
         * Test: Can load .toml files
         * Validates that the loader identifies .toml files as loadable.
         */
        it('should return true for .toml files', () => {
            expect(loader.canLoad('config.toml')).to.be.true;
            expect(loader.canLoad('/path/to/config.toml')).to.be.true;
        });

        /**
         * Test: Case-insensitive extension matching
         * Validates that extension matching works regardless of case.
         */
        it('should match extensions case-insensitively', () => {
            expect(loader.canLoad('config.TOML')).to.be.true;
            expect(loader.canLoad('config.Toml')).to.be.true;
            expect(loader.canLoad('config.ToMl')).to.be.true;
        });

        /**
         * Test: Cannot load unsupported file types
         * Validates that the loader rejects unsupported file types.
         */
        it('should return false for unsupported file types', () => {
            expect(loader.canLoad('config.json')).to.be.false;
            expect(loader.canLoad('config.yaml')).to.be.false;
            expect(loader.canLoad('config.xml')).to.be.false;
            expect(loader.canLoad('config.txt')).to.be.false;
        });
    });

    describe('isAvailable', () => {
        /**
         * Test: Check if @iarna/toml is available
         * Validates the isAvailable method returns correct status.
         * Note: This test's result depends on whether @iarna/toml is installed.
         */
        it('should return boolean indicating @iarna/toml availability', () => {
            const available = loader.isAvailable();

            expect(available).to.be.a('boolean');
        });
    });

    // Only run load tests if @iarna/toml is available
    (function() {
        const testLoader = new TomlLoader();
        if (!testLoader.isAvailable()) {
            describe('load - @iarna/toml not available', () => {
                /**
                 * Test: Throw helpful error when @iarna/toml is not installed
                 * Validates that the error message includes installation instructions.
                 */
                it('should throw helpful error when @iarna/toml is not installed', () => {
                    const testFile = path.join(testDir, 'test.toml');

                    fs.writeFileSync(testFile, 'folder = "./migrations"');

                    try {
                        loader.load(testFile);
                        expect.fail('Should have thrown an error');
                    } catch (error) {
                        expect(error).to.be.instanceOf(Error);
                        const message = (error as Error).message;
                        expect(message).to.include('@iarna/toml is not installed');
                        expect(message).to.include('npm install @iarna/toml');
                        expect(message).to.include(testFile);
                    }
                });
            });
            return;
        }

        describe('load - basic TOML', () => {
            /**
             * Test: Load simple TOML file
             * Validates that basic TOML files are correctly parsed.
             */
            it('should load simple TOML file', () => {
                const testFile = path.join(testDir, 'simple.toml');
                const tomlContent = `
folder = "./migrations"
tableName = "schema_version"
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Load TOML with different data types
             * Validates that TOML data types are correctly parsed.
             */
            it('should load TOML with mixed types', () => {
                const testFile = path.join(testDir, 'types.toml');
                const tomlContent = `
stringValue = "hello"
intValue = 42
floatValue = 3.14
boolTrue = true
boolFalse = false
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.stringValue).to.equal('hello');
                expect(result.intValue).to.equal(42);
                expect(result.floatValue).to.equal(3.14);
                expect(result.boolTrue).to.be.true;
                expect(result.boolFalse).to.be.false;
            });
        });

        describe('load - TOML tables', () => {
            /**
             * Test: Load TOML with tables (nested objects)
             * Validates that TOML tables are correctly parsed as nested objects.
             */
            it('should load TOML with tables', () => {
                const testFile = path.join(testDir, 'tables.toml');
                const tomlContent = `
folder = "./migrations"

[transaction]
mode = "PER_MIGRATION"
retries = 3

[backup]
enabled = true
folder = "./backups"
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.transaction).to.deep.equal({
                    mode: 'PER_MIGRATION',
                    retries: 3
                });
                expect(result.backup).to.deep.equal({
                    enabled: true,
                    folder: './backups'
                });
            });

            /**
             * Test: Load TOML with nested tables
             * Validates that deeply nested TOML tables work correctly.
             */
            it('should load TOML with nested tables', () => {
                const testFile = path.join(testDir, 'nested-tables.toml');
                const tomlContent = `
[database]
host = "localhost"

[database.pool]
min = 2
max = 10

[database.pool.options]
timeout = 30
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.database.host).to.equal('localhost');
                expect(result.database.pool.min).to.equal(2);
                expect(result.database.pool.max).to.equal(10);
                expect(result.database.pool.options.timeout).to.equal(30);
            });
        });

        describe('load - TOML arrays', () => {
            /**
             * Test: Load TOML with arrays
             * Validates that TOML arrays are correctly parsed.
             */
            it('should load TOML with arrays', () => {
                const testFile = path.join(testDir, 'arrays.toml');
                const tomlContent = `
filePatterns = ["*.up.sql", "*.down.sql"]
tags = ["migration", "database"]
numbers = [1, 2, 3, 4, 5]
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.filePatterns).to.deep.equal(['*.up.sql', '*.down.sql']);
                expect(result.tags).to.deep.equal(['migration', 'database']);
                expect(result.numbers).to.deep.equal([1, 2, 3, 4, 5]);
            });

            /**
             * Test: Load TOML with array of tables
             * Validates that TOML array of tables syntax works correctly.
             */
            it('should load TOML with array of tables', () => {
                const testFile = path.join(testDir, 'array-of-tables.toml');
                const tomlContent = `
[[servers]]
name = "primary"
host = "localhost"
port = 5432

[[servers]]
name = "secondary"
host = "backup-host"
port = 5433
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.servers).to.be.an('array');
                expect(result.servers).to.have.lengthOf(2);
                expect(result.servers[0]).to.deep.equal({
                    name: 'primary',
                    host: 'localhost',
                    port: 5432
                });
                expect(result.servers[1]).to.deep.equal({
                    name: 'secondary',
                    host: 'backup-host',
                    port: 5433
                });
            });
        });

        describe('load - TOML features', () => {
            /**
             * Test: Load TOML with comments
             * Validates that TOML comments are ignored during parsing.
             */
            it('should handle TOML comments', () => {
                const testFile = path.join(testDir, 'comments.toml');
                const tomlContent = `
# This is a comment
folder = "./migrations"  # Inline comment
# Another comment
tableName = "schema_version"
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Load TOML with multi-line strings
             * Validates that TOML multi-line string syntax is correctly handled.
             */
            it('should handle multi-line strings', () => {
                const testFile = path.join(testDir, 'multiline.toml');
                const tomlContent = `
description = """
This is a multi-line
description that spans
multiple lines."""
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.description).to.include('This is a multi-line');
                expect(result.description).to.include('multiple lines');
            });

            /**
             * Test: Load TOML with dotted keys
             * Validates that TOML dotted key syntax works correctly.
             */
            it('should handle dotted keys', () => {
                const testFile = path.join(testDir, 'dotted-keys.toml');
                const tomlContent = `
database.host = "localhost"
database.port = 5432
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.database.host).to.equal('localhost');
                expect(result.database.port).to.equal(5432);
            });

            /**
             * Test: Load TOML with dates and times
             * Validates that TOML date-time values are correctly parsed.
             */
            it('should handle dates and times', () => {
                const testFile = path.join(testDir, 'datetime.toml');
                const tomlContent = `
createdAt = 2024-01-01T12:00:00Z
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<any>(testFile);

                expect(result.createdAt).to.be.instanceOf(Date);
                expect(result.createdAt.toISOString()).to.equal('2024-01-01T12:00:00.000Z');
            });
        });

        describe('load - Error handling', () => {
            /**
             * Test: Throw error for non-existent file
             * Validates that loading a missing file throws an error.
             */
            it('should throw error for non-existent file', () => {
                const testFile = path.join(testDir, 'non-existent.toml');

                expect(() => loader.load(testFile)).to.throw();
            });

            /**
             * Test: Throw error for invalid TOML
             * Validates that malformed TOML causes an error.
             */
            it('should throw error for invalid TOML', () => {
                const testFile = path.join(testDir, 'invalid.toml');

                fs.writeFileSync(testFile, 'invalid = toml = syntax');

                expect(() => loader.load(testFile)).to.throw();
            });

            /**
             * Test: Throw error with helpful message
             * Validates that error messages include the file path.
             */
            it('should throw error with helpful message for invalid files', () => {
                const testFile = path.join(testDir, 'error-test.toml');

                fs.writeFileSync(testFile, '[bad\nsection');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include(testFile);
                }
            });

            /**
             * Test: Handle empty TOML file
             * Validates that empty TOML files return empty object.
             */
            it('should return empty object for empty TOML file', () => {
                const testFile = path.join(testDir, 'empty.toml');

                fs.writeFileSync(testFile, '');

                const result = loader.load<any>(testFile);

                expect(result).to.be.an('object');
                expect(Object.keys(result)).to.have.lengthOf(0);
            });
        });

        describe('load - Path resolution', () => {
            /**
             * Test: Load file with relative path
             * Validates that relative paths are correctly resolved.
             */
            it('should resolve relative paths', () => {
                const testFile = path.join(testDir, 'relative.toml');
                const tomlContent = 'folder = "./migrations"';

                fs.writeFileSync(testFile, tomlContent);

                const relativePath = path.relative(process.cwd(), testFile);
                const result = loader.load<any>(relativePath);

                expect(result.folder).to.equal('./migrations');
            });

            /**
             * Test: Load file with absolute path
             * Validates that absolute paths work correctly.
             */
            it('should handle absolute paths', () => {
                const testFile = path.join(testDir, 'absolute.toml');
                const tomlContent = 'folder = "./migrations"';

                fs.writeFileSync(testFile, tomlContent);

                const absolutePath = path.resolve(testFile);
                const result = loader.load<any>(absolutePath);

                expect(result.folder).to.equal('./migrations');
            });
        });

        describe('load - Type safety', () => {
            /**
             * Test: Generic type parameter
             * Validates that the loader supports TypeScript generics.
             */
            it('should support generic type parameter', () => {
                const testFile = path.join(testDir, 'typed.toml');

                interface TestConfig {
                    folder: string;
                    tableName: string;
                }

                const tomlContent = `
folder = "./migrations"
tableName = "schema_version"
                `.trim();

                fs.writeFileSync(testFile, tomlContent);

                const result = loader.load<TestConfig>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });
        });
    })();
});
