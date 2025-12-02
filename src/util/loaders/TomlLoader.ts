import * as path from 'path';
import * as fs from 'fs';
import { IConfigFileLoader } from '../../interface/IConfigFileLoader';

/**
 * Loader for TOML configuration files.
 *
 * Supports:
 * - `.toml` files
 *
 * **Requires optional peer dependency:** `@iarna/toml`
 *
 * Install with: `npm install @iarna/toml`
 *
 * @example
 * ```typescript
 * const loader = new TomlLoader();
 *
 * if (loader.isAvailable()) {
 *     const config = loader.load('msr.config.toml');
 * } else {
 *     console.error('@iarna/toml not installed');
 * }
 * ```
 */
export class TomlLoader implements IConfigFileLoader {
    readonly supportedExtensions = ['.toml'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private tomlModule: any = null;
    private loadError: Error | null = null;

    constructor() {
        try {
            // Try to load @iarna/toml (optional peer dependency)
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            this.tomlModule = require('@iarna/toml');
        } catch (error) {
            // Ensure error has a meaningful message for reporting
            if (error instanceof Error) {
                this.loadError = error;
            } else {
                this.loadError = new Error('Unknown error');
            }
        }
    }

    /**
     * Check if @iarna/toml is available.
     *
     * @returns True if @iarna/toml is installed, false otherwise
     *
     * @example
     * ```typescript
     * const loader = new TomlLoader();
     * if (!loader.isAvailable()) {
     *     console.log('Install @iarna/toml: npm install @iarna/toml');
     * }
     * ```
     */
    isAvailable(): boolean {
        return this.tomlModule !== null;
    }

    /**
     * Check if this loader can handle the given file.
     *
     * @param filePath - Path to the configuration file
     * @returns True if file has .toml extension
     */
    canLoad(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.toml';
    }

    /**
     * Load and parse TOML configuration file.
     *
     * @param filePath - Path to the configuration file
     * @returns Parsed configuration object
     * @throws Error if @iarna/toml is not installed, file cannot be read, or TOML is invalid
     *
     * @example
     * ```typescript
     * const loader = new TomlLoader();
     *
     * try {
     *     const config = loader.load<Partial<Config>>('msr.config.toml');
     *     console.log('Folder:', config.folder);
     * } catch (error) {
     *     console.error('Load failed:', error.message);
     * }
     * ```
     */
    load<T = unknown>(filePath: string): T {
        if (!this.isAvailable()) {
            // loadError is guaranteed to be Error (never null when !isAvailable)
            // and Error.message always exists
            const errorMessage = this.loadError?.message || 'Module not available';
            throw new Error(
                `Cannot load TOML file ${filePath}: @iarna/toml is not installed.\n` +
                `Install it with: npm install @iarna/toml\n` +
                `Original error: ${errorMessage}`
            );
        }

        try {
            const resolvedPath = path.resolve(filePath);
            const content = fs.readFileSync(resolvedPath, 'utf8');

            // Parse TOML content
            const parsed = this.tomlModule!.parse(content);

            if (parsed === null || parsed === undefined) {
                throw new Error('TOML file is empty or contains only null/undefined');
            }

            if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error(
                    `Expected TOML file to contain an object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`
                );
            }

            return parsed as T;
        } catch (error) {
            // Don't double-wrap our own error messages
            if (error instanceof Error && error.message.startsWith('Cannot load TOML file')) {
                throw error;
            }

            // Format error message with fallback for non-Error exceptions
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to load configuration from ${filePath}: ${errorMessage}`);
        }
    }
}
