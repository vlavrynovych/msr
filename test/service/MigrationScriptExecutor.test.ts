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
    IBackup, ISchemaVersion, IMigrationScript
} from "../../src";
import {TestUtils} from "../TestUtils";

const processExit = sinon.stub(process, 'exit');

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

        executor = new MigrationScriptExecutor(handler);
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

    after(() => {
        processExit.restore()
    })

    it('golden path', async () => {
        // when
        await executor.migrate()

        // then
        expect(handler.schemaVersion.isInitialized).have.been.called.once
        expect(handler.schemaVersion.createTable).have.not.been.called
        expect(handler.schemaVersion.validateTable).have.been.called.once
        expect(handler.schemaVersion.migrations.getAll).have.been.called.once
        expect(handler.schemaVersion.migrations.save).have.been.called.once

        expect(executor.migrationService.readMigrationScripts).have.been.called.once

        expect(executor.backupService.backup).have.been.called.once
        expect(executor.backupService.restore).have.not.been.called
        expect(executor.backupService.deleteBackup).have.been.called.once

        expect(executor.migrate).have.been.called.once
        expect(executor.getTodo).have.been.called.once
        expect(executor.execute).have.been.called.once
        expect(executor.task).have.been.called.once
    })

    it('no new scripts', async () => {
        // having: empty folder
        handler.cfg = TestUtils.getConfig(TestUtils.EMPTY_FOLDER)

        // when
        await executor.migrate()

        // then
        expect(handler.schemaVersion.isInitialized).have.been.called.once
        expect(handler.schemaVersion.createTable).have.not.been.called
        expect(handler.schemaVersion.validateTable).have.been.called.once
        expect(handler.schemaVersion.migrations.getAll).have.been.called.once
        expect(handler.schemaVersion.migrations.save).have.not.been.called

        expect(executor.migrationService.readMigrationScripts).have.been.called.once

        expect(executor.backupService.backup).have.been.called.once
        expect(executor.backupService.restore).have.not.been.called
        expect(executor.backupService.deleteBackup).have.been.called.once

        expect(executor.migrate).have.been.called.once
        expect(executor.getTodo).have.been.called.once
        expect(executor.execute).have.been.called.once
        expect(executor.task).have.not.been.called.once
    })

    it('throw an error - restore', async () => {
        // having:
        valid = false

        // when
        await executor.migrate()

        // then
        expect(handler.schemaVersion.isInitialized).have.been.called.once
        expect(handler.schemaVersion.createTable).have.not.been.called
        expect(handler.schemaVersion.validateTable).have.been.called.once
        expect(handler.schemaVersion.migrations.getAll).have.not.been.called
        expect(handler.schemaVersion.migrations.save).have.not.been.called

        expect(executor.migrationService.readMigrationScripts).have.not.been.called.once

        expect(executor.backupService.backup).have.been.called.once
        expect(executor.backupService.restore).have.been.called
        expect(executor.backupService.deleteBackup).have.been.called.once

        expect(executor.migrate).have.been.called.once
        expect(executor.getTodo).have.not.been.called.once
        expect(executor.execute).have.not.been.called.once
        expect(executor.task).have.not.been.called.once
    })

    it('getTodo: with migrated scripts', async () => {
        // having:
        const migrated = [
            {timestamp: 1} as MigrationScript,
            {timestamp: 2} as MigrationScript,
        ]

        const all = [
            {timestamp: 1} as MigrationScript,
            {timestamp: 2} as MigrationScript,
            {timestamp: 3} as MigrationScript,
        ]

        // when
        const todo = executor.getTodo(migrated, all);

        // then
        expect(todo.length).eq(1, "Should be one new script")
        expect(todo[0].timestamp).eq(3, "New script has timestamp = 3")
    })

    it('list', async () => {
        scripts = [
            {timestamp: 1, name: 'n1', username: 'v1'} as MigrationScript,
            {timestamp: 2, name: 'n2', username: 'v2'} as MigrationScript,
            {timestamp: 3, name: 'n3', username: 'v3'} as MigrationScript,
        ]

        spy.on(console, ['log'], (...items) => {
            const msg:string = items[0]
            expect(msg.includes("n1")).is.true
            expect(msg.includes("n2")).is.true
            expect(msg.includes("n3")).is.true
        });

        await executor.list()
        await executor.list(0)
        await executor.list(-2)
        await executor.list(100)
        spy.restore()

        spy.on(console, ['log'], (...items) => {
            const msg:string = items[0]
            expect(msg.includes("n3")).is.true
            expect(!msg.includes("n2")).is.true
            expect(!msg.includes("n1")).is.true
        });

        await executor.list(1)
        spy.restore()
    })

    it('execute: should handle migration script throwing error', async () => {
        // having: migration that throws
        const errorScript = TestUtils.prepareMigration('V202311020036_test.ts');
        errorScript.script = {
            async up() {
                throw new Error('Migration execution failed');
            }
        } as any;

        // when
        await expect(executor.execute([errorScript])).to.be.rejectedWith('Migration execution failed');
    })

    it('execute: should stop on first migration failure', async () => {
        // having: multiple migrations, first one fails
        const script1 = TestUtils.prepareMigration('V202311020036_test.ts');
        script1.timestamp = 1;
        script1.script = {
            async up() {
                throw new Error('First migration failed');
            }
        } as any;

        const script2 = TestUtils.prepareMigration('V202311020036_test.ts');
        script2.timestamp = 2;
        let script2Executed = false;
        script2.script = {
            async up() {
                script2Executed = true;
                return 'success';
            }
        } as any;

        // when
        try {
            await executor.execute([script1, script2]);
            expect.fail('Should have thrown');
        } catch (e: any) {
            // then: second script should not execute
            expect(script2Executed).to.be.false;
            expect(e.message).to.include('First migration failed');
        }
    })

    it('migrate: should call restore on migration failure', async () => {
        // having: migration that will fail
        handler.cfg = TestUtils.getConfig();
        const readStub = sinon.stub(fs, 'readFileSync');
        readStub.returns(`
            export class FailingMigration {
                async up() { throw new Error('Migration failed'); }
            }
        `);

        // when
        await executor.migrate();

        // then
        expect(executor.backupService.backup).have.been.called;
        expect(executor.backupService.restore).have.been.called;
        expect(executor.backupService.deleteBackup).have.been.called;

        readStub.restore();
    })

    it('task: should handle schemaVersionService.save failure', async () => {
        // having: migration script with mocked up() method
        const script = TestUtils.prepareMigration('V202311020036_test.ts');
        script.script = {
            async up() {
                return 'success';
            }
        } as any;

        // and: save that fails
        const saveStub = sinon.stub(handler.schemaVersion.migrations, 'save');
        saveStub.rejects(new Error('Failed to save migration record'));

        // when/then
        await expect(executor.task(script)).to.be.rejectedWith('Failed to save migration record');

        saveStub.restore();
    })

    it('getTodo: should handle empty migrated list', () => {
        // having
        const migrated: MigrationScript[] = [];
        const all = [
            {timestamp: 1} as MigrationScript,
            {timestamp: 2} as MigrationScript,
        ];

        // when
        const todo = executor.getTodo(migrated, all);

        // then: should return all scripts
        expect(todo.length).eq(2, 'Should return all scripts when no migrations done');
    })

    it('getTodo: should ignore scripts older than last migration', () => {
        // having: last migrated is timestamp 5
        const migrated = [
            {timestamp: 5} as MigrationScript,
        ];

        const all = [
            {timestamp: 3} as MigrationScript,  // older - should be ignored
            {timestamp: 5} as MigrationScript,  // already migrated
            {timestamp: 7} as MigrationScript,  // newer - should be todo
        ];

        // when
        const todo = executor.getTodo(migrated, all);

        // then
        expect(todo.length).eq(1, 'Should only return scripts newer than last migration');
        expect(todo[0].timestamp).eq(7);
    })

    describe('Integration Tests', () => {
        it('E2E: should execute full backup → migrate → cleanup cycle', async () => {
            // This tests the full happy path with real file I/O
            handler.cfg = TestUtils.getConfig();
            initialized = true;
            valid = true;

            // when: execute full migration
            await executor.migrate();

            // then: verify key methods were called
            expect(executor.backupService.backup).have.been.called;
            expect(executor.migrationService.readMigrationScripts).have.been.called;
            expect(executor.execute).have.been.called;
            expect(executor.backupService.restore).have.not.been.called;
            expect(executor.backupService.deleteBackup).have.been.called;
        })

        it('E2E: should execute backup → fail → restore → cleanup cycle', async () => {
            // This tests error handling with restore
            initialized = true;
            valid = false; // cause validation to fail

            // when: execute migration that will fail
            await executor.migrate();

            // then: verify error handling lifecycle
            expect(executor.backupService.backup).have.been.called;
            expect(executor.backupService.restore).have.been.called;
            expect(executor.backupService.deleteBackup).have.been.called;
            expect(executor.migrationService.readMigrationScripts).have.not.been.called;
        })

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

        it('E2E: should handle empty migration list gracefully', async () => {
            // having: no migrations to run
            handler.cfg = TestUtils.getConfig(TestUtils.EMPTY_FOLDER);
            initialized = true;
            valid = true;

            // when: execute with no scripts
            await executor.migrate();

            // then: should complete without error
            expect(executor.backupService.backup).have.been.called;
            expect(executor.execute).have.been.called;
            expect(executor.task).have.not.been.called;
            expect(executor.backupService.deleteBackup).have.been.called;
        })
    })
})