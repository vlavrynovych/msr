import { expect } from 'chai';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Additional edge case tests to achieve 100% coverage for all loaders.
 * These tests use advanced mocking to trigger defensive error paths.
 */
/**
 * Tests for the refactored error handling branches that are now coverable.
 * After refactoring to extract ternary expressions to const declarations,
 * these branches can be tested without overly complex mocking.
 */
describe('Loader Edge Cases - 100% Coverage', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders-edge');

    before(() => {
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    after(() => {
        if (fs.existsSync(testDir)) {
            fs.readdirSync(testDir).forEach(file => {
                fs.unlinkSync(path.join(testDir, file));
            });
            fs.rmdirSync(testDir);
        }
    });

    describe('YamlLoader - Error re-throw edge case', () => {
        it('should re-throw error that starts with "Cannot load YAML file"', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            // Mock require to return a parser that throws our own error
            Module.prototype.require = function(id: string) {
                if (id === 'js-yaml') {
                    return {
                        load: () => {
                            throw new Error('Cannot load YAML file test.yaml: custom error');
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];

                const { YamlLoader } = require('../../../../src/util/loaders/YamlLoader');
                const loader = new YamlLoader();

                const testFile = path.join(testDir, 'rethrow.yaml');
                fs.writeFileSync(testFile, 'content: value');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Cannot load YAML file');
                    expect((error as Error).message).to.include('custom error');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];
            }
        });
    });

    describe('TomlLoader - Defensive check edge cases', () => {
        it('should throw error when parser returns null', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    return {
                        parse: () => null
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                const testFile = path.join(testDir, 'null-return.toml');
                fs.writeFileSync(testFile, 'content = "value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('empty or contains only null/undefined');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('should throw error when parser returns array', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    return {
                        parse: () => ['item1', 'item2']
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                const testFile = path.join(testDir, 'array-return.toml');
                fs.writeFileSync(testFile, 'content = "value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Expected TOML file to contain an object');
                    expect((error as Error).message).to.include('got array');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('should re-throw error that starts with "Cannot load TOML file"', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    return {
                        parse: () => {
                            throw new Error('Cannot load TOML file test.toml: custom error');
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                const testFile = path.join(testDir, 'rethrow.toml');
                fs.writeFileSync(testFile, 'content = "value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Cannot load TOML file');
                    expect((error as Error).message).to.include('custom error');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });
    });

    describe('XmlLoader - Defensive check edge cases', () => {
        it('should throw error when parser returns null', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    return {
                        XMLParser: class {
                            parse() {
                                return null;
                            }
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];

                const { XmlLoader } = require('../../../../src/util/loaders/XmlLoader');
                const loader = new XmlLoader();

                const testFile = path.join(testDir, 'null-return.xml');
                fs.writeFileSync(testFile, '<root><content>value</content></root>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('empty or contains only null/undefined');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('should throw error when parser returns primitive (string)', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    return {
                        XMLParser: class {
                            parse() {
                                return 'just a string';
                            }
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];

                const { XmlLoader } = require('../../../../src/util/loaders/XmlLoader');
                const loader = new XmlLoader();

                const testFile = path.join(testDir, 'string-return.xml');
                fs.writeFileSync(testFile, '<root><content>value</content></root>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Expected XML file to contain an object');
                    expect((error as Error).message).to.include('got string');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('should re-throw error that starts with "Cannot load XML file"', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    return {
                        XMLParser: class {
                            parse() {
                                throw new Error('Cannot load XML file test.xml: custom error');
                            }
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];

                const { XmlLoader } = require('../../../../src/util/loaders/XmlLoader');
                const loader = new XmlLoader();

                const testFile = path.join(testDir, 'rethrow.xml');
                fs.writeFileSync(testFile, '<root><content>value</content></root>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Cannot load XML file');
                    expect((error as Error).message).to.include('custom error');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });
    });

    describe('Refactored Error Message Branches - Now Coverable', () => {
        /**
         * Test coverage for the refactored error message formatting.
         * After extracting ternary expressions to const declarations,
         * these branches can be tested with simple mocking.
         */

        it('YamlLoader: should use "Module not available" when loadError.message is empty', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'js-yaml') {
                    const error = new Error('');
                    (error as any).code = 'MODULE_NOT_FOUND';
                    throw error;
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];

                const { YamlLoader } = require('../../../../src/util/loaders/YamlLoader');
                const loader = new YamlLoader();

                const testFile = path.join(testDir, 'empty-msg.yaml');
                fs.writeFileSync(testFile, 'content: value');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Original error: Module not available');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('YamlLoader: should use "Unknown error" when parser throws non-Error', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'js-yaml') {
                    return {
                        load: () => {
                            throw 'String error, not Error instance';
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];

                const { YamlLoader } = require('../../../../src/util/loaders/YamlLoader');
                const loader = new YamlLoader();

                const testFile = path.join(testDir, 'non-error.yaml');
                fs.writeFileSync(testFile, 'content: value');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Failed to load configuration from');
                    expect(message).to.include('Unknown error');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('TomlLoader: should use "Module not available" when loadError.message is empty', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    const error = new Error('');
                    (error as any).code = 'MODULE_NOT_FOUND';
                    throw error;
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                const testFile = path.join(testDir, 'empty-msg.toml');
                fs.writeFileSync(testFile, 'content = "value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Original error: Module not available');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('TomlLoader: should use "Unknown error" when parser throws non-Error', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    return {
                        parse: () => {
                            throw 42; // Throw a number instead of Error
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                const testFile = path.join(testDir, 'non-error.toml');
                fs.writeFileSync(testFile, 'content = "value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Failed to load configuration from');
                    expect(message).to.include('Unknown error');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('XmlLoader: should use "Module not available" when loadError.message is empty', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    const error = new Error('');
                    (error as any).code = 'MODULE_NOT_FOUND';
                    throw error;
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];

                const { XmlLoader } = require('../../../../src/util/loaders/XmlLoader');
                const loader = new XmlLoader();

                const testFile = path.join(testDir, 'empty-msg.xml');
                fs.writeFileSync(testFile, '<root><content>value</content></root>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Original error: Module not available');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('XmlLoader: should use "Unknown error" when parser throws non-Error', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    return {
                        XMLParser: class {
                            parse() {
                                throw { custom: 'error object' }; // Throw non-Error object
                            }
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];

                const { XmlLoader } = require('../../../../src/util/loaders/XmlLoader');
                const loader = new XmlLoader();

                const testFile = path.join(testDir, 'non-error.xml');
                fs.writeFileSync(testFile, '<root><content>value</content></root>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Failed to load configuration from');
                    expect(message).to.include('Unknown error');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });

        // Tests for optional chaining (?.) when loadError is null
        it('YamlLoader: should handle null loadError with optional chaining', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'js-yaml') {
                    const error = new Error('Module not found');
                    (error as any).code = 'MODULE_NOT_FOUND';
                    throw error;
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];

                const { YamlLoader } = require('../../../../src/util/loaders/YamlLoader');
                const loader = new YamlLoader();

                // Manipulate private field to test optional chaining
                (loader as any).yamlModule = null; // Ensure isAvailable() returns false
                (loader as any).loadError = null;  // Set loadError to null

                const testFile = path.join(testDir, 'null-loaderror.yaml');
                fs.writeFileSync(testFile, 'content: value');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Original error: Module not available');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('TomlLoader: should handle null loadError with optional chaining', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    const error = new Error('Module not found');
                    (error as any).code = 'MODULE_NOT_FOUND';
                    throw error;
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                // Manipulate private field to test optional chaining
                (loader as any).tomlModule = null;
                (loader as any).loadError = null;

                const testFile = path.join(testDir, 'null-loaderror.toml');
                fs.writeFileSync(testFile, 'content = "value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Original error: Module not available');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('TomlLoader: should detect primitive type (not array) when validation fails', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    return {
                        parse: () => {
                            return 'just a string'; // Return primitive string (not array, not object)
                        }
                    };
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                const testFile = path.join(testDir, 'primitive-string.toml');
                fs.writeFileSync(testFile, 'content = "value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Expected TOML file to contain an object');
                    expect(message).to.include('got string'); // This covers the typeof branch
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('XmlLoader: should handle null loadError with optional chaining', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    const error = new Error('Module not found');
                    (error as any).code = 'MODULE_NOT_FOUND';
                    throw error;
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];

                const { XmlLoader } = require('../../../../src/util/loaders/XmlLoader');
                const loader = new XmlLoader();

                // Manipulate private field to test optional chaining
                (loader as any).xmlModule = null;
                (loader as any).loadError = null;

                const testFile = path.join(testDir, 'null-loaderror.xml');
                fs.writeFileSync(testFile, '<root><content>value</content></root>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Original error: Module not available');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });
    });
});
