import { expect } from 'chai';
import sinon from 'sinon';
import { LevelAwareLogger, ILogger, LogLevel } from '../../../src';

describe('LevelAwareLogger', () => {
    let mockLogger: ILogger;
    let infoStub: sinon.SinonStub;
    let warnStub: sinon.SinonStub;
    let errorStub: sinon.SinonStub;
    let debugStub: sinon.SinonStub;
    let logStub: sinon.SinonStub;

    beforeEach(() => {
        infoStub = sinon.stub();
        warnStub = sinon.stub();
        errorStub = sinon.stub();
        debugStub = sinon.stub();
        logStub = sinon.stub();

        mockLogger = {
            info: infoStub,
            warn: warnStub,
            error: errorStub,
            debug: debugStub,
            log: logStub
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Constructor', () => {
        it('should create logger with default info level', () => {
            const logger = new LevelAwareLogger(mockLogger);
            expect(logger).to.be.instanceOf(LevelAwareLogger);
        });

        it('should create logger with specified level', () => {
            const logger = new LevelAwareLogger(mockLogger, 'debug');
            expect(logger).to.be.instanceOf(LevelAwareLogger);
        });
    });

    describe('Log Level: error', () => {
        let logger: LevelAwareLogger;

        beforeEach(() => {
            logger = new LevelAwareLogger(mockLogger, 'error');
        });

        it('should show error logs', () => {
            logger.error('test error');
            expect(errorStub.calledOnceWith('test error')).to.be.true;
        });

        it('should filter warn logs', () => {
            logger.warn('test warn');
            expect(warnStub.called).to.be.false;
        });

        it('should filter info logs', () => {
            logger.info('test info');
            expect(infoStub.called).to.be.false;
        });

        it('should filter debug logs', () => {
            logger.debug('test debug');
            expect(debugStub.called).to.be.false;
        });

        it('should always show log() messages', () => {
            logger.log('test log');
            expect(logStub.calledOnceWith('test log')).to.be.true;
        });
    });

    describe('Log Level: warn', () => {
        let logger: LevelAwareLogger;

        beforeEach(() => {
            logger = new LevelAwareLogger(mockLogger, 'warn');
        });

        it('should show error logs', () => {
            logger.error('test error');
            expect(errorStub.calledOnceWith('test error')).to.be.true;
        });

        it('should show warn logs', () => {
            logger.warn('test warn');
            expect(warnStub.calledOnceWith('test warn')).to.be.true;
        });

        it('should filter info logs', () => {
            logger.info('test info');
            expect(infoStub.called).to.be.false;
        });

        it('should filter debug logs', () => {
            logger.debug('test debug');
            expect(debugStub.called).to.be.false;
        });

        it('should always show log() messages', () => {
            logger.log('test log');
            expect(logStub.calledOnceWith('test log')).to.be.true;
        });
    });

    describe('Log Level: info (default)', () => {
        let logger: LevelAwareLogger;

        beforeEach(() => {
            logger = new LevelAwareLogger(mockLogger, 'info');
        });

        it('should show error logs', () => {
            logger.error('test error');
            expect(errorStub.calledOnceWith('test error')).to.be.true;
        });

        it('should show warn logs', () => {
            logger.warn('test warn');
            expect(warnStub.calledOnceWith('test warn')).to.be.true;
        });

        it('should show info logs', () => {
            logger.info('test info');
            expect(infoStub.calledOnceWith('test info')).to.be.true;
        });

        it('should filter debug logs', () => {
            logger.debug('test debug');
            expect(debugStub.called).to.be.false;
        });

        it('should always show log() messages', () => {
            logger.log('test log');
            expect(logStub.calledOnceWith('test log')).to.be.true;
        });
    });

    describe('Log Level: debug', () => {
        let logger: LevelAwareLogger;

        beforeEach(() => {
            logger = new LevelAwareLogger(mockLogger, 'debug');
        });

        it('should show error logs', () => {
            logger.error('test error');
            expect(errorStub.calledOnceWith('test error')).to.be.true;
        });

        it('should show warn logs', () => {
            logger.warn('test warn');
            expect(warnStub.calledOnceWith('test warn')).to.be.true;
        });

        it('should show info logs', () => {
            logger.info('test info');
            expect(infoStub.calledOnceWith('test info')).to.be.true;
        });

        it('should show debug logs', () => {
            logger.debug('test debug');
            expect(debugStub.calledOnceWith('test debug')).to.be.true;
        });

        it('should always show log() messages', () => {
            logger.log('test log');
            expect(logStub.calledOnceWith('test log')).to.be.true;
        });
    });

    describe('Arguments forwarding', () => {
        it('should forward additional arguments to info', () => {
            const logger = new LevelAwareLogger(mockLogger, 'info');
            logger.info('test', 'arg1', 123, { key: 'value' });
            expect(infoStub.calledOnceWith('test', 'arg1', 123, { key: 'value' })).to.be.true;
        });

        it('should forward additional arguments to warn', () => {
            const logger = new LevelAwareLogger(mockLogger, 'warn');
            logger.warn('test', 'arg1', 123);
            expect(warnStub.calledOnceWith('test', 'arg1', 123)).to.be.true;
        });

        it('should forward additional arguments to error', () => {
            const logger = new LevelAwareLogger(mockLogger, 'error');
            logger.error('test', new Error('error'));
            expect(errorStub.calledOnceWith('test', sinon.match.instanceOf(Error))).to.be.true;
        });

        it('should forward additional arguments to debug', () => {
            const logger = new LevelAwareLogger(mockLogger, 'debug');
            logger.debug('test', { debug: true });
            expect(debugStub.calledOnceWith('test', { debug: true })).to.be.true;
        });

        it('should forward additional arguments to log', () => {
            const logger = new LevelAwareLogger(mockLogger, 'error');
            logger.log('test', 'always', 'shown');
            expect(logStub.calledOnceWith('test', 'always', 'shown')).to.be.true;
        });
    });

    describe('Default log level', () => {
        it('should use info as default level when not specified', () => {
            const logger = new LevelAwareLogger(mockLogger);

            logger.info('info message');
            logger.debug('debug message');

            expect(infoStub.calledOnce).to.be.true;
            expect(debugStub.called).to.be.false;
        });
    });

    describe('Level hierarchy validation', () => {
        it('should respect level hierarchy (error < warn < info < debug)', () => {
            const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];

            levels.forEach((level) => {
                const logger = new LevelAwareLogger(mockLogger, level);

                // Reset stubs
                infoStub.resetHistory();
                warnStub.resetHistory();
                errorStub.resetHistory();
                debugStub.resetHistory();

                // Call all methods
                logger.error('error');
                logger.warn('warn');
                logger.info('info');
                logger.debug('debug');

                // Verify based on level
                expect(errorStub.called).to.be.true; // error always shown

                if (level === 'error') {
                    expect(warnStub.called).to.be.false;
                    expect(infoStub.called).to.be.false;
                    expect(debugStub.called).to.be.false;
                } else if (level === 'warn') {
                    expect(warnStub.called).to.be.true;
                    expect(infoStub.called).to.be.false;
                    expect(debugStub.called).to.be.false;
                } else if (level === 'info') {
                    expect(warnStub.called).to.be.true;
                    expect(infoStub.called).to.be.true;
                    expect(debugStub.called).to.be.false;
                } else if (level === 'debug') {
                    expect(warnStub.called).to.be.true;
                    expect(infoStub.called).to.be.true;
                    expect(debugStub.called).to.be.true;
                }
            });
        });
    });
});
