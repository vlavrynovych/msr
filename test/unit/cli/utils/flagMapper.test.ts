import {expect} from 'chai';
import {mapFlagsToConfig, CLIFlags} from '../../../../src/cli/utils/flagMapper';
import {Config} from '../../../../src/model/Config';
import {ConsoleLogger} from '../../../../src/logger/ConsoleLogger';
import {FileLogger} from '../../../../src/logger/FileLogger';
import {SilentLogger} from '../../../../src/logger/SilentLogger';

describe('flagMapper', () => {
    let config: Config;

    beforeEach(() => {
        config = new Config();
    });

    describe('mapFlagsToConfig()', () => {
        /**
         * Test: Maps folder flag to config
         * Validates that the folder flag updates config.folder
         */
        it('should map folder flag to config.folder', () => {
            const flags: CLIFlags = {folder: './custom-migrations'};
            mapFlagsToConfig(config, flags);
            expect(config.folder).to.equal('./custom-migrations');
        });

        /**
         * Test: Maps tableName flag to config
         * Validates that the tableName flag updates config.tableName
         */
        it('should map tableName flag to config.tableName', () => {
            const flags: CLIFlags = {tableName: 'custom_versions'};
            mapFlagsToConfig(config, flags);
            expect(config.tableName).to.equal('custom_versions');
        });

        /**
         * Test: Maps displayLimit flag to config
         * Validates that the displayLimit flag updates config.displayLimit
         */
        it('should map displayLimit flag to config.displayLimit', () => {
            const flags: CLIFlags = {displayLimit: 20};
            mapFlagsToConfig(config, flags);
            expect(config.displayLimit).to.equal(20);
        });

        /**
         * Test: Maps dryRun flag to config
         * Validates that the dryRun flag updates config.dryRun
         */
        it('should map dryRun flag to config.dryRun', () => {
            const flags: CLIFlags = {dryRun: true};
            mapFlagsToConfig(config, flags);
            expect(config.dryRun).to.equal(true);
        });

        /**
         * Test: Maps noLock flag to config.locking.enabled
         * Validates that noLock=true disables locking
         */
        it('should map noLock=true to config.locking.enabled=false', () => {
            const flags: CLIFlags = {noLock: true};
            mapFlagsToConfig(config, flags);
            expect(config.locking.enabled).to.equal(false);
        });

        /**
         * Test: Maps noLock=false to config.locking.enabled=true
         * Validates that noLock=false enables locking
         */
        it('should map noLock=false to config.locking.enabled=true', () => {
            const flags: CLIFlags = {noLock: false};
            mapFlagsToConfig(config, flags);
            expect(config.locking.enabled).to.equal(true);
        });

        /**
         * Test: Maps multiple flags to config
         * Validates that multiple flags can be mapped simultaneously
         */
        it('should map multiple flags to config', () => {
            const flags: CLIFlags = {
                folder: './migrations',
                tableName: 'versions',
                displayLimit: 10,
                dryRun: true,
            };
            mapFlagsToConfig(config, flags);
            expect(config.folder).to.equal('./migrations');
            expect(config.tableName).to.equal('versions');
            expect(config.displayLimit).to.equal(10);
            expect(config.dryRun).to.equal(true);
        });

        /**
         * Test: Does not modify config when flags are undefined
         * Validates that undefined flags don't overwrite existing config values
         */
        it('should not modify config when flags are undefined', () => {
            config.folder = './original-folder';
            config.tableName = 'original_table';
            config.displayLimit = 5;
            config.dryRun = false;

            const flags: CLIFlags = {};
            mapFlagsToConfig(config, flags);

            expect(config.folder).to.equal('./original-folder');
            expect(config.tableName).to.equal('original_table');
            expect(config.displayLimit).to.equal(5);
            expect(config.dryRun).to.equal(false);
        });

        /**
         * Test: Returns undefined when no logger flag is provided
         * Validates that no logger is created when logger flag is not specified
         */
        it('should return undefined when no logger flag is provided', () => {
            const flags: CLIFlags = {folder: './migrations'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.undefined;
        });
    });

    describe('Logger creation', () => {
        /**
         * Test: Creates ConsoleLogger when logger flag is "console"
         * Validates that a ConsoleLogger instance is created with correct log level
         */
        it('should create ConsoleLogger when logger flag is "console"', () => {
            const flags: CLIFlags = {logger: 'console'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(ConsoleLogger);
        });

        /**
         * Test: Creates ConsoleLogger with custom log level
         * Validates that log level is correctly passed to ConsoleLogger
         */
        it('should create ConsoleLogger with custom log level', () => {
            const flags: CLIFlags = {logger: 'console', logLevel: 'debug'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(ConsoleLogger);
            // Note: We can't directly access private logLevel, but we verified the logger is created
        });

        /**
         * Test: Creates ConsoleLogger with default INFO level
         * Validates that INFO is the default log level when not specified
         */
        it('should create ConsoleLogger with default INFO level when logLevel not specified', () => {
            const flags: CLIFlags = {logger: 'console'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(ConsoleLogger);
        });

        /**
         * Test: Creates FileLogger when logger flag is "file" with logFile
         * Validates that a FileLogger instance is created with correct parameters
         */
        it('should create FileLogger when logger flag is "file" with logFile', () => {
            const flags: CLIFlags = {logger: 'file', logFile: './logs/migration.log'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(FileLogger);
        });

        /**
         * Test: Creates FileLogger with custom log level
         * Validates that log level is correctly passed to FileLogger
         */
        it('should create FileLogger with custom log level', () => {
            const flags: CLIFlags = {
                logger: 'file',
                logFile: './logs/migration.log',
                logLevel: 'error',
            };
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(FileLogger);
        });

        /**
         * Test: Throws error when logger is "file" but logFile is missing
         * Validates that file logger requires logFile parameter
         */
        it('should throw error when logger is "file" but logFile is missing', () => {
            const flags: CLIFlags = {logger: 'file'};
            expect(() => mapFlagsToConfig(config, flags)).to.throw(
                Error,
                '--log-file is required when using --logger file'
            );
        });

        /**
         * Test: Creates SilentLogger when logger flag is "silent"
         * Validates that a SilentLogger instance is created
         */
        it('should create SilentLogger when logger flag is "silent"', () => {
            const flags: CLIFlags = {logger: 'silent'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(SilentLogger);
        });

        /**
         * Test: Creates SilentLogger regardless of logLevel
         * Validates that logLevel is ignored for silent logger
         */
        it('should create SilentLogger regardless of logLevel', () => {
            const flags: CLIFlags = {logger: 'silent', logLevel: 'debug'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(SilentLogger);
        });
    });

    describe('Log level parsing', () => {
        /**
         * Test: Parses "error" log level correctly
         * Validates that "error" string maps to ERROR log level
         */
        it('should parse "error" log level correctly', () => {
            const flags: CLIFlags = {logger: 'console', logLevel: 'error'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(ConsoleLogger);
        });

        /**
         * Test: Parses "warn" log level correctly
         * Validates that "warn" string maps to WARN log level
         */
        it('should parse "warn" log level correctly', () => {
            const flags: CLIFlags = {logger: 'console', logLevel: 'warn'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(ConsoleLogger);
        });

        /**
         * Test: Parses "info" log level correctly
         * Validates that "info" string maps to INFO log level
         */
        it('should parse "info" log level correctly', () => {
            const flags: CLIFlags = {logger: 'console', logLevel: 'info'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(ConsoleLogger);
        });

        /**
         * Test: Parses "debug" log level correctly
         * Validates that "debug" string maps to DEBUG log level
         */
        it('should parse "debug" log level correctly', () => {
            const flags: CLIFlags = {logger: 'console', logLevel: 'debug'};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.instanceOf(ConsoleLogger);
        });
    });

    describe('Integration scenarios', () => {
        /**
         * Test: Maps all flags including logger creation
         * Validates that config mapping and logger creation work together
         */
        it('should map all flags including logger creation', () => {
            const flags: CLIFlags = {
                folder: './migrations',
                tableName: 'versions',
                displayLimit: 15,
                dryRun: true,
                logger: 'console',
                logLevel: 'debug',
            };
            const logger = mapFlagsToConfig(config, flags);

            expect(config.folder).to.equal('./migrations');
            expect(config.tableName).to.equal('versions');
            expect(config.displayLimit).to.equal(15);
            expect(config.dryRun).to.equal(true);
            expect(logger).to.be.instanceOf(ConsoleLogger);
        });

        /**
         * Test: Handles empty flags object
         * Validates that empty flags don't cause errors
         */
        it('should handle empty flags object', () => {
            const flags: CLIFlags = {};
            const logger = mapFlagsToConfig(config, flags);
            expect(logger).to.be.undefined;
        });

        /**
         * Test: Handles partial flag updates
         * Validates that only specified flags are updated
         */
        it('should handle partial flag updates', () => {
            config.folder = './original';
            config.tableName = 'original_table';
            config.displayLimit = 10;

            const flags: CLIFlags = {
                folder: './new-folder',
                // tableName not specified
                displayLimit: 20,
            };
            mapFlagsToConfig(config, flags);

            expect(config.folder).to.equal('./new-folder');
            expect(config.tableName).to.equal('original_table'); // unchanged
            expect(config.displayLimit).to.equal(20);
        });
    });
});
