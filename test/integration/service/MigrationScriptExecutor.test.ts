import {expect, spy} from 'chai';
import {afterEach} from "mocha";
import sinon from 'sinon';
import fs from 'fs';
import {
    Config,
    IDB,
    IMigrationInfo,
    IDatabaseMigrationHandler,
    MigrationScript,
    MigrationScriptExecutor,
    IBackup, ISchemaVersion, IMigrationScript,
    IMigrationResult,
    SilentLogger
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

describe('MigrationScriptExecutor', () => {

    let initialized = true
    let created = true
    let valid = true
    let scripts:MigrationScript[] = []

    let handler:IDatabaseMigrationHandler
    let executor:MigrationScriptExecutor

    before(() => {
        let cfg = TestUtils.getConfig()
        const db:IDB = new class implements IDB {
            test(){throw new Error('Not implemented')}
        }
        handler = new class implements IDatabaseMigrationHandler {
            backup:IBackup = {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            };
            schemaVersion:ISchemaVersion = {
                migrations: {
                    getAll(): Promise<MigrationScript[]> {
                        return Promise.resolve(scripts);
                    },
                    save(details: IMigrationInfo): Promise<any> {
                        return Promise.resolve(undefined);
                    }
                } as IMigrationScript,

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
            cfg:Config = cfg;
            db: IDB = db;
            getName(): string { return "Test Implementation" }
        }

        executor = new MigrationScriptExecutor(handler, { logger: new SilentLogger() });
    })

    beforeEach(() => {
        handler.cfg = TestUtils.getConfig() // reset config before each test
        initialized = true
        created = true
        valid = true
        spy.on(handler.schemaVersion, ['isInitialized', 'createTable', 'validateTable']);
        spy.on(handler.schemaVersion.migrations, ['save', 'getAll']);

        spy.on(executor, ['migrate', 'getTodo', 'execute', 'task']);
        spy.on(executor.backupService, ['restore', 'deleteBackup', 'backup']);
        spy.on(executor.migrationService, ['readMigrationScripts']);
    })

    afterEach(() => {
        spy.restore()
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
            const result: IMigrationResult = await executor.migrate()

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
            expect(handler.schemaVersion.migrations.getAll).have.been.called.once
            expect(handler.schemaVersion.migrations.save).have.been.called.once

            // Verify migration discovery ran
            expect(executor.migrationService.readMigrationScripts).have.been.called.once

            // Verify backup lifecycle: created → not restored (success) → deleted
            expect(executor.backupService.backup).have.been.called.once
            expect(executor.backupService.restore).have.not.been.called
            expect(executor.backupService.deleteBackup).have.been.called.once

            // Verify all migration workflow methods were called
            expect(executor.migrate).have.been.called.once
            expect(executor.getTodo).have.been.called.once
            expect(executor.execute).have.been.called.once
            expect(executor.task).have.been.called.once
        })

        /**
         * Test: Migration with no new scripts to execute
         * Validates the system handles "nothing to do" gracefully when all
         * migrations have already been executed. Backup is still created as
         * a safety measure, but no migrations run.
         */
        it('should handle case when no new scripts exist', async () => {
            // Configure to use empty migrations directory
            handler.cfg = TestUtils.getConfig(TestUtils.EMPTY_FOLDER)

            // Execute migration with no scripts to run
            const result: IMigrationResult = await executor.migrate()

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
            expect(handler.schemaVersion.migrations.getAll).have.been.called.once
            expect(handler.schemaVersion.migrations.save).have.not.been.called

            // Verify script discovery still ran
            expect(executor.migrationService.readMigrationScripts).have.been.called.once

            // Verify backup lifecycle completed even with no migrations
            expect(executor.backupService.backup).have.been.called.once
            expect(executor.backupService.restore).have.not.been.called
            expect(executor.backupService.deleteBackup).have.been.called.once

            // Verify workflow ran but no individual migration tasks executed
            expect(executor.migrate).have.been.called.once
            expect(executor.getTodo).have.been.called.once
            expect(executor.execute).have.not.been.called.once
            expect(executor.task).have.not.been.called.once
        })

        /**
         * Test: Migration failure triggers backup restore
         * Validates the error recovery workflow when schema validation fails:
         * 1. Backup is created
         * 2. Validation fails
         * 3. Backup is restored to undo any changes
         * 4. Backup is cleaned up
         * This ensures the database returns to its pre-migration state on failure.
         */
        it('should restore backup when migration throws error', async () => {
            // Simulate schema validation failure
            valid = false

            // Execute migration which will fail validation
            const result: IMigrationResult = await executor.migrate()

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
            expect(handler.schemaVersion.migrations.getAll).have.not.been.called
            expect(handler.schemaVersion.migrations.save).have.not.been.called

            // Verify migration discovery was skipped after validation failure
            expect(executor.migrationService.readMigrationScripts).have.not.been.called.once

            // Verify error recovery: backup created → restored → cleaned up
            expect(executor.backupService.backup).have.been.called.once
            expect(executor.backupService.restore).have.been.called
            expect(executor.backupService.deleteBackup).have.been.called.once

            // Verify workflow stopped early due to validation failure
            expect(executor.migrate).have.been.called.once
            expect(executor.getTodo).have.not.been.called.once
            expect(executor.execute).have.not.been.called.once
            expect(executor.task).have.not.been.called.once
        })

        /**
         * Test: migrate() triggers restore on execution failure
         * Integration test validating that when a migration execution fails,
         * the backup restore is automatically triggered. This test directly
         * stubs a migration script to throw an error during execution.
         */
        it('should call restore on migration failure', async () => {
            // Create a migration script that will throw an error
            handler.cfg = TestUtils.getConfig();

            // Stub the migration service to return a failing script
            const failingScript = TestUtils.prepareMigration('V202311020036_fail.ts');
            failingScript.script = {
                async up() {
                    throw new Error('Migration execution failed');
                }
            } as any;

            const readStub = sinon.stub(executor.migrationService, 'readMigrationScripts');
            readStub.resolves([failingScript]);

            // Execute migration (will fail)
            const result: IMigrationResult = await executor.migrate();

            // Verify result indicates failure
            expect(result.success).to.be.false
            expect(result.errors).to.be.an('array')
            expect(result.errors!.length).to.be.greaterThan(0)

            // Verify error recovery workflow: backup → restore → cleanup
            expect(executor.backupService.backup).have.been.called;
            expect(executor.backupService.restore).have.been.called;
            expect(executor.backupService.deleteBackup).have.been.called;

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
            } as any;

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
            } as any;

            // Create second migration with execution tracking
            const script2 = TestUtils.prepareMigration('V202311020036_test.ts');
            script2.timestamp = 2;
            let script2Executed = false;
            script2.script = {
                async up() {
                    script2Executed = true;
                    return 'success';
                }
            } as any;

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

    describe('getTodo()', () => {
        /**
         * Test: getTodo identifies new migrations to execute
         * Validates that getTodo() correctly filters migrations by comparing
         * already-executed migrations against all available migrations. Only
         * migrations with timestamps newer than the last executed should be returned.
         */
        it('should filter out migrated scripts from todo list', async () => {
            // Define already-executed migrations (timestamps 1 and 2)
            const migrated = [
                {timestamp: 1} as MigrationScript,
                {timestamp: 2} as MigrationScript,
            ]

            // Define all available migrations (includes new one with timestamp 3)
            const all = [
                {timestamp: 1} as MigrationScript,
                {timestamp: 2} as MigrationScript,
                {timestamp: 3} as MigrationScript,
            ]

            // Get list of pending migrations
            const todo = executor.getTodo(migrated, all);

            // Verify only the new migration is returned
            expect(todo.length).eq(1, "Should be one new script")
            expect(todo[0].timestamp).eq(3, "New script has timestamp = 3")
        })

        /**
         * Test: getTodo with no previous migrations returns all scripts
         * Edge case test for first-time migration execution. When no migrations
         * have been run yet (empty migrated list), all available migrations
         * should be returned as pending.
         */
        it('should handle empty migrated list', () => {
            // Simulate no migrations have been executed yet
            const migrated: MigrationScript[] = [];
            const all = [
                {timestamp: 1} as MigrationScript,
                {timestamp: 2} as MigrationScript,
            ];

            // Get pending migrations
            const todo = executor.getTodo(migrated, all);

            // Verify all migrations are returned as pending
            expect(todo.length).eq(2, 'Should return all scripts when no migrations done');
        })

        /**
         * Test: getTodo ignores scripts older than last executed migration
         * Validates that migrations with timestamps older than the most recent
         * executed migration are filtered out. This prevents running "missing"
         * old migrations that were skipped or added after newer ones executed.
         */
        it('should ignore scripts older than last migration', () => {
            // Last executed migration has timestamp 5
            const migrated = [
                {timestamp: 5} as MigrationScript,
            ];

            // Available migrations include older, current, and newer
            const all = [
                {timestamp: 3} as MigrationScript,  // older - should be ignored
                {timestamp: 5} as MigrationScript,  // already migrated
                {timestamp: 7} as MigrationScript,  // newer - should be todo
            ];

            // Get pending migrations
            const todo = executor.getTodo(migrated, all);

            // Verify only the newer migration is returned
            expect(todo.length).eq(1, 'Should only return scripts newer than last migration');
            expect(todo[0].timestamp).eq(7);
        })
    })

    describe('task()', () => {
        /**
         * Test: task() handles database save failures
         * Validates that when a migration executes successfully but saving
         * the migration record to the database fails, the error is propagated.
         * This prevents the system from incorrectly thinking a migration succeeded.
         */
        it('should handle schemaVersionService.save failure', async () => {
            // Create a migration script that will succeed
            const script = TestUtils.prepareMigration('V202311020036_test.ts');
            script.script = {
                async up() {
                    return 'success';
                }
            } as any;

            // Stub save() to fail when recording the migration
            const saveStub = sinon.stub(handler.schemaVersion.migrations, 'save');
            saveStub.rejects(new Error('Failed to save migration record'));

            // Verify the save error is propagated
            await expect(executor.task(script)).to.be.rejectedWith('Failed to save migration record');

            saveStub.restore();
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
                {timestamp: 1, name: 'n1', username: 'v1'} as MigrationScript,
                {timestamp: 2, name: 'n2', username: 'v2'} as MigrationScript,
                {timestamp: 3, name: 'n3', username: 'v3'} as MigrationScript,
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
            handler.cfg = TestUtils.getConfig();
            initialized = true;
            valid = true;

            // when: execute full migration
            const result: IMigrationResult = await executor.migrate();

            // then: verify result indicates success
            expect(result.success).to.be.true
            expect(result.executed).to.be.an('array')
            expect(result.errors).to.be.undefined

            // then: verify key methods were called
            expect(executor.backupService.backup).have.been.called;
            expect(executor.migrationService.readMigrationScripts).have.been.called;
            expect(executor.execute).have.been.called;
            expect(executor.backupService.restore).have.not.been.called;
            expect(executor.backupService.deleteBackup).have.been.called;
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
            const result: IMigrationResult = await executor.migrate();

            // then: verify result indicates failure
            expect(result.success).to.be.false
            expect(result.errors).to.be.an('array')
            expect(result.errors!.length).to.be.greaterThan(0)

            // then: verify error handling lifecycle
            expect(executor.backupService.backup).have.been.called;
            expect(executor.backupService.restore).have.been.called;
            expect(executor.backupService.deleteBackup).have.been.called;
            expect(executor.migrationService.readMigrationScripts).have.not.been.called;
        })

        /**
         * Integration test for sequential migration execution.
         * Validates that multiple migrations are executed in the correct order (by timestamp)
         * and that each migration's result is properly recorded and saved.
         * This ensures the migration system maintains execution order consistency.
         */
        it('E2E: should handle multiple sequential migrations', async () => {
            // having: setup for multiple migration execution
            handler.cfg = TestUtils.getConfig();
            scripts = []; // start with no migrations

            // and: stub to return multiple scripts
            const script1 = TestUtils.prepareMigration('V202311020036_test.ts');
            script1.timestamp = 1;
            script1.name = 'Migration1';
            script1.script = {
                async up() { return 'result1'; }
            } as any;

            const script2 = TestUtils.prepareMigration('V202311020036_test.ts');
            script2.timestamp = 2;
            script2.name = 'Migration2';
            script2.script = {
                async up() { return 'result2'; }
            } as any;

            const script3 = TestUtils.prepareMigration('V202311020036_test.ts');
            script3.timestamp = 3;
            script3.name = 'Migration3';
            script3.script = {
                async up() { return 'result3'; }
            } as any;

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
            expect(handler.schemaVersion.migrations.save).have.been.called.exactly(3);
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
            } as any;

            const script2 = TestUtils.prepareMigration('V202311020036_test.ts');
            script2.timestamp = 2;
            script2.script = {
                async up() { throw new Error('Migration 2 failed'); }
            } as any;

            const script3 = TestUtils.prepareMigration('V202311020036_test.ts');
            script3.timestamp = 3;
            script3.script = {
                async up() { return 'success3'; }
            } as any;

            // when: execute with failure in middle
            try {
                await executor.execute([script1, script2, script3]);
                expect.fail('Should have thrown');
            } catch (e: any) {
                // then: only first migration should be saved
                expect(handler.schemaVersion.migrations.save).have.been.called.once;
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
            handler.cfg = TestUtils.getConfig(TestUtils.EMPTY_FOLDER);
            initialized = true;
            valid = true;

            // when: execute with no scripts
            const result: IMigrationResult = await executor.migrate();

            // then: verify result indicates success with no executions
            expect(result.success).to.be.true
            expect(result.executed).to.be.an('array')
            expect(result.executed.length).to.equal(0)
            expect(result.errors).to.be.undefined

            // then: should complete without error
            expect(executor.backupService.backup).have.been.called;
            expect(executor.execute).have.been.called;
            expect(executor.task).have.not.been.called;
            expect(executor.backupService.deleteBackup).have.been.called;
        })
    })

    describe('Constructor', () => {
        /**
         * Test: Constructor uses default ConsoleLogger when logger not provided
         * Validates that the default logger parameter works correctly
         */
        it('should use default ConsoleLogger when logger not provided', () => {
            const executorWithDefaultLogger = new MigrationScriptExecutor(handler);
            expect(executorWithDefaultLogger).to.be.instanceOf(MigrationScriptExecutor);
        })

        /**
         * Test: Constructor accepts custom logger through dependencies
         * Validates that custom logger is used instead of default
         */
        it('should use custom logger when provided', () => {
            const customLogger = new SilentLogger();
            const executorWithCustomLogger = new MigrationScriptExecutor(handler, {
                logger: customLogger
            });
            expect(executorWithCustomLogger.logger).to.equal(customLogger);
        })

        /**
         * Test: Constructor accepts custom backupService through dependencies
         * Validates that custom backupService is used instead of default
         */
        it('should use custom backupService when provided', () => {
            const mockBackupService = {
                backup: sinon.stub().resolves(),
                restore: sinon.stub().resolves(),
                deleteBackup: sinon.stub()
            };
            const executorWithCustomBackup = new MigrationScriptExecutor(handler, {
                backupService: mockBackupService
            });
            expect(executorWithCustomBackup.backupService).to.equal(mockBackupService);
        })

        /**
         * Test: Constructor accepts custom schemaVersionService through dependencies
         * Validates that custom schemaVersionService is used instead of default
         */
        it('should use custom schemaVersionService when provided', () => {
            const mockSchemaVersionService = {
                init: sinon.stub().resolves(),
                save: sinon.stub().resolves(),
                getAllMigratedScripts: sinon.stub().resolves([])
            };
            const executorWithCustomSchema = new MigrationScriptExecutor(handler, {
                schemaVersionService: mockSchemaVersionService
            });
            expect(executorWithCustomSchema.schemaVersionService).to.equal(mockSchemaVersionService);
        })

        /**
         * Test: Constructor accepts custom consoleRenderer through dependencies
         * Validates that custom consoleRenderer is used instead of default
         */
        it('should use custom consoleRenderer when provided', () => {
            const mockRenderer = {
                drawFiglet: sinon.stub(),
                drawMigrated: sinon.stub(),
                drawTodoTable: sinon.stub(),
                drawIgnoredTable: sinon.stub(),
                drawExecutedTable: sinon.stub()
            };
            const executorWithCustomRenderer = new MigrationScriptExecutor(handler, {
                consoleRenderer: mockRenderer
            });
            expect(executorWithCustomRenderer.consoleRenderer).to.equal(mockRenderer);
            expect(mockRenderer.drawFiglet.calledOnce).to.be.true;
        })

        /**
         * Test: Constructor accepts custom migrationService through dependencies
         * Validates that custom migrationService is used instead of default
         */
        it('should use custom migrationService when provided', () => {
            const mockMigrationService = {
                readMigrationScripts: sinon.stub().resolves([])
            };
            const executorWithCustomMigration = new MigrationScriptExecutor(handler, {
                migrationService: mockMigrationService
            });
            expect(executorWithCustomMigration.migrationService).to.equal(mockMigrationService);
        })

        /**
         * Test: Constructor accepts all custom dependencies at once
         * Validates that all custom dependencies can be injected together
         */
        it('should use all custom dependencies when provided', () => {
            const customLogger = new SilentLogger();
            const mockBackupService = {
                backup: sinon.stub().resolves(),
                restore: sinon.stub().resolves(),
                deleteBackup: sinon.stub()
            };
            const mockSchemaVersionService = {
                init: sinon.stub().resolves(),
                save: sinon.stub().resolves(),
                getAllMigratedScripts: sinon.stub().resolves([])
            };
            const mockRenderer = {
                drawFiglet: sinon.stub(),
                drawMigrated: sinon.stub(),
                drawTodoTable: sinon.stub(),
                drawIgnoredTable: sinon.stub(),
                drawExecutedTable: sinon.stub()
            };
            const mockMigrationService = {
                readMigrationScripts: sinon.stub().resolves([])
            };

            const executorWithAllCustom = new MigrationScriptExecutor(handler, {
                logger: customLogger,
                backupService: mockBackupService,
                schemaVersionService: mockSchemaVersionService,
                consoleRenderer: mockRenderer,
                migrationService: mockMigrationService
            });

            expect(executorWithAllCustom.logger).to.equal(customLogger);
            expect(executorWithAllCustom.backupService).to.equal(mockBackupService);
            expect(executorWithAllCustom.schemaVersionService).to.equal(mockSchemaVersionService);
            expect(executorWithAllCustom.consoleRenderer).to.equal(mockRenderer);
            expect(executorWithAllCustom.migrationService).to.equal(mockMigrationService);
        })
    })
})