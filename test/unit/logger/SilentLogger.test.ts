import { expect } from 'chai';
import sinon from 'sinon';
import { SilentLogger } from '../../../src';

describe('SilentLogger', () => {

    let consoleInfoStub: sinon.SinonStub;
    let consoleWarnStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;
    let consoleDebugStub: sinon.SinonStub;
    let consoleLogStub: sinon.SinonStub;

    beforeEach(() => {
        consoleInfoStub = sinon.stub(console, 'info');
        consoleWarnStub = sinon.stub(console, 'warn');
        consoleErrorStub = sinon.stub(console, 'error');
        consoleDebugStub = sinon.stub(console, 'debug');
        consoleLogStub = sinon.stub(console, 'log');
    });

    afterEach(() => {
        consoleInfoStub.restore();
        consoleWarnStub.restore();
        consoleErrorStub.restore();
        consoleDebugStub.restore();
        consoleLogStub.restore();
    });

    describe('info()', () => {
        /**
         * Test: info() produces no output
         * Validates that SilentLogger.info() does not call console.info
         */
        it('should not produce any output', () => {
            const logger = new SilentLogger();
            logger.info('test message', 'arg1', 'arg2');

            expect(consoleInfoStub.called).to.be.false;
        });
    });

    describe('warn()', () => {
        /**
         * Test: warn() produces no output
         * Validates that SilentLogger.warn() does not call console.warn
         */
        it('should not produce any output', () => {
            const logger = new SilentLogger();
            logger.warn('warning message', 'arg1', 'arg2');

            expect(consoleWarnStub.called).to.be.false;
        });
    });

    describe('error()', () => {
        /**
         * Test: error() produces no output
         * Validates that SilentLogger.error() does not call console.error
         */
        it('should not produce any output', () => {
            const logger = new SilentLogger();
            logger.error('error message', 'arg1', 'arg2');

            expect(consoleErrorStub.called).to.be.false;
        });
    });

    describe('debug()', () => {
        /**
         * Test: debug() produces no output
         * Validates that SilentLogger.debug() does not call console.debug
         */
        it('should not produce any output', () => {
            const logger = new SilentLogger();
            logger.debug('debug message', 'arg1', 'arg2');

            expect(consoleDebugStub.called).to.be.false;
        });
    });

    describe('log()', () => {
        /**
         * Test: log() produces no output
         * Validates that SilentLogger.log() does not call console.log
         */
        it('should not produce any output', () => {
            const logger = new SilentLogger();
            logger.log('log message', 'arg1', 'arg2');

            expect(consoleLogStub.called).to.be.false;
        });
    });

    describe('Multiple calls', () => {
        /**
         * Test: Multiple logger method calls produce no output
         * Validates that the logger suppresses all output even with multiple calls
         */
        it('should suppress all output from multiple calls', () => {
            const logger = new SilentLogger();

            logger.info('info');
            logger.warn('warn');
            logger.error('error');
            logger.debug('debug');
            logger.log('log');

            expect(consoleInfoStub.called).to.be.false;
            expect(consoleWarnStub.called).to.be.false;
            expect(consoleErrorStub.called).to.be.false;
            expect(consoleDebugStub.called).to.be.false;
            expect(consoleLogStub.called).to.be.false;
        });
    });

    describe('Use in tests', () => {
        /**
         * Test: SilentLogger doesn't interfere with test output
         * Validates that using SilentLogger in tests keeps output clean
         */
        it('should keep test output clean', () => {
            const logger = new SilentLogger();

            // Simulate usage in a test environment
            logger.info('Starting migration...');
            logger.log('Processing migration 1...');
            logger.log('Processing migration 2...');
            logger.info('Migration completed!');

            // Verify no console methods were called
            expect(consoleInfoStub.called).to.be.false;
            expect(consoleLogStub.called).to.be.false;
        });
    });
});
