import {expect, spy} from 'chai';
import {afterEach} from "mocha";
import sinon from 'sinon';
import {
    Config,
    IDB,
    IMigrationInfo,
    IDatabaseMigrationHandler,
    IRunnableScript,
    MigrationScript,
    MigrationScriptExecutor,
    IBackup,
    ISchemaVersion,
    IMigrationScript,
    SilentLogger,
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

/**
 * Integration tests for MigrationScriptExecutor version control features.
 * Tests the migrateTo() and downTo() methods for controlled version upgrades/downgrades.
 */
describe('MigrationScriptExecutor - Version Control', () => {

    let initialized = true;
    let created = true;
    let valid = true;
    let scripts: MigrationScript<IDB>[] = [];
    let cfg: Config;
    let handler: IDatabaseMigrationHandler<IDB>;
    let executor: MigrationScriptExecutor<IDB>;
    let removedTimestamps: number[] = [];

    before(() => {
        cfg = TestUtils.getConfig();
        const db: IDB = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
            async checkConnection(): Promise<boolean> {
                return true;
            }
        };

        handler = {
            backup: {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            } as IBackup<IDB>,
            schemaVersion: {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> {
                        return Promise.resolve(scripts);
                    },
                    save(details: IMigrationInfo): Promise<void> {
                        return Promise.resolve(undefined);
                    },
                    remove(timestamp: number): Promise<void> {
                        removedTimestamps.push(timestamp);
                        return Promise.resolve(undefined);
                    }
                } as IMigrationScript<IDB>,
                createTable(tableName: string): Promise<boolean> {
                    return Promise.resolve(created);
                },
                isInitialized(tableName: string): Promise<boolean> {
                    return Promise.resolve(initialized);
                },
                validateTable(tableName: string): Promise<boolean> {
                    return Promise.resolve(valid);
                }
            } as ISchemaVersion<IDB>,
            db,
            getName(): string { return "Test Implementation" },
            getVersion(): string { return "1.0.0-test" }
        } as IDatabaseMigrationHandler<IDB>;
    });

    beforeEach(() => {
        // Disable validation for version control tests since we're using mocked scripts
        cfg.validateBeforeRun = false;
        cfg.validateMigratedFiles = false;

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: cfg });
        initialized = true;
        created = true;
        valid = true;
        removedTimestamps = [];
        spy.on(handler.schemaVersion, ['isInitialized', 'createTable', 'validateTable']);
        spy.on(handler.schemaVersion.migrationRecords, ['save', 'getAllExecuted', 'remove']);
        spy.on(executor.backupService, ['restore', 'deleteBackup', 'backup']);
        spy.on(executor.migrationService, ['findMigrationScripts']);
});

    afterEach(() => {
        spy.restore();
        scripts = [];
        removedTimestamps = [];
    });

    /**
     * Helper function to create a mock MigrationScript with a runnable script.
     * Avoids file I/O by directly configuring the script property.
     * Also overrides init() to prevent file loading attempts.
     */
    function createMockMigrationScript(timestamp: number, name: string = `V${timestamp}_mig.ts`): MigrationScript<IDB> {
        const script = new MigrationScript<IDB>(name, `/fake/path/${name}`, timestamp);
        script.script = {
            async up(): Promise<string> {
                return `Migration ${timestamp} executed`;
            },
            async down(): Promise<string> {
                return `Migration ${timestamp} rolled back`;
            }
        } as IRunnableScript<IDB>;
        // Override init() to prevent file loading - script is already configured
        script.init = async () => {};
        return script;
    }

    describe('migrateTo()', () => {

        /**
         * Test: migrateTo executes migrations up to target version
         * Validates that only migrations with timestamp <= targetVersion are executed
         */
        it('should execute migrations up to target version', async () => {
            // Configure the migration scanner to return all 5 migrations
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
                createMockMigrationScript(4),
                createMockMigrationScript(5),
            ];

            // No migrations executed yet in the database
            scripts = [];

            // Stub the scanner to return all migrations as available (pending) since none are in database
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: [],
                pending: allMigrations,
                ignored: [],
                executed: []
            });

            // Migrate up to version 3
            const result = await executor.up(3);

            // Verify only migrations 1, 2, 3 were executed
            expect(result.executed.length).to.equal(3);
            expect(result.executed[0].timestamp).to.equal(1);
            expect(result.executed[1].timestamp).to.equal(2);
            expect(result.executed[2].timestamp).to.equal(3);
            expect(result.success).to.be.true;

            // Verify save was called 3 times
            expect(handler.schemaVersion.migrationRecords.save).to.have.been.called.exactly(3);

            scanStub.restore();
        });

        /**
         * Test: migrateTo returns early when target already reached
         * Validates that when database is already at or beyond target version,
         * no migrations are executed
         */
        it('should return early when already at target version', async () => {
            // All 3 migrations are available on disk
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
            ];

            // Simulate migrations 1, 2, 3 already executed in the database
            scripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3)
            ];

            // Stub the scanner - no pending since all are already migrated
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: scripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Try to migrate to version 2 (already beyond it)
            const result = await executor.up(2);

            // Verify no migrations were executed
            expect(result.executed.length).to.equal(0);
            expect(result.success).to.be.true;
            expect(handler.schemaVersion.migrationRecords.save).to.have.not.been.called;

            scanStub.restore();
        });

        /**
         * Test: migrateTo executes remaining migrations to reach target
         * Validates that when some migrations are already executed,
         * only the remaining ones up to target are executed
         */
        it('should execute only remaining migrations to reach target', async () => {
            // All 5 migrations are available on disk
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
                createMockMigrationScript(4),
                createMockMigrationScript(5),
            ];

            // Simulate migrations 1, 2 already executed in the database
            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            scripts = migratedScripts;

            // Stub the scanner - migrations 3, 4, 5 are pending
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: allMigrations.slice(2),
                ignored: [],
                executed: []
            });

            // Migrate to version 4
            const result = await executor.up(4);

            // Verify only migrations 3, 4 were executed
            expect(result.executed.length).to.equal(2);
            expect(result.executed[0].timestamp).to.equal(3);
            expect(result.executed[1].timestamp).to.equal(4);
            expect(result.success).to.be.true;

            scanStub.restore();
        });

        /**
         * Test: migrateTo creates backup when rollback strategy requires it
         * Validates backup is created before executing migrations
         */
        it('should create backup before executing migrations', async () => {
            // One migration available on disk
            const allMigrations = [createMockMigrationScript(1)];

            // No migrations executed yet
            scripts = [];

            // Stub the scanner
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: [],
                pending: allMigrations,
                ignored: [],
                executed: []
            });

            await executor.up(1);

            // Verify backup was created
            expect(executor.backupService.backup).to.have.been.called.once;

            scanStub.restore();
        });

        /**
         * Test: migrateTo validates migrations when validateBeforeRun is true
         */
        it('should call validateMigrations when validateBeforeRun is true', async () => {
            // Stub validateMigrations to track calls
            const validateStub = sinon.stub((executor as any).validationOrchestrator, 'validateMigrations').resolves();

            const allMigrations = [createMockMigrationScript(1)];
            scripts = [];

            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: [],
                pending: allMigrations,
                ignored: [],
                executed: []
            });

            // Enable validation
            cfg.validateBeforeRun = true;

            await executor.up(1);

            // Verify validation was called
            expect(validateStub.calledOnce).to.be.true;

            scanStub.restore();
            validateStub.restore();
            cfg.validateBeforeRun = false; // Reset
        });

        /**
         * Test: migrateTo validates file integrity when validateMigratedFiles is true
         */
        it('should call validateMigratedFileIntegrity when validateMigratedFiles is true', async () => {
            // Stub validateMigratedFileIntegrity to track calls
            const integrityStub = sinon.stub((executor as any).validationOrchestrator, 'validateMigratedFileIntegrity').resolves();

            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];
            const migratedScripts = [createMockMigrationScript(1)];
            scripts = migratedScripts;

            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [allMigrations[1]],
                ignored: [],
                executed: []
            });

            // Enable file integrity validation
            cfg.validateMigratedFiles = true;

            await executor.up(2);

            // Verify validation was called
            expect(integrityStub.calledOnce).to.be.true;

            scanStub.restore();
            integrityStub.restore();
            cfg.validateMigratedFiles = false; // Reset
        });

        /**
         * Test: migrateTo handles errors and calls handleRollback
         */
        it('should handle migration failure and call rollback', async () => {
            const allMigrations = [createMockMigrationScript(1)];
            scripts = [];

            // Create migration that throws error
            const failingMigration = createMockMigrationScript(1);
            failingMigration.script = {
                async up(): Promise<string> {
                    throw new Error('Migration failed intentionally');
                }
            } as IRunnableScript<IDB>;

            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: [failingMigration],
                migrated: [],
                pending: [failingMigration],
                ignored: [],
                executed: []
            });

            // Stub rollbackService.rollback to prevent actual rollback
            const rollbackStub = sinon.stub(executor.rollbackService, 'rollback').resolves();

            try {
                await executor.up(1);
                expect.fail('Should have thrown error');
            } catch (error: any) {
                // Verify error is thrown
                expect(error.message).to.include('Migration failed intentionally');

                // Verify rollback was called
                expect(rollbackStub.calledOnce).to.be.true;
            }

            scanStub.restore();
            rollbackStub.restore();
        });

        /**
         * Test: migrateTo with hooks object but no hook methods defined
         * This covers optional chaining branches where hooks exist but methods don't
         */
        it('should handle hooks object with undefined methods', async () => {
            // Create executor with empty hooks object
            const executorWithEmptyHooks = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                hooks: {} // Hooks object exists but no methods defined
, config: cfg });

            const allMigrations = [createMockMigrationScript(1)];
            scripts = [];

            const scanStub = sinon.stub(executorWithEmptyHooks.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: [],
                pending: allMigrations,
                ignored: [],
                executed: []
            });

            const result = await executorWithEmptyHooks.up(1);

            // Verify execution succeeded despite undefined hook methods
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(1);

            scanStub.restore();
        });

        /**
         * Test: migrateTo early return when already at target version
         * Covers the branch where pendingUpToTarget.length === 0
         */
        it('should handle early return when already at or beyond target version', async () => {
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];
            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];
            scripts = migratedScripts;

            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Try to migrate to version 1, but already at version 2
            const result = await executor.up(1);

            // Verify early return
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(0);
            expect(result.migrated.length).to.equal(2);

            scanStub.restore();
        });

        /**
         * Test: migrateTo when backup path is undefined
         * Covers the branch where backupPath is falsy
         */
        it('should handle undefined backup path', async () => {
            const allMigrations = [createMockMigrationScript(1)];
            scripts = [];

            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: [],
                pending: allMigrations,
                ignored: [],
                executed: []
            });

            // Stub backup to return undefined
            const backupStub = sinon.stub(executor.backupService, 'backup').resolves(undefined);

            const result = await executor.up(1);

            // Verify execution succeeded even with undefined backup path
            expect(result.success).to.be.true;

            scanStub.restore();
            backupStub.restore();
        });

        /**
         * Test: migrateTo with all hooks defined and backup path exists
         * Covers all optional chaining branches in the success path
         */
        it('should execute all hooks when fully configured', async () => {
            const onBeforeBackupSpy = sinon.spy();
            const onAfterBackupSpy = sinon.spy();
            const onStartSpy = sinon.spy();
            const onCompleteSpy = sinon.spy();

            const executorWithAllHooks = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                hooks: {
                    onBeforeBackup: onBeforeBackupSpy,
                    onAfterBackup: onAfterBackupSpy,
                    onStart: onStartSpy,
                    onComplete: onCompleteSpy
                }
, config: cfg });

            const allMigrations = [createMockMigrationScript(1)];
            scripts = [];

            const scanStub = sinon.stub(executorWithAllHooks.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: [],
                pending: allMigrations,
                ignored: [],
                executed: []
            });

            // Ensure backup returns a valid path
            const backupStub = sinon.stub(executorWithAllHooks.backupService, 'backup').resolves('/fake/backup.sql');

            const result = await executorWithAllHooks.up(1);

            // Verify all hooks were called
            expect(onBeforeBackupSpy.calledOnce).to.be.true;
            expect(onAfterBackupSpy.calledOnce).to.be.true;
            expect(onAfterBackupSpy.firstCall.args[0]).to.equal('/fake/backup.sql');
            expect(onStartSpy.calledOnce).to.be.true;
            expect(onCompleteSpy.calledOnce).to.be.true;

            // Verify result
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(1);

            scanStub.restore();
            backupStub.restore();
        });

        /**
         * Test: migrateTo with all hooks defined in early return path
         * Covers optional chaining branches in the early return case
         */
        it('should call onStart and onComplete hooks in early return path', async () => {
            const onStartSpy = sinon.spy();
            const onCompleteSpy = sinon.spy();

            const executorWithHooks = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                hooks: {
                    onStart: onStartSpy,
                    onComplete: onCompleteSpy
                }
, config: cfg });

            const allMigrations = [createMockMigrationScript(1)];
            const migratedScripts = [createMockMigrationScript(1)];
            scripts = migratedScripts;

            const scanStub = sinon.stub(executorWithHooks.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [], // Already at target
                ignored: [],
                executed: []
            });

            // Migrate to version 1, but already at version 1 (early return)
            const result = await executorWithHooks.up(1);

            // Verify hooks were called in early return path
            expect(onStartSpy.calledOnce).to.be.true;
            expect(onStartSpy.firstCall.args[0]).to.equal(1); // total
            expect(onStartSpy.firstCall.args[1]).to.equal(0); // pending
            expect(onCompleteSpy.calledOnce).to.be.true;

            // Verify early return
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(0);

            scanStub.restore();
        });
    });

    describe('downTo()', () => {

        /**
         * Test: downTo rolls back migrations newer than target version
         * Validates that migrations with timestamp > targetVersion are rolled back
         * in reverse chronological order
         */
        it('should roll back migrations newer than target version', async () => {
            // All 5 migrations available on disk
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
                createMockMigrationScript(4),
                createMockMigrationScript(5),
            ];

            // Simulate all 5 migrations already executed in the database
            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
                createMockMigrationScript(4),
                createMockMigrationScript(5)
            ];

            scripts = migratedScripts;

            // Stub the scanner - all migrations are migrated
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Roll back to version 2
            const result = await executor.down(2);

            // Verify migrations 5, 4, 3 were rolled back (in reverse order)
            expect(result.executed.length).to.equal(3);
            expect(result.executed[0].timestamp).to.equal(5); // Rolled back first
            expect(result.executed[1].timestamp).to.equal(4);
            expect(result.executed[2].timestamp).to.equal(3);
            expect(result.success).to.be.true;

            // Verify remove was called for versions 5, 4, 3
            expect(removedTimestamps).to.deep.equal([5, 4, 3]);
            expect(handler.schemaVersion.migrationRecords.remove).to.have.been.called.exactly(3);

            scanStub.restore();
        });

        /**
         * Test: downTo returns early when already at or below target
         * Validates that when database is already at or below target version,
         * no rollback is performed
         */
        it('should return early when already at target version', async () => {
            // All 2 migrations available on disk
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
            ];

            // Simulate only migrations 1, 2 executed in database
            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            scripts = migratedScripts;

            // Stub the scanner - no pending rollbacks
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Try to roll back to version 2 (already at it)
            const result = await executor.down(2);

            // Verify no rollback was performed
            expect(result.executed.length).to.equal(0);
            expect(result.success).to.be.true;
            expect(handler.schemaVersion.migrationRecords.remove).to.have.not.been.called;

            scanStub.restore();
        });

        /**
         * Test: downTo rolls back to version 0 (complete rollback)
         * Validates that rolling back to version 0 removes all migrations
         */
        it('should roll back all migrations when target is 0', async () => {
            // All 3 migrations available on disk
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
            ];

            // Simulate all 3 migrations already executed in database
            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3)
            ];

            scripts = migratedScripts;

            // Stub the scanner - all migrations are migrated
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Roll back to version 0 (remove everything)
            const result = await executor.down(0);

            // Verify all 3 migrations were rolled back
            expect(result.executed.length).to.equal(3);
            expect(result.executed[0].timestamp).to.equal(3);
            expect(result.executed[1].timestamp).to.equal(2);
            expect(result.executed[2].timestamp).to.equal(1);
            expect(result.success).to.be.true;

            // Verify remove was called for all versions
            expect(removedTimestamps).to.deep.equal([3, 2, 1]);

            scanStub.restore();
        });

        /**
         * Test: downTo throws error when migration missing down() method
         * Validates that rollback fails gracefully when a migration doesn't
         * have a down() method implemented
         */
        it('should throw error when migration missing down() method', async () => {
            // Create migration WITHOUT down() method
            const migrationWithoutDown = new MigrationScript<IDB>('V1_mig.ts', '/fake/path/V1_mig.ts', 1);
            migrationWithoutDown.script = {
                async up(): Promise<string> {
                    return 'Migration executed';
                }
            } as IRunnableScript<IDB>;
            // Override init to prevent file loading
            migrationWithoutDown.init = async () => {};

            // Simulate migration 1 executed in database
            scripts = [migrationWithoutDown];

            // Stub the scanner - migration is migrated (needs rollback)
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: [migrationWithoutDown],
                migrated: [migrationWithoutDown],
                pending: [],
                ignored: [],
                executed: []
            });

            // Try to roll back - should fail
            try {
                await executor.down(0);
                expect.fail('Should have thrown error for missing down() method');
            } catch (error: any) {
                expect(error.message).to.include('does not have a down() method');
                expect(error.message).to.include('V1_mig.ts');
            }

            // Verify remove was NOT called since rollback failed
            expect(handler.schemaVersion.migrationRecords.remove).to.have.not.been.called;

            scanStub.restore();
        });

        /**
         * Test: downTo removes from schema_version in correct order
         * Validates that schema_version records are removed in the same order
         * as the down() methods are executed (reverse chronological)
         */
        it('should remove from schema_version in reverse chronological order', async () => {
            // All 4 migrations available on disk
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
                createMockMigrationScript(4),
            ];

            // Simulate all 4 migrations executed in database
            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
                createMockMigrationScript(4)
            ];

            scripts = migratedScripts;

            // Stub the scanner - all are migrated
            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Roll back to version 1
            await executor.down(1);

            // Verify removal order: 4, 3, 2 (reverse chronological)
            expect(removedTimestamps).to.deep.equal([4, 3, 2]);

            scanStub.restore();
        });
    });

    describe('migrateTo() and downTo() together', () => {

        /**
         * Test: Version control round-trip (up then down)
         * Validates that migrating to a version and then rolling back
         * leaves the database in the correct state
         */
        it('should handle version control round-trip correctly', async () => {
            // All 5 migrations available on disk
            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2),
                createMockMigrationScript(3),
                createMockMigrationScript(4),
                createMockMigrationScript(5),
            ];

            scripts = [];

            // Stub scanner for initial migrateTo call - no migrations executed yet
            let scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: [],
                pending: allMigrations,
                ignored: [],
                executed: []
            });

            // Step 1: Migrate to version 3
            const upResult = await executor.up(3);
            expect(upResult.executed.length).to.equal(3);
            expect(upResult.success).to.be.true;

            // Restore the first stub
            scanStub.restore();

            // Simulate that migrations 1, 2, 3 are now in schema_version
            const migratedScripts = upResult.executed.map(s => {
                const script = new MigrationScript<IDB>(s.name, `/fake/path/${s.name}`, s.timestamp);
                script.script = {
                    async up(): Promise<string> {
                        return `Migration ${s.timestamp} executed`;
                    },
                    async down(): Promise<string> {
                        return `Migration ${s.timestamp} rolled back`;
                    }
                } as IRunnableScript<IDB>;
                script.init = async () => {};
                return script;
            });

            scripts = migratedScripts;

            // Stub scanner for downTo call - migrations 1, 2, 3 are migrated, 4, 5 pending
            scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: allMigrations.slice(3),
                ignored: [],
                executed: []
            });

            // Step 2: Roll back to version 1
            const downResult = await executor.down(1);
            expect(downResult.executed.length).to.equal(2); // Rolled back 3, 2
            expect(downResult.success).to.be.true;

            // Verify removed versions 3, 2
            expect(removedTimestamps).to.deep.equal([3, 2]);

            scanStub.restore();
        });
    });

    describe('downTo() - Validation and Hooks', () => {

        /**
         * Test: downTo calls validation when config.validateBeforeRun is true
         * Validates that the validation method is invoked before rollback
         */
        it('should call validateMigrations when validateBeforeRun is true', async () => {
            // Stub validateAll to track calls without actually validating
            const validateStub = sinon.stub(executor.validationService, 'validateAll').resolves([]);

            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            scripts = migratedScripts;

            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Enable validation temporarily
            cfg.validateBeforeRun = true;

            // Roll back to version 0
            const result = await executor.down(0);

            // Verify validation was called
            expect(validateStub.calledOnce).to.be.true;
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(2);

            scanStub.restore();
            validateStub.restore();
            cfg.validateBeforeRun = false; // Reset
        });

        /**
         * Test: downTo calls file integrity validation when config.validateMigratedFiles is true
         * Validates that the integrity check method is invoked before rollback
         */
        it('should call validateMigratedFileIntegrity when validateMigratedFiles is true', async () => {
            // Stub validateMigratedFileIntegrity to track calls without actually validating
            const integrityStub = sinon.stub(executor.validationService, 'validateMigratedFileIntegrity').resolves([]);

            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            scripts = migratedScripts;

            const scanStub = sinon.stub(executor.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Enable file integrity validation temporarily
            cfg.validateMigratedFiles = true;

            // Roll back to version 0
            const result = await executor.down(0);

            // Verify validation was called
            expect(integrityStub.calledOnce).to.be.true;
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(2);

            scanStub.restore();
            integrityStub.restore();
            cfg.validateMigratedFiles = false; // Reset
        });

        /**
         * Test: downTo calls onStart hook with correct parameters
         */
        it('should call onStart hook when rolling back', async () => {
            const onStartSpy = sinon.spy();
            const executorWithHooks = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                hooks: {
                    onStart: onStartSpy
                }
, config: cfg });

            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            scripts = migratedScripts;

            const scanStub = sinon.stub(executorWithHooks.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            await executorWithHooks.down(0);

            // Verify onStart was called with (total=2, toRollback=2)
            expect(onStartSpy.calledOnce).to.be.true;
            expect(onStartSpy.firstCall.args[0]).to.equal(2); // total scripts
            expect(onStartSpy.firstCall.args[1]).to.equal(2); // scripts to rollback

            scanStub.restore();
        });

        /**
         * Test: downTo calls onBeforeMigrate and onAfterMigrate hooks for each migration
         */
        it('should call onBeforeMigrate and onAfterMigrate hooks for each rollback', async () => {
            const onBeforeMigrateSpy = sinon.spy();
            const onAfterMigrateSpy = sinon.spy();
            const executorWithHooks = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                hooks: {
                    onBeforeMigrate: onBeforeMigrateSpy,
                    onAfterMigrate: onAfterMigrateSpy
                }
, config: cfg });

            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            scripts = migratedScripts;

            const scanStub = sinon.stub(executorWithHooks.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            await executorWithHooks.down(0);

            // Verify hooks were called for each migration (2 migrations rolled back)
            expect(onBeforeMigrateSpy.callCount).to.equal(2);
            expect(onAfterMigrateSpy.callCount).to.equal(2);

            // Verify order: should rollback 2 first, then 1 (reverse chronological)
            expect(onBeforeMigrateSpy.firstCall.args[0].timestamp).to.equal(2);
            expect(onBeforeMigrateSpy.secondCall.args[0].timestamp).to.equal(1);

            scanStub.restore();
        });

        /**
         * Test: downTo calls onComplete hook after successful rollback
         */
        it('should call onComplete hook after successful rollback', async () => {
            const onCompleteSpy = sinon.spy();
            const executorWithHooks = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                hooks: {
                    onComplete: onCompleteSpy
                }
, config: cfg });

            const allMigrations = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            const migratedScripts = [
                createMockMigrationScript(1),
                createMockMigrationScript(2)
            ];

            scripts = migratedScripts;

            const scanStub = sinon.stub(executorWithHooks.migrationScanner, 'scan');
            scanStub.resolves({
                all: allMigrations,
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            await executorWithHooks.down(0);

            // Verify onComplete was called
            expect(onCompleteSpy.calledOnce).to.be.true;
            const result = onCompleteSpy.firstCall.args[0];
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(2);

            scanStub.restore();
        });

        /**
         * Test: downTo calls onError hook when rollback fails
         */
        it('should call onError hook when rollback fails', async () => {
            const onErrorSpy = sinon.spy();
            const executorWithHooks = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                hooks: {
                    onError: onErrorSpy
                }
, config: cfg });

            // Create migration without down() method
            const migrationWithoutDown = new MigrationScript<IDB>('V1_mig.ts', '/fake/path/V1_mig.ts', 1);
            migrationWithoutDown.script = {
                async up(): Promise<string> {
                    return 'Migration 1 executed';
                }
                // NO down() method
            } as IRunnableScript<IDB>;
            migrationWithoutDown.init = async () => {};

            const migratedScripts = [migrationWithoutDown];
            scripts = migratedScripts;

            const scanStub = sinon.stub(executorWithHooks.migrationScanner, 'scan');
            scanStub.resolves({
                all: [migrationWithoutDown],
                migrated: migratedScripts,
                pending: [],
                ignored: [],
                executed: []
            });

            // Attempt rollback - should fail
            try {
                await executorWithHooks.down(0);
                expect.fail('Should have thrown error for missing down() method');
            } catch (error: any) {
                // Verify onError was called
                expect(onErrorSpy.calledOnce).to.be.true;
                const errorArg = onErrorSpy.firstCall.args[0];
                expect(errorArg.message).to.include('does not have a down() method');
            }

            scanStub.restore();
        });
    });
});
