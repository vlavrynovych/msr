import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { YamlLoader } from '../../../../src/util/loaders/YamlLoader';

describe('YamlLoader', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders');
    let loader: YamlLoader;

    before(() => {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    beforeEach(() => {
        loader = new YamlLoader();
    });

    after(() => {
        // Clean up test files
        if (fs.existsSync(testDir)) {
            fs.readdirSync(testDir).forEach(file => {
                if (file.endsWith('.yaml') || file.endsWith('.yml')) {
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
        it('should support .yaml and .yml extensions', () => {
            expect(loader.supportedExtensions).to.deep.equal(['.yaml', '.yml']);
        });
    });

    describe('canLoad', () => {
        /**
         * Test: Can load .yaml files
         * Validates that the loader identifies .yaml files as loadable.
         */
        it('should return true for .yaml files', () => {
            expect(loader.canLoad('config.yaml')).to.be.true;
            expect(loader.canLoad('/path/to/config.yaml')).to.be.true;
        });

        /**
         * Test: Can load .yml files
         * Validates that the loader identifies .yml files as loadable.
         */
        it('should return true for .yml files', () => {
            expect(loader.canLoad('config.yml')).to.be.true;
            expect(loader.canLoad('/path/to/config.yml')).to.be.true;
        });

        /**
         * Test: Case-insensitive extension matching
         * Validates that extension matching works regardless of case.
         */
        it('should match extensions case-insensitively', () => {
            expect(loader.canLoad('config.YAML')).to.be.true;
            expect(loader.canLoad('config.Yml')).to.be.true;
            expect(loader.canLoad('config.YML')).to.be.true;
        });

        /**
         * Test: Cannot load unsupported file types
         * Validates that the loader rejects unsupported file types.
         */
        it('should return false for unsupported file types', () => {
            expect(loader.canLoad('config.json')).to.be.false;
            expect(loader.canLoad('config.toml')).to.be.false;
            expect(loader.canLoad('config.xml')).to.be.false;
            expect(loader.canLoad('config.txt')).to.be.false;
        });
    });

    describe('isAvailable', () => {
        /**
         * Test: Check if js-yaml is available
         * Validates the isAvailable method returns correct status.
         * Note: This test's result depends on whether js-yaml is installed.
         */
        it('should return boolean indicating js-yaml availability', () => {
            const available = loader.isAvailable();

            expect(available).to.be.a('boolean');
        });
    });

    // Only run load tests if js-yaml is available
    (function() {
        const testLoader = new YamlLoader();
        if (!testLoader.isAvailable()) {
            describe('load - js-yaml not available', () => {
                /**
                 * Test: Throw helpful error when js-yaml is not installed
                 * Validates that the error message includes installation instructions.
                 */
                it('should throw helpful error when js-yaml is not installed', () => {
                    const testFile = path.join(testDir, 'test.yaml');

                    fs.writeFileSync(testFile, 'folder: ./migrations');

                    try {
                        loader.load(testFile);
                        expect.fail('Should have thrown an error');
                    } catch (error) {
                        expect(error).to.be.instanceOf(Error);
                        const message = (error as Error).message;
                        expect(message).to.include('js-yaml is not installed');
                        expect(message).to.include('npm install js-yaml');
                        expect(message).to.include(testFile);
                    }
                });
            });
            return;
        }

        describe('load - basic YAML', () => {
            /**
             * Test: Load simple YAML file
             * Validates that basic YAML files are correctly parsed.
             */
            it('should load simple YAML file', () => {
                const testFile = path.join(testDir, 'simple.yaml');
                const yamlContent = `
folder: ./migrations
tableName: schema_version
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Load .yml extension
             * Validates that .yml files work the same as .yaml.
             */
            it('should load .yml files', () => {
                const testFile = path.join(testDir, 'simple.yml');
                const yamlContent = `
folder: ./migrations
tableName: schema_version
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });
        });

        describe('load - nested structures', () => {
            /**
             * Test: Load YAML with nested objects
             * Validates that complex YAML structures are preserved.
             */
            it('should load YAML with nested objects', () => {
                const testFile = path.join(testDir, 'nested.yaml');
                const yamlContent = `
folder: ./migrations
transaction:
  mode: PER_MIGRATION
  retries: 3
backup:
  enabled: true
  folder: ./backups
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

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
             * Test: Load YAML with arrays
             * Validates that arrays in YAML are correctly parsed.
             */
            it('should load YAML with arrays', () => {
                const testFile = path.join(testDir, 'arrays.yaml');
                const yamlContent = `
filePatterns:
  - "*.up.sql"
  - "*.down.sql"
tags:
  - migration
  - database
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<any>(testFile);

                expect(result.filePatterns).to.deep.equal(['*.up.sql', '*.down.sql']);
                expect(result.tags).to.deep.equal(['migration', 'database']);
            });

            /**
             * Test: Load YAML with mixed types
             * Validates that different YAML data types are correctly parsed.
             */
            it('should load YAML with mixed types', () => {
                const testFile = path.join(testDir, 'mixed-types.yaml');
                const yamlContent = `
stringValue: hello
numberValue: 42
floatValue: 3.14
booleanTrue: true
booleanFalse: false
nullValue: null
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<any>(testFile);

                expect(result.stringValue).to.equal('hello');
                expect(result.numberValue).to.equal(42);
                expect(result.floatValue).to.equal(3.14);
                expect(result.booleanTrue).to.be.true;
                expect(result.booleanFalse).to.be.false;
                expect(result.nullValue).to.be.null;
            });
        });

        describe('load - YAML features', () => {
            /**
             * Test: Load YAML with comments
             * Validates that YAML comments are ignored during parsing.
             */
            it('should handle YAML comments', () => {
                const testFile = path.join(testDir, 'comments.yaml');
                const yamlContent = `
# This is a comment
folder: ./migrations  # Inline comment
# Another comment
tableName: schema_version
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Load YAML with multi-line strings
             * Validates that multi-line string syntax is correctly handled.
             */
            it('should handle multi-line strings', () => {
                const testFile = path.join(testDir, 'multiline.yaml');
                const yamlContent = `
description: |
  This is a multi-line
  description that spans
  multiple lines.
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<any>(testFile);

                expect(result.description).to.include('This is a multi-line');
                expect(result.description).to.include('multiple lines');
            });

            /**
             * Test: Load YAML with anchors and aliases
             * Validates that YAML anchors and aliases are correctly resolved.
             */
            it('should handle YAML anchors and aliases', () => {
                const testFile = path.join(testDir, 'anchors.yaml');
                const yamlContent = `
defaults: &defaults
  retries: 3
  timeout: 30

transaction:
  <<: *defaults
  mode: PER_MIGRATION
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<any>(testFile);

                expect(result.transaction.retries).to.equal(3);
                expect(result.transaction.timeout).to.equal(30);
                expect(result.transaction.mode).to.equal('PER_MIGRATION');
            });
        });

        describe('load - Error handling', () => {
            /**
             * Test: Throw error for non-existent file
             * Validates that loading a missing file throws an error.
             */
            it('should throw error for non-existent file', () => {
                const testFile = path.join(testDir, 'non-existent.yaml');

                expect(() => loader.load(testFile)).to.throw(Error);
            });

            /**
             * Test: Throw error for invalid YAML
             * Validates that malformed YAML causes an error.
             */
            it('should throw error for invalid YAML', () => {
                const testFile = path.join(testDir, 'invalid.yaml');

                fs.writeFileSync(testFile, 'invalid: yaml: content: :::');

                expect(() => loader.load(testFile)).to.throw(Error);
            });

            /**
             * Test: Throw error with helpful message
             * Validates that error messages include the file path.
             */
            it('should throw error with helpful message for invalid files', () => {
                const testFile = path.join(testDir, 'error-test.yaml');

                fs.writeFileSync(testFile, 'bad:\n  yaml:\n    - item\n  - misaligned');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include(testFile);
                }
            });

            /**
             * Test: Handle empty YAML file
             * Validates that empty YAML files are handled appropriately.
             */
            it('should throw error for empty YAML file', () => {
                const testFile = path.join(testDir, 'empty.yaml');

                fs.writeFileSync(testFile, '');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('empty');
                }
            });

            /**
             * Test: Throw error for YAML array instead of object
             * Validates that YAML files containing arrays are rejected.
             */
            it('should throw error for YAML array instead of object', () => {
                const testFile = path.join(testDir, 'array.yaml');
                const yamlContent = `
- item1
- item2
- item3
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Expected YAML file to contain an object');
                    expect((error as Error).message).to.include('array');
                }
            });

            /**
             * Test: Throw error for YAML primitive instead of object
             * Validates that YAML files containing primitives are rejected.
             */
            it('should throw error for YAML primitive instead of object', () => {
                const testFile = path.join(testDir, 'primitive.yaml');

                fs.writeFileSync(testFile, 'just a string');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Expected YAML file to contain an object');
                }
            });
        });

        describe('load - Path resolution', () => {
            /**
             * Test: Load file with relative path
             * Validates that relative paths are correctly resolved.
             */
            it('should resolve relative paths', () => {
                const testFile = path.join(testDir, 'relative.yaml');
                const yamlContent = 'folder: ./migrations';

                fs.writeFileSync(testFile, yamlContent);

                const relativePath = path.relative(process.cwd(), testFile);
                const result = loader.load<any>(relativePath);

                expect(result.folder).to.equal('./migrations');
            });

            /**
             * Test: Load file with absolute path
             * Validates that absolute paths work correctly.
             */
            it('should handle absolute paths', () => {
                const testFile = path.join(testDir, 'absolute.yaml');
                const yamlContent = 'folder: ./migrations';

                fs.writeFileSync(testFile, yamlContent);

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
                const testFile = path.join(testDir, 'typed.yaml');

                interface TestConfig {
                    folder: string;
                    tableName: string;
                }

                const yamlContent = `
folder: ./migrations
tableName: schema_version
                `.trim();

                fs.writeFileSync(testFile, yamlContent);

                const result = loader.load<TestConfig>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });
        });
    })();
});
