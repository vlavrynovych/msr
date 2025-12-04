import * as fs from 'node:fs';
import * as path from 'node:path';
import { Config } from '../model/Config';
import { ENV } from '../model/env';
import { LogLevel } from '../interface/ILogger';
import { ConfigFileLoaderRegistry } from './ConfigFileLoaderRegistry';
import { JsJsonLoader, YamlLoader, TomlLoader, XmlLoader } from './loaders';

/**
 * Options for ConfigLoader.load() method.
 */
export interface ConfigLoaderOptions {
    /**
     * Base directory to search for default config files.
     * @default process.cwd()
     */
    baseDir?: string;

    /**
     * Specific config file path to load (bypasses auto-detection).
     * If provided, this file will be loaded instead of searching for default files.
     * Takes precedence over baseDir and auto-detection.
     */
    configFile?: string;
}

/**
 * Utility class for loading configuration using a waterfall approach.
 *
 * **Loading Priority (Waterfall):**
 * 1. Environment variables (MSR_*)
 * 2. Config file (./msr.config.js, ./msr.config.json, or MSR_CONFIG_FILE)
 * 3. Built-in defaults (from Config class)
 *
 * **Design:**
 * - Database-agnostic - no database-specific parsing
 * - Adapter-friendly - adapters can use helper methods for their own env vars
 * - Type-safe - automatic type coercion based on default values
 *
 * @example
 * ```typescript
 * // Main waterfall loading
 * const config = ConfigLoader.load();
 *
 * // With overrides
 * const config = ConfigLoader.load({ folder: './custom' });
 *
 * // Individual helpers (for adapters)
 * dryRun: boolean = ConfigLoader.loadFromEnv('MSR_DRY_RUN', false);
 * ```
 */
export class ConfigLoader {
    /**
     * Default config file names to search for (in order).
     * Priority: JS > JSON > YAML > TOML > XML
     */
    private static readonly DEFAULT_CONFIG_FILES = [
        'msr.config.js',
        'msr.config.json',
        'msr.config.yaml',
        'msr.config.yml',
        'msr.config.toml',
        'msr.config.xml'
    ];

    /**
     * Static initializer to register default loaders.
     * Registers loaders in priority order.
     */
    private static readonly initialized = (() => {
        // Always register JS/JSON loader (no dependencies)
        ConfigFileLoaderRegistry.register(new JsJsonLoader());

        // Register optional format loaders (they handle missing dependencies gracefully)
        ConfigFileLoaderRegistry.register(new YamlLoader());
        ConfigFileLoaderRegistry.register(new TomlLoader());
        ConfigFileLoaderRegistry.register(new XmlLoader());

        return true;
    })();

    /**
     * Load configuration using waterfall approach.
     *
     * **Priority Order:**
     * 1. Start with built-in defaults (new Config())
     * 2. Merge with config from file (if exists)
     * 3. Merge with environment variables (MSR_*)
     * 4. Merge with provided overrides
     *
     * @param overrides - Optional configuration overrides (highest priority)
     * @param optionsOrBaseDir - Options object or base directory string (for backward compatibility)
     * @returns Fully loaded configuration
     *
     * @example
     * ```typescript
     * // Load with waterfall (env → file → defaults)
     * const config = ConfigLoader.load();
     *
     * // Load with custom overrides
     * const config = ConfigLoader.load({
     *   folder: './migrations',
     *   dryRun: true
     * });
     *
     * // Load from specific directory (backward compatible)
     * const config = ConfigLoader.load({}, '/app');
     *
     * // Load with options object
     * const config = ConfigLoader.load({}, {
     *   baseDir: '/app',
     *   configFile: './config/custom.yaml'
     * });
     *
     * // Load specific config file (bypasses auto-detection)
     * const config = ConfigLoader.load({}, {
     *   configFile: './production.yaml'
     * });
     * ```
     */
    static load(
        overrides?: Partial<Config>,
        optionsOrBaseDir?: string | ConfigLoaderOptions
    ): Config {
        // Normalize options parameter
        const options: ConfigLoaderOptions = typeof optionsOrBaseDir === 'string'
            ? { baseDir: optionsOrBaseDir }
            : (optionsOrBaseDir || {});

        const baseDir = options.baseDir || process.cwd();
        const explicitConfigFile = options.configFile;

        // Step 1: Start with built-in defaults
        const config = new Config();

        // Step 2: Merge with config file (if exists)
        let configFilePath: string | undefined;

        if (explicitConfigFile) {
            // Use explicitly provided config file
            configFilePath = path.resolve(explicitConfigFile);
            if (!fs.existsSync(configFilePath)) {
                console.warn(
                    `Warning: Specified config file does not exist: ${explicitConfigFile}`
                );
                configFilePath = undefined;
            }
        } else {
            // Auto-detect config file in baseDir
            configFilePath = this.findConfigFile(baseDir);
        }

        if (configFilePath) {
            try {
                const fileConfig = this.loadFromFile<Partial<Config>>(configFilePath);
                Object.assign(config, fileConfig);
            } catch (error) {
                /* istanbul ignore next: loadFromFile always throws Error objects */
                const message = error instanceof Error ? error.message : 'Unknown';
                console.warn(
                    `Warning: Failed to load config from ${configFilePath}. ` +
                    `Using defaults. Error: ${message}`
                );
            }
        }

        // Step 3: Merge with environment variables
        this.applyEnvironmentVariables(config);

        // Step 4: Merge with provided overrides (highest priority)
        if (overrides) {
            Object.assign(config, overrides);
        }

        return config;
    }

    /**
     * Find config file in the following order:
     * 1. MSR_CONFIG_FILE environment variable
     * 2. ./msr.config.js
     * 3. ./msr.config.json
     *
     * @param baseDir - Base directory to search (default: process.cwd())
     * @returns Path to config file if found, undefined otherwise
     *
     * @example
     * ```typescript
     * // Check for config file
     * const configPath = ConfigLoader.findConfigFile();
     * if (configPath) {
     *   console.log(`Using config: ${configPath}`);
     * }
     * ```
     */
    static findConfigFile(baseDir: string = process.cwd()): string | undefined {
        // 1. Check MSR_CONFIG_FILE env var
        const envConfigFile = process.env[ENV.MSR_CONFIG_FILE];
        if (envConfigFile) {
            const resolvedPath = path.resolve(baseDir, envConfigFile);
            if (fs.existsSync(resolvedPath)) {
                return resolvedPath;
            }
            console.warn(
                `Warning: ${ENV.MSR_CONFIG_FILE} points to non-existent file: ${envConfigFile}`
            );
        }

        // 2. Check default config files
        for (const filename of this.DEFAULT_CONFIG_FILES) {
            const filePath = path.resolve(baseDir, filename);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }

        return undefined;
    }

    /**
     * Apply environment variables to config object.
     *
     * Looks for MSR_* environment variables and applies them to config.
     * Uses type coercion based on existing config property types.
     *
     * @param config - Config object to apply env vars to
     *
     * @example
     * ```typescript
     * const config = new Config();
     * ConfigLoader.applyEnvironmentVariables(config);
     * // MSR_FOLDER=./db/migrations → config.folder = './db/migrations'
     * // MSR_DRY_RUN=true → config.dryRun = true
     * ```
     */
    static applyEnvironmentVariables(config: Config): void {
        // Simple properties
        if (process.env[ENV.MSR_FOLDER]) {
            config.folder = process.env[ENV.MSR_FOLDER]!;
        }
        if (process.env[ENV.MSR_TABLE_NAME]) {
            config.tableName = process.env[ENV.MSR_TABLE_NAME]!;
        }
        if (process.env[ENV.MSR_BEFORE_MIGRATE_NAME]) {
            config.beforeMigrateName = process.env[ENV.MSR_BEFORE_MIGRATE_NAME]!;
        }
        if (process.env[ENV.MSR_DRY_RUN] !== undefined) {
            config.dryRun = this.parseBoolean(process.env[ENV.MSR_DRY_RUN]!);
        }
        if (process.env[ENV.MSR_DISPLAY_LIMIT] !== undefined) {
            config.displayLimit = this.parseNumber(process.env[ENV.MSR_DISPLAY_LIMIT]!);
        }
        if (process.env[ENV.MSR_RECURSIVE] !== undefined) {
            config.recursive = this.parseBoolean(process.env[ENV.MSR_RECURSIVE]!);
        }
        if (process.env[ENV.MSR_VALIDATE_BEFORE_RUN] !== undefined) {
            config.validateBeforeRun = this.parseBoolean(process.env[ENV.MSR_VALIDATE_BEFORE_RUN]!);
        }
        if (process.env[ENV.MSR_STRICT_VALIDATION] !== undefined) {
            config.strictValidation = this.parseBoolean(process.env[ENV.MSR_STRICT_VALIDATION]!);
        }
        if (process.env[ENV.MSR_SHOW_BANNER] !== undefined) {
            config.showBanner = this.parseBoolean(process.env[ENV.MSR_SHOW_BANNER]!);
        }
        if (process.env[ENV.MSR_LOG_LEVEL]) {
            const level = process.env[ENV.MSR_LOG_LEVEL]!;
            if (['error', 'warn', 'info', 'debug'].includes(level)) {
                config.logLevel = level as LogLevel;
            } else {
                console.warn(`Invalid MSR_LOG_LEVEL value: '${level}'. Valid values are: error, warn, info, debug. Using default 'info'.`);
            }
        }

        // File patterns array
        if (process.env[ENV.MSR_FILE_PATTERNS]) {
            try {
                const patterns = JSON.parse(process.env[ENV.MSR_FILE_PATTERNS]!);
                if (Array.isArray(patterns)) {
                    config.filePatterns = patterns.map(p => new RegExp(p));
                }
            } catch {
                console.warn(`Warning: Invalid ${ENV.MSR_FILE_PATTERNS} format. Expected JSON array.`);
            }
        }

        // Complex objects - prefer dot-notation, fall back to JSON
        // Logging config
        if (process.env[ENV.MSR_LOGGING]) {
            try {
                const logging = JSON.parse(process.env[ENV.MSR_LOGGING]!);
                Object.assign(config.logging, logging);
            } catch {
                console.warn(`Warning: Invalid ${ENV.MSR_LOGGING} JSON. Using dot-notation if available.`);
            }
        }
        // Override with dot-notation env vars (takes precedence)
        config.logging = this.loadNestedFromEnv(ENV.MSR_LOGGING, config.logging);

        // Backup config
        if (config.backup && process.env[ENV.MSR_BACKUP]) {
            try {
                const backup = JSON.parse(process.env[ENV.MSR_BACKUP]!);
                Object.assign(config.backup, backup);
            } catch {
                console.warn(`Warning: Invalid ${ENV.MSR_BACKUP} JSON. Using dot-notation if available.`);
            }
        }
        if (config.backup) {
            config.backup = this.loadNestedFromEnv(ENV.MSR_BACKUP, config.backup);
        }

        // Transaction config (v0.5.0)
        if (process.env[ENV.MSR_TRANSACTION]) {
            try {
                const transaction = JSON.parse(process.env[ENV.MSR_TRANSACTION]!);
                Object.assign(config.transaction, transaction);
            } catch {
                console.warn(`Warning: Invalid ${ENV.MSR_TRANSACTION} JSON. Using dot-notation if available.`);
            }
        }
        // Override with dot-notation env vars (takes precedence)
        config.transaction = this.loadNestedFromEnv(ENV.MSR_TRANSACTION, config.transaction);
    }

    /**
     * Load a single property from environment variable with type coercion.
     *
     * Automatically converts string values to the type of the default value:
     * - boolean: 'true'/'1'/'yes'/'on' → true, anything else → false
     * - number: parses as float
     * - string: returns as-is
     *
     * **Use Case:** Adapters loading their own environment variables.
     *
     * @param envVarName - Name of the environment variable
     * @param defaultValue - Default value if env var not set (determines return type)
     * @returns Value from env var (coerced to type) or default value
     *
     * @example
     * ```typescript
     * // In PostgreSQL adapter
     * class PostgreSQLConfig extends Config {
     *   host: string = ConfigLoader.loadFromEnv('PG_HOST', 'localhost');
     *   port: number = ConfigLoader.loadFromEnv('PG_PORT', 5432);
     *   ssl: boolean = ConfigLoader.loadFromEnv('PG_SSL', false);
     * }
     * ```
     */
    static loadFromEnv<T extends string | number | boolean>(
        envVarName: string,
        defaultValue: T
    ): T {
        const value = process.env[envVarName];

        if (value === undefined || value === '') {
            return defaultValue;
        }

        return this.coerceValue(value, typeof defaultValue) as T;
    }

    /**
     * Load a complex object from a JSON environment variable.
     *
     * Expects the environment variable to contain valid JSON.
     * Falls back to default value if env var not set or contains invalid JSON.
     *
     * **Use Case:** Loading entire config objects from environment.
     *
     * @param envVarName - Name of the environment variable
     * @param defaultValue - Default object if env var not set or invalid
     * @returns Parsed object merged with default value
     *
     * @example
     * ```typescript
     * // In adapter
     * poolConfig: IPoolConfig = ConfigLoader.loadObjectFromEnv('PG_POOL', {
     *   min: 2,
     *   max: 10,
     *   idleTimeoutMillis: 30000
     * });
     *
     * // Environment:
     * // PG_POOL='{"max":20,"idleTimeoutMillis":60000}'
     * // Result: { min: 2, max: 20, idleTimeoutMillis: 60000 }
     * ```
     */
    static loadObjectFromEnv<T extends object>(
        envVarName: string,
        defaultValue: T
    ): T {
        const value = process.env[envVarName];

        if (!value) {
            return defaultValue;
        }

        try {
            const parsed = JSON.parse(value);
            return { ...defaultValue, ...parsed };
        } catch {
            console.warn(
                `Warning: Failed to parse ${envVarName} as JSON. Using default value.`
            );
            return defaultValue;
        }
    }

    /**
     * Load a nested object from dot-notation environment variables.
     *
     * Looks for environment variables with the pattern: PREFIX_KEY=value
     * Automatically coerces types based on default value types.
     *
     * **Use Case:** Preferred method for loading complex objects (better than JSON).
     *
     * @param prefix - Prefix for environment variables (e.g., 'MSR_LOGGING')
     * @param defaultValue - Default object structure with types
     * @returns Object built from env vars or default value
     *
     * @example
     * ```typescript
     * // Environment variables:
     * // MSR_LOGGING_ENABLED=true
     * // MSR_LOGGING_PATH=./custom/logs
     * // MSR_LOGGING_MAX_FILES=20
     *
     * const config = ConfigLoader.loadNestedFromEnv('MSR_LOGGING', {
     *   enabled: false,
     *   path: './logs',
     *   maxFiles: 10
     * });
     * // Result: { enabled: true, path: './custom/logs', maxFiles: 20 }
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static loadNestedFromEnv<T extends Record<string, any>>(
        prefix: string,
        defaultValue: T
    ): T {
        const result = { ...defaultValue };

        for (const key in defaultValue) {
            if (!Object.prototype.hasOwnProperty.call(defaultValue, key)) {
                continue;
            }

            // Convert camelCase to SNAKE_CASE for env var name
            const envKey = `${prefix}_${this.toSnakeCase(key).toUpperCase()}`;
            const envValue = process.env[envKey];

            if (envValue !== undefined && envValue !== '') {
                const defaultType = typeof defaultValue[key];
                result[key] = this.coerceValue(envValue, defaultType) as T[Extract<keyof T, string>];
            }
        }

        return result;
    }

    /**
     * Load configuration from a file using registered loaders.
     *
     * Supports multiple formats via registered loaders:
     * - `.js` / `.json` files (built-in, no dependencies)
     * - `.yaml` / `.yml` files (requires `js-yaml`)
     * - `.toml` files (requires `@iarna/toml`)
     * - `.xml` files (requires `fast-xml-parser`)
     *
     * @param filePath - Path to configuration file (absolute or relative)
     * @returns Configuration object from file
     * @throws Error if file not found, no loader available, or parsing fails
     *
     * @example
     * ```typescript
     * // Load from JSON file
     * const config = ConfigLoader.loadFromFile('./config/production.json');
     *
     * // Load from YAML file (requires js-yaml)
     * const config = ConfigLoader.loadFromFile('./config/production.yaml');
     *
     * // Load from TOML file (requires @iarna/toml)
     * const config = ConfigLoader.loadFromFile('./config/production.toml');
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static loadFromFile<T = any>(filePath: string): T {
        const resolvedPath = path.resolve(filePath);

        // Find a loader that can handle this file
        const loader = ConfigFileLoaderRegistry.getLoader(resolvedPath);

        if (!loader) {
            const ext = path.extname(resolvedPath);
            throw new Error(
                `No loader registered for file type '${ext}'. ` +
                `File: ${filePath}\n` +
                `Supported extensions: ${ConfigFileLoaderRegistry.getSupportedExtensions().join(', ')}`
            );
        }

        // Use the loader to parse the file
        return loader.load<T>(resolvedPath);
    }

    /**
     * Validate that required environment variables are set.
     *
     * @param requiredVars - Array of required environment variable names
     * @throws Error with list of missing variables if any are not set
     *
     * @example
     * ```typescript
     * // In adapter, ensure critical env vars are set
     * ConfigLoader.validateRequired(['PG_HOST', 'PG_DATABASE']);
     * ```
     */
    static validateRequired(requiredVars: string[]): void {
        const missing = requiredVars.filter(varName => !process.env[varName]);

        if (missing.length > 0) {
            throw new Error(
                `Missing required environment variables:\n${missing
                    .map(v => `  - ${v}`)
                    .join('\n')}\n\nPlease set these variables before running.`
            );
        }
    }

    /**
     * Coerce a string value to the specified type.
     *
     * @param value - String value from environment variable
     * @param type - Target type ('boolean', 'number', 'string')
     * @returns Coerced value
     */
    private static coerceValue(value: string, type: string): string | number | boolean {
        switch (type) {
            case 'boolean':
                return this.parseBoolean(value);
            case 'number':
                return this.parseNumber(value);
            case 'string':
            default:
                return value;
        }
    }

    /**
     * Parse a string to boolean.
     *
     * Truthy values: 'true', '1', 'yes', 'on' (case-insensitive)
     * Everything else is false.
     */
    private static parseBoolean(value: string): boolean {
        const normalized = value.toLowerCase().trim();
        return ['true', '1', 'yes', 'on'].includes(normalized);
    }

    /**
     * Parse a string to number.
     *
     * @param value - String value
     * @returns Parsed number or NaN if invalid
     */
    private static parseNumber(value: string): number {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
            console.warn(`Warning: Invalid number value "${value}", using NaN`);
        }
        return parsed;
    }

    /**
     * Convert camelCase to snake_case.
     *
     * @param str - camelCase string
     * @returns snake_case string
     */
    private static toSnakeCase(str: string): string {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
}
