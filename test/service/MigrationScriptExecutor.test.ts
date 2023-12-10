import {expect, spy} from 'chai';
import {afterEach} from "mocha";
import sinon from 'sinon';
import {Config, IDB, IMigrationInfo, IDatabaseMigrationHandler, MigrationScript, MigrationScriptExecutor} from "../../src";
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
            cfg:Config = cfg;
            db: IDB = db;

            backup(): Promise<string> { return Promise.resolve('content') }
            restore(data: string): Promise<any> { return Promise.resolve('restored') }
            getName(): string { return "Test Implementation" }

            createTable(tableName: string): Promise<boolean> {
                return Promise.resolve(created);
            }

            isInitialized(tableName: string): Promise<boolean> {
                return Promise.resolve(initialized);
            }

            getAll(): Promise<MigrationScript[]> {
                return Promise.resolve(scripts);
            }
            register(details: IMigrationInfo): Promise<any> {
                return Promise.resolve(undefined);
            }

            validateTable(tableName: string): Promise<boolean> {
                return Promise.resolve(valid);
            }
        }

        executor = new MigrationScriptExecutor(handler);
    })

    beforeEach(() => {
        handler.cfg = TestUtils.getConfig() // reset config before each test
        initialized = true
        created = true
        valid = true
        spy.on(handler, ['isInitialized', 'createTable', 'validateTable', 'register', 'getAll']);
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
        expect(handler.isInitialized).have.been.called.once
        expect(handler.createTable).have.not.been.called
        expect(handler.validateTable).have.been.called.once
        expect(handler.getAll).have.been.called.once
        expect(handler.register).have.been.called.once

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
        expect(handler.isInitialized).have.been.called.once
        expect(handler.createTable).have.not.been.called
        expect(handler.validateTable).have.been.called.once
        expect(handler.getAll).have.been.called.once
        expect(handler.register).have.not.been.called

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
        expect(handler.isInitialized).have.been.called.once
        expect(handler.createTable).have.not.been.called
        expect(handler.validateTable).have.been.called.once
        expect(handler.getAll).have.not.been.called
        expect(handler.register).have.not.been.called

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
})