import {expect} from 'chai';
import sinon from 'sinon';
import {
    Config,
    IDB,
    IMigrationInfo,
    IDatabaseMigrationHandler,
    MigrationScriptExecutor,
    IBackup,
    ISchemaVersion,
    SilentLogger,
    RollbackStrategy,
    MigrationScript,
    BackupMode
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";
import fs from 'fs';

/**
 * Integration tests for BackupMode functionality to achieve 100% coverage.
 * Tests uncovered scenarios:
 * - CREATE_ONLY mode skipping restore
 * - RESTORE_ONLY without existingBackupPath (error)
 * - shouldRestoreInMode() with DOWN strategy
 * - Public backup methods
 */
describe('MigrationScriptExecutor - BackupMode Coverage', () => {

    let cfg: Config;
    let db: IDB;

    before(() => {
        cfg = TestUtils.getConfig();
        db = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
        }
    });

    afterEach(() => {
        sinon.restore();
        // Clean up test backups
        if (fs.existsSync('./backups')) {
            const files = fs.readdirSync('./backups');
            files.forEach(file => {
                if (file.startsWith('backup-') || file.startsWith('test-')) {
                    fs.unlinkSync(`./backups/${file}`);
                }
            });
        }
    });

    /**
     * Test: CREATE_ONLY mode - backup created but restore skipped on failure
     * Covers lines 1002-1003 (restore skipped path)
     */
    it('should skip restore with BackupMode.CREATE_ONLY on failure', async () => {
        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.BACKUP;
        config.backupMode = BackupMode.CREATE_ONLY;
        config.validateBeforeRun = false;

        // Create handler with failing migration
        const failingMigration = new MigrationScript('failing', './test/integration/data/V202001010000_test.ts', 202001010000);
        sinon.stub(failingMigration, 'init').resolves();
        failingMigration.script = {
            up: sinon.stub().rejects(new Error('Migration failed'))
        };

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Stub migrationScanner to return the failing migration
        sinon.stub(executor.migrationScanner, 'scan').resolves({
            all: [failingMigration],
            migrated: [],
            pending: [failingMigration],
            ignored: [],
            executed: []
        });

        const result = await executor.migrate();

        // Should fail
        expect(result.success).to.be.false;

        // Backup should have been created
        expect(backupStub.calledOnce).to.be.true;

        // Restore should NOT have been called (CREATE_ONLY mode)
        expect(restoreStub.called).to.be.false;
    });

    /**
     * Test: RESTORE_ONLY without existingBackupPath throws error
     * Covers lines 1010-1013 (error path)
     */
    it('should throw error when RESTORE_ONLY used without existingBackupPath', async () => {
        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.BACKUP;
        config.backupMode = BackupMode.RESTORE_ONLY;
        // Intentionally NOT setting config.backup.existingBackupPath
        config.validateBeforeRun = false;

        // Create handler with failing migration
        const failingMigration = new MigrationScript('failing', './test/integration/data/V202001010000_test.ts', 202001010000);
        sinon.stub(failingMigration, 'init').resolves();
        failingMigration.script = {
            up: sinon.stub().rejects(new Error('Migration failed'))
        };

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Stub migrationScanner to return the failing migration
        sinon.stub(executor.migrationScanner, 'scan').resolves({
            all: [failingMigration],
            migrated: [],
            pending: [failingMigration],
            ignored: [],
            executed: []
        });

        try {
            await executor.migrate();
            expect.fail('Should have thrown error about missing existingBackupPath');
        } catch (error: any) {
            // Should throw specific error about existingBackupPath
            expect(error.message).to.include('existingBackupPath');
        }

        // Backup should NOT have been created (RESTORE_ONLY mode)
        expect(backupStub.called).to.be.false;
    });

    /**
     * Test: shouldRestoreInMode() with DOWN strategy returns false
     * Covers line 1124 (early return for non-backup strategies)
     */
    it('should not restore with DOWN strategy regardless of backupMode', async () => {
        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.DOWN; // DOWN strategy
        config.backupMode = BackupMode.FULL; // Even with FULL mode
        config.validateBeforeRun = false;

        // Create handler with failing migration that has down()
        const failingMigration = new MigrationScript('failing', './test/integration/data/V202001010000_test.ts', 202001010000);
        sinon.stub(failingMigration, 'init').resolves();
        const downStub = sinon.stub().resolves();
        failingMigration.script = {
            up: sinon.stub().rejects(new Error('Migration failed')),
            down: downStub // Has down() method
        };

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Stub migrationScanner to return the failing migration
        sinon.stub(executor.migrationScanner, 'scan').resolves({
            all: [failingMigration],
            migrated: [],
            pending: [failingMigration],
            ignored: [],
            executed: []
        });

        const result = await executor.migrate();

        // Should fail
        expect(result.success).to.be.false;

        // Backup should NOT have been created (DOWN strategy ignores backup)
        expect(backupStub.called).to.be.false;

        // Restore should NOT have been called (DOWN strategy uses down() methods)
        expect(restoreStub.called).to.be.false;

        // down() method should have been called
        expect(downStub.calledOnce).to.be.true;
    });

    /**
     * Test: BOTH strategy with MANUAL mode - down() fails, no restore
     * Covers line 1124 (early return when strategy doesn't involve backups)
     * and ensures MANUAL mode skips restore even in BOTH strategy fallback
     */
    it('should not restore with BOTH strategy and MANUAL mode when down() fails', async () => {
        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.BOTH;
        config.backupMode = BackupMode.MANUAL; // MANUAL mode
        config.validateBeforeRun = false;

        // Create handler with failing migration that has a failing down() method
        const failingMigration = new MigrationScript('failing', './test/integration/data/V202001010000_test.ts', 202001010000);
        sinon.stub(failingMigration, 'init').resolves();
        const downStub = sinon.stub().rejects(new Error('down() failed'));
        failingMigration.script = {
            up: sinon.stub().rejects(new Error('Migration failed')),
            down: downStub // Has down() but it fails
        };

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Stub migrationScanner to return the failing migration
        sinon.stub(executor.migrationScanner, 'scan').resolves({
            all: [failingMigration],
            migrated: [],
            pending: [failingMigration],
            ignored: [],
            executed: []
        });

        const result = await executor.migrate();

        // Should fail
        expect(result.success).to.be.false;

        // Backup should NOT have been created (MANUAL mode)
        expect(backupStub.called).to.be.false;

        // down() should have been called (BOTH tries down first)
        expect(downStub.calledOnce).to.be.true;

        // Restore should NOT be called (MANUAL mode prevents backup restore)
        expect(restoreStub.called).to.be.false;
    });

    /**
     * Test: shouldRestoreInMode() returns false for NONE strategy
     * Covers line 1124 (return false for NONE strategy)
     */
    it('should not restore with NONE strategy', async () => {
        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.NONE; // NONE strategy
        config.backupMode = BackupMode.FULL;
        config.validateBeforeRun = false;

        // Create handler with failing migration
        const failingMigration = new MigrationScript('failing', './test/integration/data/V202001010000_test.ts', 202001010000);
        sinon.stub(failingMigration, 'init').resolves();
        failingMigration.script = {
            up: sinon.stub().rejects(new Error('Migration failed'))
        };

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Stub migrationScanner to return the failing migration
        sinon.stub(executor.migrationScanner, 'scan').resolves({
            all: [failingMigration],
            migrated: [],
            pending: [failingMigration],
            ignored: [],
            executed: []
        });

        const result = await executor.migrate();

        // Should fail
        expect(result.success).to.be.false;

        // Neither backup nor restore should have been called (NONE strategy)
        expect(backupStub.called).to.be.false;
        expect(restoreStub.called).to.be.false;
    });

    /**
     * Test: createBackup() public method
     * Ensures the public method works correctly
     */
    it('should create backup using createBackup() public method', async () => {
        const backupStub = sinon.stub().resolves('backup-data');

        const config = new Config();
        config.folder = cfg.folder;

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: sinon.stub().resolves()
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Call the public method directly
        const backupPath = await executor.createBackup();

        expect(backupStub.calledOnce).to.be.true;
        expect(backupPath).to.be.a('string');
        expect(backupPath).to.include('backup');
    });

    /**
     * Test: restoreFromBackup() public method
     * Ensures the public method works correctly
     */
    it('should restore from backup using restoreFromBackup() public method', async () => {
        const restoreStub = sinon.stub().resolves();
        const backupData = '{"test": "data"}';

        const config = new Config();
        config.folder = cfg.folder;

        // Create a test backup file
        const testBackupPath = './backups/test-backup.bkp';
        if (!fs.existsSync('./backups')) {
            fs.mkdirSync('./backups', {recursive: true});
        }
        fs.writeFileSync(testBackupPath, backupData);

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: sinon.stub().resolves('backup-data'),
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Call the public method directly with specific path
        await executor.restoreFromBackup(testBackupPath);

        expect(restoreStub.calledOnce).to.be.true;
        expect(restoreStub.firstCall.args[0]).to.equal(backupData);
    });

    /**
     * Test: shouldRestoreInMode() with DOWN strategy (edge case)
     * This tests the defensive code path that checks strategy
     * Line 1124 coverage: Tests the unreachable defensive guard
     */
    it('should return false from shouldRestoreInMode with DOWN strategy', async () => {
        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.DOWN; // DOWN strategy
        config.backupMode = BackupMode.FULL; // Any mode

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: sinon.stub().resolves('backup-data'),
                restore: sinon.stub().resolves()
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Access private method via type casting (for coverage of defensive code)
        const shouldRestore = (executor as any).shouldRestoreInMode();

        // Should return false because strategy is DOWN
        expect(shouldRestore).to.be.false;
    });

    /**
     * Test: deleteBackup() public method
     * Ensures the public method works correctly
     */
    it('should delete backup using deleteBackup() public method', async () => {
        const config = new Config();
        config.folder = cfg.folder;
        config.backup.deleteBackup = true; // Enable deletion

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: sinon.stub().resolves('backup-data'),
                restore: sinon.stub().resolves()
            } as IBackup,
            schemaVersion: {
                migrations: {
                    getAll(): Promise<MigrationScript[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" }
        };

        const executor = new MigrationScriptExecutor(handler, config, {logger: new SilentLogger()});

        // Create a backup first
        const backupPath = await executor.createBackup();

        // Verify backup exists
        expect(fs.existsSync(backupPath)).to.be.true;

        // Call the public method directly
        executor.deleteBackup();

        // Verify backup was deleted
        expect(fs.existsSync(backupPath)).to.be.false;
    });
});
