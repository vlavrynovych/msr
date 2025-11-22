import { expect } from 'chai';
import sinon from 'sinon';
import { ConsoleLogger } from '../../../src';

describe('ConsoleLogger', () => {

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
         * Test: info() delegates to console.info
         * Validates that ConsoleLogger.info() properly calls console.info
         * with the correct message and arguments.
         */
        it('should delegate to console.info', () => {
            const logger = new ConsoleLogger();
            logger.info('test message', 'arg1', 'arg2');

            expect(consoleInfoStub.calledOnce).to.be.true;
            expect(consoleInfoStub.calledWith('test message', 'arg1', 'arg2')).to.be.true;
        });

        /**
         * Test: info() handles no additional arguments
         */
        it('should handle message without additional arguments', () => {
            const logger = new ConsoleLogger();
            logger.info('test message');

            expect(consoleInfoStub.calledOnce).to.be.true;
            expect(consoleInfoStub.calledWith('test message')).to.be.true;
        });
    });

    describe('warn()', () => {
        /**
         * Test: warn() delegates to console.warn
         * Validates that ConsoleLogger.warn() properly calls console.warn
         * with the correct message and arguments.
         */
        it('should delegate to console.warn', () => {
            const logger = new ConsoleLogger();
            logger.warn('warning message', 'arg1', 'arg2');

            expect(consoleWarnStub.calledOnce).to.be.true;
            expect(consoleWarnStub.calledWith('warning message', 'arg1', 'arg2')).to.be.true;
        });

        /**
         * Test: warn() handles no additional arguments
         */
        it('should handle message without additional arguments', () => {
            const logger = new ConsoleLogger();
            logger.warn('warning message');

            expect(consoleWarnStub.calledOnce).to.be.true;
            expect(consoleWarnStub.calledWith('warning message')).to.be.true;
        });
    });

    describe('error()', () => {
        /**
         * Test: error() delegates to console.error
         * Validates that ConsoleLogger.error() properly calls console.error
         * with the correct message and arguments.
         */
        it('should delegate to console.error', () => {
            const logger = new ConsoleLogger();
            logger.error('error message', 'arg1', 'arg2');

            expect(consoleErrorStub.calledOnce).to.be.true;
            expect(consoleErrorStub.calledWith('error message', 'arg1', 'arg2')).to.be.true;
        });

        /**
         * Test: error() handles no additional arguments
         */
        it('should handle message without additional arguments', () => {
            const logger = new ConsoleLogger();
            logger.error('error message');

            expect(consoleErrorStub.calledOnce).to.be.true;
            expect(consoleErrorStub.calledWith('error message')).to.be.true;
        });
    });

    describe('debug()', () => {
        /**
         * Test: debug() delegates to console.debug
         * Validates that ConsoleLogger.debug() properly calls console.debug
         * with the correct message and arguments.
         */
        it('should delegate to console.debug', () => {
            const logger = new ConsoleLogger();
            logger.debug('debug message', 'arg1', 'arg2');

            expect(consoleDebugStub.calledOnce).to.be.true;
            expect(consoleDebugStub.calledWith('debug message', 'arg1', 'arg2')).to.be.true;
        });

        /**
         * Test: debug() handles no additional arguments
         */
        it('should handle message without additional arguments', () => {
            const logger = new ConsoleLogger();
            logger.debug('debug message');

            expect(consoleDebugStub.calledOnce).to.be.true;
            expect(consoleDebugStub.calledWith('debug message')).to.be.true;
        });
    });

    describe('log()', () => {
        /**
         * Test: log() delegates to console.log
         * Validates that ConsoleLogger.log() properly calls console.log
         * with the correct message and arguments.
         */
        it('should delegate to console.log', () => {
            const logger = new ConsoleLogger();
            logger.log('log message', 'arg1', 'arg2');

            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith('log message', 'arg1', 'arg2')).to.be.true;
        });

        /**
         * Test: log() handles no additional arguments
         */
        it('should handle message without additional arguments', () => {
            const logger = new ConsoleLogger();
            logger.log('log message');

            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith('log message')).to.be.true;
        });
    });

    describe('Multiple calls', () => {
        /**
         * Test: Multiple logger method calls work correctly
         * Validates that the logger can handle multiple calls to different methods
         */
        it('should handle multiple calls to different methods', () => {
            const logger = new ConsoleLogger();

            logger.info('info');
            logger.warn('warn');
            logger.error('error');
            logger.debug('debug');
            logger.log('log');

            expect(consoleInfoStub.calledOnce).to.be.true;
            expect(consoleWarnStub.calledOnce).to.be.true;
            expect(consoleErrorStub.calledOnce).to.be.true;
            expect(consoleDebugStub.calledOnce).to.be.true;
            expect(consoleLogStub.calledOnce).to.be.true;
        });
    });
});
