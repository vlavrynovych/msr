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

    it('init: should handle empty tableName gracefully', async () => {
        // SchemaVersionService doesn't validate tableName, delegates to underlying service
        // when: empty string tableName
        initialized = false;
        created = true;
        valid = true;

        await new SchemaVersionService(schemaVersion).init('');
        expect(schemaVersion.isInitialized).have.been.called.with('');
    })

    it('init: should handle very long tableName', async () => {
        // when: 1000 char tableName
        const longTableName = 'a'.repeat(1000);
        initialized = false;
        created = true;
        valid = true;

        // then: should not throw (delegates to service)
        await new SchemaVersionService(schemaVersion).init(longTableName);
        expect(schemaVersion.createTable).have.been.called.with(longTableName);
    })

    it('init: should handle special characters in tableName', async () => {
        // when: tableName with special chars
        initialized = false;
        created = true;
        valid = true;

        await new SchemaVersionService(schemaVersion).init('test-table_123');
        expect(schemaVersion.createTable).have.been.called.with('test-table_123');
    })

    it('save: should handle very large migration info objects', async () => {
        // when: large migration info
        const largeMigration = {
            timestamp: 1,
            name: 'test',
            result: 'x'.repeat(100000), // 100KB result
            startedAt: Date.now(),
            finishedAt: Date.now()
        } as IMigrationInfo;

        // then: should not throw
        await new SchemaVersionService(schemaVersion).save(largeMigration);
        expect(schemaVersion.migrations.save).have.been.called.with(largeMigration);
    })

    it('save: should handle migration info with undefined fields', async () => {
        // when: migration with missing fields
        const incompleteMigration = {
            timestamp: undefined,
            name: undefined
        } as any;

        // then: should delegate to service (service handles validation)
        await new SchemaVersionService(schemaVersion).save(incompleteMigration);
        expect(schemaVersion.migrations.save).have.been.called;
    })

    it('getAllMigratedScripts: should handle empty results', async () => {
        // when: no migrations
        scripts = [];

        // then
        const res = await new SchemaVersionService(schemaVersion).getAllMigratedScripts();
        expect(res.length).eq(0, 'Should return empty array');
    })

    it('getAllMigratedScripts: should handle large number of scripts', async () => {
        // when: 10000 migrations
        scripts = Array.from({length: 10000}, (_, i) => ({
            timestamp: i,
            name: `Migration${i}`
        } as MigrationScript));

        // then
        const start = Date.now();
        const res = await new SchemaVersionService(schemaVersion).getAllMigratedScripts();
        const duration = Date.now() - start;

        expect(res.length).eq(10000, 'Should return all scripts');
        expect(duration).to.be.lessThan(100, 'Should be fast (< 100ms)');
    })
})