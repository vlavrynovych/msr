import * as path from 'node:path';
import { IConfigFileLoader } from '../../interface/IConfigFileLoader';

/**
 * Loader for JavaScript and JSON configuration files.
 *
 * Supports:
 * - `.js` files (CommonJS modules)
 * - `.json` files (JSON format)
 *
 * Uses Node.js `require()` for loading, which natively supports both formats.
 * Handles ES module default exports automatically.
 *
 * @example
 * ```typescript
 * const loader = new JsJsonLoader();
 *
 * // Load JS config
 * const jsConfig = loader.load('msr.config.js');
 *
 * // Load JSON config
 * const jsonConfig = loader.load('msr.config.json');
 * ```
 */
export class JsJsonLoader implements IConfigFileLoader {
    readonly supportedExtensions = ['.js', '.json'];

    /**
     * Check if this loader can handle the given file.
     *
     * @param filePath - Path to the configuration file
     * @returns True if file has .js or .json extension
     */
    canLoad(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.js' || ext === '.json';
    }

    /**
     * Load and parse JavaScript or JSON configuration file.
     *
     * @param filePath - Path to the configuration file
     * @returns Parsed configuration object
     * @throws Error if file cannot be loaded or parsed
     *
     * @example
     * ```typescript
     * const loader = new JsJsonLoader();
     *
     * try {
     *     const config = loader.load<Partial<Config>>('msr.config.js');
     *     console.log('Folder:', config.folder);
     * } catch (error) {
     *     console.error('Load failed:', error.message);
     * }
     * ```
     */
    load<T = unknown>(filePath: string): T {
        try {
            const resolvedPath = path.resolve(filePath);

            // Use require to load JSON or JS files
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const loaded = require(resolvedPath);

            // Handle ES modules default export
            return (loaded.default || loaded) as T;
        } catch (error) {
            throw new Error(
                `Failed to load configuration from ${filePath}: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            );
        }
    }
}
