import {expect, spy} from 'chai';
import {afterEach} from "mocha";
import sinon from 'sinon';
import {Config, IDB, IMigrationInfo, IRunner, MigrationScript, MSRunner} from "../../src";

describe('MSRunner', () => {

    let initialized = true
    let created = true
    let valid = true
    let scripts:MigrationScript[] = []

    let r:IRunner
    let msr:MSRunner

    before(() => {
        let cfg = new Config()
        cfg.folder = `${process.cwd()}/migrations`;
        cfg.backup.folder = `${process.cwd()}/backups`;

        const db:IDB = new class implements IDB {
            test(){throw new Error('Not implemented')}
        }
        r = new class implements IRunner {
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

        msr = new MSRunner(r);
        sinon.stub(process, 'exit');
    })

    beforeEach(() => {
        initialized = true
        created = true
        valid = true
        spy.on(r, ['isInitialized', 'createTable', 'validateTable', 'register', 'getAll']);
        spy.on(msr, ['migrate', 'getTodo', 'execute', 'task']);
        spy.on(msr.backupService, ['restore', 'deleteBackup', 'backup']);
        spy.on(msr.migrationService, ['readMigrationScripts']);
    })

    afterEach(() => {
        spy.restore();
    })

    it('golden path', async () => {
        // when
        await msr.migrate()

        // then
        expect(r.isInitialized).have.been.called.once
        expect(r.createTable).have.not.been.called
        expect(r.validateTable).have.been.called.once
        expect(r.getAll).have.been.called.once
        expect(r.register).have.been.called.once

        expect(msr.migrationService.readMigrationScripts).have.been.called.once

        expect(msr.backupService.backup).have.been.called.once
        expect(msr.backupService.restore).have.not.been.called
        expect(msr.backupService.deleteBackup).have.been.called.once

        expect(msr.migrate).have.been.called.once
        expect(msr.getTodo).have.been.called.once
        expect(msr.execute).have.been.called.once
        expect(msr.task).have.been.called.once


    })

    it('no new scripts', async () => {
        // having: empty folder
        r.cfg.folder = `${process.cwd()}/backups`;

        // when
        await msr.migrate()

        // then
        expect(r.isInitialized).have.been.called.once
        expect(r.createTable).have.not.been.called
        expect(r.validateTable).have.been.called.once
        expect(r.getAll).have.been.called.once
        expect(r.register).have.not.been.called

        expect(msr.migrationService.readMigrationScripts).have.been.called.once

        expect(msr.backupService.backup).have.been.called.once
        expect(msr.backupService.restore).have.not.been.called
        expect(msr.backupService.deleteBackup).have.been.called.once

        expect(msr.migrate).have.been.called.once
        expect(msr.getTodo).have.been.called.once
        expect(msr.execute).have.been.called.once
        expect(msr.task).have.not.been.called.once
    })

    it('throw an error - restore', async () => {
        // having:
        valid = false

        // when
        await msr.migrate()

        // then
        expect(r.isInitialized).have.been.called.once
        expect(r.createTable).have.not.been.called
        expect(r.validateTable).have.been.called.once
        expect(r.getAll).have.not.been.called
        expect(r.register).have.not.been.called

        expect(msr.migrationService.readMigrationScripts).have.not.been.called.once

        expect(msr.backupService.backup).have.been.called.once
        expect(msr.backupService.restore).have.been.called
        expect(msr.backupService.deleteBackup).have.been.called.once

        expect(msr.migrate).have.been.called.once
        expect(msr.getTodo).have.not.been.called.once
        expect(msr.execute).have.not.been.called.once
        expect(msr.task).have.not.been.called.once
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
        const todo = msr.getTodo(migrated, all);

        // then
        expect(todo.length).eq(1, "Should be one new script")
        expect(todo[0].timestamp).eq(3, "New script has timestamp = 3")
    })
})