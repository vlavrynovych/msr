import {IMigrationScriptLoader} from './IMigrationScriptLoader';
import {IDB} from '../dao';

/**
 * Registry for migration script loaders.
 *
 * Manages multiple loaders and selects the appropriate one based on file type/extension.
 * Loaders are checked in registration order until one that can handle the file is found.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const registry = new LoaderRegistry<IDB>();
 * registry.register(new TypeScriptLoader<IDB>());
 * registry.register(new SqlLoader<IDB>());
 *
 * // Find appropriate loader for file
 * const loader = registry.findLoader('/migrations/V123_create.up.sql');
 * // Returns SqlLoader instance
 * ```
 */
export interface ILoaderRegistry<DB extends IDB> {
    /**
     * Register a new migration script loader.
     *
     * Loaders are checked in registration order when finding a loader for a file.
     * Register more specific loaders first, followed by more general loaders.
     *
     * @param loader - Loader implementation to register (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * // Register in order of specificity
     * registry.register(new SqlLoader<IDB>());        // Checks .up.sql first
     * registry.register(new TypeScriptLoader<IDB>()); // Then checks .ts/.js
     * registry.register(new JavaScriptLoader<IDB>()); // Then checks .js specifically
     * ```
     */
    register(loader: IMigrationScriptLoader<DB>): void;

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
    findLoader(filePath: string): IMigrationScriptLoader<DB>;

    /**
     * Get all registered loaders.
     *
     * Useful for debugging, logging, or displaying supported file types to users.
     *
     * @returns Array of all registered loaders in registration order (typed with generic DB parameter in v0.6.0)
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
    getLoaders(): IMigrationScriptLoader<DB>[];
}