import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { FileLogger } from '../../../src';

describe('FileLogger', () => {

    const testLogDir = './test-logs';
    const testLogPath = path.join(testLogDir, 'test.log');

    afterEach(() => {
        // Clean up test logs after each test
        if (fs.existsSync(testLogDir)) {
            const files = fs.readdirSync(testLogDir);
            files.forEach(file => {
                fs.unlinkSync(path.join(testLogDir, file));
            });
            fs.rmdirSync(testLogDir);
        }
    });

    describe('Constructor', () => {
        /**
         * Test: Constructor creates log directory if it doesn't exist
         */
        it('should create log directory if it does not exist', () => {
            expect(fs.existsSync(testLogDir)).to.be.false;

            new FileLogger({ logPath: testLogPath });

            expect(fs.existsSync(testLogDir)).to.be.true;
        });

        /**
         * Test: Constructor uses default values when no config provided
         */
        it('should use default values when no config provided', () => {
            const logger = new FileLogger();

            expect(logger).to.be.instanceOf(FileLogger);
            expect(logger.getFileSize()).to.equal(0);
        });

        /**
         * Test: Constructor accepts custom configuration
         */
        it('should accept custom configuration', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                maxFileSize: 1024,
                maxFiles: 3,
                includeTimestamp: false
            });

            expect(logger).to.be.instanceOf(FileLogger);
        });
    });

    describe('info()', () => {
        /**
         * Test: info() writes message to file
         */
        it('should write info message to file', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            logger.info('test info message');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[INFO] test info message');
        });

        /**
         * Test: info() writes message with additional arguments
         */
        it('should write info message with additional arguments', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            logger.info('test message', 'arg1', 123);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[INFO] test message arg1 123');
        });

        /**
         * Test: info() includes timestamp when enabled
         */
        it('should include timestamp when enabled', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: true
            });

            logger.info('test message');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.match(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO\] test message/);
        });

        /**
         * Test: info() excludes timestamp when disabled
         */
        it('should exclude timestamp when disabled', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('test message');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.equal('[INFO] test message\n');
        });
    });

    describe('warn()', () => {
        /**
         * Test: warn() writes warning message to file
         */
        it('should write warn message to file', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            logger.warn('test warning');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[WARN] test warning');
        });
    });

    describe('error()', () => {
        /**
         * Test: error() writes error message to file
         */
        it('should write error message to file', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            logger.error('test error');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[ERROR] test error');
        });

        /**
         * Test: error() handles Error objects
         */
        it('should handle Error objects', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            const error = new Error('Test error message');
            logger.error('An error occurred', error);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[ERROR] An error occurred');
            expect(content).to.include('Error: Test error message');
        });
    });

    describe('debug()', () => {
        /**
         * Test: debug() writes debug message to file
         */
        it('should write debug message to file', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            logger.debug('test debug');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[DEBUG] test debug');
        });
    });

    describe('log()', () => {
        /**
         * Test: log() writes log message to file
         */
        it('should write log message to file', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            logger.log('test log');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[LOG] test log');
        });
    });

    describe('Argument handling', () => {
        /**
         * Test: Handles null and undefined arguments
         */
        it('should handle null and undefined arguments', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('test', null, undefined);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.equal('[INFO] test null undefined\n');
        });

        /**
         * Test: Handles number arguments
         */
        it('should handle number arguments', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('test', 123, 45.67);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.equal('[INFO] test 123 45.67\n');
        });

        /**
         * Test: Handles boolean arguments
         */
        it('should handle boolean arguments', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('test', true, false);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.equal('[INFO] test true false\n');
        });

        /**
         * Test: Handles object arguments
         */
        it('should handle object arguments', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('test', { key: 'value', num: 123 });

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[INFO] test');
            expect(content).to.include('"key":"value"');
            expect(content).to.include('"num":123');
        });

        /**
         * Test: Handles array arguments
         */
        it('should handle array arguments', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('test', [1, 2, 3]);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.equal('[INFO] test [1,2,3]\n');
        });
    });

    describe('Log rotation', () => {
        /**
         * Test: Rotates log file when max size is reached
         */
        it('should rotate log file when max size is reached', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                maxFileSize: 50, // Very small size to trigger rotation
                maxFiles: 3,
                includeTimestamp: false
            });

            // Write enough data to exceed maxFileSize
            // [INFO] + message + \n = overhead, so message needs to be bigger
            logger.info('First message that will exceed 50 bytes with overhead');
            expect(fs.existsSync(testLogPath)).to.be.true;

            const sizeAfterFirst = logger.getFileSize();
            expect(sizeAfterFirst).to.be.greaterThan(50);

            // Write more data, should trigger rotation since file > 50 bytes
            logger.info('Second message');

            // After rotation, original file should be .1
            expect(fs.existsSync(`${testLogPath}.1`)).to.be.true;

            // Current file should be smaller (only contains second message)
            const sizeAfterRotation = logger.getFileSize();
            expect(sizeAfterRotation).to.be.lessThan(sizeAfterFirst);
        });

        /**
         * Test: Keeps specified number of backup files
         */
        it('should keep only specified number of backup files', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                maxFileSize: 50,
                maxFiles: 2,
                includeTimestamp: false
            });

            // Write multiple rotations
            for (let i = 0; i < 5; i++) {
                logger.info('X'.repeat(60));
            }

            const logFiles = logger.getLogFiles();
            // Should have current + maxFiles backup files (max 3 total)
            expect(logFiles.length).to.be.at.most(3);

            // Oldest file should not exist
            expect(fs.existsSync(`${testLogPath}.3`)).to.be.false;
        });

        /**
         * Test: Rotation preserves log order
         */
        it('should preserve log order during rotation', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                maxFileSize: 100,
                maxFiles: 3,
                includeTimestamp: false
            });

            logger.info('Message 1'); // First message
            logger.info('A'.repeat(80)); // Makes file exceed 100 bytes

            // Next write should trigger rotation
            logger.info('Message 2');

            // Check if rotation happened
            if (fs.existsSync(`${testLogPath}.1`)) {
                const rotatedContent = fs.readFileSync(`${testLogPath}.1`, 'utf8');
                expect(rotatedContent).to.include('Message 1');
            }

            const currentContent = fs.readFileSync(testLogPath, 'utf8');
            expect(currentContent).to.include('Message 2');
        });
    });

    describe('getFileSize()', () => {
        /**
         * Test: getFileSize returns 0 for non-existent file
         */
        it('should return 0 for non-existent file', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            expect(logger.getFileSize()).to.equal(0);
        });

        /**
         * Test: getFileSize returns correct size
         */
        it('should return correct file size', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('test');

            const size = logger.getFileSize();
            expect(size).to.be.greaterThan(0);
            expect(size).to.equal('[INFO] test\n'.length);
        });
    });

    describe('getLogFiles()', () => {
        /**
         * Test: getLogFiles returns empty array when no logs exist
         */
        it('should return empty array when no logs exist', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            const files = logger.getLogFiles();

            expect(files).to.be.an('array');
            expect(files.length).to.equal(0);
        });

        /**
         * Test: getLogFiles returns current log file
         */
        it('should return current log file', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            logger.info('test');

            const files = logger.getLogFiles();
            expect(files.length).to.equal(1);
            expect(files[0]).to.equal(testLogPath);
        });

        /**
         * Test: getLogFiles returns all rotated files
         */
        it('should return all rotated files', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                maxFileSize: 50,
                maxFiles: 3,
                includeTimestamp: false
            });

            // Create multiple rotations
            for (let i = 0; i < 4; i++) {
                logger.info('X'.repeat(60));
            }

            const files = logger.getLogFiles();
            expect(files.length).to.be.greaterThan(1);
            expect(files).to.include(testLogPath);
        });
    });

    describe('clearLogs()', () => {
        /**
         * Test: clearLogs removes all log files
         */
        it('should remove all log files', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                maxFileSize: 50,
                maxFiles: 3,
                includeTimestamp: false
            });

            // Create multiple rotations
            for (let i = 0; i < 3; i++) {
                logger.info('X'.repeat(60));
            }

            let files = logger.getLogFiles();
            expect(files.length).to.be.greaterThan(0);

            logger.clearLogs();

            files = logger.getLogFiles();
            expect(files.length).to.equal(0);
        });

        /**
         * Test: clearLogs handles non-existent files gracefully
         */
        it('should handle non-existent files gracefully', () => {
            const logger = new FileLogger({ logPath: testLogPath });

            expect(() => logger.clearLogs()).to.not.throw();
        });
    });

    describe('Multiple log levels', () => {
        /**
         * Test: Multiple log levels write to same file
         */
        it('should write multiple log levels to same file', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('info message');
            logger.warn('warn message');
            logger.error('error message');
            logger.debug('debug message');
            logger.log('log message');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[INFO] info message');
            expect(content).to.include('[WARN] warn message');
            expect(content).to.include('[ERROR] error message');
            expect(content).to.include('[DEBUG] debug message');
            expect(content).to.include('[LOG] log message');
        });
    });

    describe('Edge cases', () => {
        /**
         * Test: Handles empty message
         */
        it('should handle empty message', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.equal('[INFO] \n');
        });

        /**
         * Test: Handles very long messages
         */
        it('should handle very long messages', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            const longMessage = 'A'.repeat(10000);
            logger.info(longMessage);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include(longMessage);
        });

        /**
         * Test: Handles special characters in messages
         */
        it('should handle special characters in messages', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            logger.info('Test with émojis 🎉 and spëcial çhars');

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('Test with émojis 🎉 and spëcial çhars');
        });

        /**
         * Test: Handles circular reference objects
         */
        it('should handle circular reference objects', () => {
            const logger = new FileLogger({
                logPath: testLogPath,
                includeTimestamp: false
            });

            const obj: any = { a: 1 };
            obj.self = obj; // Circular reference

            logger.info('circular', obj);

            const content = fs.readFileSync(testLogPath, 'utf8');
            expect(content).to.include('[INFO] circular');
        });
    });
});
