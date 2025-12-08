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
    TransactionMode
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

/**
 * Integration tests for MigrationScriptExecutor rollback strategies.
 * Tests the different rollback modes: backup, down, both, and none.
 */
describe('MigrationScriptExecutor - Rollback Strategies', () => {

    let cfg: Config;
    let db: IDB;

    before(() => {
        cfg = TestUtils.getConfig();
        db = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
            async checkConnection(): Promise<boolean> {
                return true;
            }
        }
    });

    /**
     * Test: BACKUP strategy uses backup/restore on failure
     */
    it('should use backup/restore with RollbackStrategy.BACKUP', async () => {
        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.BACKUP;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler<IDB> = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup<IDB>,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" },
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(), config: config });
        const result = await executor.migrate();

        // Should succeed (no migrations to run)
        expect(result.success).to.be.true;

        // Should have created backup
        expect(backupStub.calledOnce).to.be.true;
});

    /**
     * Test: DOWN strategy calls down() methods on failure
     */
    it('should use down() methods with RollbackStrategy.DOWN', async () => {
        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.DOWN;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        // Handler without backup (down() only)
        const handler: IDatabaseMigrationHandler<IDB> = {
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" },
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(), config: config });
        const result = await executor.migrate();

        // Should succeed without backup
        expect(result.success).to.be.true;
});

    /**
     * Test: BOTH strategy creates backup and can use down()
     */
    it('should create backup and support down() with RollbackStrategy.BOTH', async () => {
        const backupStub = sinon.stub().resolves('backup-data');
        const restoreStub = sinon.stub().resolves();

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.BOTH;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler<IDB> = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup<IDB>,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" },
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(), config: config });
        const result = await executor.migrate();

        // Should succeed and have created backup
        expect(result.success).to.be.true;
        expect(backupStub.calledOnce).to.be.true;
});

    /**
     * Test: NONE strategy skips backup entirely
     */
    it('should skip backup with RollbackStrategy.NONE', async () => {
        const backupStub = sinon.stub().resolves('backup-data');

        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.NONE;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler<IDB> = {
            backup: {
                backup: backupStub,
                restore: sinon.stub().resolves()
            } as IBackup<IDB>,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" },
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(), config: config });
        const result = await executor.migrate();

        // Should succeed without creating backup
        expect(result.success).to.be.true;
        expect(backupStub.called).to.be.false;
});

    /**
     * Test: Handler without backup works with DOWN strategy
     */
    it('should work without backup interface when using DOWN strategy', async () => {
        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.DOWN;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        // No backup property
        const handler: IDatabaseMigrationHandler<IDB> = {
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" },
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(), config: config });
        const result = await executor.migrate();

        expect(result.success).to.be.true;
});

    /**
     * Test: Default rollback strategy is BACKUP
     */
    it('should default to RollbackStrategy.BACKUP', () => {
        const config = new Config();
        expect(config.rollbackStrategy).to.equal(RollbackStrategy.BACKUP);
    });

    /**
     * Test: BACKUP strategy without backup interface
     */
    it('should skip backup when BACKUP strategy but no backup interface', async () => {
        const config = new Config();
        config.folder = cfg.folder;
        config.rollbackStrategy = RollbackStrategy.BACKUP;
        config.validateBeforeRun = false; // Disable validation for this rollback-specific test
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        // No backup property
        const handler: IDatabaseMigrationHandler<IDB> = {
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" },
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(), config: config });
        const result = await executor.migrate();

        // Should succeed even without backup
        expect(result.success).to.be.true;
});

    /**
     * Test: Backward compatibility - existing handlers still work
     */
    it('should be backward compatible with existing handlers', async () => {
        const config = new Config();
        config.folder = cfg.folder;
        // Don't set rollbackStrategy - should use default (BACKUP)
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler<IDB> = {
            backup: {
                backup: sinon.stub().resolves('backup-data'),
                restore: sinon.stub().resolves()
            } as IBackup<IDB>,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<void> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" },
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(), config: config });
        const result = await executor.migrate();

        expect(result.success).to.be.true;
});
});
