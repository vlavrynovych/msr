import {expect, spy} from "chai";
import {afterEach} from "mocha";
import {
    SchemaVersionService,
    MigrationScript,
    Config,
    IMigrationInfo,
    ISchemaVersion,
    IMigrationScript
} from "../../src";

describe('SchemaVersionService:init', () => {

    let initialized = true
    let created = true
    let valid = true
    let scripts:MigrationScript[] = []

    let cfg = new Config()
    let schemaVersion:ISchemaVersion

    before(() => {
        schemaVersion = {
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
        } as ISchemaVersion
    })

    beforeEach(() => {
        initialized = true
        created = true
        valid = true
        spy.on(schemaVersion, ['isInitialized', 'createTable', 'validateTable']);
        spy.on(schemaVersion.migrations, ['save', 'getAll']);
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
        await new SchemaVersionService(schemaVersion).init(cfg.tableName);

        // then
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('Need to init table - invalid', async () => {
        // when:
        initialized = false
        created = true
        valid = false

        // and: init
        await expect(new SchemaVersionService(schemaVersion).init(cfg.tableName)).to.be.rejectedWith("Schema version table is invalid");

        // then
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('No need to init table - valid', async () => {
        // when:
        initialized = true
        created = false
        valid = true

        // and: init
        await new SchemaVersionService(schemaVersion).init(cfg.tableName);

        // then
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('No need to init table - invalid', async () => {
        // when:
        initialized = true
        created = false
        valid = false

        // and: init
        await expect(new SchemaVersionService(schemaVersion).init(cfg.tableName)).to.be.rejectedWith("Schema version table is invalid");

        // then
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    it('Cannot create table', async () => {
        // when:
        initialized = false
        created = false
        valid = false

        // and: init
        await expect(new SchemaVersionService(schemaVersion).init(cfg.tableName)).to.be.rejectedWith("Cannot create table");

        // then
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.validateTable).have.not.been.called
    })

    it('Check register', async () => {
        // when:
        const m = {} as IMigrationInfo;
        await new SchemaVersionService(schemaVersion).save({} as IMigrationInfo);

        // then
        expect(schemaVersion.migrations.save).have.been.called.with(m)
        expect(schemaVersion.migrations.getAll).have.not.been.called
        expect(schemaVersion.isInitialized).have.not.been.called
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.not.been.called
    })

    it('Check getAllMigratedScripts', async () => {
        // when:
        const res = await new SchemaVersionService(schemaVersion).getAllMigratedScripts();

        // then
        expect(res).eq(scripts, "Should return list of scripts")
        expect(schemaVersion.migrations.save).have.not.been.called
        expect(schemaVersion.migrations.getAll).have.been.called.once
        expect(schemaVersion.isInitialized).have.not.been.called
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.not.been.called
    })
})