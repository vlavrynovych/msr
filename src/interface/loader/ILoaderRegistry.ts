import {IMigrationScriptLoader} from './IMigrationScriptLoader';

/**
 * Registry for migration script loaders.
 *
 * Manages multiple loaders and selects the appropriate one based on file type/extension.
 * Loaders are checked in registration order until one that can handle the file is found.
 *
 * @example
 * ```typescript
 * const registry = new LoaderRegistry();
 * registry.register(new TypeScriptLoader());
 * registry.register(new SqlLoader());
 *
 * // Find appropriate loader for file
 * const loader = registry.findLoader('/migrations/V123_create.up.sql');
 * // Returns SqlLoader instance
 * ```
 */
export interface ILoaderRegistry {
    /**
     * Register a new migration script loader.
     *
     * Loaders are checked in registration order when finding a loader for a file.
     * Register more specific loaders first, followed by more general loaders.
     *
     * @param loader - Loader implementation to register
     *
     * @example
     * ```typescript
     * // Register in order of specificity
     * registry.register(new SqlLoader());        // Checks .up.sql first
     * registry.register(new TypeScriptLoader()); // Then checks .ts/.js
     * registry.register(new JavaScriptLoader()); // Then checks .js specifically
     * ```
     */
    register(loader: IMigrationScriptLoader): void;

    /**
     * Find loader that can handle the given file.
     *
     * Iterates through registered loaders in registration order and returns
     * the first loader whose `canHandle()` method returns true.
     *
     * @param filePath - Absolute path to migration file
     * @returns Loader that can handle the file
     * @throws Error if no registered loader can handle the file type
     *
     * @example
     * ```typescript
     * // For TypeScript file
     * const tsLoader = registry.findLoader('/path/V123_create.ts');
     * // Returns TypeScriptLoader
     *
     * // For SQL file
     * const sqlLoader = registry.findLoader('/path/V123_create.up.sql');
     * // Returns SqlLoader
     *
     * // For unsupported file
     * registry.findLoader('/path/V123_create.yaml');
     * // Throws: No loader found for file: V123_create.yaml
     * ```
     */
    findLoader(filePath: string): IMigrationScriptLoader;

    /**
     * Get all registered loaders.
     *
     * Useful for debugging, logging, or displaying supported file types to users.
     *
     * @returns Array of all registered loaders in registration order
     *
     * @example
     * ```typescript
     * const loaders = registry.getLoaders();
     * console.log('Supported loaders:');
     * loaders.forEach(loader => {
     *     console.log(`  - ${loader.getName()}`);
     * });
     * // Output:
     * //   - SqlLoader
     * //   - TypeScriptLoader
     * ```
     */
    getLoaders(): IMigrationScriptLoader[];
}