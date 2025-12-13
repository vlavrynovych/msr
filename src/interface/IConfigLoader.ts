import {Config} from "../model";
import {ConfigLoaderOptions} from "../util/ConfigLoader";

/**
 * Interface for configuration loaders.
 *
 * Allows adapters to implement custom config loading logic while maintaining
 * compatibility with the core MigrationScriptExecutor.
 *
 * **New in v0.7.0:**
 * - Enables database adapters to extend ConfigLoader and customize environment variable handling
 * - Supports custom configuration types through generic type parameter (Phase 2)
 *
 * @template C - Configuration type (defaults to Config)
 *
 * @example
 * ```typescript
 * // Basic usage (core library)
 * class ConfigLoader implements IConfigLoader<Config> {
 *     load(overrides?: Partial<Config>, options?: ConfigLoaderOptions): Config {
 *         const config = new Config();
 *         this.applyEnvironmentVariables(config);
 *         if (overrides) Object.assign(config, overrides);
 *         return config;
 *     }
 *
 *     applyEnvironmentVariables(config: Config): void {
 *         // Handle MSR_* env vars
 *     }
 * }
 *
 * // Adapter extending ConfigLoader
 * class PostgreSqlConfigLoader extends ConfigLoader {
 *     applyEnvironmentVariables(config: Config): void {
 *         super.applyEnvironmentVariables(config);  // MSR_* vars
 *
 *         // Add POSTGRES_* env vars
 *         if (process.env.POSTGRES_HOST) {
 *             (config as any).host = process.env.POSTGRES_HOST;
 *         }
 *     }
 * }
 * ```
 */
export interface IConfigLoader<C extends Config = Config> {
    /**
     * Load configuration from various sources.
     *
     * Loading order (later sources override earlier):
     * 1. Default values from Config constructor
     * 2. Config file (if found)
     * 3. Environment variables
     * 4. Overrides parameter
     *
     * @param overrides - Optional configuration overrides
     * @param options - Optional loader options (baseDir for config file search)
     * @returns Loaded configuration
     *
     * @example
     * ```typescript
     * // Load with defaults
     * const config = loader.load();
     *
     * // Load with overrides
     * const config = loader.load({ folder: './migrations' });
     *
     * // Load with custom base directory
     * const config = loader.load({}, { baseDir: '/custom/path' });
     * ```
     */
    load(overrides?: Partial<C>, options?: ConfigLoaderOptions): C;

    /**
     * Apply environment variables to configuration.
     *
     * This method is called during load() and can be overridden by adapters
     * to add custom environment variable handling.
     *
     * **Base implementation handles:**
     * - MSR_FOLDER
     * - MSR_FILE_PATTERNS
     * - MSR_BACKUP_ENABLED
     * - MSR_BACKUP_FOLDER
     * - MSR_BACKUP_MODE
     * - MSR_ROLLBACK_STRATEGY
     * - MSR_ALLOW_MISSING_FILES
     * - MSR_LOG_LEVEL
     * - MSR_TRANSACTION_* (mode, retry, isolation)
     *
     * **Adapters can extend to add their own:**
     * - POSTGRES_HOST, POSTGRES_PORT, etc.
     * - MYSQL_HOST, MYSQL_PORT, etc.
     * - MONGO_URI, etc.
     *
     * @param config - Configuration object to modify
     *
     * @example
     * ```typescript
     * // Adapter extending base ConfigLoader
     * class MyConfigLoader extends ConfigLoader {
     *     applyEnvironmentVariables(config: Config): void {
     *         // Apply base MSR_* env vars
     *         super.applyEnvironmentVariables(config);
     *
     *         // Add custom env vars
     *         if (process.env.MY_DB_HOST) {
     *             (config as any).host = process.env.MY_DB_HOST;
     *         }
     *     }
     * }
     * ```
     */
    applyEnvironmentVariables(config: C): void;
}
