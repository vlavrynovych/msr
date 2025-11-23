import {expect} from 'chai';
import sinon from 'sinon';
import {JsonRenderStrategy, IScripts, MigrationScript, IDatabaseMigrationHandler, Config} from "../../../../src";

/**
 * Unit tests for JsonRenderStrategy.
 * Tests JSON output formatting for all render methods.
 */
describe('JsonRenderStrategy', () => {

    let logStub: sinon.SinonStub;
    let warnStub: sinon.SinonStub;

    beforeEach(() => {
        logStub = sinon.stub(console, 'log');
        warnStub = sinon.stub(console, 'warn');
    });

    afterEach(() => {
        logStub.restore();
        warnStub.restore();
    });

    describe('constructor', () => {
        it('should default to pretty printing', () => {
            const strategy = new JsonRenderStrategy();
            const scripts = {migrated: []} as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderBanner('1.0.0', 'Test Handler');

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);
            // Pretty printed JSON should have newlines
            expect(output).to.include('\n');
            expect(parsed.banner).to.exist;
        });

        it('should support compact printing', () => {
            const strategy = new JsonRenderStrategy(false);

            strategy.renderBanner('1.0.0', 'Test Handler');

            const output = logStub.firstCall.args[0];
            // Compact JSON should not have newlines (except possibly trailing)
            expect(output.trim()).to.not.include('\n');
        });
    });

    describe('renderMigrated', () => {
        it('should render empty array when no migrations', () => {
            const strategy = new JsonRenderStrategy();
            const scripts = {migrated: [], all: []} as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler);

            expect(logStub.called).to.be.false;
        });

        it('should render migrated scripts as JSON', () => {
            const strategy = new JsonRenderStrategy();
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
                all: [
                    {timestamp: 202501220100, name: 'V202501220100_test.ts'} as MigrationScript
                ]
            } as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler);

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.migrated).to.be.an('array');
            expect(parsed.migrated).to.have.lengthOf(1);
            expect(parsed.migrated[0].timestamp).to.equal(202501220100);
            expect(parsed.migrated[0].name).to.equal('V202501220100_test.ts');
            expect(parsed.migrated[0].username).to.equal('developer');
            expect(parsed.migrated[0].foundLocally).to.be.true;
            expect(parsed.migrated[0].executed).to.be.a('string');
            expect(parsed.migrated[0].executedAgo).to.be.a('string');
            expect(parsed.migrated[0].duration).to.be.a('number');
        });

        it('should mark migrations as not found locally when missing from all', () => {
            const strategy = new JsonRenderStrategy();
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
                all: [] // Migration not found locally
            } as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler);

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.migrated[0].foundLocally).to.be.false;
        });

        it('should limit migrations when limit is specified', () => {
            const strategy = new JsonRenderStrategy();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {timestamp: 1, name: 'Old', startedAt: now, finishedAt: now, username: 'user'} as MigrationScript,
                    {timestamp: 2, name: 'Recent', startedAt: now, finishedAt: now, username: 'user'} as MigrationScript,
                    {timestamp: 3, name: 'Newest', startedAt: now, finishedAt: now, username: 'user'} as MigrationScript,
                ],
                all: []
            } as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler, 2);

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.migrated).to.have.lengthOf(2);
            // Should show most recent first (highest timestamp)
            expect(parsed.migrated[0].timestamp).to.equal(3);
            expect(parsed.migrated[1].timestamp).to.equal(2);
        });

        it('should handle limit of 0 as show all', () => {
            const strategy = new JsonRenderStrategy();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {timestamp: 1, name: 'M1', startedAt: now, finishedAt: now, username: 'user'} as MigrationScript,
                    {timestamp: 2, name: 'M2', startedAt: now, finishedAt: now, username: 'user'} as MigrationScript,
                ],
                all: []
            } as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler, 0);

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.migrated).to.have.lengthOf(2);
        });

        it('should handle missing all array gracefully', () => {
            const strategy = new JsonRenderStrategy();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {timestamp: 1, name: 'M1', startedAt: now, finishedAt: now, username: 'user'} as MigrationScript,
                ],
                all: undefined // No all array
            } as unknown as IScripts;
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            strategy.renderMigrated(scripts, handler);

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.migrated).to.have.lengthOf(1);
            expect(parsed.migrated[0].foundLocally).to.be.false;
        });

        it('should support compact mode', () => {
            const strategy = new JsonRenderStrategy(false);
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

            const output = logStub.firstCall.args[0];
            // Compact JSON should not have newlines (except possibly trailing)
            expect(output.trim()).to.not.include('\n');
            const parsed = JSON.parse(output);
            expect(parsed.migrated).to.have.lengthOf(1);
        });
    });

    describe('renderPending', () => {
        it('should not render when no pending migrations', () => {
            const strategy = new JsonRenderStrategy();

            strategy.renderPending([]);

            expect(logStub.called).to.be.false;
        });

        it('should render pending migrations as JSON', () => {
            const strategy = new JsonRenderStrategy();
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_test.ts', filepath: '/path/to/migration.ts'} as MigrationScript,
                {timestamp: 202501220200, name: 'V202501220200_another.ts', filepath: '/path/to/another.ts'} as MigrationScript,
            ];

            strategy.renderPending(scripts);

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.pending).to.be.an('array');
            expect(parsed.pending).to.have.lengthOf(2);
            expect(parsed.pending[0].timestamp).to.equal(202501220100);
            expect(parsed.pending[0].name).to.equal('V202501220100_test.ts');
            expect(parsed.pending[0].path).to.equal('/path/to/migration.ts');
        });

        it('should support compact mode', () => {
            const strategy = new JsonRenderStrategy(false);
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_test.ts', filepath: '/path/to/migration.ts'} as MigrationScript,
            ];

            strategy.renderPending(scripts);

            const output = logStub.firstCall.args[0];
            // Compact JSON should not have newlines (except possibly trailing)
            expect(output.trim()).to.not.include('\n');
            const parsed = JSON.parse(output);
            expect(parsed.pending).to.have.lengthOf(1);
        });
    });

    describe('renderExecuted', () => {
        it('should not render when no executed migrations', () => {
            const strategy = new JsonRenderStrategy();

            strategy.renderExecuted([]);

            expect(logStub.called).to.be.false;
        });

        it('should render executed migrations as JSON', () => {
            const strategy = new JsonRenderStrategy();
            const now = Date.now();
            const scripts = [
                {
                    timestamp: 202501220100,
                    name: 'V202501220100_test.ts',
                    startedAt: now - 2500,
                    finishedAt: now,
                    username: 'developer',
                    result: 'Migration completed successfully'
                },
                {
                    timestamp: 202501220200,
                    name: 'V202501220200_another.ts',
                    startedAt: now - 1000,
                    finishedAt: now,
                    username: 'developer',
                    result: 'Another migration done'
                },
            ];

            strategy.renderExecuted(scripts);

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.executed).to.be.an('array');
            expect(parsed.executed).to.have.lengthOf(2);
            expect(parsed.executed[0].timestamp).to.equal(202501220100);
            expect(parsed.executed[0].name).to.equal('V202501220100_test.ts');
            expect(parsed.executed[0].duration).to.be.a('number');
            expect(parsed.executed[0].duration).to.equal(2.5);
            expect(parsed.executed[0].result).to.equal('Migration completed successfully');
        });

        it('should support compact mode', () => {
            const strategy = new JsonRenderStrategy(false);
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

            const output = logStub.firstCall.args[0];
            // Compact JSON should not have newlines (except possibly trailing)
            expect(output.trim()).to.not.include('\n');
            const parsed = JSON.parse(output);
            expect(parsed.executed).to.have.lengthOf(1);
        });
    });

    describe('renderIgnored', () => {
        it('should not render when no ignored migrations', () => {
            const strategy = new JsonRenderStrategy();

            strategy.renderIgnored([]);

            expect(warnStub.called).to.be.false;
        });

        it('should render ignored migrations as JSON with warning', () => {
            const strategy = new JsonRenderStrategy();
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_old.ts', filepath: '/path/to/old.ts'} as MigrationScript,
            ];

            strategy.renderIgnored(scripts);

            const output = warnStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.ignored).to.be.an('array');
            expect(parsed.ignored).to.have.lengthOf(1);
            expect(parsed.ignored[0].timestamp).to.equal(202501220100);
            expect(parsed.ignored[0].name).to.equal('V202501220100_old.ts');
            expect(parsed.ignored[0].path).to.equal('/path/to/old.ts');
        });

        it('should support compact mode', () => {
            const strategy = new JsonRenderStrategy(false);
            const scripts = [
                {timestamp: 202501220100, name: 'V202501220100_old.ts', filepath: '/path/to/old.ts'} as MigrationScript,
            ];

            strategy.renderIgnored(scripts);

            const output = warnStub.firstCall.args[0];
            // Compact JSON should not have newlines (except possibly trailing)
            expect(output.trim()).to.not.include('\n');
            const parsed = JSON.parse(output);
            expect(parsed.ignored).to.have.lengthOf(1);
        });
    });

    describe('renderBanner', () => {
        it('should render banner information as JSON', () => {
            const strategy = new JsonRenderStrategy();

            strategy.renderBanner('0.3.0', 'PostgreSQL Handler');

            const output = logStub.firstCall.args[0];
            const parsed = JSON.parse(output);

            expect(parsed.banner).to.exist;
            expect(parsed.banner.application).to.equal('Migration Script Runner');
            expect(parsed.banner.version).to.equal('v0.3.0');
            expect(parsed.banner.handler).to.equal('PostgreSQL Handler');
        });
    });

    describe('JSON formatting', () => {
        it('should produce valid JSON for all methods', () => {
            const strategy = new JsonRenderStrategy(true);
            const now = Date.now();
            const handler = {cfg: new Config()} as IDatabaseMigrationHandler;

            // Test each method produces valid JSON
            strategy.renderBanner('1.0.0', 'Handler');
            expect(() => JSON.parse(logStub.lastCall.args[0])).to.not.throw();

            const scripts = {
                migrated: [{timestamp: 1, name: 'M', startedAt: now, finishedAt: now, username: 'u'} as MigrationScript],
                all: []
            } as unknown as IScripts;
            strategy.renderMigrated(scripts, handler);
            expect(() => JSON.parse(logStub.lastCall.args[0])).to.not.throw();

            strategy.renderPending([{timestamp: 1, name: 'M', filepath: '/p'} as MigrationScript]);
            expect(() => JSON.parse(logStub.lastCall.args[0])).to.not.throw();

            strategy.renderExecuted([{timestamp: 1, name: 'M', startedAt: now, finishedAt: now, result: 'R', username: 'u'}]);
            expect(() => JSON.parse(logStub.lastCall.args[0])).to.not.throw();

            strategy.renderIgnored([{timestamp: 1, name: 'M', filepath: '/p'} as MigrationScript]);
            expect(() => JSON.parse(warnStub.lastCall.args[0])).to.not.throw();
        });
    });
});
