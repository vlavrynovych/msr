/**
 * Interface for configuration file format loaders.
 *
 * Loaders are responsible for parsing configuration files in specific formats
 * (JSON, YAML, TOML, XML, etc.) and converting them to JavaScript objects.
 *
 * @example
 * ```typescript
 * class YamlLoader implements IConfigFileLoader {
 *     get supportedExtensions(): string[] {
 *         return ['.yaml', '.yml'];
 *     }
 *
 *     canLoad(filePath: string): boolean {
 *         return filePath.endsWith('.yaml') || filePath.endsWith('.yml');
 *     }
 *
 *     load<T>(filePath: string): T {
 *         const yaml = require('js-yaml');
 *         const content = fs.readFileSync(filePath, 'utf8');
 *         return yaml.load(content) as T;
 *     }
 * }
 * ```
 */
export interface IConfigFileLoader {
    /**
     * List of file extensions this loader supports (e.g., ['.yaml', '.yml']).
     * Used for documentation and auto-detection.
     */
    readonly supportedExtensions: string[];

    /**
     * Check if this loader can handle the given file path.
     *
     * @param filePath - Path to the configuration file
     * @returns True if this loader can parse the file, false otherwise
     *
     * @example
     * ```typescript
     * if (loader.canLoad('msr.config.yaml')) {
     *     const config = loader.load('msr.config.yaml');
     * }
     * ```
     */
    canLoad(filePath: string): boolean;

    /**
     * Load and parse configuration from the specified file.
     *
     * @param filePath - Path to the configuration file
     * @returns Parsed configuration object
     * @throws Error if file cannot be read or parsed
     *
     * @example
     * ```typescript
     * try {
     *     const config = loader.load<Partial<Config>>('msr.config.yaml');
     *     console.log(config.folder);
     * } catch (error) {
     *     console.error('Failed to load config:', error.message);
     * }
     * ```
     */
    load<T = unknown>(filePath: string): T;
}
