import { expect } from "chai";
import sinon from "sinon";
import { CompositeLogger, ConsoleLogger, SilentLogger } from "../../../src";
import { ILogger } from "../../../src/interface/ILogger";

describe('CompositeLogger', () => {

    describe('constructor', () => {

        /**
         * Test that CompositeLogger can be created with no loggers.
         * Verifies empty array initialization.
         */
        it('should create with empty loggers array', () => {
            const logger = new CompositeLogger();
            expect(logger.getLoggers()).to.be.an('array').that.is.empty;
        });

        /**
         * Test that CompositeLogger can be created with initial loggers.
         * Verifies constructor accepts array of loggers.
         */
        it('should create with initial loggers', () => {
            const logger1 = new ConsoleLogger();
            const logger2 = new SilentLogger();
            const composite = new CompositeLogger([logger1, logger2]);

            expect(composite.getLoggers()).to.have.lengthOf(2);
            expect(composite.getLoggers()).to.include(logger1);
            expect(composite.getLoggers()).to.include(logger2);
        });

        /**
         * Test that CompositeLogger creates a copy of the loggers array.
         * Verifies immutability of internal array.
         */
        it('should create a copy of the loggers array', () => {
            const logger1 = new ConsoleLogger();
            const originalArray = [logger1];
            const composite = new CompositeLogger(originalArray);

            // Mutate original array
            originalArray.push(new SilentLogger());

            // CompositeLogger should not be affected
            expect(composite.getLoggers()).to.have.lengthOf(1);
        });

    });

    describe('addLogger', () => {

        /**
         * Test that a logger can be added to an empty composite.
         * Verifies basic addLogger functionality.
         */
        it('should add logger to empty composite', () => {
            const composite = new CompositeLogger();
            const logger = new ConsoleLogger();

            composite.addLogger(logger);

            expect(composite.getLoggers()).to.have.lengthOf(1);
            expect(composite.getLoggers()).to.include(logger);
        });

        /**
         * Test that multiple loggers can be added sequentially.
         * Verifies addLogger can be called multiple times.
         */
        it('should add multiple loggers', () => {
            const composite = new CompositeLogger();
            const logger1 = new ConsoleLogger();
            const logger2 = new SilentLogger();

            composite.addLogger(logger1);
            composite.addLogger(logger2);

            expect(composite.getLoggers()).to.have.lengthOf(2);
            expect(composite.getLoggers()).to.include(logger1);
            expect(composite.getLoggers()).to.include(logger2);
        });

        /**
         * Test that the same logger instance can be added multiple times.
         * Verifies no duplicate prevention (intentional design).
         */
        it('should allow adding the same logger multiple times', () => {
            const composite = new CompositeLogger();
            const logger = new ConsoleLogger();

            composite.addLogger(logger);
            composite.addLogger(logger);

            expect(composite.getLoggers()).to.have.lengthOf(2);
        });

    });

    describe('removeLogger', () => {

        /**
         * Test that a logger can be removed from the composite.
         * Verifies basic removeLogger functionality and return value.
         */
        it('should remove logger from composite', () => {
            const logger1 = new ConsoleLogger();
            const logger2 = new SilentLogger();
            const composite = new CompositeLogger([logger1, logger2]);

            const result = composite.removeLogger(logger1);

            expect(result).to.be.true;
            expect(composite.getLoggers()).to.have.lengthOf(1);
            expect(composite.getLoggers()).to.not.include(logger1);
            expect(composite.getLoggers()).to.include(logger2);
        });

        /**
         * Test that removing a non-existent logger returns false.
         * Verifies error handling for missing logger.
         */
        it('should return false when removing non-existent logger', () => {
            const logger1 = new ConsoleLogger();
            const logger2 = new SilentLogger();
            const composite = new CompositeLogger([logger1]);

            const result = composite.removeLogger(logger2);

            expect(result).to.be.false;
            expect(composite.getLoggers()).to.have.lengthOf(1);
        });

        /**
         * Test that removing from an empty composite returns false.
         * Verifies behavior with empty loggers array.
         */
        it('should return false when removing from empty composite', () => {
            const composite = new CompositeLogger();
            const logger = new ConsoleLogger();

            const result = composite.removeLogger(logger);

            expect(result).to.be.false;
            expect(composite.getLoggers()).to.be.empty;
        });

        /**
         * Test that removing a duplicate logger only removes the first instance.
         * Verifies single-instance removal behavior.
         */
        it('should remove only first instance of duplicate logger', () => {
            const logger = new ConsoleLogger();
            const composite = new CompositeLogger([logger, logger]);

            const result = composite.removeLogger(logger);

            expect(result).to.be.true;
            expect(composite.getLoggers()).to.have.lengthOf(1);
        });

    });

    describe('getLoggers', () => {

        /**
         * Test that getLoggers returns a copy of the loggers array.
         * Verifies immutability of internal state.
         */
        it('should return a copy of loggers array', () => {
            const logger1 = new ConsoleLogger();
            const composite = new CompositeLogger([logger1]);

            const loggers1 = composite.getLoggers();
            const loggers2 = composite.getLoggers();

            expect(loggers1).to.not.equal(loggers2);
            expect(loggers1).to.deep.equal(loggers2);
        });

        /**
         * Test that mutating the returned array does not affect internal state.
         * Verifies encapsulation of internal loggers array.
         */
        it('should not allow external modification of internal array', () => {
            const logger1 = new ConsoleLogger();
            const composite = new CompositeLogger([logger1]);

            const loggers = composite.getLoggers();
            loggers.push(new SilentLogger());

            expect(composite.getLoggers()).to.have.lengthOf(1);
        });

    });

    describe('log methods', () => {

        let mockLogger1: ILogger;
        let mockLogger2: ILogger;
        let composite: CompositeLogger;

        beforeEach(() => {
            mockLogger1 = {
                info: sinon.stub(),
                warn: sinon.stub(),
                error: sinon.stub(),
                debug: sinon.stub(),
                log: sinon.stub()
            };
            mockLogger2 = {
                info: sinon.stub(),
                warn: sinon.stub(),
                error: sinon.stub(),
                debug: sinon.stub(),
                log: sinon.stub()
            };
            composite = new CompositeLogger([mockLogger1, mockLogger2]);
        });

        /**
         * Test that info() forwards to all registered loggers.
         * Verifies message and arguments are passed correctly.
         */
        it('should forward info() to all loggers', () => {
            composite.info('test message', 'arg1', 'arg2');

            expect((mockLogger1.info as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger1.info as sinon.SinonStub).calledWith('test message', 'arg1', 'arg2')).to.be.true;
            expect((mockLogger2.info as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger2.info as sinon.SinonStub).calledWith('test message', 'arg1', 'arg2')).to.be.true;
        });

        /**
         * Test that warn() forwards to all registered loggers.
         * Verifies message and arguments are passed correctly.
         */
        it('should forward warn() to all loggers', () => {
            composite.warn('warning message', { key: 'value' });

            expect((mockLogger1.warn as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger1.warn as sinon.SinonStub).calledWith('warning message', { key: 'value' })).to.be.true;
            expect((mockLogger2.warn as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger2.warn as sinon.SinonStub).calledWith('warning message', { key: 'value' })).to.be.true;
        });

        /**
         * Test that error() forwards to all registered loggers.
         * Verifies message and arguments are passed correctly.
         */
        it('should forward error() to all loggers', () => {
            const err = new Error('test error');
            composite.error('error message', err);

            expect((mockLogger1.error as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger1.error as sinon.SinonStub).calledWith('error message', err)).to.be.true;
            expect((mockLogger2.error as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger2.error as sinon.SinonStub).calledWith('error message', err)).to.be.true;
        });

        /**
         * Test that debug() forwards to all registered loggers.
         * Verifies message and arguments are passed correctly.
         */
        it('should forward debug() to all loggers', () => {
            composite.debug('debug message', 123, true);

            expect((mockLogger1.debug as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger1.debug as sinon.SinonStub).calledWith('debug message', 123, true)).to.be.true;
            expect((mockLogger2.debug as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger2.debug as sinon.SinonStub).calledWith('debug message', 123, true)).to.be.true;
        });

        /**
         * Test that log() forwards to all registered loggers.
         * Verifies message and arguments are passed correctly.
         */
        it('should forward log() to all loggers', () => {
            composite.log('log message', null, undefined);

            expect((mockLogger1.log as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger1.log as sinon.SinonStub).calledWith('log message', null, undefined)).to.be.true;
            expect((mockLogger2.log as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger2.log as sinon.SinonStub).calledWith('log message', null, undefined)).to.be.true;
        });

        /**
         * Test that log methods work with empty loggers array.
         * Verifies no errors when no loggers are registered.
         */
        it('should handle logging with no registered loggers', () => {
            const emptyComposite = new CompositeLogger();

            expect(() => emptyComposite.info('test')).to.not.throw();
            expect(() => emptyComposite.warn('test')).to.not.throw();
            expect(() => emptyComposite.error('test')).to.not.throw();
            expect(() => emptyComposite.debug('test')).to.not.throw();
            expect(() => emptyComposite.log('test')).to.not.throw();
        });

        /**
         * Test that log methods work with single logger.
         * Verifies correct behavior with one logger.
         */
        it('should forward to single logger', () => {
            const singleComposite = new CompositeLogger([mockLogger1]);

            singleComposite.info('test message');

            expect((mockLogger1.info as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that log methods forward with no additional arguments.
         * Verifies message-only logging.
         */
        it('should forward message without additional arguments', () => {
            composite.info('message only');

            expect((mockLogger1.info as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger1.info as sinon.SinonStub).args[0]).to.deep.equal(['message only']);
        });

    });

    describe('integration scenarios', () => {

        /**
         * Test real-world scenario with ConsoleLogger and SilentLogger.
         * Verifies CompositeLogger works with actual logger implementations.
         */
        it('should work with real logger implementations', () => {
            const consoleLogger = new ConsoleLogger();
            const silentLogger = new SilentLogger();
            const composite = new CompositeLogger([consoleLogger, silentLogger]);

            // Should not throw
            expect(() => composite.info('test')).to.not.throw();
            expect(() => composite.warn('test')).to.not.throw();
            expect(() => composite.error('test')).to.not.throw();
            expect(() => composite.debug('test')).to.not.throw();
            expect(() => composite.log('test')).to.not.throw();
        });

        /**
         * Test dynamic logger management during runtime.
         * Verifies loggers can be added and removed dynamically.
         */
        it('should support dynamic logger management', () => {
            const composite = new CompositeLogger();
            const mockLogger: ILogger = {
                info: sinon.stub(),
                warn: sinon.stub(),
                error: sinon.stub(),
                debug: sinon.stub(),
                log: sinon.stub()
            };

            // Add logger dynamically
            composite.addLogger(mockLogger);
            composite.info('test1');
            expect((mockLogger.info as sinon.SinonStub).calledOnce).to.be.true;

            // Remove logger dynamically
            composite.removeLogger(mockLogger);
            composite.info('test2');
            expect((mockLogger.info as sinon.SinonStub).calledOnce).to.be.true; // Still once
        });

        /**
         * Test nested CompositeLogger scenario.
         * Verifies CompositeLogger can contain other CompositeLoggers.
         */
        it('should support nested composite loggers', () => {
            const mockLogger: ILogger = {
                info: sinon.stub(),
                warn: sinon.stub(),
                error: sinon.stub(),
                debug: sinon.stub(),
                log: sinon.stub()
            };

            const innerComposite = new CompositeLogger([mockLogger]);
            const outerComposite = new CompositeLogger([innerComposite]);

            outerComposite.info('test message');

            expect((mockLogger.info as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockLogger.info as sinon.SinonStub).calledWith('test message')).to.be.true;
        });

    });

});
