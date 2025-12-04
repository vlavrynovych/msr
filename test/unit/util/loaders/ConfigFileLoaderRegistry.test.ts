import { expect } from 'chai';
import { ConfigFileLoaderRegistry } from '../../../../src/util/ConfigFileLoaderRegistry';
import { IConfigFileLoader } from '../../../../src/interface/IConfigFileLoader';

describe('ConfigFileLoaderRegistry', () => {
    // Mock loader for testing
    class MockLoader implements IConfigFileLoader {
        readonly supportedExtensions: string[];

        constructor(extensions: string[]) {
            this.supportedExtensions = extensions;
        }

        canLoad(filePath: string): boolean {
            return this.supportedExtensions.some(ext =>
                filePath.toLowerCase().endsWith(ext)
            );
        }

        load<T = unknown>(filePath: string): T {
            return { loaded: true, filePath } as T;
        }
    }

    beforeEach(() => {
        // Clear registry before each test
        ConfigFileLoaderRegistry.clear();
    });

    afterEach(() => {
        // Clear registry after each test to prevent pollution
        ConfigFileLoaderRegistry.clear();
    });

    describe('register', () => {
        /**
         * Test: Register a loader successfully
         * Validates that a loader can be registered and retrieved.
         */
        it('should register a loader', () => {
            const loader = new MockLoader(['.test']);

            ConfigFileLoaderRegistry.register(loader);

            const loaders = ConfigFileLoaderRegistry.getAllLoaders();
            expect(loaders).to.have.lengthOf(1);
            expect(loaders[0]).to.equal(loader);
        });

        /**
         * Test: Register multiple loaders
         * Validates that multiple loaders can be registered.
         */
        it('should register multiple loaders', () => {
            const loader1 = new MockLoader(['.test1']);
            const loader2 = new MockLoader(['.test2']);

            ConfigFileLoaderRegistry.register(loader1);
            ConfigFileLoaderRegistry.register(loader2);

            const loaders = ConfigFileLoaderRegistry.getAllLoaders();
            expect(loaders).to.have.lengthOf(2);
        });

        /**
         * Test: Register same loader multiple times
         * Validates that registering the same loader twice doesn't duplicate it.
         */
        it('should not duplicate loader when registered multiple times', () => {
            const loader = new MockLoader(['.test']);

            ConfigFileLoaderRegistry.register(loader);
            ConfigFileLoaderRegistry.register(loader);

            const loaders = ConfigFileLoaderRegistry.getAllLoaders();
            expect(loaders).to.have.lengthOf(1);
        });
    });

    describe('getLoader', () => {
        /**
         * Test: Get loader for supported file type
         * Validates that the correct loader is returned for a file it can load.
         */
        it('should return loader for supported file type', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            const result = ConfigFileLoaderRegistry.getLoader('config.test');

            expect(result).to.equal(loader);
        });

        /**
         * Test: Return undefined for unsupported file type
         * Validates that undefined is returned when no loader can handle the file.
         */
        it('should return undefined for unsupported file type', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            const result = ConfigFileLoaderRegistry.getLoader('config.unknown');

            expect(result).to.be.undefined;
        });

        /**
         * Test: Return first matching loader when multiple can handle the file
         * Validates priority when multiple loaders support the same extension.
         */
        it('should return first matching loader when multiple support same extension', () => {
            const loader1 = new MockLoader(['.test']);
            const loader2 = new MockLoader(['.test']);

            ConfigFileLoaderRegistry.register(loader1);
            ConfigFileLoaderRegistry.register(loader2);

            const result = ConfigFileLoaderRegistry.getLoader('config.test');

            expect(result).to.equal(loader1);
        });

        /**
         * Test: Handle file paths with directories
         * Validates that loaders work with full file paths, not just file names.
         */
        it('should handle file paths with directories', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            const result = ConfigFileLoaderRegistry.getLoader('/path/to/config.test');

            expect(result).to.equal(loader);
        });

        /**
         * Test: Case-insensitive extension matching
         * Validates that extension matching works regardless of case.
         */
        it('should match extensions case-insensitively', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            const result1 = ConfigFileLoaderRegistry.getLoader('config.TEST');
            const result2 = ConfigFileLoaderRegistry.getLoader('config.Test');
            const result3 = ConfigFileLoaderRegistry.getLoader('config.test');

            expect(result1).to.equal(loader);
            expect(result2).to.equal(loader);
            expect(result3).to.equal(loader);
        });
    });

    describe('getAllLoaders', () => {
        /**
         * Test: Return empty array when no loaders registered
         * Validates the initial state of the registry.
         */
        it('should return empty array when no loaders registered', () => {
            const loaders = ConfigFileLoaderRegistry.getAllLoaders();

            expect(loaders).to.be.an('array');
            expect(loaders).to.have.lengthOf(0);
        });

        /**
         * Test: Return all registered loaders
         * Validates that all registered loaders are returned.
         */
        it('should return all registered loaders', () => {
            const loader1 = new MockLoader(['.test1']);
            const loader2 = new MockLoader(['.test2']);
            const loader3 = new MockLoader(['.test3']);

            ConfigFileLoaderRegistry.register(loader1);
            ConfigFileLoaderRegistry.register(loader2);
            ConfigFileLoaderRegistry.register(loader3);

            const loaders = ConfigFileLoaderRegistry.getAllLoaders();

            expect(loaders).to.have.lengthOf(3);
            expect(loaders).to.include(loader1);
            expect(loaders).to.include(loader2);
            expect(loaders).to.include(loader3);
        });

        /**
         * Test: Return readonly array
         * Validates that the returned array is readonly and cannot be modified.
         */
        it('should return readonly array that cannot modify registry', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            const loaders = ConfigFileLoaderRegistry.getAllLoaders() as IConfigFileLoader[];

            // Try to modify the returned array (should not affect registry)
            loaders.push(new MockLoader(['.fake']));

            const actualLoaders = ConfigFileLoaderRegistry.getAllLoaders();
            expect(actualLoaders).to.have.lengthOf(1);
        });
    });

    describe('getSupportedExtensions', () => {
        /**
         * Test: Return empty array when no loaders registered
         * Validates the initial state.
         */
        it('should return empty array when no loaders registered', () => {
            const extensions = ConfigFileLoaderRegistry.getSupportedExtensions();

            expect(extensions).to.be.an('array');
            expect(extensions).to.have.lengthOf(0);
        });

        /**
         * Test: Return all supported extensions
         * Validates that all extensions from all loaders are returned.
         */
        it('should return all supported extensions', () => {
            const loader1 = new MockLoader(['.test1', '.test2']);
            const loader2 = new MockLoader(['.test3']);

            ConfigFileLoaderRegistry.register(loader1);
            ConfigFileLoaderRegistry.register(loader2);

            const extensions = ConfigFileLoaderRegistry.getSupportedExtensions();

            expect(extensions).to.have.lengthOf(3);
            expect(extensions).to.include('.test1');
            expect(extensions).to.include('.test2');
            expect(extensions).to.include('.test3');
        });

        /**
         * Test: Remove duplicate extensions
         * Validates that duplicate extensions from multiple loaders are deduplicated.
         */
        it('should deduplicate extensions when multiple loaders support same extension', () => {
            const loader1 = new MockLoader(['.test', '.test1']);
            const loader2 = new MockLoader(['.test', '.test2']);

            ConfigFileLoaderRegistry.register(loader1);
            ConfigFileLoaderRegistry.register(loader2);

            const extensions = ConfigFileLoaderRegistry.getSupportedExtensions();

            expect(extensions).to.have.lengthOf(3);
            expect(extensions.filter(ext => ext === '.test')).to.have.lengthOf(1);
        });
    });

    describe('hasLoaderForExtension', () => {
        /**
         * Test: Return true when loader exists for extension
         * Validates that the method correctly identifies supported extensions.
         */
        it('should return true when loader exists for extension', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            const result = ConfigFileLoaderRegistry.hasLoaderForExtension('.test');

            expect(result).to.be.true;
        });

        /**
         * Test: Return false when no loader exists for extension
         * Validates that the method correctly identifies unsupported extensions.
         */
        it('should return false when no loader exists for extension', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            const result = ConfigFileLoaderRegistry.hasLoaderForExtension('.unknown');

            expect(result).to.be.false;
        });

        /**
         * Test: Case-insensitive extension check
         * Validates that extension checking works regardless of case.
         */
        it('should check extensions case-insensitively', () => {
            const loader = new MockLoader(['.test']);
            ConfigFileLoaderRegistry.register(loader);

            expect(ConfigFileLoaderRegistry.hasLoaderForExtension('.TEST')).to.be.true;
            expect(ConfigFileLoaderRegistry.hasLoaderForExtension('.Test')).to.be.true;
            expect(ConfigFileLoaderRegistry.hasLoaderForExtension('.test')).to.be.true;
        });
    });

    describe('clear', () => {
        /**
         * Test: Clear all registered loaders
         * Validates that the clear method removes all loaders from the registry.
         */
        it('should clear all registered loaders', () => {
            const loader1 = new MockLoader(['.test1']);
            const loader2 = new MockLoader(['.test2']);

            ConfigFileLoaderRegistry.register(loader1);
            ConfigFileLoaderRegistry.register(loader2);

            expect(ConfigFileLoaderRegistry.getAllLoaders()).to.have.lengthOf(2);

            ConfigFileLoaderRegistry.clear();

            expect(ConfigFileLoaderRegistry.getAllLoaders()).to.have.lengthOf(0);
        });

        /**
         * Test: Clear on empty registry is safe
         * Validates that clearing an empty registry doesn't cause errors.
         */
        it('should be safe to clear empty registry', () => {
            expect(() => ConfigFileLoaderRegistry.clear()).to.not.throw();

            const loaders = ConfigFileLoaderRegistry.getAllLoaders();
            expect(loaders).to.have.lengthOf(0);
        });

        /**
         * Test: Can register loaders after clearing
         * Validates that the registry can be used normally after clearing.
         */
        it('should allow registering loaders after clearing', () => {
            const loader1 = new MockLoader(['.test1']);
            ConfigFileLoaderRegistry.register(loader1);
            ConfigFileLoaderRegistry.clear();

            const loader2 = new MockLoader(['.test2']);
            ConfigFileLoaderRegistry.register(loader2);

            const loaders = ConfigFileLoaderRegistry.getAllLoaders();
            expect(loaders).to.have.lengthOf(1);
            expect(loaders[0]).to.equal(loader2);
        });
    });
});
