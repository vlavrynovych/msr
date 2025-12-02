import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Tests for loader error paths using module cache manipulation.
 * This achieves 100% coverage by testing scenarios where optional dependencies are unavailable.
 */
describe('Loader Module Unavailability Tests', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders-unavailable');

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

    describe('YamlLoader - unavailable module', () => {
        /**
         * Test module unavailability by manipulating require
         */
        it('should handle js-yaml being unavailable', () => {
            // Store original require
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            // Mock require to throw for js-yaml
            Module.prototype.require = function(id: string) {
                if (id === 'js-yaml') {
                    const error = new Error('Cannot find module \'js-yaml\'');
                    (error as any).code = 'MODULE_NOT_FOUND';
                    throw error;
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                // Clear the module cache for YamlLoader
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];

                // Now require it - constructor will catch the error
                const { YamlLoader } = require('../../../../src/util/loaders/YamlLoader');
                const loader = new YamlLoader();

                // Should report as unavailable
                expect(loader.isAvailable()).to.be.false;

                // Attempting to load should throw with helpful message
                const testFile = path.join(testDir, 'test.yaml');
                fs.writeFileSync(testFile, 'folder: ./migrations');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Cannot load YAML file');
                    expect(message).to.include('js-yaml is not installed');
                    expect(message).to.include('npm install js-yaml');
                    expect(message).to.include('Original error');
                }
            } finally {
                // Restore original require
                Module.prototype.require = originalRequire;

                // Clear cache again to restore normal state
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];
            }
        });

        /**
         * Test non-Error exception in module loading
         */
        it('should handle non-Error exceptions when loading js-yaml', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            // Mock require to throw a non-Error
            Module.prototype.require = function(id: string) {
                if (id === 'js-yaml') {
                    throw 'String error, not Error instance';
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];

                const { YamlLoader } = require('../../../../src/util/loaders/YamlLoader');
                const loader = new YamlLoader();

                expect(loader.isAvailable()).to.be.false;

                const testFile = path.join(testDir, 'test.yaml');
                fs.writeFileSync(testFile, 'folder: ./migrations');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Original error: Unknown');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/YamlLoader');
                delete require.cache[loaderPath];
            }
        });
    });

    describe('TomlLoader - unavailable module', () => {
        it('should handle @iarna/toml being unavailable', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    const error = new Error('Cannot find module \'@iarna/toml\'');
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

                expect(loader.isAvailable()).to.be.false;

                const testFile = path.join(testDir, 'test.toml');
                fs.writeFileSync(testFile, 'folder = "./migrations"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Cannot load TOML file');
                    expect(message).to.include('@iarna/toml is not installed');
                    expect(message).to.include('npm install @iarna/toml');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('should handle non-Error exceptions when loading @iarna/toml', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === '@iarna/toml') {
                    throw 'String error';
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];

                const { TomlLoader } = require('../../../../src/util/loaders/TomlLoader');
                const loader = new TomlLoader();

                expect(loader.isAvailable()).to.be.false;
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/TomlLoader');
                delete require.cache[loaderPath];
            }
        });
    });

    describe('XmlLoader - unavailable module', () => {
        it('should handle fast-xml-parser being unavailable', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    const error = new Error('Cannot find module \'fast-xml-parser\'');
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

                expect(loader.isAvailable()).to.be.false;

                const testFile = path.join(testDir, 'test.xml');
                fs.writeFileSync(testFile, '<msr><folder>./migrations</folder></msr>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Cannot load XML file');
                    expect(message).to.include('fast-xml-parser is not installed');
                    expect(message).to.include('npm install fast-xml-parser');
                }
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });

        it('should handle non-Error exceptions when loading fast-xml-parser', () => {
            const Module = require('module');
            const originalRequire = Module.prototype.require;

            Module.prototype.require = function(id: string) {
                if (id === 'fast-xml-parser') {
                    throw 'String error';
                }
                return originalRequire.apply(this, arguments);
            };

            try {
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];

                const { XmlLoader } = require('../../../../src/util/loaders/XmlLoader');
                const loader = new XmlLoader();

                expect(loader.isAvailable()).to.be.false;
            } finally {
                Module.prototype.require = originalRequire;
                const loaderPath = require.resolve('../../../../src/util/loaders/XmlLoader');
                delete require.cache[loaderPath];
            }
        });
    });
});
