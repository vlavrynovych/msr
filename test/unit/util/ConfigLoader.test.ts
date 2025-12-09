import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ConfigLoader } from '../../../src/util';
import { Config } from '../../../src/model/Config';

describe('ConfigLoader', () => {

    // Store original env vars to restore after tests
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        // Save current env vars
        Object.keys(process.env)
            .filter(key => key.startsWith('MSR_'))
            .forEach(key => {
                originalEnv[key] = process.env[key];
                delete process.env[key];
            });
    });

    afterEach(() => {
        // Restore original env vars
        Object.keys(process.env)
            .filter(key => key.startsWith('MSR_'))
            .forEach(key => delete process.env[key]);

        Object.keys(originalEnv).forEach(key => {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            }
        });
    });

    describe('loadFromEnv', () => {
        /**
         * Test: Load string from environment variable
         * Validates that string values are returned as-is from env vars.
         */
        it('should load string from environment variable', () => {
            process.env.TEST_STRING = './custom/path';

            const result = ConfigLoader.loadFromEnv('TEST_STRING', './default');

            expect(result).to.equal('./custom/path');
        });

        /**
         * Test: Load string with default value when env var not set
         * Validates that default value is used when environment variable is not set.
         */
        it('should use default value when env var not set', () => {
            const result = ConfigLoader.loadFromEnv('TEST_MISSING', './default');

            expect(result).to.equal('./default');
        });

        /**
         * Test: Load boolean from environment variable
         * Validates that boolean values are correctly parsed from strings.
         */
        it('should load boolean from environment variable', () => {
            process.env.TEST_TRUE = 'true';
            process.env.TEST_ONE = '1';
            process.env.TEST_YES = 'yes';
            process.env.TEST_ON = 'on';
            process.env.TEST_FALSE = 'false';
            process.env.TEST_ZERO = '0';

            expect(ConfigLoader.loadFromEnv('TEST_TRUE', false)).to.be.true;
            expect(ConfigLoader.loadFromEnv('TEST_ONE', false)).to.be.true;
            expect(ConfigLoader.loadFromEnv('TEST_YES', false)).to.be.true;
            expect(ConfigLoader.loadFromEnv('TEST_ON', false)).to.be.true;
            expect(ConfigLoader.loadFromEnv('TEST_FALSE', true)).to.be.false;
            expect(ConfigLoader.loadFromEnv('TEST_ZERO', true)).to.be.false;
        });

        /**
         * Test: Boolean parsing is case-insensitive
         * Validates that 'TRUE', 'True', 'true' all parse to true.
         */
        it('should parse boolean case-insensitively', () => {
            process.env.TEST_UPPER = 'TRUE';
            process.env.TEST_MIXED = 'True';
            process.env.TEST_LOWER = 'true';

            expect(ConfigLoader.loadFromEnv('TEST_UPPER', false)).to.be.true;
            expect(ConfigLoader.loadFromEnv('TEST_MIXED', false)).to.be.true;
            expect(ConfigLoader.loadFromEnv('TEST_LOWER', false)).to.be.true;
        });

        /**
         * Test: Load number from environment variable
         * Validates that numeric values are correctly parsed from strings.
         */
        it('should load number from environment variable', () => {
            process.env.TEST_INTEGER = '42';
            process.env.TEST_FLOAT = '3.14';
            process.env.TEST_NEGATIVE = '-10';

            expect(ConfigLoader.loadFromEnv('TEST_INTEGER', 0)).to.equal(42);
            expect(ConfigLoader.loadFromEnv('TEST_FLOAT', 0)).to.equal(3.14);
            expect(ConfigLoader.loadFromEnv('TEST_NEGATIVE', 0)).to.equal(-10);
        });

        /**
         * Test: Return NaN for invalid number strings
         * Validates that invalid numeric strings return NaN with warning.
         */
        it('should return NaN for invalid number strings', () => {
            process.env.TEST_INVALID_NUMBER = 'not-a-number';

            const result = ConfigLoader.loadFromEnv('TEST_INVALID_NUMBER', 0);

            expect(result).to.be.NaN;
        });

        /**
         * Test: Handle empty string as not set
         * Validates that empty strings are treated as missing env vars.
         */
        it('should treat empty string as not set', () => {
            process.env.TEST_EMPTY = '';

            const result = ConfigLoader.loadFromEnv('TEST_EMPTY', './default');

            expect(result).to.equal('./default');
        });
    });

    describe('loadObjectFromEnv', () => {
        /**
         * Test: Load object from JSON environment variable
         * Validates that JSON strings are correctly parsed into objects.
         */
        it('should load object from JSON env var', () => {
            process.env.TEST_JSON = JSON.stringify({
                enabled: true,
                path: './custom',
                maxFiles: 20
            });

            const defaultValue = {
                enabled: false,
                path: './default',
                maxFiles: 10
            };

            const result = ConfigLoader.loadObjectFromEnv('TEST_JSON', defaultValue);

            expect(result).to.deep.equal({
                enabled: true,
                path: './custom',
                maxFiles: 20
            });
        });

        /**
         * Test: Merge JSON with default values
         * Validates that parsed JSON is merged with defaults, not replaced.
         */
        it('should merge JSON with default values', () => {
            process.env.TEST_PARTIAL = JSON.stringify({ maxFiles: 30 });

            const defaultValue = {
                enabled: false,
                path: './default',
                maxFiles: 10
            };

            const result = ConfigLoader.loadObjectFromEnv('TEST_PARTIAL', defaultValue);

            expect(result).to.deep.equal({
                enabled: false,
                path: './default',
                maxFiles: 30
            });
        });

        /**
         * Test: Return default on invalid JSON
         * Validates that invalid JSON returns default value with warning.
         */
        it('should return default value on invalid JSON', () => {
            process.env.TEST_INVALID = 'not valid json';

            const defaultValue = { enabled: false };

            const result = ConfigLoader.loadObjectFromEnv('TEST_INVALID', defaultValue);

            expect(result).to.deep.equal(defaultValue);
        });

        /**
         * Test: Return default when env var not set
         * Validates that default value is used when env var is missing.
         */
        it('should return default when env var not set', () => {
            const defaultValue = { enabled: false };

            const result = ConfigLoader.loadObjectFromEnv('TEST_MISSING', defaultValue);

            expect(result).to.deep.equal(defaultValue);
        });
    });

    describe('loadNestedFromEnv', () => {
        /**
         * Test: Load nested object from dot-notation env vars
         * Validates that PREFIX_KEY env vars are correctly mapped to object properties.
         */
        it('should load nested object from dot-notation env vars', () => {
            process.env.TEST_CONFIG_ENABLED = 'true';
            process.env.TEST_CONFIG_PATH = './custom/path';
            process.env.TEST_CONFIG_MAX_FILES = '25';

            const defaultValue = {
                enabled: false,
                path: './default',
                maxFiles: 10
            };

            const result = ConfigLoader.loadNestedFromEnv('TEST_CONFIG', defaultValue);

            expect(result).to.deep.equal({
                enabled: true,
                path: './custom/path',
                maxFiles: 25
            });
        });

        /**
         * Test: Convert camelCase to SNAKE_CASE for env vars
         * Validates that camelCase property names are converted to SNAKE_CASE.
         */
        it('should convert camelCase to SNAKE_CASE', () => {
            process.env.TEST_NESTED_LOG_SUCCESSFUL = 'true';
            process.env.TEST_NESTED_TIMESTAMP_FORMAT = 'YYYY-MM-DD';

            const defaultValue = {
                logSuccessful: false,
                timestampFormat: 'ISO'
            };

            const result = ConfigLoader.loadNestedFromEnv('TEST_NESTED', defaultValue);

            expect(result.logSuccessful).to.be.true;
            expect(result.timestampFormat).to.equal('YYYY-MM-DD');
        });

        /**
         * Test: Use defaults for missing env vars
         * Validates that properties not set via env vars keep their default values.
         */
        it('should use defaults for missing env vars', () => {
            process.env.TEST_PARTIAL_ENABLED = 'true';

            const defaultValue = {
                enabled: false,
                path: './default',
                maxFiles: 10
            };

            const result = ConfigLoader.loadNestedFromEnv('TEST_PARTIAL', defaultValue);

            expect(result).to.deep.equal({
                enabled: true,
                path: './default',
                maxFiles: 10
            });
        });

        /**
         * Test: Type coercion for nested values
         * Validates that env var values are coerced to match default value types.
         */
        it('should coerce types for nested values', () => {
            process.env.TEST_TYPES_FLAG = 'true';
            process.env.TEST_TYPES_COUNT = '42';
            process.env.TEST_TYPES_NAME = 'test';

            const defaultValue = {
                flag: false,
                count: 0,
                name: ''
            };

            const result = ConfigLoader.loadNestedFromEnv('TEST_TYPES', defaultValue);

            expect(result.flag).to.be.a('boolean');
            expect(result.count).to.be.a('number');
            expect(result.name).to.be.a('string');
            expect(result.flag).to.be.true;
            expect(result.count).to.equal(42);
            expect(result.name).to.equal('test');
        });

        /**
         * Test: Skip inherited properties from prototype
         * Validates that only own properties are processed.
         */
        it('should skip inherited properties from prototype', () => {
            process.env.TEST_PROTO_INHERITED = 'from-env';
            process.env.TEST_PROTO_VALUE = 'from-env';

            // Create object with prototype property and own property
            const protoObject = { inherited: 'proto-value' };
            const defaultValue = Object.create(protoObject) as { inherited: string; value: string };
            defaultValue.value = 'default';

            const result = ConfigLoader.loadNestedFromEnv('TEST_PROTO', defaultValue);

            // Own property should be updated from env var
            expect(result.value).to.equal('from-env');
            // Inherited property should NOT be in result (hasOwnProperty check filters it out)
            expect(result.hasOwnProperty('inherited')).to.be.false;
        });
    });

    describe('applyEnvironmentVariables', () => {
        /**
         * Test: Apply simple environment variables to config
         * Validates that MSR_* env vars are correctly applied to Config object.
         */
        it('should apply simple env vars to config', () => {
            process.env.MSR_FOLDER = './custom/migrations';
            process.env.MSR_TABLE_NAME = 'custom_table';
            process.env.MSR_BEFORE_MIGRATE_NAME = 'custom_before_migrate';
            process.env.MSR_DRY_RUN = 'true';
            process.env.MSR_DISPLAY_LIMIT = '50';

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            expect(config.folder).to.equal('./custom/migrations');
            expect(config.tableName).to.equal('custom_table');
            expect(config.beforeMigrateName).to.equal('custom_before_migrate');
            expect(config.dryRun).to.be.true;
            expect(config.displayLimit).to.equal(50);
        });

        /**
         * Test: Apply nested logging config from env vars
         * Validates that MSR_LOGGING_* env vars are correctly applied.
         */
        it('should apply nested logging config from env vars', () => {
            process.env.MSR_LOGGING_ENABLED = 'true';
            process.env.MSR_LOGGING_PATH = './custom/logs';
            process.env.MSR_LOGGING_MAX_FILES = '20';

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            expect(config.logging.enabled).to.be.true;
            expect(config.logging.path).to.equal('./custom/logs');
            expect(config.logging.maxFiles).to.equal(20);
        });

        /**
         * Test: Apply file patterns from JSON env var
         * Validates that MSR_FILE_PATTERNS can be set via JSON.
         */
        it('should apply file patterns from JSON env var', () => {
            process.env.MSR_FILE_PATTERNS = JSON.stringify([
                '^V(\\d+)_.*\\.ts$',
                '^V(\\d+)_.*\\.sql$'
            ]);

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            expect(config.filePatterns).to.have.lengthOf(2);
            expect(config.filePatterns[0]).to.be.instanceOf(RegExp);
            expect(config.filePatterns[0].test('V123_test.ts')).to.be.true;
        });

        /**
         * Test: Boolean env vars are correctly parsed
         * Validates that various boolean formats are handled.
         */
        it('should parse boolean env vars correctly', () => {
            process.env.MSR_RECURSIVE = 'false';
            process.env.MSR_VALIDATE_BEFORE_RUN = '1';
            process.env.MSR_STRICT_VALIDATION = 'yes';
            process.env.MSR_SHOW_BANNER = 'false';

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            expect(config.recursive).to.be.false;
            expect(config.validateBeforeRun).to.be.true;
            expect(config.strictValidation).to.be.true;
            expect(config.showBanner).to.be.false;
        });

        /**
         * Test: Parse valid MSR_LOG_LEVEL values
         * Validates that all valid log levels are correctly parsed.
         */
        it('should parse valid MSR_LOG_LEVEL values', () => {
            const validLevels = ['error', 'warn', 'info', 'debug'] as const;

            validLevels.forEach((level) => {
                process.env.MSR_LOG_LEVEL = level;

                const config = new Config();
                config.showBanner = false;
                new ConfigLoader().applyEnvironmentVariables(config);

                expect(config.logLevel).to.equal(level);

                // Clean up for next iteration
                delete process.env.MSR_LOG_LEVEL;
            });
        });

        /**
         * Test: Handle invalid MSR_LOG_LEVEL gracefully
         * Validates that invalid log level values trigger warning and use default.
         */
        it('should use default log level for invalid MSR_LOG_LEVEL', () => {
            process.env.MSR_LOG_LEVEL = 'invalid-level';

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            // Should keep default 'info' when invalid value provided
            expect(config.logLevel).to.equal('info');
        });

        /**
         * Test: MSR_LOG_LEVEL not set uses default
         * Validates that default log level is used when env var not set.
         */
        it('should use default log level when MSR_LOG_LEVEL not set', () => {
            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            // Should use default 'info' from Config class
            expect(config.logLevel).to.equal('info');
        });

        /**
         * Test: Handle invalid MSR_FILE_PATTERNS JSON
         * Validates that invalid JSON in MSR_FILE_PATTERNS is handled gracefully with warning.
         */
        it('should handle invalid MSR_FILE_PATTERNS JSON', () => {
            process.env.MSR_FILE_PATTERNS = 'invalid json [';

            const config = new Config();
            config.showBanner = false;
            const originalPatterns = [...config.filePatterns];

            new ConfigLoader().applyEnvironmentVariables(config);

            // Should keep original patterns when JSON is invalid
            expect(config.filePatterns).to.deep.equal(originalPatterns);
        });

        /**
         * Test: Handle invalid MSR_LOGGING JSON
         * Validates that invalid JSON in MSR_LOGGING falls back to dot-notation.
         */
        it('should handle invalid MSR_LOGGING JSON', () => {
            process.env.MSR_LOGGING = 'invalid json {';
            process.env.MSR_LOGGING_ENABLED = 'true';

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            // Dot-notation should still work even when JSON is invalid
            expect(config.logging.enabled).to.be.true;
        });

        /**
         * Test: Handle invalid MSR_BACKUP JSON
         * Validates that invalid JSON in MSR_BACKUP falls back to dot-notation.
         */
        it('should handle invalid MSR_BACKUP JSON', () => {
            process.env.MSR_BACKUP = 'invalid json {';
            process.env.MSR_BACKUP_TIMESTAMP = 'false';

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            // Dot-notation should still work even when JSON is invalid
            if (config.backup) {
                expect(config.backup.timestamp).to.be.false;
            }
        });

        /**
         * Test: Handle MSR_LOGGING and MSR_BACKUP JSON with valid values
         * Validates that valid JSON is correctly parsed.
         */
        it('should apply MSR_LOGGING and MSR_BACKUP from valid JSON', () => {
            process.env.MSR_LOGGING = JSON.stringify({
                enabled: true,
                path: './json/logs'
            });
            process.env.MSR_BACKUP = JSON.stringify({
                timestamp: false,
                folder: './json/backup'
            });

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            expect(config.logging.enabled).to.be.true;
            expect(config.logging.path).to.equal('./json/logs');

            if (config.backup) {
                expect(config.backup.timestamp).to.be.false;
                expect(config.backup.folder).to.equal('./json/backup');
            }
        });

        /**
         * Test: Apply transaction config from JSON environment variable
         * Validates that transaction config can be loaded from MSR_TRANSACTION JSON.
         */
        it('should apply transaction config from JSON environment variable', () => {
            process.env.MSR_TRANSACTION = JSON.stringify({
                mode: 'PER_BATCH',
                retries: 5
            });

            const config = new Config();
            config.showBanner = false;
            new ConfigLoader().applyEnvironmentVariables(config);

            expect(config.transaction.mode).to.equal('PER_BATCH');
            expect(config.transaction.retries).to.equal(5);
        });

        /**
         * Test: Handle invalid transaction JSON gracefully
         * Validates that invalid MSR_TRANSACTION JSON doesn't crash the loader.
         */
        it('should handle invalid transaction JSON gracefully', () => {
            process.env.MSR_TRANSACTION = 'invalid-json';

            const config = new Config();
            config.showBanner = false;

            // Should not throw
            new ConfigLoader().applyEnvironmentVariables(config);

            // Should keep default values
            expect(config.transaction.mode).to.equal('PER_MIGRATION');
        });
    });

    describe('findConfigFile', () => {
        /**
         * Test: Find msr.config.js when it exists
         * Validates that msr.config.js is found in the base directory.
         */
        it('should find msr.config.js when it exists', () => {
            const testDir = path.resolve(__dirname, '../../../');
            const configFile = path.resolve(testDir, 'msr.config.js');

            // Create test config file
            fs.writeFileSync(configFile, 'module.exports = {};');

            try {
                const result = ConfigLoader.findConfigFile(testDir);
                expect(result).to.equal(configFile);
            } finally {
                // Clean up
                if (fs.existsSync(configFile)) {
                    fs.unlinkSync(configFile);
                }
            }
        });

        /**
         * Test: Find msr.config.json when it exists
         * Validates that msr.config.json is found in the base directory.
         */
        it('should find msr.config.json when it exists', () => {
            const testDir = path.resolve(__dirname, '../../../');
            const configFile = path.resolve(testDir, 'msr.config.json');

            // Create test config file
            fs.writeFileSync(configFile, '{}');

            try {
                const result = ConfigLoader.findConfigFile(testDir);
                expect(result).to.equal(configFile);
            } finally {
                // Clean up
                if (fs.existsSync(configFile)) {
                    fs.unlinkSync(configFile);
                }
            }
        });

        /**
         * Test: Return undefined when no config file exists
         * Validates that undefined is returned when no config files are found.
         */
        it('should return undefined when no config file exists', () => {
            const testDir = path.resolve(__dirname, '../../../');

            const result = ConfigLoader.findConfigFile(testDir);

            expect(result).to.be.undefined;
        });

        /**
         * Test: Use MSR_CONFIG_FILE env var if set
         * Validates that MSR_CONFIG_FILE takes precedence over default locations.
         */
        it('should use MSR_CONFIG_FILE env var if set', () => {
            const testDir = path.resolve(__dirname, '../../../');
            const customConfig = path.resolve(testDir, 'custom.config.js');

            process.env.MSR_CONFIG_FILE = 'custom.config.js';

            // Create custom config file
            fs.writeFileSync(customConfig, 'module.exports = {};');

            try {
                const result = ConfigLoader.findConfigFile(testDir);
                expect(result).to.equal(customConfig);
            } finally {
                // Clean up
                if (fs.existsSync(customConfig)) {
                    fs.unlinkSync(customConfig);
                }
                delete process.env.MSR_CONFIG_FILE;
            }
        });

        /**
         * Test: Warn when MSR_CONFIG_FILE points to non-existent file
         * Validates that warning is issued when MSR_CONFIG_FILE is invalid.
         */
        it('should warn when MSR_CONFIG_FILE points to non-existent file', () => {
            const testDir = path.resolve(__dirname, '../../../');

            process.env.MSR_CONFIG_FILE = 'non-existent-config.js';

            try {
                const result = ConfigLoader.findConfigFile(testDir);
                // Should return undefined and warn
                expect(result).to.be.undefined;
            } finally {
                delete process.env.MSR_CONFIG_FILE;
            }
        });

        /**
         * Test: Prefer msr.config.js over msr.config.json
         * Validates priority order when multiple config files exist.
         */
        it('should prefer msr.config.js over msr.config.json', () => {
            const testDir = path.resolve(__dirname, '../../../');
            const jsConfig = path.resolve(testDir, 'msr.config.js');
            const jsonConfig = path.resolve(testDir, 'msr.config.json');

            // Create both config files
            fs.writeFileSync(jsConfig, 'module.exports = {};');
            fs.writeFileSync(jsonConfig, '{}');

            try {
                const result = ConfigLoader.findConfigFile(testDir);
                expect(result).to.equal(jsConfig);
            } finally {
                // Clean up
                if (fs.existsSync(jsConfig)) {
                    fs.unlinkSync(jsConfig);
                }
                if (fs.existsSync(jsonConfig)) {
                    fs.unlinkSync(jsonConfig);
                }
            }
        });

        /**
         * Test: Use default baseDir when not provided
         * Validates that process.cwd() is used as default baseDir parameter.
         */
        it('should use process.cwd() as default baseDir', () => {
            const jsConfig = path.resolve(process.cwd(), 'msr.config.js');

            // Create config file in cwd
            fs.writeFileSync(jsConfig, 'module.exports = {};');

            try {
                // Call without baseDir parameter to use default
                const result = ConfigLoader.findConfigFile();
                expect(result).to.equal(jsConfig);
            } finally {
                // Clean up
                if (fs.existsSync(jsConfig)) {
                    fs.unlinkSync(jsConfig);
                }
            }
        });
    });

    describe('load', () => {
        /**
         * Test: Load returns Config instance with defaults
         * Validates that load() returns a proper Config object.
         */
        it('should return Config instance with defaults', () => {
            const config = new ConfigLoader().load();

            expect(config).to.be.instanceOf(Config);
            expect(config.folder).to.be.a('string');
            expect(config.tableName).to.be.a('string');
        });

        /**
         * Test: Waterfall priority - env vars override defaults
         * Validates that environment variables override default values.
         */
        it('should apply env vars over defaults (waterfall)', () => {
            process.env.MSR_FOLDER = './env/migrations';
            process.env.MSR_DRY_RUN = 'true';

            const config = new ConfigLoader().load();

            expect(config.folder).to.equal('./env/migrations');
            expect(config.dryRun).to.be.true;
        });

        /**
         * Test: Waterfall priority - overrides override env vars
         * Validates that constructor overrides have highest priority.
         */
        it('should apply overrides over env vars (waterfall)', () => {
            process.env.MSR_FOLDER = './env/migrations';

            const config = new ConfigLoader().load({
                folder: './override/migrations'
            });

            expect(config.folder).to.equal('./override/migrations');
        });

        /**
         * Test: Load config from file when it exists
         * Validates that config file values are loaded.
         */
        it('should load config from file when it exists', () => {
            const testDir = process.cwd();
            const configFile = path.resolve(testDir, 'msr.config.js');

            // Create test config file
            fs.writeFileSync(configFile, `
                module.exports = {
                    folder: './file/migrations',
                    tableName: 'file_table'
                };
            `);

            try {
                const config = new ConfigLoader().load(undefined, { baseDir: testDir });

                expect(config.folder).to.equal('./file/migrations');
                expect(config.tableName).to.equal('file_table');
            } finally {
                // Clean up
                if (fs.existsSync(configFile)) {
                    fs.unlinkSync(configFile);
                }
                // Clear require cache
                delete require.cache[configFile];
            }
        });

        /**
         * Test: Complete waterfall: overrides > env > file > defaults
         * Validates the complete priority chain.
         */
        it('should follow complete waterfall priority', () => {
            const testDir = process.cwd();
            const configFile = path.resolve(testDir, 'msr.config.js');

            // Create config file
            fs.writeFileSync(configFile, `
                module.exports = {
                    folder: './file/migrations',
                    tableName: 'file_table',
                    displayLimit: 10
                };
            `);

            // Set env vars
            process.env.MSR_TABLE_NAME = 'env_table';
            process.env.MSR_DRY_RUN = 'true';

            try {
                const config = new ConfigLoader().load({
                    tableName: 'override_table'
                }, { baseDir: testDir });

                // Override wins
                expect(config.tableName).to.equal('override_table');
                // Env var wins over file
                expect(config.dryRun).to.be.true;
                // File wins over default
                expect(config.displayLimit).to.equal(10);
                // File value used when no env or override
                expect(config.folder).to.equal('./file/migrations');
            } finally {
                // Clean up
                if (fs.existsSync(configFile)) {
                    fs.unlinkSync(configFile);
                }
                delete require.cache[configFile];
            }
        });

        /**
         * Test: Continue with defaults when config file loading fails
         * Validates that errors in config file loading don't break the system.
         */
        it('should continue with defaults when config file loading fails', () => {
            const testDir = process.cwd();
            const configFile = path.resolve(testDir, 'msr.config.js');

            // Create invalid config file (syntax error)
            fs.writeFileSync(configFile, 'module.exports = { invalid syntax');

            try {
                const config = new ConfigLoader().load(undefined, { baseDir: testDir });

                // Should still return a valid Config with defaults
                expect(config).to.be.instanceOf(Config);
                expect(config.folder).to.be.a('string');
            } finally {
                // Clean up
                if (fs.existsSync(configFile)) {
                    fs.unlinkSync(configFile);
                }
                delete require.cache[configFile];
            }
        });

        /**
         * Test: Handle non-Error exceptions during config file loading
         * Validates that non-Error exceptions (like strings) are handled gracefully.
         */
        it('should handle non-Error exceptions during config file loading', () => {
            const testDir = process.cwd();
            const configFile = path.resolve(testDir, 'msr.config.js');

            // Create config file that throws a non-Error
            fs.writeFileSync(configFile, 'throw "String error not Error instance";');

            try {
                const config = new ConfigLoader().load(undefined, { baseDir: testDir });

                // Should still return a valid Config with defaults
                expect(config).to.be.instanceOf(Config);
                expect(config.folder).to.be.a('string');
            } finally {
                // Clean up
                if (fs.existsSync(configFile)) {
                    fs.unlinkSync(configFile);
                }
                delete require.cache[configFile];
            }
        });

        /**
         * Test: Handle non-existent explicit config file
         * Validates that specifying a non-existent config file falls back to defaults.
         */
        it('should warn and use defaults when explicit config file does not exist', () => {
            const config = new ConfigLoader().load(undefined, {
                configFile: './non-existent-config.yaml'
            });

            // Should still return a valid Config with defaults
            expect(config).to.be.instanceOf(Config);
            expect(config.folder).to.be.a('string');
        });

        /**
         * Test: Load with ConfigLoaderOptions object
         * Validates that ConfigLoaderOptions with baseDir works correctly.
         */
        it('should accept ConfigLoaderOptions with baseDir', () => {
            const testDir = process.cwd();
            const config = new ConfigLoader().load(undefined, {
                baseDir: testDir
            });

            expect(config).to.be.instanceOf(Config);
        });
    });

    describe('loadFromFile', () => {
        /**
         * Test: Load config from JSON file
         * Validates that JSON files are correctly loaded.
         */
        it('should load config from JSON file', () => {
            const testFile = path.resolve(__dirname, 'test-config.json');

            fs.writeFileSync(testFile, JSON.stringify({
                folder: './json/migrations',
                tableName: 'json_table'
            }));

            try {
                const config = ConfigLoader.loadFromFile<Partial<Config>>(testFile);

                expect(config.folder).to.equal('./json/migrations');
                expect(config.tableName).to.equal('json_table');
            } finally {
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
            }
        });

        /**
         * Test: Load config from JS file
         * Validates that JavaScript CommonJS files are correctly loaded.
         */
        it('should load config from JS file', () => {
            const testFile = path.resolve(__dirname, 'test-config.js');

            fs.writeFileSync(testFile, `
                module.exports = {
                    folder: './js/migrations',
                    tableName: 'js_table'
                };
            `);

            try {
                const config = ConfigLoader.loadFromFile<Partial<Config>>(testFile);

                expect(config.folder).to.equal('./js/migrations');
                expect(config.tableName).to.equal('js_table');
            } finally {
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
                delete require.cache[testFile];
            }
        });

        /**
         * Test: Load config from ES module with default export
         * Validates that ES modules with default exports are correctly handled.
         */
        it('should handle ES module default export', () => {
            const testFile = path.resolve(__dirname, 'test-es-config.js');

            // Simulate ES module style with default export
            fs.writeFileSync(testFile, `
                module.exports = {
                    default: {
                        folder: './es/migrations',
                        tableName: 'es_table'
                    }
                };
            `);

            try {
                const config = ConfigLoader.loadFromFile<Partial<Config>>(testFile);

                expect(config.folder).to.equal('./es/migrations');
                expect(config.tableName).to.equal('es_table');
            } finally {
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
                delete require.cache[testFile];
            }
        });

        /**
         * Test: Throw error when file not found
         * Validates that appropriate error is thrown for missing files.
         */
        it('should throw error when file not found', () => {
            const nonExistentFile = path.resolve(__dirname, 'does-not-exist.json');

            expect(() => ConfigLoader.loadFromFile(nonExistentFile)).to.throw();
        });

        /**
         * Test: Throw error with non-Error exception message
         * Validates that non-Error exceptions are wrapped with "Unknown error" message.
         */
        it('should handle non-Error exceptions in loadFromFile', () => {
            const testFile = path.resolve(__dirname, 'test-throw.js');

            // Create file that throws a non-Error
            fs.writeFileSync(testFile, 'throw "String error";');

            try {
                expect(() => ConfigLoader.loadFromFile(testFile)).to.throw(/Unknown error/);
            } finally {
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
                delete require.cache[testFile];
            }
        });

        /**
         * Test: Throw error for unsupported file extension
         * Validates that files with unsupported extensions throw helpful error.
         */
        it('should throw error for unsupported file extension', () => {
            const testFile = path.resolve(__dirname, 'test-config.txt');

            fs.writeFileSync(testFile, 'folder: ./migrations');

            try {
                const thrower = () => ConfigLoader.loadFromFile(testFile);
                expect(thrower).to.throw(/No loader registered for file type/);
                expect(thrower).to.throw(/\.txt/);
            } finally {
                if (fs.existsSync(testFile)) {
                    fs.unlinkSync(testFile);
                }
            }
        });
    });

    describe('validateRequired', () => {
        /**
         * Test: No error when all required vars are set
         * Validates that validation passes when all required vars exist.
         */
        it('should not throw when all required vars are set', () => {
            process.env.TEST_REQUIRED_1 = 'value1';
            process.env.TEST_REQUIRED_2 = 'value2';

            expect(() => {
                ConfigLoader.validateRequired(['TEST_REQUIRED_1', 'TEST_REQUIRED_2']);
            }).to.not.throw();
        });

        /**
         * Test: Throw error when required var is missing
         * Validates that validation fails when required vars are missing.
         */
        it('should throw when required var is missing', () => {
            expect(() => {
                ConfigLoader.validateRequired(['TEST_MISSING_VAR']);
            }).to.throw(/Missing required environment variables/);
        });

        /**
         * Test: Error message lists all missing vars
         * Validates that error message includes all missing variable names.
         */
        it('should list all missing vars in error message', () => {
            try {
                ConfigLoader.validateRequired(['TEST_MISSING_1', 'TEST_MISSING_2']);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.be.instanceOf(Error);
                const message = (error as Error).message;
                expect(message).to.include('TEST_MISSING_1');
                expect(message).to.include('TEST_MISSING_2');
            }
        });

        /**
         * Test: Only check missing vars, not present ones
         * Validates that only missing vars are reported in error.
         */
        it('should only report missing vars', () => {
            process.env.TEST_PRESENT = 'value';

            try {
                ConfigLoader.validateRequired(['TEST_PRESENT', 'TEST_MISSING']);
                expect.fail('Should have thrown error');
            } catch (error) {
                const message = (error as Error).message;
                expect(message).to.include('TEST_MISSING');
                expect(message).to.not.include('TEST_PRESENT');
            }
        });
    });

    describe('autoApplyEnvironmentVariables - Adapter Extensibility', () => {
        /**
         * Extended config for testing adapter scenarios
         */
        class TestAdapterConfig extends Config {
            host: string = 'localhost';
            port: number = 5432;
            ssl: boolean = false;
            poolSize: number = 10;
            customObject: { enabled: boolean; timeout: number } = {
                enabled: false,
                timeout: 5000
            };
        }

        /**
         * Extended ConfigLoader for testing adapter scenarios
         */
        class TestAdapterConfigLoader extends ConfigLoader<TestAdapterConfig> {
            applyEnvironmentVariables(config: TestAdapterConfig): void {
                // First apply MSR_* vars (base config)
                super.applyEnvironmentVariables(config);

                // Then apply adapter-specific vars with custom prefix
                this.autoApplyEnvironmentVariables(config, 'TEST_DB');
            }
        }

        /**
         * Test: Automatic parsing with custom prefix for adapters
         * Validates that adapters can use autoApplyEnvironmentVariables with their own prefix.
         */
        it('should automatically parse env vars with custom prefix', () => {
            process.env.TEST_DB_HOST = 'db.example.com';
            process.env.TEST_DB_PORT = '3306';
            process.env.TEST_DB_SSL = 'true';
            process.env.TEST_DB_POOL_SIZE = '20';

            const config = new TestAdapterConfig();
            const loader = new TestAdapterConfigLoader();
            loader.applyEnvironmentVariables(config);

            expect(config.host).to.equal('db.example.com');
            expect(config.port).to.equal(3306);
            expect(config.ssl).to.be.true;
            expect(config.poolSize).to.equal(20);
        });

        /**
         * Test: Automatic parsing of nested objects
         * Validates that nested objects are automatically parsed with dot-notation.
         */
        it('should automatically parse nested objects', () => {
            process.env.TEST_DB_CUSTOM_OBJECT_ENABLED = 'true';
            process.env.TEST_DB_CUSTOM_OBJECT_TIMEOUT = '10000';

            const config = new TestAdapterConfig();
            const loader = new TestAdapterConfigLoader();
            loader.applyEnvironmentVariables(config);

            expect(config.customObject.enabled).to.be.true;
            expect(config.customObject.timeout).to.equal(10000);
        });

        /**
         * Test: CamelCase to SNAKE_CASE conversion
         * Validates that property names are correctly converted to env var names.
         */
        it('should convert camelCase property names to SNAKE_CASE env vars', () => {
            process.env.TEST_DB_POOL_SIZE = '15';

            const config = new TestAdapterConfig();
            const loader = new TestAdapterConfigLoader();
            loader.applyEnvironmentVariables(config);

            expect(config.poolSize).to.equal(15);
        });

        /**
         * Test: Type coercion for different types
         * Validates that automatic type coercion works for all primitive types.
         */
        it('should automatically coerce types based on default values', () => {
            process.env.TEST_DB_HOST = 'string-value';
            process.env.TEST_DB_PORT = '9999';
            process.env.TEST_DB_SSL = 'true';

            const config = new TestAdapterConfig();
            const loader = new TestAdapterConfigLoader();
            loader.applyEnvironmentVariables(config);

            expect(config.host).to.be.a('string');
            expect(config.port).to.be.a('number');
            expect(config.ssl).to.be.a('boolean');
        });

        /**
         * Test: Override system for special cases
         * Validates that custom overrides can be used for properties requiring special handling.
         */
        it('should support custom overrides for special case properties', () => {
            class CustomLoaderWithOverrides extends ConfigLoader<TestAdapterConfig> {
                applyEnvironmentVariables(config: TestAdapterConfig): void {
                    super.applyEnvironmentVariables(config);

                    const overrides = new Map<string, (cfg: TestAdapterConfig, envVar: string) => void>();

                    // Custom validation for port
                    overrides.set('port', (cfg: TestAdapterConfig, envVar: string) => {
                        const value = process.env[envVar];
                        if (value) {
                            const port = parseInt(value, 10);
                            if (port >= 1 && port <= 65535) {
                                cfg.port = port;
                            } else {
                                console.warn(`Invalid port ${port}, using default`);
                            }
                        }
                    });

                    this.autoApplyEnvironmentVariables(config, 'TEST_DB', overrides);
                }
            }

            // Valid port
            process.env.TEST_DB_PORT = '8080';
            let config = new TestAdapterConfig();
            new CustomLoaderWithOverrides().applyEnvironmentVariables(config);
            expect(config.port).to.equal(8080);

            // Invalid port (out of range)
            process.env.TEST_DB_PORT = '99999';
            config = new TestAdapterConfig();
            new CustomLoaderWithOverrides().applyEnvironmentVariables(config);
            expect(config.port).to.equal(5432); // Should use default
        });

        /**
         * Test: Base config and adapter config vars work together
         * Validates that MSR_* and adapter-specific vars can coexist.
         */
        it('should apply both MSR_* and adapter-specific vars', () => {
            process.env.MSR_FOLDER = './custom/migrations';
            process.env.MSR_DRY_RUN = 'true';
            process.env.TEST_DB_HOST = 'db.example.com';
            process.env.TEST_DB_PORT = '3306';

            const config = new TestAdapterConfig();
            const loader = new TestAdapterConfigLoader();
            loader.applyEnvironmentVariables(config);

            // Base MSR config
            expect(config.folder).to.equal('./custom/migrations');
            expect(config.dryRun).to.be.true;

            // Adapter-specific config
            expect(config.host).to.equal('db.example.com');
            expect(config.port).to.equal(3306);
        });

        /**
         * Test: Backward compatibility with manual env var handling
         * Validates that adapters can still manually handle env vars if needed.
         */
        it('should allow mixing automatic and manual env var handling', () => {
            class MixedLoader extends ConfigLoader<TestAdapterConfig> {
                applyEnvironmentVariables(config: TestAdapterConfig): void {
                    super.applyEnvironmentVariables(config);

                    // Manual handling for some vars
                    if (process.env.TEST_DB_HOST) {
                        config.host = process.env.TEST_DB_HOST;
                    }

                    // Automatic handling for others
                    this.autoApplyEnvironmentVariables(config, 'TEST_DB');
                }
            }

            process.env.TEST_DB_HOST = 'manual.example.com';
            process.env.TEST_DB_PORT = '3306';

            const config = new TestAdapterConfig();
            new MixedLoader().applyEnvironmentVariables(config);

            expect(config.host).to.equal('manual.example.com');
            expect(config.port).to.equal(3306);
        });
    });
});
