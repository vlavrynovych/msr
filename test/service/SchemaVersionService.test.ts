import * as chai from "chai";
import spies from 'chai-spies';
chai.use(spies);
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

import {SchemaVersionService, IDatabaseMigrationHandler, IDB, MigrationScript, Config, IMigrationInfo} from "../../src";
import {expect, spy} from "chai";
import {afterEach} from "mocha";

describe('SchemaVersionService:init', () => {

    let initialized = true
    let created = true
    let valid = true
    let scripts:MigrationScript[] = []

    let cfg = new Config()
    let handler:IDatabaseMigrationHandler

    before(() => {
        const db:IDB = new class implements IDB {
            test(){throw new Error('Not implemented')}
        }
        handler = new class implements IDatabaseMigrationHandler {
            cfg:Config = cfg;
            db: IDB = db;

            backup(): Promise<string> { throw new Error('Not Implemented') }
            restore(data: string): Promise<any> { throw new Error('Not Implemented') }
            getName(): string { throw new Error('Not Implemented') }

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
    })

    beforeEach(() => {
        initialized = true
        created = true
        valid = true
        spy.on(handler, ['isInitialized', 'createTable', 'validateTable', 'register', 'getAll']);
    })

    afterEach(() => {
        spy.restore();
    })


    it('Need to init table - valid', async () => {
        // when:
        initialized = false
        created = true
        valid = true

        // and: init
        await new SchemaVersionService(handler).init(cfg.tableName);

        // then
        expect(handler.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(handler.createTable).have.been.called.once.with(cfg.tableName)
        expect(handler.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('Need to init table - invalid', async () => {
        // when:
        initialized = false
        created = true
        valid = false

        // and: init
        await expect(new SchemaVersionService(handler).init(cfg.tableName)).to.be.rejectedWith("Schema version table is invalid");

        // then
        expect(handler.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(handler.createTable).have.been.called.once.with(cfg.tableName)
        expect(handler.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('No need to init table - valid', async () => {
        // when:
        initialized = true
        created = false
        valid = true

        // and: init
        await new SchemaVersionService(handler).init(cfg.tableName);

        // then
        expect(handler.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(handler.createTable).have.not.been.called
        expect(handler.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('No need to init table - invalid', async () => {
        // when:
        initialized = true
        created = false
        valid = false

        // and: init
        await expect(new SchemaVersionService(handler).init(cfg.tableName)).to.be.rejectedWith("Schema version table is invalid");

        // then
        expect(handler.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(handler.createTable).have.not.been.called
        expect(handler.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('Cannot create table', async () => {
        // when:
        initialized = false
        created = false
        valid = false

        // and: init
        await expect(new SchemaVersionService(handler).init(cfg.tableName)).to.be.rejectedWith("Cannot create table");

        // then
        expect(handler.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(handler.createTable).have.been.called.once.with(cfg.tableName)
        expect(handler.validateTable).have.not.been.called
    })

    it('Check register', async () => {
        // when:
        const m = {} as IMigrationInfo;
        await new SchemaVersionService(handler).register({} as IMigrationInfo);

        // then
        expect(handler.register).have.been.called.with(m)
        expect(handler.getAll).have.not.been.called
        expect(handler.isInitialized).have.not.been.called
        expect(handler.createTable).have.not.been.called
        expect(handler.validateTable).have.not.been.called
    })

    it('Check getAllMigratedScripts', async () => {
        // when:
        const res = await new SchemaVersionService(handler).getAllMigratedScripts();

        // then
        expect(res).eq(scripts, "Should return list of scripts")
        expect(handler.getAll).have.been.called.once
        expect(handler.register).have.not.been.called
        expect(handler.isInitialized).have.not.been.called
        expect(handler.createTable).have.not.been.called
        expect(handler.validateTable).have.not.been.called
    })
})