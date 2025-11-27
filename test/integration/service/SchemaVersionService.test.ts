import {expect, spy} from "chai";
import {afterEach} from "mocha";
import {
    SchemaVersionService,
    MigrationScript,
    Config,
    IMigrationInfo,
    ISchemaVersion,
    IMigrationScript
} from "../../../src";

describe('SchemaVersionService', () => {

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
                },
                remove(timestamp: number): Promise<void> {
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
        spy.on(schemaVersion.migrations, ['save', 'getAll', 'remove']);
    })

    afterEach(() => {
        spy.restore();
    })

    describe('init()', () => {

        /**
         * Test: Table initialization succeeds when table doesn't exist
         * Validates the happy path: when the schema version table doesn't exist,
         * init() creates it and validates it successfully. This is the first-run
         * scenario when the migration system is used for the first time.
         */
        it('should initialize table when it does not exist and is valid', async () => {
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
        it('should fail initialization when created table is invalid', async () => {
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
        it('should skip initialization when table exists and is valid', async () => {
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
        it('should fail validation when existing table is invalid', async () => {
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
        it('should throw error when table creation fails', async () => {
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
         * Test: Empty tableName is delegated to underlying service
         * Edge case test validating that SchemaVersionService doesn't perform
         * input validation on tableName - it delegates to the underlying database
         * implementation which should handle or reject empty table names.
         */
        it('should handle empty tableName gracefully', async () => {
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
        it('should handle very long tableName', async () => {
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
        it('should handle special characters in tableName', async () => {
            // Use table name with hyphens, underscores, and numbers
            initialized = false;
            created = true;
            valid = true;

            // Pass through without modification
            await new SchemaVersionService(schemaVersion).init('test-table_123');
            expect(schemaVersion.createTable).have.been.called.with('test-table_123');
        })
    })

    describe('save()', () => {

        /**
         * Test: Saving migration info delegates to underlying implementation
         * Validates that save() correctly delegates to the migrations.save() method
         * without calling any other schema version methods. This is used after each
         * successful migration to record it in the database.
         */
        it('should register migration info successfully', async () => {
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
         * Test: Large migration info objects are saved successfully
         * Performance test validating that saving migration info with large result
         * strings (100KB) doesn't cause issues. Important for migrations that return
         * detailed results or process large datasets.
         */
        it('should handle very large migration info objects', async () => {
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
        it('should handle migration info with undefined fields', async () => {
            // Create migration info with missing required fields
            const incompleteMigration: IMigrationInfo = {
                timestamp: 1,
                name: 'test',
                startedAt: Date.now(),
                finishedAt: Date.now(),
                username: 'test-user',
                result: undefined
            };

            // Should delegate to service (service handles validation)
            await new SchemaVersionService(schemaVersion).save(incompleteMigration);
            expect(schemaVersion.migrations.save).have.been.called;
        })
    })

    describe('getAllMigratedScripts()', () => {

        /**
         * Test: Getting all migrated scripts delegates to underlying implementation
         * Validates that getAllMigratedScripts() correctly retrieves the list of
         * already-executed migrations from the database without calling any other
         * schema version methods. This is used to determine which migrations to skip.
         */
        it('should retrieve all migrated scripts successfully', async () => {
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
         * Test: Empty migration list is returned correctly
         * Edge case test for first-time usage when no migrations have been run yet.
         * Validates that an empty array is returned rather than null/undefined.
         */
        it('should handle empty results', async () => {
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
        it('should handle large number of scripts', async () => {
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

    describe('remove()', () => {

        /**
         * Test: Removing migration record delegates to underlying implementation
         * Validates that remove() correctly delegates to migrations.remove() method
         * without calling any other schema version methods. This is used during
         * rollback operations to remove migration records from the tracking table.
         */
        it('should remove migration record successfully', async () => {
            // Remove a migration by timestamp
            const timestamp = 202501220100;
            await new SchemaVersionService(schemaVersion).remove(timestamp);

            // Verify only remove() was called, no other schema operations
            expect(schemaVersion.migrations.remove).have.been.called.with(timestamp);
            expect(schemaVersion.migrations.save).have.not.been.called;
            expect(schemaVersion.migrations.getAll).have.not.been.called;
            expect(schemaVersion.isInitialized).have.not.been.called;
            expect(schemaVersion.createTable).have.not.been.called;
            expect(schemaVersion.validateTable).have.not.been.called;
        })

        /**
         * Test: Removing non-existent migration is handled gracefully
         * Edge case test validating that attempting to remove a migration that
         * doesn't exist in the database is delegated to the underlying service
         * without throwing errors at the SchemaVersionService level.
         */
        it('should handle removing non-existent migration', async () => {
            // Attempt to remove a migration that doesn't exist
            const nonExistentTimestamp = 999999999999;
            await new SchemaVersionService(schemaVersion).remove(nonExistentTimestamp);

            // Should delegate to service (service handles existence checking)
            expect(schemaVersion.migrations.remove).have.been.called.with(nonExistentTimestamp);
        })

        /**
         * Test: Removing with zero timestamp is accepted
         * Edge case test with boundary value (zero). Validates that the service
         * doesn't perform timestamp validation and delegates to the underlying
         * implementation which should handle edge cases appropriately.
         */
        it('should handle zero timestamp', async () => {
            // Remove with timestamp = 0 (edge case)
            await new SchemaVersionService(schemaVersion).remove(0);

            // Should delegate without validation
            expect(schemaVersion.migrations.remove).have.been.called.with(0);
        })

        /**
         * Test: Removing with negative timestamp is accepted
         * Edge case test with invalid negative value. Validates that input
         * validation is delegated to the underlying database implementation
         * rather than performed at the service layer.
         */
        it('should handle negative timestamp', async () => {
            // Remove with negative timestamp (invalid but passed through)
            await new SchemaVersionService(schemaVersion).remove(-1);

            // Should delegate to service (service handles validation)
            expect(schemaVersion.migrations.remove).have.been.called.with(-1);
        })

        /**
         * Test: Removing with very large timestamp is accepted
         * Edge case test with maximum safe integer value. Validates that the
         * service handles large timestamp values without overflow or errors,
         * delegating to the database implementation for storage validation.
         */
        it('should handle very large timestamp', async () => {
            // Remove with very large timestamp (JavaScript max safe integer)
            const largeTimestamp = Number.MAX_SAFE_INTEGER;
            await new SchemaVersionService(schemaVersion).remove(largeTimestamp);

            // Should pass through without issues
            expect(schemaVersion.migrations.remove).have.been.called.with(largeTimestamp);
        })
    })
})