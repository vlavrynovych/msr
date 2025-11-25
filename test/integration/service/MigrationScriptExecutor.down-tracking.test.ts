import {expect} from 'chai';
import sinon from 'sinon';
import {
    Config,
    IDB,
    IMigrationInfo,
    IDatabaseMigrationHandler,
    MigrationScriptExecutor,
    ISchemaVersion,
    SilentLogger,
    RollbackStrategy,
    MigrationScript
} from "../../../src";
import * as fs from "fs";
import * as path from "path";

/**
 * Test to verify that executed migrations are tracked for rollback
 * even when a later migration fails.
 *
 * This is a regression test for the bug where scripts.executed was empty
 * when an error was thrown from executeWithHooks().
 */
describe('MigrationScriptExecutor - Track Executed Scripts for Rollback', () => {

    let testDir: string;
    let db: IDB;

    before(() => {
        // Create unique test directory for migrations
        testDir = path.join(process.cwd(), `test-migrations-tracking-${Date.now()}`);
        fs.mkdirSync(testDir, {recursive: true});

        db = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
        }
    });

    after(() => {
        // Cleanup test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, {recursive: true, force: true});
        }
    });

    /**
     * Test: When migration #3 fails, down() should be called for migrations #1 and #2
     *
     * Scenario:
     * - Migration 1: succeeds, has down()
     * - Migration 2: succeeds, has down()
     * - Migration 3: FAILS
     *
     * Expected: down() called for migration 2, then migration 1 (reverse order)
     */
    it('should call down() for all executed migrations when a later migration fails', async () => {
        const downCalls: Array<{name: string, timestamp: number}> = [];

        // Create migration 1 (succeeds)
        const migration1Path = path.join(testDir, 'V202501260001_first.ts');
        fs.writeFileSync(migration1Path, `
            export default class First {
                async up(db: any, info: any): Promise<string> {
                    return 'First migration succeeded';
                }
                async down(db: any, info: any): Promise<string> {
                    (global as any).__testDownCalls = (global as any).__testDownCalls || [];
                    (global as any).__testDownCalls.push({name: 'first', timestamp: Date.now()});
                    return 'Rolling back first migration';
                }
            }
        `);

        // Create migration 2 (succeeds)
        const migration2Path = path.join(testDir, 'V202501260002_second.ts');
        fs.writeFileSync(migration2Path, `
            export default class Second {
                async up(db: any, info: any): Promise<string> {
                    return 'Second migration succeeded';
                }
                async down(db: any, info: any): Promise<string> {
                    (global as any).__testDownCalls = (global as any).__testDownCalls || [];
                    (global as any).__testDownCalls.push({name: 'second', timestamp: Date.now()});
                    return 'Rolling back second migration';
                }
            }
        `);

        // Create migration 3 (fails)
        const migration3Path = path.join(testDir, 'V202501260003_failing.ts');
        fs.writeFileSync(migration3Path, `
            export default class Failing {
                async up(db: any, info: any): Promise<string> {
                    throw new Error('Third migration failed - should trigger rollback of 1 and 2');
                }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.DOWN;

        const handler: IDatabaseMigrationHandler = {
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> {
                        return Promise.resolve([])
                    },
                    save(details: IMigrationInfo): Promise<void> {
                        return Promise.resolve()
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        // Clear global tracker
        (global as any).__testDownCalls = [];

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Get down calls from global tracker
        const calls = (global as any).__testDownCalls || [];

        // Verify migration failed
        expect(result.success).to.be.false;
        expect(result.errors).to.have.lengthOf.at.least(1);

        // CRITICAL: Verify that down() was called for both executed migrations
        // This will FAIL with current implementation because scripts.executed is empty
        expect(calls).to.have.lengthOf(2, 'Should call down() for both executed migrations');

        // Verify reverse order: second migration rolled back first, then first migration
        expect(calls[0].name).to.equal('second', 'Second migration should be rolled back first');
        expect(calls[1].name).to.equal('first', 'First migration should be rolled back second');

        // Verify they were called in chronological order (second's timestamp <= first's timestamp)
        expect(calls[0].timestamp).to.be.at.most(calls[1].timestamp);

        // Cleanup
        fs.unlinkSync(migration1Path);
        fs.unlinkSync(migration2Path);
        fs.unlinkSync(migration3Path);
        delete (global as any).__testDownCalls;
    });

    /**
     * Test: When migration #2 fails, down() should be called only for migration #1
     */
    it('should call down() only for migrations executed before the failure', async () => {
        // Create migration 1 (succeeds)
        const migration1Path = path.join(testDir, 'V202501260004_success.ts');
        fs.writeFileSync(migration1Path, `
            export default class Success {
                async up(): Promise<string> {
                    (global as any).__testDownCalls2 = (global as any).__testDownCalls2 || [];
                    return 'success';
                }
                async down(): Promise<string> {
                    (global as any).__testDownCalls2.push('success');
                    return 'rollback success';
                }
            }
        `);

        // Create migration 2 (fails)
        const migration2Path = path.join(testDir, 'V202501260005_fail.ts');
        fs.writeFileSync(migration2Path, `
            export default class Fail {
                async up(): Promise<string> { throw new Error('Failed immediately'); }
                async down(): Promise<string> {
                    (global as any).__testDownCalls2.push('fail');
                    return 'rollback fail';
                }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.DOWN;

        const handler: IDatabaseMigrationHandler = {
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> {
                        return Promise.resolve([])
                    },
                    save(details: IMigrationInfo): Promise<void> {
                        return Promise.resolve()
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        (global as any).__testDownCalls2 = [];

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});
        const result = await executor.migrate();

        const calls = (global as any).__testDownCalls2 || [];

        // Verify migration failed
        expect(result.success).to.be.false;

        // CRITICAL: Verify down() was called for:
        // 1. The failed migration (to clean up partial changes)
        // 2. The successful migration
        expect(calls).to.have.lengthOf(2, 'Should call down() for failed migration + successful migration');
        expect(calls[0]).to.equal('fail', 'Failed migration should be rolled back first');
        expect(calls[1]).to.equal('success', 'Successful migration should be rolled back second');

        // Cleanup
        fs.unlinkSync(migration1Path);
        fs.unlinkSync(migration2Path);
        delete (global as any).__testDownCalls2;
    });

    /**
     * Test: When first migration fails, only the failed migration's down() should be called
     */
    it('should call down() on the first migration when it fails', async () => {
        // Create migration that fails immediately
        const migrationPath = path.join(testDir, 'V202501260006_immediate_fail.ts');
        fs.writeFileSync(migrationPath, `
            export default class ImmediateFail {
                async up(): Promise<string> { throw new Error('Failed on first migration'); }
                async down(): Promise<string> {
                    (global as any).__testDownCalls3 = (global as any).__testDownCalls3 || [];
                    (global as any).__testDownCalls3.push('immediate_fail');
                    return 'Cleaned up failed migration';
                }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.DOWN;

        const infoMessages: string[] = [];
        const testLogger = {
            info: (msg: string) => { infoMessages.push(msg); },
            warn: () => {},
            error: () => {},
            debug: () => {},
            log: () => {}
        };

        const handler: IDatabaseMigrationHandler = {
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> {
                        return Promise.resolve([])
                    },
                    save(details: IMigrationInfo): Promise<void> {
                        return Promise.resolve()
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        (global as any).__testDownCalls3 = [];

        const executor = new MigrationScriptExecutor(handler, config, {logger: testLogger});
        const result = await executor.migrate();

        const calls = (global as any).__testDownCalls3 || [];

        // Verify migration failed
        expect(result.success).to.be.false;

        // Should log about rolling back 1 migration
        const hasRollbackMessage = infoMessages.some(msg => msg.includes('Rolling back 1 migration'));
        expect(hasRollbackMessage).to.be.true;

        // CRITICAL: Failed migration's down() should be called to clean up
        expect(calls).to.have.lengthOf(1, 'Should call down() on the failed migration');
        expect(calls[0]).to.equal('immediate_fail');

        // Cleanup
        fs.unlinkSync(migrationPath);
        delete (global as any).__testDownCalls3;
    });
});
