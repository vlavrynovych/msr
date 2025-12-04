import {expect} from 'chai';
import sinon from 'sinon';
import {SilentRenderStrategy, IScripts, MigrationScript, Config, IDB} from "../../../../src";

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
            const strategy = new SilentRenderStrategy<IDB>();
            const scripts = {migrated: [], all: []} as unknown as IScripts<IDB>;
            const config = new Config();

            strategy.renderMigrated(scripts, config);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with migrations', () => {
            const strategy = new SilentRenderStrategy<IDB>();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {
                        timestamp: 202501220100,
                        name: 'V202501220100_test.ts',
                        startedAt: now - 5000,
                        finishedAt: now,
                        username: 'developer',
                    } as MigrationScript<IDB>
                ],
                all: []
            } as unknown as IScripts<IDB>;
            const config = new Config();

            strategy.renderMigrated(scripts, config);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with limit', () => {
            const strategy = new SilentRenderStrategy<IDB>();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {timestamp: 1, name: 'M1', startedAt: now, finishedAt: now, username: 'u'} as MigrationScript<IDB>,
                    {timestamp: 2, name: 'M2', startedAt: now, finishedAt: now, username: 'u'} as MigrationScript<IDB>,
                ],
                all: []
            } as unknown as IScripts<IDB>;
            const config = new Config();

            strategy.renderMigrated(scripts, config);

            expect(logStub.called).to.be.false;
        });
    });

    describe('renderPending', () => {
        it('should produce no output for empty todo', () => {
            const strategy = new SilentRenderStrategy<IDB>();

            strategy.renderPending([]);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with pending migrations', () => {
            const strategy = new SilentRenderStrategy<IDB>();
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_test.ts', filepath: '/path'} as MigrationScript<IDB>,
            ];

            strategy.renderPending(scripts);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });

    describe('renderExecuted', () => {
        it('should produce no output for empty executed', () => {
            const strategy = new SilentRenderStrategy<IDB>();

            strategy.renderExecuted([]);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with executed migrations', () => {
            const strategy = new SilentRenderStrategy<IDB>();
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
            const strategy = new SilentRenderStrategy<IDB>();

            strategy.renderIgnored([]);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });

        it('should produce no output with ignored migrations', () => {
            const strategy = new SilentRenderStrategy<IDB>();
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_old.ts', filepath: '/path'} as MigrationScript<IDB>,
            ];

            strategy.renderIgnored(scripts);

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });

    describe('renderBanner', () => {
        it('should produce no output', () => {
            const strategy = new SilentRenderStrategy<IDB>();

            strategy.renderBanner('0.3.0', 'PostgreSQL Handler');

            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });

    describe('complete silence', () => {
        it('should remain silent for all operations', () => {
            const strategy = new SilentRenderStrategy<IDB>();
            const now = Date.now();
            const config = new Config();

            // Call all methods
            strategy.renderBanner('1.0.0', 'Handler');

            const scripts = {
                migrated: [{timestamp: 1, name: 'M', startedAt: now, finishedAt: now, username: 'u'} as MigrationScript<IDB>],
                all: []
            } as unknown as IScripts<IDB>;
            strategy.renderMigrated(scripts, config);

            strategy.renderPending([{timestamp: 1, name: 'M', filepath: '/p'} as MigrationScript<IDB>]);
            strategy.renderExecuted([{timestamp: 1, name: 'M', startedAt: now, finishedAt: now, result: 'R', username: 'u'}]);
            strategy.renderIgnored([{timestamp: 1, name: 'M', filepath: '/p'} as MigrationScript<IDB>]);

            // Verify complete silence
            expect(logStub.called).to.be.false;
            expect(warnStub.called).to.be.false;
            expect(errorStub.called).to.be.false;
        });
    });
});
