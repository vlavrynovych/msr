import {expect} from 'chai';
import sinon from 'sinon';
import {SilentRenderStrategy, IScripts, MigrationScript, IDatabaseMigrationHandler, Config} from "../../../../src";

/**
 * Unit tests for SilentRenderStrategy.
 * Tests that all render methods produce no output.
 */
describe('SilentRenderStrategy', () => {

    let logStub: sinon.SinonStub;
    let warnStub: sinon.SinonStub;
    let errorStub: sinon.SinonStub;

    beforeEach(() => {
        logStub = sinon.stub(console, 'log');
        warnStub = sinon.stub(console, 'warn');
        errorStub = sinon.stub(console, 'error');
    });

    afterEach(() => {
        logStub.restore();
        warnStub.restore();
        errorStub.restore();
    });

    describe('renderMigrated', () => {
        it('should produce no output for empty migrations', () => {
            const strategy = new SilentRenderStrategy();
            const scripts = {migrated: [], all: []} as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with migrations', () => {
            const strategy = new SilentRenderStrategy();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {
                        timestamp: 202501220100,
                        name: 'V202501220100_test.ts',
                        startedAt: now - 5000,
                        finishedAt: now,
                        username: 'developer',
                    } as MigrationScript
                ],
                all: []
            } as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with limit', () => {
            const strategy = new SilentRenderStrategy();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {timestamp: 1, name: 'M1', startedAt: now, finishedAt: now, username: 'u'} as MigrationScript,
                    {timestamp: 2, name: 'M2', startedAt: now, finishedAt: now, username: 'u'} as MigrationScript,
                ],
                all: []
            } as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler, 1);

            expect(logStub.called).to.be.false;
        });
    });

    describe('renderPending', () => {
        it('should produce no output for empty todo', () => {
            const strategy = new SilentRenderStrategy();

            strategy.renderPending([]);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with pending migrations', () => {
            const strategy = new SilentRenderStrategy();
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_test.ts', filepath: '/path'} as MigrationScript,
            ];

            strategy.renderPending(scripts);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });

    describe('renderExecuted', () => {
        it('should produce no output for empty executed', () => {
            const strategy = new SilentRenderStrategy();

            strategy.renderExecuted([]);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with executed migrations', () => {
            const strategy = new SilentRenderStrategy();
            const now = Date.now();
            const scripts = [
                {
                    timestamp: 202501220100,
                    name: 'V202501220100_test.ts',
                    startedAt: now - 2500,
                    finishedAt: now,
                    username: 'developer',
                    result: 'Done'
                },
            ];

            strategy.renderExecuted(scripts);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });

    describe('renderIgnored', () => {
        it('should produce no output for empty ignored', () => {
            const strategy = new SilentRenderStrategy();

            strategy.renderIgnored([]);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with ignored migrations', () => {
            const strategy = new SilentRenderStrategy();
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_old.ts', filepath: '/path'} as MigrationScript,
            ];

            strategy.renderIgnored(scripts);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });

    describe('renderBanner', () => {
        it('should produce no output', () => {
            const strategy = new SilentRenderStrategy();

            strategy.renderBanner('0.3.0', 'PostgreSQL Handler');

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });

    describe('complete silence', () => {
        it('should remain silent for all operations', () => {
            const strategy = new SilentRenderStrategy();
            const now = Date.now();
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            // Call all methods
            strategy.renderBanner('1.0.0', 'Handler');

            const scripts = {
                migrated: [{timestamp: 1, name: 'M', startedAt: now, finishedAt: now, username: 'u'} as MigrationScript],
                all: []
            } as unknown as IScripts;
            strategy.renderMigrated(scripts, handler);

            strategy.renderPending([{timestamp: 1, name: 'M', filepath: '/p'} as MigrationScript]);
            strategy.renderExecuted([{timestamp: 1, name: 'M', startedAt: now, finishedAt: now, result: 'R', username: 'u'}]);
            strategy.renderIgnored([{timestamp: 1, name: 'M', filepath: '/p'} as MigrationScript]);

            // Verify complete silence
            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });
});
