import { IConfigFileLoader } from '../interface/IConfigFileLoader';

/**
 * Registry for configuration file format loaders.
 *
 * Manages registration and retrieval of loaders for different configuration
 * file formats (JS, JSON, YAML, TOML, XML, etc.).
 *
 * @example
 * ```typescript
 * // Register a custom loader
 * ConfigFileLoaderRegistry.register(new YamlLoader());
 *
 * // Find loader for a file
 * const loader = ConfigFileLoaderRegistry.getLoader('msr.config.yaml');
 * if (loader) {
 *     const config = loader.load('msr.config.yaml');
 * }
 * ```
 */
export class ConfigFileLoaderRegistry {
    private static loaders: IConfigFileLoader[] = [];

    /**
     * Register a configuration file loader.
     *
     * Loaders are checked in registration order when finding a loader for a file.
     * Register more specific loaders before more generic ones.
     * Duplicate loaders (same instance) are not registered twice.
     *
     * @param loader - The loader to register
     *
     * @example
     * ```typescript
     * // Register loaders in priority order
     * ConfigFileLoaderRegistry.register(new JsJsonLoader());
     * ConfigFileLoaderRegistry.register(new YamlLoader());
     * ConfigFileLoaderRegistry.register(new TomlLoader());
     * ```
     */
    static register(loader: IConfigFileLoader): void {
        // Prevent duplicate registration of the same loader instance
        if (!this.loaders.includes(loader)) {
            this.loaders.push(loader);
        }
    }

    /**
     * Get a loader that can handle the specified file.
     *
     * Returns the first registered loader that can handle the file,
     * or undefined if no suitable loader is found.
     *
     * @param filePath - Path to the configuration file
     * @returns Loader capable of handling the file, or undefined
     *
     * @example
     * ```typescript
     * const loader = ConfigFileLoaderRegistry.getLoader('msr.config.yaml');
     * if (loader) {
     *     const config = loader.load('msr.config.yaml');
     * } else {
     *     console.error('No loader found for YAML files');
     * }
     * ```
     */
    static getLoader(filePath: string): IConfigFileLoader | undefined {
        return this.loaders.find(loader => loader.canLoad(filePath));
    }

    /**
     * Get all registered loaders.
     *
     * @returns Array of all registered loaders
     *
     * @example
     * ```typescript
     * const loaders = ConfigFileLoaderRegistry.getAllLoaders();
     * console.log('Supported formats:',
     *     loaders.flatMap(l => l.supportedExtensions).join(', '));
     * ```
     */
    static getAllLoaders(): readonly IConfigFileLoader[] {
        return [...this.loaders];
    }

    /**
     * Get all supported file extensions across all registered loaders.
     *
     * Returns a deduplicated list of extensions. If multiple loaders support
     * the same extension, it appears only once in the result.
     *
     * @returns Array of supported file extensions (e.g., ['.js', '.json', '.yaml'])
     *
     * @example
     * ```typescript
     * const extensions = ConfigFileLoaderRegistry.getSupportedExtensions();
     * // ['.js', '.json', '.yaml', '.yml', '.toml', '.xml']
     * ```
     */
    static getSupportedExtensions(): string[] {
        const extensions = this.loaders.flatMap(loader => loader.supportedExtensions);
        // Deduplicate using Set
        return Array.from(new Set(extensions));
    }

    /**
     * Clear all registered loaders.
     *
     * Primarily used for testing to reset the registry to a known state.
     *
     * @example
     * ```typescript
     * // In test setup
     * beforeEach(() => {
     *     ConfigFileLoaderRegistry.clear();
     *     ConfigFileLoaderRegistry.register(new JsJsonLoader());
     * });
     * ```
     */
    static clear(): void {
        this.loaders = [];
    }

    /**
     * Check if a loader is registered for the given file extension.
     *
     * Comparison is case-insensitive (.yaml, .YAML, and .Yaml are treated the same).
     *
     * @param extension - File extension (e.g., '.yaml', '.toml')
     * @returns True if a loader supports this extension, false otherwise
     *
     * @example
     * ```typescript
     * if (ConfigFileLoaderRegistry.hasLoaderForExtension('.yaml')) {
     *     console.log('YAML configuration files are supported');
     * }
     * ```
     */
    static hasLoaderForExtension(extension: string): boolean {
        const lowerExt = extension.toLowerCase();
        return this.loaders.some(loader =>
            loader.supportedExtensions.some(ext => ext.toLowerCase() === lowerExt)
        );
    }
}
