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
 * Test to verify that a FAILED migration's down() method is called to clean up partial changes.
 *
 * Scenario:
 * - Migration 1: succeeds ✅
 * - Migration 2: succeeds ✅
 * - Migration 3: FAILS during up() ❌ (but has made partial database changes)
 *
 * Expected behavior with DOWN strategy:
 * 1. Call migration 3's down() to clean up its partial changes
 * 2. Call migration 2's down()
 * 3. Call migration 1's down()
 */
describe('MigrationScriptExecutor - Failed Migration Cleanup', () => {

    let testDir: string;
    let db: IDB;

    before(() => {
        testDir = path.join(process.cwd(), `test-migrations-failed-cleanup-${Date.now()}`);
        fs.mkdirSync(testDir, {recursive: true});

        db = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
        }
    });

    after(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, {recursive: true, force: true});
        }
    });

    /**
     * CRITICAL TEST: Failed migration should have its down() called to clean up partial changes
     *
     * This tests the scenario where a migration fails AFTER making some database changes.
     * The down() method should be called to clean up those partial changes.
     */
    it('should call down() on the failed migration to clean up partial changes', async () => {
        // Track all down() calls
        (global as any).__cleanupDownCalls = [];

        // Migration 1: succeeds
        const migration1Path = path.join(testDir, 'V202501260001_first.ts');
        fs.writeFileSync(migration1Path, `
            export default class First {
                async up(db: any, info: any): Promise<string> {
                    return 'First succeeded';
                }
                async down(db: any, info: any): Promise<string> {
                    (global as any).__cleanupDownCalls.push('first');
                    return 'First rolled back';
                }
            }
        `);

        // Migration 2: succeeds
        const migration2Path = path.join(testDir, 'V202501260002_second.ts');
        fs.writeFileSync(migration2Path, `
            export default class Second {
                async up(db: any, info: any): Promise<string> {
                    return 'Second succeeded';
                }
                async down(db: any, info: any): Promise<string> {
                    (global as any).__cleanupDownCalls.push('second');
                    return 'Second rolled back';
                }
            }
        `);

        // Migration 3: FAILS after making partial changes
        const migration3Path = path.join(testDir, 'V202501260003_failing.ts');
        fs.writeFileSync(migration3Path, `
            export default class Failing {
                async up(db: any, info: any): Promise<string> {
                    // Simulate making some database changes before failing
                    (global as any).__partialChanges = 'Migration 3 made partial changes';

                    // Then fail
                    throw new Error('Migration 3 failed after partial changes');
                }
                async down(db: any, info: any): Promise<string> {
                    // CRITICAL: This should be called to clean up partial changes
                    (global as any).__cleanupDownCalls.push('failing');
                    (global as any).__partialChanges = null; // Clean up
                    return 'Failing migration rolled back';
                }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.DOWN;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

        const handler: IDatabaseMigrationHandler = {
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript[]> {
                        return Promise.resolve([])
                    },
                    save(details: IMigrationInfo): Promise<void> {
                        return Promise.resolve()
                    },
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined)
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});
        const result = await executor.migrate();

        const downCalls = (global as any).__cleanupDownCalls || [];

        // Verify migration failed
        expect(result.success).to.be.false;
        expect(result.errors).to.have.lengthOf.at.least(1);

        // CRITICAL ASSERTION: Failed migration's down() should be called FIRST
        expect(downCalls).to.have.lengthOf(3, 'Should call down() for failed migration + 2 successful migrations');
        expect(downCalls[0]).to.equal('failing', 'Failed migration should be rolled back FIRST to clean up partial changes');
        expect(downCalls[1]).to.equal('second', 'Second migration should be rolled back second');
        expect(downCalls[2]).to.equal('first', 'First migration should be rolled back last');

        // Verify partial changes were cleaned up
        expect((global as any).__partialChanges).to.be.null;

        // Cleanup
        fs.unlinkSync(migration1Path);
        fs.unlinkSync(migration2Path);
        fs.unlinkSync(migration3Path);
        delete (global as any).__cleanupDownCalls;
        delete (global as any).__partialChanges;
    });

    /**
     * Test: Failed migration without down() method should log warning
     */
    it('should warn when failed migration has no down() method', async () => {
        // Migration that fails without down() method
        const migrationPath = path.join(testDir, 'V202501260004_no_down.ts');
        fs.writeFileSync(migrationPath, `
            export default class NoDown {
                async up(db: any, info: any): Promise<string> {
                    (global as any).__partialChanges2 = 'Made changes';
                    throw new Error('Failed without down method');
                }
                // No down() method!
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.DOWN;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

        const warnMessages: string[] = [];
        const testLogger = {
            info: () => {},
            warn: (msg: string) => { warnMessages.push(msg); },
            error: () => {},
            debug: () => {},
            log: () => {}
        };

        const handler: IDatabaseMigrationHandler = {
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript[]> {
                        return Promise.resolve([])
                    },
                    save(details: IMigrationInfo): Promise<void> {
                        return Promise.resolve()
                    },
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined)
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: testLogger});
        const result = await executor.migrate();

        // Should fail
        expect(result.success).to.be.false;

        // Should warn about missing down() on failed migration
        const hasWarning = warnMessages.some(msg =>
            msg.includes('No down() method') || msg.includes('V202501260004_no_down')
        );
        expect(hasWarning).to.be.true;

        // Partial changes are NOT cleaned up (down() missing)
        expect((global as any).__partialChanges2).to.equal('Made changes');

        // Cleanup
        fs.unlinkSync(migrationPath);
        delete (global as any).__partialChanges2;
    });

    /**
     * Test: BOTH strategy should call failed migration's down() before trying successful ones
     */
    it('should call failed migration down() first with BOTH strategy', async () => {
        (global as any).__bothStrategyDownCalls = [];

        // Success migration
        const migration1Path = path.join(testDir, 'V202501260005_success.ts');
        fs.writeFileSync(migration1Path, `
            export default class Success {
                async up(): Promise<string> { return 'success'; }
                async down(): Promise<string> {
                    (global as any).__bothStrategyDownCalls.push('success');
                    return 'rolled back';
                }
            }
        `);

        // Failing migration
        const migration2Path = path.join(testDir, 'V202501260006_fail_both.ts');
        fs.writeFileSync(migration2Path, `
            export default class FailBoth {
                async up(): Promise<string> {
                    throw new Error('fail');
                }
                async down(): Promise<string> {
                    (global as any).__bothStrategyDownCalls.push('failed');
                    return 'cleaned up failed migration';
                }
            }
        `);

        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.BOTH;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            },
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript[]> {
                        return Promise.resolve([])
                    },
                    save(details: IMigrationInfo): Promise<void> {
                        return Promise.resolve()
                    },
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined)
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});
        const result = await executor.migrate();

        const downCalls = (global as any).__bothStrategyDownCalls || [];

        // Should fail
        expect(result.success).to.be.false;

        // Should call down() methods (failed first, then successful)
        expect(downCalls).to.have.lengthOf(2);
        expect(downCalls[0]).to.equal('failed', 'Failed migration down() should be called first');
        expect(downCalls[1]).to.equal('success', 'Successful migration down() should be called second');

        // Cleanup
        fs.unlinkSync(migration1Path);
        fs.unlinkSync(migration2Path);
        delete (global as any).__bothStrategyDownCalls;
    });
});
