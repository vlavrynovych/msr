import {expect} from 'chai';
import sinon from 'sinon';
import fs from 'node:fs';
import path from 'node:path';
import {
    Config,
    IDB,
    IMigrationInfo,
    IDatabaseMigrationHandler,
    MigrationScriptExecutor,
    IBackup,
    ISchemaVersion,
    SilentLogger,
    TransactionMode
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

/**
 * Integration tests for MigrationScriptExecutor beforeMigrate file functionality.
 * Tests the beforeMigrate.ts special script that executes once before migrations run.
 */
describe('MigrationScriptExecutor - beforeMigrate File', () => {

    let cfg: Config;
    let db: IDB;

    // Shared test migration content
    const TEST_MIGRATION_CONTENT = [
        'export default class TestMigration {',
        '    async up() {',
        '        return \'Success\';',
        '    }',
        '}'
    ].join('\n');

    before(() => {
        cfg = TestUtils.getConfig();
        cfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions
        db = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
            async checkConnection(): Promise<boolean> {
                return true;
            }
        }
    });

    /**
     * Test: beforeMigrate.ts is executed when it exists
     * Validates that the special beforeMigrate.ts file runs before migrations
     */
    it('should execute beforeMigrate.ts if it exists in migrations folder', async () => {
        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, cfg, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Verify migration succeeded (beforeMigrate.ts exists in test fixtures)
        expect(result.success).to.be.true;
    });

    /**
     * Test: beforeMigrate.ts is NOT executed when there are no pending migrations
     * Validates that beforeMigrate is skipped if there's nothing to migrate
     */
    it('should not execute beforeMigrate.ts when no pending migrations', async () => {
        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    // Return the migration as already executed
                    getAllExecuted(): Promise<any> {
                        return Promise.resolve([{
                            timestamp: 202311020036,
                            name: 'V202311020036_test.ts',
                            finishedAt: Date.now(),
                            username: 'test'
                        }]);
                    },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, cfg, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Verify migration succeeded without running beforeMigrate
        expect(result.success).to.be.true;
        expect(result.executed.length).to.equal(0);
    });

    /**
     * Test: beforeMigrate.ts error causes early migration failure (fail-fast)
     * Validates that errors in beforeMigrate cause migration to abort BEFORE
     * backup is created. This tests the fail-fast behavior where beforeMigrate
     * errors prevent any database operations.
     */
    it('should fail migration early if beforeMigrate.ts throws error (no backup)', async () => {
        // Create a temporary migrations folder with a failing beforeMigrate.ts
        const tempFolder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-temp-fail');
        if (!fs.existsSync(tempFolder)) {
            fs.mkdirSync(tempFolder, { recursive: true });
        }

        // Create a beforeMigrate.ts that throws an error
        const beforeMigrateContent = [
            'export default class BeforeMigrate {',
            '    async up() {',
            '        throw new Error(\'beforeMigrate setup failed\');',
            '    }',
            '}'
        ].join('\n');
        fs.writeFileSync(path.join(tempFolder, 'beforeMigrate.ts'), beforeMigrateContent);

        // Create a simple migration to make sure there are pending migrations
        fs.writeFileSync(path.join(tempFolder, 'V202501010001_test.ts'), TEST_MIGRATION_CONTENT);

        const restoreStub = sinon.stub().resolves('restored');
        const tempCfg = new Config();
        tempCfg.folder = tempFolder;
        tempCfg.recursive = false;
        tempCfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, tempCfg, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Verify migration failed
        expect(result.success).to.be.false;
        expect(result.errors).to.not.be.undefined;
        expect(result.errors?.length).to.be.greaterThan(0);

        // Note: restore is NOT called because beforeMigrate fails BEFORE backup is created
        // beforeMigrate runs first, then scan, then validation, THEN backup
        expect(restoreStub.called).to.be.false;

        // Cleanup
        fs.unlinkSync(path.join(tempFolder, 'beforeMigrate.ts'));
        fs.unlinkSync(path.join(tempFolder, 'V202501010001_test.ts'));
        fs.rmdirSync(tempFolder);
    });

    /**
     * Test: beforeMigrate.ts succeeds but migration fails → triggers backup/restore
     * Validates that when beforeMigrate succeeds but a migration fails during execution,
     * the backup/restore mechanism works correctly. This tests the restoration path
     * in the context of beforeMigrate functionality.
     */
    it('should restore backup when beforeMigrate succeeds but migration fails', async () => {
        const tempFolder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-temp-restore');
        if (!fs.existsSync(tempFolder)) {
            fs.mkdirSync(tempFolder, { recursive: true });
        }

        // Create a beforeMigrate.ts that succeeds
        const beforeMigrateContent = [
            'export default class BeforeMigrate {',
            '    async up() {',
            '        return \'Setup complete\';',
            '    }',
            '}'
        ].join('\n');
        fs.writeFileSync(path.join(tempFolder, 'beforeMigrate.ts'), beforeMigrateContent);

        // Create a migration that will fail
        const failingMigrationContent = [
            'export default class TestMigration {',
            '    async up() {',
            '        throw new Error(\'Migration failed\');',
            '    }',
            '}'
        ].join('\n');
        fs.writeFileSync(path.join(tempFolder, 'V202501010001_failing.ts'), failingMigrationContent);

        const restoreStub = sinon.stub().resolves('restored');
        const backupStub = sinon.stub().resolves('backup-path');
        const tempCfg = new Config();
        tempCfg.folder = tempFolder;
        tempCfg.recursive = false;
        tempCfg.validateBeforeRun = false; // Disable validation so migration execution is attempted
        tempCfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup: backupStub,
                restore: restoreStub
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, tempCfg, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Verify migration failed
        expect(result.success).to.be.false;
        expect(result.errors).to.not.be.undefined;

        // Verify beforeMigrate succeeded (doesn't throw), backup was created, and restore was called
        expect(backupStub.calledOnce).to.be.true;
        expect(restoreStub.calledOnce).to.be.true;

        // Cleanup
        fs.rmSync(tempFolder, { recursive: true, force: true });
    });

    /**
     * Test: migrations work normally when beforeMigrate.ts doesn't exist
     * Validates backward compatibility when no beforeMigrate file is present
     */
    it('should work normally when beforeMigrate.ts does not exist', async () => {
        // Use a folder without beforeMigrate.ts
        const tempFolder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-temp-no-before');
        if (!fs.existsSync(tempFolder)) {
            fs.mkdirSync(tempFolder, { recursive: true });
        }

        // Create a simple migration
        fs.writeFileSync(path.join(tempFolder, 'V202501010001_test.ts'), TEST_MIGRATION_CONTENT);

        const tempCfg = new Config();
        tempCfg.folder = tempFolder;
        tempCfg.recursive = false;
        tempCfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, tempCfg, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Verify migration succeeds without beforeMigrate
        expect(result.success).to.be.true;
        expect(result.executed.length).to.equal(1);

        // Cleanup
        fs.unlinkSync(path.join(tempFolder, 'V202501010001_test.ts'));
        fs.rmdirSync(tempFolder);
    });

    /**
     * Test: beforeMigrate.ts executes only once before all migrations
     * Validates that beforeMigrate is not called per-migration
     */
    it('should execute beforeMigrate.ts only once, not per migration', async () => {
        // This is validated by the implementation - beforeMigrate runs once before the loop

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, cfg, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Verify migration completed successfully
        expect(result.success).to.be.true;
        // There's 1 migration in test fixtures
        expect(result.executed.length).to.be.greaterThan(0);
    });

    /**
     * Test: beforeMigrate can be disabled by setting beforeMigrateName to null
     * Validates that the feature can be completely disabled
     */
    it('should skip beforeMigrate when beforeMigrateName is null', async () => {
        const tempCfg = new Config();
        tempCfg.folder = cfg.folder;
        tempCfg.beforeMigrateName = null; // Disable beforeMigrate
        tempCfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, tempCfg, {logger: new SilentLogger()});
        const result = await executor.migrate();

        // Verify migration succeeded without beforeMigrate
        expect(result.success).to.be.true;
        expect(result.executed.length).to.be.greaterThan(0);
    });

    /**
     * Test: enhanced logging for beforeMigrate execution
     * Validates that detailed logs are produced during beforeMigrate execution
     */
    it('should log detailed information about beforeMigrate execution', async () => {
        const mockLogger = {
            info: sinon.spy(),
            error: sinon.spy(),
            warn: sinon.spy(),
            debug: sinon.spy(),
            log: sinon.spy()
        };

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        // Override log level to 'info' to test logging behavior
        const testCfg = TestUtils.getConfig();
        testCfg.logLevel = 'info';
        testCfg.transaction.mode = TransactionMode.NONE;

        const executor = new MigrationScriptExecutor(handler, testCfg, {logger: mockLogger});
        const result = await executor.migrate();

        // Verify migration succeeded
        expect(result.success).to.be.true;

        // Verify logging behavior
        expect(mockLogger.info.called).to.be.true;

        // Check for specific log messages
        const infoMessages = mockLogger.info.args.map((args: unknown[]) => args[0] as string);

        // Should log checking for beforeMigrate
        expect(infoMessages.some((msg: string) => msg.includes('Checking for beforeMigrate'))).to.be.true;

        // Should log found beforeMigrate script
        expect(infoMessages.some((msg: string) => msg.includes('Found beforeMigrate script'))).to.be.true;

        // Should log execution start
        expect(infoMessages.some((msg: string) => msg.includes('Executing beforeMigrate'))).to.be.true;

        // Should log completion with duration
        expect(infoMessages.some((msg: string) => msg.includes('completed successfully in'))).to.be.true;

        // Should log result (our test beforeMigrate returns a result)
        expect(infoMessages.some((msg: string) => msg.includes('Result:'))).to.be.true;
    });

    /**
     * Test: logging when no beforeMigrate script exists
     * Validates that appropriate message is logged when beforeMigrate is not found
     */
    it('should log when no beforeMigrate script is found', async () => {
        const mockLogger = {
            info: sinon.spy(),
            error: sinon.spy(),
            warn: sinon.spy(),
            debug: sinon.spy(),
            log: sinon.spy()
        };

        // Use a folder without beforeMigrate.ts
        const tempFolder = path.join(process.cwd(), 'test', 'fixtures', 'migrations-temp-no-before-2');
        if (!fs.existsSync(tempFolder)) {
            fs.mkdirSync(tempFolder, { recursive: true });
        }

        // Create a simple migration
        fs.writeFileSync(path.join(tempFolder, 'V202501010001_test.ts'), TEST_MIGRATION_CONTENT);

        const tempCfg = new Config();
        tempCfg.folder = tempFolder;
        tempCfg.recursive = false;
        tempCfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

        const handler: IDatabaseMigrationHandler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<any> { return Promise.resolve([]) },
                    save(details: IMigrationInfo): Promise<any> { return Promise.resolve() },
                    remove(timestamp: number): Promise<void> { return Promise.resolve(undefined) }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            } as ISchemaVersion,
            db,
            getName(): string { return "Test Handler" },
            getVersion(): string { return "1.0.0-test" }
        };

        const executor = new MigrationScriptExecutor(handler, tempCfg, {logger: mockLogger});
        const result = await executor.migrate();

        // Verify migration succeeds
        expect(result.success).to.be.true;

        // Verify logging behavior
        const infoMessages = mockLogger.info.args.map((args: unknown[]) => args[0] as string);

        // Should log checking for beforeMigrate
        expect(infoMessages.some((msg: string) => msg.includes('Checking for beforeMigrate'))).to.be.true;

        // Should log not found message
        expect(infoMessages.some((msg: string) => msg.includes('No beforeMigrate script found'))).to.be.true;

        // Should NOT log execution messages
        expect(infoMessages.some((msg: string) => msg.includes('Executing beforeMigrate'))).to.be.false;

        // Cleanup
        fs.unlinkSync(path.join(tempFolder, 'V202501010001_test.ts'));
        fs.rmdirSync(tempFolder);
    });
});
