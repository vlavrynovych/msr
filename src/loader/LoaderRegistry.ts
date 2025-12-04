import path from 'node:path';
import {ILoaderRegistry} from '../interface/loader/ILoaderRegistry';
import {IMigrationScriptLoader} from '../interface/loader/IMigrationScriptLoader';
import {TypeScriptLoader} from './TypeScriptLoader';
import {SqlLoader} from './SqlLoader';
import {ILogger} from '../interface/ILogger';
import {ConsoleLogger} from '../logger/ConsoleLogger';
import {IDB} from '../interface/dao';

/**
 * Default implementation of ILoaderRegistry.
 *
 * Manages multiple migration script loaders and selects the appropriate
 * loader based on file type. Loaders are checked in registration order.
 *
 * Use `LoaderRegistry.createDefault()` to get a pre-configured registry
 * with TypeScript and SQL loaders.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * // Use default registry
 * const registry = LoaderRegistry.createDefault<IDB>();
 *
 * // Or create custom registry
 * const registry = new LoaderRegistry<IDB>();
 * registry.register(new TypeScriptLoader<IDB>());
 * registry.register(new SqlLoader<IDB>());
 * registry.register(new CustomLoader<IDB>());
 *
 * // Find loader for file
 * const loader = registry.findLoader('/path/V123_create.up.sql');
 * const runnable = await loader.load(script);
 * ```
 */
export class LoaderRegistry<DB extends IDB> implements ILoaderRegistry<DB> {
    private readonly loaders: IMigrationScriptLoader<DB>[] = [];

    /**
     * Register a new migration script loader.
     *
     * Loaders are checked in registration order. Register more specific
     * loaders first, followed by more general loaders.
     *
     * @param loader - Loader implementation to register (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * registry.register(new SqlLoader<IDB>());        // Checks .up.sql first
     * registry.register(new TypeScriptLoader<IDB>()); // Then checks .ts/.js
     * ```
     */
    register(loader: IMigrationScriptLoader<DB>): void {
        this.loaders.push(loader);
    }

    /**
     * Find loader that can handle the given file.
     *
     * Iterates through registered loaders in registration order and returns
     * the first loader whose `canHandle()` method returns true.
     *
     * @param filePath - Absolute path to migration file
     * @returns Loader that can handle the file (typed with generic DB parameter in v0.6.0)
     * @throws Error if no registered loader can handle the file type
     *
     * @example
     * ```typescript
     * const loader = registry.findLoader('/path/V123_create.ts');
     * // Returns TypeScriptLoader
     *
     * const loader = registry.findLoader('/path/V123_create.up.sql');
     * // Returns SqlLoader
     *
     * registry.findLoader('/path/V123_create.yaml');
     * // Throws: No loader found for file: V123_create.yaml
     * ```
     */
    findLoader(filePath: string): IMigrationScriptLoader<DB> {
        for (const loader of this.loaders) {
            if (loader.canHandle(filePath)) {
                return loader;
            }
        }

        const filename = path.basename(filePath);
        const supportedTypes = this.loaders.map(l => l.getName()).join(', ');

        throw new Error(
            `No loader found for file: ${filename}\n` +
            `Supported types: ${supportedTypes}\n` +
            `\n` +
            `To add support for this file type:\n` +
            `1. Implement IMigrationScriptLoader interface\n` +
            `2. Register your loader via dependencies.loaderRegistry`
        );
    }

    /**
     * Get all registered loaders.
     *
     * Returns loaders in registration order.
     *
     * @returns Array of all registered loaders (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * const loaders = registry.getLoaders();
     * console.log('Supported loaders:');
     * loaders.forEach(loader => {
     *     console.log(`  - ${loader.getName()}`);
     * });
     * // Output:
     * //   - TypeScriptLoader
     * //   - SqlLoader
     * ```
     */
    getLoaders(): IMigrationScriptLoader<DB>[] {
        return [...this.loaders];
    }

    /**
     * Create registry with default loaders (TypeScript and SQL).
     *
     * This is the recommended way to get a loader registry unless you need
     * custom loaders. The default registry includes:
     * - TypeScriptLoader (handles .ts and .js files)
     * - SqlLoader (handles .up.sql and .down.sql files)
     *
     * @param logger - Optional logger for all loaders
     * @returns LoaderRegistry with TypeScript and SQL loaders registered (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * // Use default logger
     * const registry = LoaderRegistry.createDefault<IDB>();
     *
     * // Use custom logger
     * const logger = new FileLogger('./migrations.log');
     * const registry = LoaderRegistry.createDefault<IDB>(logger);
     * ```
     */
    static createDefault<DB extends IDB>(logger?: ILogger): LoaderRegistry<DB> {
        const actualLogger = logger || new ConsoleLogger();
        const registry = new LoaderRegistry<DB>();

        // Register loaders in order of specificity
        registry.register(new TypeScriptLoader<DB>(actualLogger));
        registry.register(new SqlLoader<DB>(actualLogger));

        return registry;
    }
}
