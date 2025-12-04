import * as path from 'path';
import * as fs from 'fs';
import { IConfigFileLoader } from '../../interface/IConfigFileLoader';

/**
 * Loader for YAML configuration files.
 *
 * Supports:
 * - `.yaml` files
 * - `.yml` files
 *
 * **Requires optional peer dependency:** `js-yaml`
 *
 * Install with: `npm install js-yaml`
 *
 * @example
 * ```typescript
 * const loader = new YamlLoader();
 *
 * if (loader.isAvailable()) {
 *     const config = loader.load('msr.config.yaml');
 * } else {
 *     console.error('js-yaml not installed');
 * }
 * ```
 */
export class YamlLoader implements IConfigFileLoader {
    readonly supportedExtensions = ['.yaml', '.yml'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly yamlModule: any = null;
    private readonly loadError: Error | null = null;

    constructor() {
        try {
            // Try to load js-yaml (optional peer dependency)
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            this.yamlModule = require('js-yaml');
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
     * Check if js-yaml is available.
     *
     * @returns True if js-yaml is installed, false otherwise
     *
     * @example
     * ```typescript
     * const loader = new YamlLoader();
     * if (!loader.isAvailable()) {
     *     console.log('Install js-yaml: npm install js-yaml');
     * }
     * ```
     */
    isAvailable(): boolean {
        return this.yamlModule !== null;
    }

    /**
     * Check if this loader can handle the given file.
     *
     * @param filePath - Path to the configuration file
     * @returns True if file has .yaml or .yml extension
     */
    canLoad(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.yaml' || ext === '.yml';
    }

    /**
     * Load and parse YAML configuration file.
     *
     * @param filePath - Path to the configuration file
     * @returns Parsed configuration object
     * @throws Error if js-yaml is not installed, file cannot be read, or YAML is invalid
     *
     * @example
     * ```typescript
     * const loader = new YamlLoader();
     *
     * try {
     *     const config = loader.load<Partial<Config>>('msr.config.yaml');
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
                `Cannot load YAML file ${filePath}: js-yaml is not installed.\n` +
                `Install it with: npm install js-yaml\n` +
                `Original error: ${errorMessage}`
            );
        }

        try {
            const resolvedPath = path.resolve(filePath);
            const content = fs.readFileSync(resolvedPath, 'utf8');

            // Parse YAML content
            const parsed = this.yamlModule!.load(content);

            if (parsed === null || parsed === undefined) {
                throw new Error('YAML file is empty or contains only null/undefined');
            }

            if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error(
                    `Expected YAML file to contain an object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`
                );
            }

            return parsed as T;
        } catch (error) {
            // Don't double-wrap our own error messages
            if (error instanceof Error && error.message.startsWith('Cannot load YAML file')) {
                throw error;
            }

            // Format error message with fallback for non-Error exceptions
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to load configuration from ${filePath}: ${errorMessage}`);
        }
    }
}
