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
 * Tests for MigrationScriptExecutor rollback edge cases.
 * Validates rollback behavior with missing backup, missing down() methods,
 * rollback failures, and NONE strategy.
 */
describe('MigrationScriptExecutor - Rollback Edge Cases', () => {

    let testDir: string;
    let db: IDB;

    before(() => {
        testDir = path.join(process.cwd(), `test-migrations-coverage-${Date.now()}`);
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
     * Test: Rollback with no backup available should warn
     */
    it('should warn when no backup available for restore', async () => {
        const warnMessages: string[] = [];
        const testLogger = {
            info: () => {},
            warn: (msg: string) => { warnMessages.push(msg); },
            error: () => {},
            debug: () => {},
            log: () => {}
        };

        // Create failing migration
        const migrationPath = path.join(testDir, 'V202501260001_fail.ts');
        fs.writeFileSync(migrationPath, `
            export default class Fail {
                async up(): Promise<string> { throw new Error('fail'); }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.BACKUP;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

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
            // No backup interface
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: testLogger});
        const result = await executor.migrate();

        expect(result.success).to.be.false;
        expect(warnMessages.some(msg => msg.includes('No backup available'))).to.be.true;

        // Cleanup
        fs.unlinkSync(migrationPath);
    });

    /**
     * Test: Successful migration with no down() method should warn when rolled back
     */
    it('should warn when successful migration has no down() method', async () => {
        const warnMessages: string[] = [];
        const testLogger = {
            info: () => {},
            warn: (msg: string) => { warnMessages.push(msg); },
            error: () => {},
            debug: () => {},
            log: () => {}
        };

        // Migration 1: succeeds, no down()
        const migration1Path = path.join(testDir, 'V202501260002_no_down.ts');
        fs.writeFileSync(migration1Path, `
            export default class NoDown {
                async up(): Promise<string> { return 'success'; }
                // No down() method
            }
        `);

        // Migration 2: fails
        const migration2Path = path.join(testDir, 'V202501260003_fail.ts');
        fs.writeFileSync(migration2Path, `
            export default class Fail {
                async up(): Promise<string> { throw new Error('fail'); }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.DOWN;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

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

        const executor = new MigrationScriptExecutor(handler, config, {logger: testLogger});
        const result = await executor.migrate();

        expect(result.success).to.be.false;
        // Should warn about missing down() for the successful migration
        expect(warnMessages.some(msg =>
            msg.includes('No down() method') && msg.includes('V202501260002_no_down')
        )).to.be.true;

        // Cleanup
        fs.unlinkSync(migration1Path);
        fs.unlinkSync(migration2Path);
    });

    /**
     * Test: BOTH strategy should fallback to backup when down() fails
     */
    it('should fallback to backup when down() fails in BOTH strategy', async () => {
        const infoMessages: string[] = [];
        const errorMessages: (string | Error)[] = [];
        const testLogger = {
            info: (msg: string) => { infoMessages.push(msg); },
            warn: () => {},
            error: (msg: string | Error) => { errorMessages.push(msg); },
            debug: () => {},
            log: () => {}
        };

        // Migration 1: succeeds, down() throws error
        const migration1Path = path.join(testDir, 'V202501260004_down_fails.ts');
        fs.writeFileSync(migration1Path, `
            export default class DownFails {
                async up(): Promise<string> { return 'success'; }
                async down(): Promise<string> {
                    throw new Error('down() failed - simulating rollback error');
                }
            }
        `);

        // Migration 2: fails
        const migration2Path = path.join(testDir, 'V202501260005_trigger_rollback.ts');
        fs.writeFileSync(migration2Path, `
            export default class TriggerRollback {
                async up(): Promise<string> { throw new Error('trigger rollback'); }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.BOTH;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            },
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

        const executor = new MigrationScriptExecutor(handler, config, {logger: testLogger});
        const result = await executor.migrate();

        expect(result.success).to.be.false;

        // Should log down() failure
        expect(errorMessages.some(msg =>
            (typeof msg === 'string' && msg.includes('down() rollback failed')) ||
            (msg instanceof Error && msg.message.includes('down() rollback failed'))
        )).to.be.true;

        // Should log fallback to backup
        expect(infoMessages.some(msg => msg.includes('Falling back to backup'))).to.be.true;

        // Should have called restore
        expect(restoreStub.calledOnce).to.be.true;

        // Cleanup
        fs.unlinkSync(migration1Path);
        fs.unlinkSync(migration2Path);
    });

    /**
     * Test: Down strategy with no executed scripts
     *
     * Edge case where handleRollback is called but there are no scripts to rollback.
     * This can happen if there's an error before any migration execution.
     */
    it('should handle rollback with no migrations to rollback', async () => {
        const infoMessages: string[] = [];
        const testLogger = {
            info: (msg: string) => { infoMessages.push(msg); },
            warn: () => {},
            error: () => {},
            debug: () => {},
            log: () => {}
        };

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.DOWN;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

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

        const executor = new MigrationScriptExecutor(handler, config, {logger: testLogger});

        // Manually trigger rollback with empty array (testing private method)
        // This simulates a scenario where rollback is called but no migrations were executed
        await (executor as any).rollbackWithDown([]);

        // Should log "No migrations to rollback"
        expect(infoMessages.some(msg => msg.includes('No migrations to rollback'))).to.be.true;
    });

    /**
     * Test: NONE strategy should warn about no rollback
     */
    it('should warn when using NONE rollback strategy', async () => {
        const warnMessages: string[] = [];
        const testLogger = {
            info: () => {},
            warn: (msg: string) => { warnMessages.push(msg); },
            error: () => {},
            debug: () => {},
            log: () => {}
        };

        // Create migration that fails
        const migrationPath = path.join(testDir, 'V202501260010_fail_none.ts');
        fs.writeFileSync(migrationPath, `
            export default class FailNone {
                async up(): Promise<string> { throw new Error('fail with NONE strategy'); }
            }
        `);

        const config = new Config();
        config.folder = testDir;
        config.rollbackStrategy = RollbackStrategy.NONE;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test

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

        const executor = new MigrationScriptExecutor(handler, config, {logger: testLogger});
        const result = await executor.migrate();

        expect(result.success).to.be.false;

        // Should warn about no rollback configured
        expect(warnMessages.some(msg =>
            msg.includes('No rollback configured') && msg.includes('inconsistent state')
        )).to.be.true;

        // Cleanup
        fs.unlinkSync(migrationPath);
    });
});
