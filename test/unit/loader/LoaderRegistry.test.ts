import { expect } from 'chai';
import { IDB, IMigrationScriptLoader, IRunnableScript, LoaderRegistry, MigrationScript, SilentLogger, SqlLoader, TypeScriptLoader } from '../../../src';

describe('LoaderRegistry', () => {
    let registry: LoaderRegistry<IDB>;

    beforeEach(() => {
        registry = new LoaderRegistry<IDB>();
    });

    describe('register()', () => {
        it('should register a loader', () => {
            const loader = new TypeScriptLoader<IDB>();
            registry.register(loader);

            const loaders = registry.getLoaders();
            expect(loaders).to.have.lengthOf(1);
            expect(loaders[0]).to.equal(loader);
        });

        it('should register multiple loaders', () => {
            const tsLoader = new TypeScriptLoader<IDB>();
            const sqlLoader = new SqlLoader<IDB>();

            registry.register(tsLoader);
            registry.register(sqlLoader);

            const loaders = registry.getLoaders();
            expect(loaders).to.have.lengthOf(2);
            expect(loaders[0]).to.equal(tsLoader);
            expect(loaders[1]).to.equal(sqlLoader);
        });

        it('should maintain registration order', () => {
            const loader1 = new TypeScriptLoader<IDB>();
            const loader2 = new SqlLoader<IDB>();
            const loader3 = new TypeScriptLoader<IDB>();

            registry.register(loader1);
            registry.register(loader2);
            registry.register(loader3);

            const loaders = registry.getLoaders();
            expect(loaders[0]).to.equal(loader1);
            expect(loaders[1]).to.equal(loader2);
            expect(loaders[2]).to.equal(loader3);
        });
    });

    describe('findLoader()', () => {
        beforeEach(() => {
            registry.register(new TypeScriptLoader<IDB>());
            registry.register(new SqlLoader<IDB>());
        });

        it('should find TypeScript loader for .ts files', () => {
            const loader = registry.findLoader('/path/to/V202501220100_test.ts');
            expect(loader.getName()).to.equal('TypeScriptLoader');
        });

        it('should find TypeScript loader for .js files', () => {
            const loader = registry.findLoader('/path/to/V202501220100_test.js');
            expect(loader.getName()).to.equal('TypeScriptLoader');
        });

        it('should find SQL loader for .up.sql files', () => {
            const loader = registry.findLoader('/path/to/V202501220100_test.up.sql');
            expect(loader.getName()).to.equal('SqlLoader');
        });

        it('should throw error for unsupported file type', () => {
            try {
                registry.findLoader('/path/to/V202501220100_test.py');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('No loader found');
                expect((error as Error).message).to.include('V202501220100_test.py');
                expect((error as Error).message).to.include('TypeScriptLoader');
                expect((error as Error).message).to.include('SqlLoader');
            }
        });

        it('should provide helpful error message with supported types', () => {
            try {
                registry.findLoader('/path/to/test.yaml');
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('Supported types:');
                expect((error as Error).message).to.include('IMigrationScriptLoader');
            }
        });

        it('should respect registration order (first match wins)', () => {
            // Create custom registry with specific order
            const customRegistry = new LoaderRegistry<IDB>();

            // Register SQL loader first
            customRegistry.register(new SqlLoader<IDB>());
            customRegistry.register(new TypeScriptLoader<IDB>());

            // SQL loader should still only match .up.sql
            const tsLoader = customRegistry.findLoader('/path/to/test.ts');
            expect(tsLoader.getName()).to.equal('TypeScriptLoader');

            const sqlLoader = customRegistry.findLoader('/path/to/test.up.sql');
            expect(sqlLoader.getName()).to.equal('SqlLoader');
        });
    });

    describe('getLoaders()', () => {
        it('should return empty array for new registry', () => {
            const loaders = registry.getLoaders();
            expect(loaders).to.be.an('array').that.is.empty;
        });

        it('should return copy of loaders array', () => {
            const loader = new TypeScriptLoader<IDB>();
            registry.register(loader);

            const loaders1 = registry.getLoaders();
            const loaders2 = registry.getLoaders();

            // Should be different array instances
            expect(loaders1).to.not.equal(loaders2);
            // But contain same loaders
            expect(loaders1[0]).to.equal(loaders2[0]);
        });

        it('should not allow external modification of loaders', () => {
            const loader = new TypeScriptLoader<IDB>();
            registry.register(loader);

            const loaders = registry.getLoaders();
            loaders.pop(); // Try to remove loader

            // Original registry should still have the loader
            const actualLoaders = registry.getLoaders();
            expect(actualLoaders).to.have.lengthOf(1);
        });
    });

    describe('createDefault()', () => {
        it('should create registry with TypeScript and SQL loaders', () => {
            const defaultRegistry = LoaderRegistry.createDefault();

            const loaders = defaultRegistry.getLoaders();
            expect(loaders).to.have.lengthOf(2);
            expect(loaders[0].getName()).to.equal('TypeScriptLoader');
            expect(loaders[1].getName()).to.equal('SqlLoader');
        });

        it('should handle .ts files with default registry', () => {
            const defaultRegistry = LoaderRegistry.createDefault();
            const loader = defaultRegistry.findLoader('/path/to/test.ts');
            expect(loader.getName()).to.equal('TypeScriptLoader');
        });

        it('should handle .up.sql files with default registry', () => {
            const defaultRegistry = LoaderRegistry.createDefault();
            const loader = defaultRegistry.findLoader('/path/to/test.up.sql');
            expect(loader.getName()).to.equal('SqlLoader');
        });

        it('should use provided logger', () => {
            const logger = new SilentLogger();
            const defaultRegistry = LoaderRegistry.createDefault(logger);

            const loaders = defaultRegistry.getLoaders();
            expect(loaders).to.have.lengthOf(2);
        });

        it('should use default logger if not provided', () => {
            const defaultRegistry = LoaderRegistry.createDefault();

            const loaders = defaultRegistry.getLoaders();
            expect(loaders).to.have.lengthOf(2);
        });
    });

    describe('Custom Loader Integration', () => {
        it('should support registering custom loaders', () => {
            // Create a custom Python loader (mock)
            class PythonLoader implements IMigrationScriptLoader<IDB> {
                canHandle(filePath: string): boolean {
                    return /\.py$/i.test(filePath);
                }

                async load(script: MigrationScript<IDB>): Promise<IRunnableScript<IDB>> {
                    return {
                        up: async () => 'Python migration executed',
                        down: async () => 'Python migration rolled back'
                    };
                }

                getName(): string {
                    return 'PythonLoader';
                }
            }

            registry.register(new TypeScriptLoader<IDB>());
            registry.register(new SqlLoader<IDB>());
            registry.register(new PythonLoader());

            const loader = registry.findLoader('/path/to/test.py');
            expect(loader.getName()).to.equal('PythonLoader');
        });

        it('should respect custom loader priority', () => {
            // Custom loader that overrides .ts handling
            class CustomTsLoader implements IMigrationScriptLoader<IDB> {
                canHandle(filePath: string): boolean {
                    return /\.ts$/i.test(filePath);
                }

                async load(): Promise<IRunnableScript<IDB>> {
                    return {
                        up: async () => 'Custom TS loader',
                        down: async () => 'Custom TS rollback'
                    };
                }

                getName(): string {
                    return 'CustomTsLoader';
                }
            }

            // Register custom loader BEFORE default TypeScript loader
            registry.register(new CustomTsLoader());
            registry.register(new TypeScriptLoader<IDB>());

            const loader = registry.findLoader('/path/to/test.ts');
            // Should get custom loader (registered first)
            expect(loader.getName()).to.equal('CustomTsLoader');
        });
    });
});
