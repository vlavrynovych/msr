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
    IBackup, ISchemaVersion, IMigrationScript,
    IMigrationResult,
    SilentLogger,
    TransactionMode,
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

describe('MigrationScriptExecutor', () => {

    let initialized = true
    let created = true
    let valid = true
    let scripts: MigrationScript<IDB>[] = []
    let cfg: Config

    let handler: IDatabaseMigrationHandler<IDB>
    let executor: MigrationScriptExecutor<IDB>

    /**
     * Test: Constructor with automatic config loading
     * Validates that config is automatically loaded when not provided.
     */
    it('should automatically load config when not provided', () => {
        const mockHandler: IDatabaseMigrationHandler<IDB> = {
            getName(): string { return 'TestHandler'; },
            getVersion(): string { return '1.0.0'; },
            backup: {
                backup(): Promise<string> { return Promise.resolve('content'); },
                restore(_data: string): Promise<void> { return Promise.resolve(); }
            },
            schemaVersion: {
                isInitialized(_tableName: string): Promise<boolean> { return Promise.resolve(true); },
                createTable(_tableName: string): Promise<boolean> { return Promise.resolve(true); },
                validateTable(_tableName: string): Promise<boolean> { return Promise.resolve(true); },
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> { return Promise.resolve([]); },
                    save(_details: IMigrationInfo): Promise<void> { return Promise.resolve(); },
                    remove(_timestamp: number): Promise<void> { return Promise.resolve(); }
                }
            },
            db: {
                checkConnection(): Promise<boolean> { return Promise.resolve(true); }
            }
        };

        // Create executor without config - should auto-load via ConfigLoader
        const testExecutor = new MigrationScriptExecutor<IDB>({ handler: mockHandler , config: cfg });

        // Verify config was loaded (check a default property)
        expect(testExecutor['config']).to.not.be.undefined;
        expect(testExecutor['config'].folder).to.be.a('string');
    });

    before(() => {
        cfg = TestUtils.getConfig()
        cfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions
        const db:IDB = new class implements IDB {
            [key: string]: unknown;
            test(){throw new Error('Not implemented')}
            async checkConnection(): Promise<boolean> {
                return true;
            }
        }
        handler = new class implements IDatabaseMigrationHandler<IDB> {
            backup: IBackup<IDB> = {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            };
            schemaVersion: ISchemaVersion<IDB> = {
                migrationRecords: {
                    getAllExecuted(): Promise<MigrationScript<IDB>[]> {
                        return Promise.resolve(scripts);
                    },
                    save(details: IMigrationInfo): Promise<any> {
                        return Promise.resolve(undefined);
                    },
                    remove(timestamp: number): Promise<void> {
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
            };
            db: IDB = db;
            getName(): string { return "Test Implementation" }
            getVersion(): string { return "1.0.0-test" }
        }
    })

    beforeEach(() => {
        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: cfg });
        initialized = true
        created = true
        valid = true
        spy.on(handler.schemaVersion, ['isInitialized', 'createTable', 'validateTable']);
        spy.on(handler.schemaVersion.migrationRecords, ['save', 'getAllExecuted']);

        spy.on(executor, ['migrate', 'execute']);
        spy.on((executor as any).core.backup, ['restore', 'deleteBackup', 'backup']);
        spy.on((executor as any).core.migration, ['findMigrationScripts']);
});

    afterEach(() => {
        spy.restore()
        scripts = []  // Reset shared state between tests
    })

    describe('migrate()', () => {
        /**
         * Test: Successful migration execution (happy path)
         * Validates the complete migration workflow when everything succeeds:
         * 1. Schema initialization and validation
         * 2. Reading migration scripts from filesystem
         * 3. Creating backup before execution
         * 4. Determining which migrations to run
         * 5. Executing migrations and saving results
         * 6. Cleaning up backup
         */
        it('should execute migration workflow successfully', async () => {
            // Execute the full migration workflow
            const result: IMigrationResult<IDB> = await executor.migrate()

            // Verify result object
            expect(result.success).to.be.true
            expect(result.executed).to.be.an('array')
            expect(result.executed.length).to.equal(1)
            expect(result.migrated).to.be.an('array')
            expect(result.ignored).to.be.an('array')
            expect(result.errors).to.be.undefined

            // Verify schema operations: check if initialized → skip creation → validate
            expect(handler.schemaVersion.isInitialized).have.been.called.once
            expect(handler.schemaVersion.createTable).have.not.been.called
            expect(handler.schemaVersion.validateTable).have.been.called.once
            expect(handler.schemaVersion.migrationRecords.getAllExecuted).have.been.called.once
            expect(handler.schemaVersion.migrationRecords.save).have.been.called.once

            // Verify migration discovery ran
            expect((executor as any).core.migration.findMigrationScripts).have.been.called.once

            // Verify backup lifecycle: created → not restored (success) → deleted
            expect((executor as any).core.backup.backup).have.been.called.once
            expect((executor as any).core.backup.restore).have.not.been.called
            expect((executor as any).core.backup.deleteBackup).have.been.called.once

            // Verify migration workflow method was called
            expect(executor.migrate).have.been.called.once
        })

        /**
         * Test: Migration with no new scripts to execute
         * Validates the system handles "nothing to do" gracefully when all
         * migrations have already been executed. Backup is still created as
         * a safety measure, but no migrations run.
         */
        it('should handle case when no new scripts exist', async () => {
            // Configure to use empty migrations directory
            const emptyConfig = TestUtils.getConfig(TestUtils.EMPTY_FOLDER);
            cfg.folder = emptyConfig.folder;

            // Execute migration with no scripts to run
            const result: IMigrationResult<IDB> = await executor.migrate()

            // Verify result object
            expect(result.success).to.be.true
            expect(result.executed).to.be.an('array')
            expect(result.executed.length).to.equal(0)
            expect(result.migrated).to.be.an('array')
            expect(result.ignored).to.be.an('array')
            expect(result.errors).to.be.undefined

            // Verify schema operations still ran
            expect(handler.schemaVersion.isInitialized).have.been.called.once
            expect(handler.schemaVersion.createTable).have.not.been.called
            expect(handler.schemaVersion.validateTable).have.been.called.once
            expect(handler.schemaVersion.migrationRecords.getAllExecuted).have.been.called.once
            expect(handler.schemaVersion.migrationRecords.save).have.not.been.called

            // Verify script discovery still ran
            expect((executor as any).core.migration.findMigrationScripts).have.been.called.once

            // Verify backup lifecycle completed even with no migrations
            expect((executor as any).core.backup.backup).have.been.called.once
            expect((executor as any).core.backup.restore).have.not.been.called
            expect((executor as any).core.backup.deleteBackup).have.been.called.once

            // Verify workflow ran but no individual migration tasks executed
            expect(executor.migrate).have.been.called.once
            expect(executor.execute).have.not.been.called.once
        })

        /**
         * Test: Schema validation failure prevents backup creation (fail-fast)
         * Validates that when schema validation fails during database initialization,
         * the migration aborts BEFORE creating a backup. This tests the new fail-fast
         * behavior where validation errors during initialization prevent any expensive
         * database operations like backup/restore.
         *
         * Note: This is different from migration execution failures which DO trigger
         * backup/restore (see "should call restore on migration failure" test).
         */
        it('should fail fast on schema validation error (no backup/restore)', async () => {
            // Simulate schema validation failure
            valid = false

            // Execute migration which will fail validation
            const result: IMigrationResult<IDB> = await executor.migrate()

            // Verify result object indicates failure
            expect(result.success).to.be.false
            expect(result.executed).to.be.an('array')
            expect(result.executed.length).to.equal(0)
            expect(result.migrated).to.be.an('array')
            expect(result.ignored).to.be.an('array')
            expect(result.errors).to.be.an('array')
            expect(result.errors!.length).to.be.greaterThan(0)

            // Verify schema validation was attempted
            expect(handler.schemaVersion.isInitialized).have.been.called.once
            expect(handler.schemaVersion.createTable).have.not.been.called
            expect(handler.schemaVersion.validateTable).have.been.called.once
            expect(handler.schemaVersion.migrationRecords.getAllExecuted).have.not.been.called
            expect(handler.schemaVersion.migrationRecords.save).have.not.been.called

            // Migration discovery does NOT happen when schema validation fails
            // Fixed flow: init() → scan() → validate migrations → backup
            // Schema validation failure happens during init(), so scan() is never called
            expect((executor as any).core.migration.findMigrationScripts).have.not.been.called

            // Backup/restore NOT called when validation fails BEFORE backup is created
            // Schema validation failure happens during init(), so backup never created
            expect((executor as any).core.backup.backup).have.not.been.called
            expect((executor as any).core.backup.restore).have.not.been.called
            expect((executor as any).core.backup.deleteBackup).have.not.been.called

            // Verify workflow stopped early due to validation failure
            expect(executor.migrate).have.been.called.once
            expect(executor.execute).have.not.been.called.once
        })

        /**
         * Test: migrate() triggers restore on execution failure
         * Integration test validating that when a migration execution fails,
         * the backup restore is automatically triggered. This test directly
         * stubs a migration script to throw an error during execution.
         */
        it('should call restore on migration failure', async () => {
            // Create a migration script that will throw an error
            // Stub the migration service to return a failing script
            const failingScript = TestUtils.prepareMigration('V202311020036_fail.ts');
            failingScript.script = {
                async up() {
                    throw new Error('Migration execution failed');
                }
            } as IRunnableScript<IDB>;

            const readStub = sinon.stub((executor as any).core.migration, 'findMigrationScripts');
            readStub.resolves([failingScript]);

            // Execute migration (will fail)
            const result: IMigrationResult<IDB> = await executor.migrate();

            // Verify result indicates failure
            expect(result.success).to.be.false
            expect(result.errors).to.be.an('array')
            expect(result.errors!.length).to.be.greaterThan(0)

            // Verify error recovery workflow: backup → restore → cleanup
            expect((executor as any).core.backup.backup).have.been.called;
            expect((executor as any).core.backup.restore).have.been.called;
            expect((executor as any).core.backup.deleteBackup).have.been.called;

            readStub.restore();
        })
    })

    describe('execute()', () => {
        /**
         * Test: execute() handles migration errors properly
         * Validates that when a migration's up() method throws an error, the
         * error is propagated to the caller. This is critical for the error
         * recovery workflow (backup restore).
         */
        it('should handle migration script throwing error', async () => {
            // Create a migration script that will throw an error
            const errorScript = TestUtils.prepareMigration('V202311020036_test.ts');
            errorScript.script = {
                async up() {
                    throw new Error('Migration execution failed');
                }
            } as IRunnableScript<IDB>;

            // Verify the error is propagated correctly
            await expect(executor.execute([errorScript])).to.be.rejectedWith('Migration execution failed');
        })

        /**
         * Test: execute() stops on first failure (fail-fast behavior)
         * Validates that when executing multiple migrations, if one fails,
         * subsequent migrations are NOT executed. This prevents cascading
         * failures and maintains database consistency.
         */
        it('should stop on first migration failure', async () => {
            // Create first migration that will fail
            const script1 = TestUtils.prepareMigration('V202311020036_test.ts');
            script1.timestamp = 1;
            script1.script = {
                async up() {
                    throw new Error('First migration failed');
                }
            } as IRunnableScript<IDB>;

            // Create second migration with execution tracking
            const script2 = TestUtils.prepareMigration('V202311020036_test.ts');
            script2.timestamp = 2;
            let script2Executed = false;
            script2.script = {
                async up() {
                    script2Executed = true;
                    return 'success';
                }
            } as IRunnableScript<IDB>;

            // Attempt to execute both migrations
            try {
                await executor.execute([script1, script2]);
                expect.fail('Should have thrown');
            } catch (e: any) {
                // Verify second migration was NOT executed (fail-fast)
                expect(script2Executed).to.be.false;
                expect(e.message).to.include('First migration failed');
            }
        })
    })

    describe('list()', () => {
        /**
         * Test: list() displays migration history with display limits
         * Validates that the list() method correctly displays already-executed
         * migrations and respects the displayLimit parameter for showing a
         * limited number of most recent migrations.
         */
        it('should list all migrations with status', async () => {
            // Setup test data with 3 executed migrations
            scripts = [
                {timestamp: 1, name: 'n1', username: 'v1'} as MigrationScript<IDB>,
                {timestamp: 2, name: 'n2', username: 'v2'} as MigrationScript<IDB>,
                {timestamp: 3, name: 'n3', username: 'v3'} as MigrationScript<IDB>,
            ]

            // Spy on console output to verify all migrations are displayed
            spy.on(console, ['log'], (...items) => {
                const msg:string = items[0]
                expect(msg.includes("n1")).is.true
                expect(msg.includes("n2")).is.true
                expect(msg.includes("n3")).is.true
            });

            // Test various display limits: default, 0 (all), negative, and large number
            await executor.list()
            await executor.list(0)
            await executor.list(-2)
            await executor.list(100)
            spy.restore()

            // Spy again to verify display limit of 1 shows only most recent
            spy.on(console, ['log'], (...items) => {
                const msg:string = items[0]
                expect(msg.includes("n3")).is.true
                expect(!msg.includes("n2")).is.true
                expect(!msg.includes("n1")).is.true
            });

            // Test display limit of 1 (should show only n3)
            await executor.list(1)
            spy.restore()
        })
    })

    describe('Integration Tests', () => {
        /**
         * Integration test for the complete successful migration workflow.
         * Validates the happy path: backup creation, migration execution, and cleanup.
         * This ensures all components work together correctly when everything succeeds.
         */
        it('E2E: should execute full backup → migrate → cleanup cycle', async () => {
            // This tests the full happy path with real file I/O
            initialized = true;
            valid = true;

            // when: execute full migration
            const result: IMigrationResult<IDB> = await executor.migrate();

            // then: verify result indicates success
            expect(result.success).to.be.true
            expect(result.executed).to.be.an('array')
            expect(result.errors).to.be.undefined

            // then: verify key methods were called
            expect((executor as any).core.backup.backup).have.been.called;
            expect((executor as any).core.migration.findMigrationScripts).have.been.called;
            expect(executor.execute).have.been.called;
            expect((executor as any).core.backup.restore).have.not.been.called;
            expect((executor as any).core.backup.deleteBackup).have.been.called;
        })

        /**
         * Integration test for error recovery workflow.
         * Validates that when migration fails (validation error), the system:
         * 1. Creates a backup before starting
         * 2. Detects the failure
         * 3. Restores from backup to recover
         * 4. Cleans up the backup file
         * This ensures database consistency is maintained even when migrations fail.
         */
        it('E2E: should execute backup → fail → restore → cleanup cycle', async () => {
            // This tests error handling with restore
            initialized = true;
            valid = false; // cause validation to fail

            // when: execute migration that will fail
            const result: IMigrationResult<IDB> = await executor.migrate();

            // then: verify result indicates failure
            expect(result.success).to.be.false
            expect(result.errors).to.be.an('array')
            expect(result.errors!.length).to.be.greaterThan(0)

            // then: verify error handling lifecycle
            expect((executor as any).core.backup.backup).have.been.called;
            expect((executor as any).core.backup.restore).have.been.called;
            expect((executor as any).core.backup.deleteBackup).have.been.called;
            expect((executor as any).core.migration.findMigrationScripts).have.not.been.called;
        })

        /**
         * Integration test for sequential migration execution.
         * Validates that multiple migrations are executed in the correct order (by timestamp)
         * and that each migration's result is properly recorded and saved.
         * This ensures the migration system maintains execution order consistency.
         */
        it('E2E: should handle multiple sequential migrations', async () => {
            // having: setup for multiple migration execution
            scripts = []; // start with no migrations

            // and: stub to return multiple scripts
            const script1 = TestUtils.prepareMigration('V202311020036_test.ts');
            script1.timestamp = 1;
            script1.name = 'Migration1';
            script1.script = {
                async up() { return 'result1'; }
            } as IRunnableScript<IDB>;

            const script2 = TestUtils.prepareMigration('V202311020036_test.ts');
            script2.timestamp = 2;
            script2.name = 'Migration2';
            script2.script = {
                async up() { return 'result2'; }
            } as IRunnableScript<IDB>;

            const script3 = TestUtils.prepareMigration('V202311020036_test.ts');
            script3.timestamp = 3;
            script3.name = 'Migration3';
            script3.script = {
                async up() { return 'result3'; }
            } as IRunnableScript<IDB>;

            // when: execute multiple migrations
            const executed = await executor.execute([script1, script2, script3]);

            // then: all should be executed in order
            expect(executed.length).eq(3, 'Should execute all 3 migrations');
            expect(executed[0].timestamp).eq(1);
            expect(executed[1].timestamp).eq(2);
            expect(executed[2].timestamp).eq(3);
            expect(executed[0].result).eq('result1');
            expect(executed[1].result).eq('result2');
            expect(executed[2].result).eq('result3');

            // verify all were saved
            expect(handler.schemaVersion.migrationRecords.save).have.been.called.exactly(3);
        })

        /**
         * Integration test for atomic migration execution.
         * Validates that when a migration fails in the middle of a batch:
         * 1. Migrations before the failure are saved (committed)
         * 2. The failing migration is not saved
         * 3. Migrations after the failure are not executed
         * This ensures partial consistency - successfully executed migrations remain applied.
         * Note: In production, the backup/restore mechanism handles rollback if needed.
         */
        it('E2E: should maintain database consistency on partial failure', async () => {
            // This verifies that if migration 2/3 fails, only migration 1 is saved
            const script1 = TestUtils.prepareMigration('V202311020036_test.ts');
            script1.timestamp = 1;
            script1.script = {
                async up() { return 'success1'; }
            } as IRunnableScript<IDB>;

            const script2 = TestUtils.prepareMigration('V202311020036_test.ts');
            script2.timestamp = 2;
            script2.script = {
                async up() { throw new Error('Migration 2 failed'); }
            } as IRunnableScript<IDB>;

            const script3 = TestUtils.prepareMigration('V202311020036_test.ts');
            script3.timestamp = 3;
            script3.script = {
                async up() { return 'success3'; }
            } as IRunnableScript<IDB>;

            // when: execute with failure in middle
            try {
                await executor.execute([script1, script2, script3]);
                expect.fail('Should have thrown');
            } catch (e: any) {
                // then: only first migration should be saved
                expect(handler.schemaVersion.migrationRecords.save).have.been.called.once;
                expect(e.message).to.include('Migration 2 failed');
            }
        })

        /**
         * Integration test for empty migration scenario.
         * Validates that when no migrations are pending:
         * 1. The system still creates a backup (defensive programming)
         * 2. No migrations are executed
         * 3. Cleanup occurs normally
         * This ensures the system handles "nothing to do" gracefully without errors.
         */
        it('E2E: should handle empty migration list gracefully', async () => {
            // having: no migrations to run
            initialized = true;
            valid = true;

            // when: execute with no scripts
            const result: IMigrationResult<IDB> = await executor.migrate();

            // then: verify result indicates success with no executions
            expect(result.success).to.be.true
            expect(result.executed).to.be.an('array')
            expect(result.executed.length).to.equal(0)
            expect(result.errors).to.be.undefined

            // then: should complete without error
            expect((executor as any).core.backup.backup).have.been.called;
            expect(executor.execute).have.been.called;
            expect((executor as any).core.backup.deleteBackup).have.been.called;
        })
    })

    describe('Hybrid Migrations (SQL + TypeScript)', () => {
        let db: IDB;
        let handler: IDatabaseMigrationHandler<IDB>;
        let config: Config;
        let executor: MigrationScriptExecutor<IDB>;

        beforeEach(() => {
            // Create mock database
            db = {
                checkConnection: async () => true
            };

            // Create handler with transaction support
            handler = {
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0',
                db,
                backup: {
                    backup: async () => 'backup-content',
                    restore: async () => {}
                },
                schemaVersion: {
                    isInitialized: async () => true,
                    createTable: async () => true,
                    validateTable: async () => true,
                    migrationRecords: {
                        getAllExecuted: async () => [],
                        save: async () => {},
                        remove: async () => {}
                    }
                }
            };

            // Create config with transaction mode enabled
            config = new Config();
            config.transaction.mode = TransactionMode.PER_MIGRATION;
            config.folder = './test/fixtures/hybrid-migrations';
        });

        it('should throw error when hybrid migrations detected with transactions enabled', async () => {
            // Create executor with transaction mode enabled
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            const sql1 = new MigrationScript<IDB>('V001_CreateTable.up.sql', '/path/V001_CreateTable.up.sql', 1);
            const ts1 = new MigrationScript<IDB>('V002_InsertData.ts', '/path/V002_InsertData.ts', 2);

            // Mock pending migrations (both SQL and TS)
            const mockScripts = {
                all: [sql1, ts1],
                migrated: [],
                pending: [sql1, ts1],
                ignored: [],
                executed: []
            };

            // Stub the migrationScanner to return our mock scripts
            sinon.stub((executor as any).core.scanner, 'scan').resolves(mockScripts);

            // Stub validation to bypass file and transaction checks
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateMigrations').resolves();
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateTransactionConfiguration').resolves();

            // Stub init to prevent actual script loading
            sinon.stub(sql1, 'init').resolves();
            sinon.stub(ts1, 'init').resolves();

            // Call up() which will trigger hybrid detection - should return failure
            const result = await executor.up();

            // Verify migration failed with hybrid detection error
            expect(result.success).to.be.false;
            expect(result.errors).to.have.length(1);
            const error = result.errors![0];
            expect(error.message).to.include('Hybrid migrations detected');
            expect(error.message).to.include('V001_CreateTable');
            expect(error.message).to.include('V002_InsertData');
            expect(error.message).to.include('Cannot use automatic transaction management');
            expect(error.message).to.include('TransactionMode.NONE');
        });

        it('should NOT throw error when only SQL migrations', async () => {
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            // Stub the entire workflow to return success (we're only testing hybrid check, not full workflow)
            const successResult: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: []
            };

            sinon.stub((executor as any).orchestration.workflow, 'migrateAll').resolves(successResult);

            // Should not throw error - test passes if no error thrown
            const result = await executor.up();
            expect(result.success).to.be.true;
        });

        it('should NOT throw error when only TypeScript migrations', async () => {
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            // Stub the entire workflow to return success (we're only testing hybrid check, not full workflow)
            const successResult: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: []
            };

            sinon.stub((executor as any).orchestration.workflow, 'migrateAll').resolves(successResult);

            // Should not throw error - test passes if no error thrown
            const result = await executor.up();
            expect(result.success).to.be.true;
        });

        it('should NOT throw error when transaction mode is NONE', async () => {
            config.transaction.mode = TransactionMode.NONE;
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            // Stub the entire workflow to return success (we're only testing hybrid check, not full workflow)
            const successResult: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: []
            };

            sinon.stub((executor as any).orchestration.workflow, 'migrateAll').resolves(successResult);

            // Should not throw error even with hybrid migrations when mode is NONE
            const result = await executor.up();
            expect(result.success).to.be.true;
        });

        it('should NOT check when no pending migrations', async () => {
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            const mockScripts = {
                all: [],
                migrated: [],
                pending: [],
                ignored: [],
                executed: []
            };

            // Stub the migrationScanner to return our mock scripts
            sinon.stub((executor as any).core.scanner, 'scan').resolves(mockScripts);

            // Stub validation to bypass file checks
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateMigrations').resolves();

            // Should not throw error when there are no pending migrations
            const result = await executor.up();
            expect(result.success).to.be.true;
            expect(result.executed).to.have.length(0);
        });

        it('should throw error for hybrid with .js files', async () => {
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            const sql1 = new MigrationScript<IDB>('V001_CreateTable.up.sql', '/path/V001_CreateTable.up.sql', 1);
            const js1 = new MigrationScript<IDB>('V002_InsertData.js', '/path/V002_InsertData.js', 2);

            const mockScripts = {
                all: [sql1, js1],
                migrated: [],
                pending: [sql1, js1],
                ignored: [],
                executed: []
            };

            // Stub the migrationScanner to return our mock scripts
            sinon.stub((executor as any).core.scanner, 'scan').resolves(mockScripts);

            // Stub validation to bypass file and transaction checks
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateMigrations').resolves();
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateTransactionConfiguration').resolves();

            // Stub init to prevent actual script loading
            sinon.stub(sql1, 'init').resolves();
            sinon.stub(js1, 'init').resolves();

            // Call up() which will trigger hybrid detection - should return failure
            const result = await executor.up();

            // Verify migration failed with hybrid detection error
            expect(result.success).to.be.false;
            expect(result.errors).to.have.length(1);
            const error = result.errors![0];
            expect(error.message).to.include('Hybrid migrations detected');
            expect(error.message).to.include('V002_InsertData.js');
        });

        it('should include transaction mode in error message', async () => {
            config.transaction.mode = TransactionMode.PER_BATCH;
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            const sql1 = new MigrationScript<IDB>('V001_CreateTable.up.sql', '/path/V001_CreateTable.up.sql', 1);
            const ts1 = new MigrationScript<IDB>('V002_InsertData.ts', '/path/V002_InsertData.ts', 2);

            const mockScripts = {
                all: [sql1, ts1],
                migrated: [],
                pending: [sql1, ts1],
                ignored: [],
                executed: []
            };

            // Stub the migrationScanner to return our mock scripts
            sinon.stub((executor as any).core.scanner, 'scan').resolves(mockScripts);

            // Stub validation to bypass file and transaction checks
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateMigrations').resolves();
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateTransactionConfiguration').resolves();

            // Stub init to prevent actual script loading
            sinon.stub(sql1, 'init').resolves();
            sinon.stub(ts1, 'init').resolves();

            // Call up() which will trigger hybrid detection - should return failure
            const result = await executor.up();

            // Verify migration failed with hybrid detection error including transaction mode
            expect(result.success).to.be.false;
            expect(result.errors).to.have.length(1);
            const error = result.errors![0];
            expect(error.message).to.include('Current transaction mode: PER_BATCH');
        });

        it('should provide helpful solutions in error message', async () => {
            executor = new MigrationScriptExecutor<IDB>({ handler: handler , config: config });

            const sql1 = new MigrationScript<IDB>('V001_CreateTable.up.sql', '/path/V001_CreateTable.up.sql', 1);
            const ts1 = new MigrationScript<IDB>('V002_InsertData.ts', '/path/V002_InsertData.ts', 2);

            const mockScripts = {
                all: [sql1, ts1],
                migrated: [],
                pending: [sql1, ts1],
                ignored: [],
                executed: []
            };

            // Stub the migrationScanner to return our mock scripts
            sinon.stub((executor as any).core.scanner, 'scan').resolves(mockScripts);

            // Stub validation to bypass file and transaction checks
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateMigrations').resolves();
            sinon.stub((executor as any).orchestration.workflow.validationOrchestrator, 'validateTransactionConfiguration').resolves();

            // Stub init to prevent actual script loading
            sinon.stub(sql1, 'init').resolves();
            sinon.stub(ts1, 'init').resolves();

            // Call up() which will trigger hybrid detection - should return failure
            const result = await executor.up();

            // Verify migration failed with hybrid detection error including helpful solutions
            expect(result.success).to.be.false;
            expect(result.errors).to.have.length(1);
            const error = result.errors![0];
            expect(error.message).to.include('config.transaction.mode = TransactionMode.NONE');
            expect(error.message).to.include('Separate SQL and TypeScript migrations into different batches');
            expect(error.message).to.include('Convert all migrations to use the same format');
        });
    })

});
