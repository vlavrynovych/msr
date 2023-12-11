import {expect, spy} from 'chai';
import {afterEach} from "mocha";
import sinon from 'sinon';
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
})