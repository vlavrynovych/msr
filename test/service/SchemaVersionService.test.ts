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


    /**
     * Test: Table initialization succeeds when table doesn't exist
     * Validates the happy path: when the schema version table doesn't exist,
     * init() creates it and validates it successfully. This is the first-run
     * scenario when the migration system is used for the first time.
     */
    it('Need to init table - valid', async () => {
        // Simulate table doesn't exist yet
        initialized = false
        created = true
        valid = true

        // Initialize the schema version table
        await new SchemaVersionService(schemaVersion).init(cfg.tableName);

        // Verify the initialization flow: check if exists → create → validate
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    /**
     * Test: Table initialization fails when created table is invalid
     * Validates error handling when the table is created but validation fails.
     * This could indicate database issues or incorrect table schema.
     */
    it('Need to init table - invalid', async () => {
        // Simulate table creation succeeds but validation fails
        initialized = false
        created = true
        valid = false

        // Attempt initialization which should fail validation
        try {
            await new SchemaVersionService(schemaVersion).init(cfg.tableName);
            expect.fail('Should have thrown');
        } catch (e: any) {
            // Verify clear error message for debugging
            expect(e.message).to.eq("Schema version table is invalid");
            expect(e).to.be.instanceOf(Error);
        }

        // Verify the initialization was attempted before failing
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    /**
     * Test: Existing valid table skips creation
     * Validates that when the schema version table already exists and is valid,
     * init() skips the creation step and only validates. This is the normal case
     * after the first run of the migration system.
     */
    it('No need to init table - valid', async () => {
        // Simulate table already exists
        initialized = true
        created = false
        valid = true

        // Initialize (should skip creation)
        await new SchemaVersionService(schemaVersion).init(cfg.tableName);

        // Verify creation was skipped but validation still ran
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    /**
     * Test: Existing invalid table throws error
     * Validates error handling when the schema version table exists but has
     * been corrupted or modified incorrectly. This prevents running migrations
     * against a broken tracking table.
     */
    it('No need to init table - invalid', async () => {
        // Simulate existing table that's invalid
        initialized = true
        created = false
        valid = false

        // Attempt initialization which should fail validation
        await expect(new SchemaVersionService(schemaVersion).init(cfg.tableName)).to.be.rejectedWith("Schema version table is invalid");

        // Verify validation was attempted but creation was skipped
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.been.called.once.with(cfg.tableName)
    })

    /**
     * Test: Table creation failure is handled properly
     * Validates error handling when the database fails to create the schema
     * version table. This could happen due to permission issues or database
     * constraints. The error should be clear and validation should not run.
     */
    it('Cannot create table', async () => {
        // Simulate table creation failure
        initialized = false
        created = false
        valid = false

        // Attempt initialization which should fail during creation
        try {
            await new SchemaVersionService(schemaVersion).init(cfg.tableName);
            expect.fail('Should have thrown');
        } catch (e: any) {
            // Verify clear error message indicating creation failed
            expect(e.message).to.eq("Cannot create table");
            expect(e).to.be.instanceOf(Error);
        }

        // Verify creation was attempted but validation was skipped
        expect(schemaVersion.isInitialized).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.createTable).have.been.called.once.with(cfg.tableName)
        expect(schemaVersion.validateTable).have.not.been.called
    })

    /**
     * Test: Saving migration info delegates to underlying implementation
     * Validates that save() correctly delegates to the migrations.save() method
     * without calling any other schema version methods. This is used after each
     * successful migration to record it in the database.
     */
    it('Check register', async () => {
        // Create a migration info object to save
        const m = {} as IMigrationInfo;
        await new SchemaVersionService(schemaVersion).save({} as IMigrationInfo);

        // Verify only save() was called, no other schema operations
        expect(schemaVersion.migrations.save).have.been.called.with(m)
        expect(schemaVersion.migrations.getAll).have.not.been.called
        expect(schemaVersion.isInitialized).have.not.been.called
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.not.been.called
    })

    /**
     * Test: Getting all migrated scripts delegates to underlying implementation
     * Validates that getAllMigratedScripts() correctly retrieves the list of
     * already-executed migrations from the database without calling any other
     * schema version methods. This is used to determine which migrations to skip.
     */
    it('Check getAllMigratedScripts', async () => {
        // Retrieve all migrated scripts from the database
        const res = await new SchemaVersionService(schemaVersion).getAllMigratedScripts();

        // Verify correct method was called and result returned
        expect(res).eq(scripts, "Should return list of scripts")
        expect(schemaVersion.migrations.save).have.not.been.called
        expect(schemaVersion.migrations.getAll).have.been.called.once
        expect(schemaVersion.isInitialized).have.not.been.called
        expect(schemaVersion.createTable).have.not.been.called
        expect(schemaVersion.validateTable).have.not.been.called
    })

    /**
     * Test: Empty tableName is delegated to underlying service
     * Edge case test validating that SchemaVersionService doesn't perform
     * input validation on tableName - it delegates to the underlying database
     * implementation which should handle or reject empty table names.
     */
    it('init: should handle empty tableName gracefully', async () => {
        // Simulate first-time initialization with empty table name
        initialized = false;
        created = true;
        valid = true;

        // Call init with empty string (service delegates validation)
        await new SchemaVersionService(schemaVersion).init('');
        expect(schemaVersion.isInitialized).have.been.called.with('');
    })

    /**
     * Test: Very long tableName is handled without crashing
     * Edge case test with extremely long table name (1000 characters).
     * Validates the service doesn't have arbitrary length limits and delegates
     * length validation to the underlying database implementation.
     */
    it('init: should handle very long tableName', async () => {
        // Create an extremely long table name (1000 characters)
        const longTableName = 'a'.repeat(1000);
        initialized = false;
        created = true;
        valid = true;

        // Should not throw (delegates to underlying service for length validation)
        await new SchemaVersionService(schemaVersion).init(longTableName);
        expect(schemaVersion.createTable).have.been.called.with(longTableName);
    })

    /**
     * Test: Special characters in tableName are passed through
     * Validates that table names with special characters (hyphens, underscores,
     * numbers) are passed to the underlying implementation without sanitization.
     * The database layer should handle escaping/validation.
     */
    it('init: should handle special characters in tableName', async () => {
        // Use table name with hyphens, underscores, and numbers
        initialized = false;
        created = true;
        valid = true;

        // Pass through without modification
        await new SchemaVersionService(schemaVersion).init('test-table_123');
        expect(schemaVersion.createTable).have.been.called.with('test-table_123');
    })

    /**
     * Test: Large migration info objects are saved successfully
     * Performance test validating that saving migration info with large result
     * strings (100KB) doesn't cause issues. Important for migrations that return
     * detailed results or process large datasets.
     */
    it('save: should handle very large migration info objects', async () => {
        // Create migration info with 100KB result string
        const largeMigration = {
            timestamp: 1,
            name: 'test',
            result: 'x'.repeat(100000), // 100KB result
            startedAt: Date.now(),
            finishedAt: Date.now()
        } as IMigrationInfo;

        // Should save without throwing or hanging
        await new SchemaVersionService(schemaVersion).save(largeMigration);
        expect(schemaVersion.migrations.save).have.been.called.with(largeMigration);
    })

    /**
     * Test: Migration info with undefined fields is accepted
     * Edge case test validating that incomplete migration info objects are
     * passed to the underlying service without validation. The service layer
     * should handle data integrity checks.
     */
    it('save: should handle migration info with undefined fields', async () => {
        // Create migration info with missing required fields
        const incompleteMigration = {
            timestamp: undefined,
            name: undefined
        } as any;

        // Should delegate to service (service handles validation)
        await new SchemaVersionService(schemaVersion).save(incompleteMigration);
        expect(schemaVersion.migrations.save).have.been.called;
    })

    /**
     * Test: Empty migration list is returned correctly
     * Edge case test for first-time usage when no migrations have been run yet.
     * Validates that an empty array is returned rather than null/undefined.
     */
    it('getAllMigratedScripts: should handle empty results', async () => {
        // Simulate no migrations have been executed yet
        scripts = [];

        // Retrieve empty list
        const res = await new SchemaVersionService(schemaVersion).getAllMigratedScripts();
        expect(res.length).eq(0, 'Should return empty array');
    })

    /**
     * Test: Large number of migrations performs efficiently
     * Performance test with 10,000 migration records. Validates that retrieving
     * a large migration history completes quickly (< 100ms). Important for
     * projects with many migrations accumulated over time.
     */
    it('getAllMigratedScripts: should handle large number of scripts', async () => {
        // Create 10,000 migration records
        scripts = Array.from({length: 10000}, (_, i) => ({
            timestamp: i,
            name: `Migration${i}`
        } as MigrationScript));

        // Measure retrieval performance
        const start = Date.now();
        const res = await new SchemaVersionService(schemaVersion).getAllMigratedScripts();
        const duration = Date.now() - start;

        // Verify all records returned and performance is acceptable
        expect(res.length).eq(10000, 'Should return all scripts');
        expect(duration).to.be.lessThan(100, 'Should be fast (< 100ms)');
    })
})