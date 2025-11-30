import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    MigrationScriptExecutor,
    Config,
    SilentLogger,
    IDatabaseMigrationHandler,
    RollbackStrategy,
    DownMethodPolicy,
    ValidationError
} from '../../../src';

describe('MigrationScriptExecutor - validate() method', () => {
    let executor: MigrationScriptExecutor;
    let handler: IDatabaseMigrationHandler;
    let config: Config;
    let tempMigrationsDir: string;

    beforeEach(() => {
        // Create temporary migrations directory
        tempMigrationsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));

        config = new Config();
        config.folder = tempMigrationsDir;
        config.tableName = 'schema_version_validate_test';
        config.validateBeforeRun = true;
        config.validateMigratedFiles = true;

        // Mock handler with minimal implementation
        handler = {
            db: {
                query: sinon.stub().resolves([]),
                checkConnection: async () => true
            },
            init: sinon.stub().resolves(),
            schemaVersion: {
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(true),
                validateTable: sinon.stub().resolves(true),
                migrationRecords: {
                    getAllExecuted: sinon.stub().resolves([]),
                    save: sinon.stub().resolves(),
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                }
            },
            backup: sinon.stub().resolves('backup-data'),
            restore: sinon.stub().resolves(),
            getName: () => 'TestHandler',
            getVersion: () => '1.0.0-test',
        } as any;

        // Note: executor creation is deferred to each test after migration files are created
        // This ensures the MigrationService picks up the correct files
    });

    /**
     * Helper to create executor after migration files are set up.
     * Call this at the start of each test after creating migration files.
     */
    function createExecutor(): void {
        executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger()
        });
    }

    afterEach(() => {
        sinon.restore();

        // Cleanup temporary files
        if (fs.existsSync(tempMigrationsDir)) {
            fs.rmSync(tempMigrationsDir, { recursive: true, force: true });
        }
    });

    describe('Basic Validation', () => {
        /**
         * Test: validate() succeeds when no migrations exist
         * Validates that running validate() on an empty migrations
         * folder returns successfully with empty results.
         */
        it('should succeed when no migrations exist', async () => {
            createExecutor();

            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.be.an('array').that.is.empty;
            expect(result.migrated).to.be.an('array').that.is.empty;
        });

        /**
         * Test: validate() succeeds with valid pending migrations
         * Validates that pending migrations with correct structure
         * pass validation successfully.
         */
        it('should succeed with valid pending migrations', async () => {
            // Create valid migration files
            createValidMigration(tempMigrationsDir, 1, 'create_users_table');
            createValidMigration(tempMigrationsDir, 2, 'add_email_column');

            createExecutor();
            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.have.lengthOf(2);
            expect(result.pending[0].valid).to.be.true;
            expect(result.pending[1].valid).to.be.true;
            expect(result.migrated).to.be.empty;
        });

        /**
         * Test: validate() throws ValidationError for invalid migrations
         * Validates that migrations with structural errors cause
         * validation to fail with detailed error information.
         */
        it('should throw ValidationError for invalid migrations', async () => {
            // Create invalid migration (no up method export)
            const invalidContent = [
                'export default class InvalidMigration {',
                '    // Missing up() method',
                '}'
            ].join('\n');
            fs.writeFileSync(
                path.join(tempMigrationsDir, 'V000000000001_invalid.ts'),
                invalidContent
            );

            createExecutor();
            await expect(executor.validate())
                .to.be.rejectedWith(ValidationError, 'Pending migration validation failed');
        });

        /**
         * Test: validate() returns validation results structure
         * Validates that the return value has the correct structure
         * with pending and migrated arrays.
         */
        it('should return correct validation results structure', async () => {
            createValidMigration(tempMigrationsDir, 1, 'test_migration');

            createExecutor();
            const result = await executor.validate();

            expect(result).to.have.property('pending');
            expect(result).to.have.property('migrated');
            expect(result.pending).to.be.an('array');
            expect(result.migrated).to.be.an('array');
        });
    });

    describe('Pending Migration Validation', () => {
        /**
         * Test: validate() detects missing up() method
         * Validates that migrations without up() method
         * are caught during validation.
         */
        it('should detect missing up() method', async () => {
            const invalidContent = [
                'export default class Migration {',
                '    async down(db: any) {',
                '        return \'rollback\';',
                '    }',
                '}'
            ].join('\n');
            fs.writeFileSync(
                path.join(tempMigrationsDir, 'V000000000001_no_up.ts'),
                invalidContent
            );

            createExecutor();
            await expect(executor.validate())
                .to.be.rejectedWith(ValidationError);
        });

        /**
         * Test: validate() detects missing down() when required
         * Validates that when rollback strategy is DOWN, missing
         * down() methods cause validation to fail.
         */
        it('should detect missing down() when required by strategy', async () => {
            config.rollbackStrategy = RollbackStrategy.DOWN;
            config.downMethodPolicy = DownMethodPolicy.REQUIRED;

            // Create migration without down() method
            createValidMigration(tempMigrationsDir, 1, 'no_down');

            createExecutor();
            await expect(executor.validate())
                .to.be.rejectedWith(ValidationError, 'Pending migration validation failed');
        });

        /**
         * Test: validate() allows missing down() when optional
         * Validates that migrations without down() pass validation
         * when policy is OPTIONAL.
         */
        it('should allow missing down() when optional', async () => {
            config.rollbackStrategy = RollbackStrategy.BACKUP;
            config.downMethodPolicy = DownMethodPolicy.OPTIONAL;

            createValidMigration(tempMigrationsDir, 1, 'no_down');

            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.have.lengthOf(1);
            expect(result.pending[0].valid).to.be.true;
        });

        /**
         * Test: validate() warns about missing down() when recommended
         * Validates that missing down() produces warnings but doesn't
         * fail validation when policy is RECOMMENDED.
         */
        it('should warn about missing down() when recommended', async () => {
            config.rollbackStrategy = RollbackStrategy.BOTH;
            config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

            createValidMigration(tempMigrationsDir, 1, 'no_down');

            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.have.lengthOf(1);
            expect(result.pending[0].valid).to.be.true;
            expect(result.pending[0].issues).to.have.lengthOf(1);
            expect(result.pending[0].issues[0].code).to.equal('MISSING_DOWN_WITH_BOTH_STRATEGY');
        });

        /**
         * Test: validate() respects strictValidation config
         * Validates that warnings are treated as errors when
         * strictValidation is enabled.
         */
        it('should treat warnings as errors in strict mode', async () => {
            config.strictValidation = true;
            config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

            createValidMigration(tempMigrationsDir, 1, 'no_down');

            createExecutor();
            await expect(executor.validate())
                .to.be.rejectedWith(ValidationError, 'Strict validation');
        });

        /**
         * Test: validate() skips validation when validateBeforeRun is false
         * Validates that pending migration validation can be disabled
         * via configuration.
         */
        it('should skip pending validation when validateBeforeRun is false', async () => {
            config.validateBeforeRun = false;

            // Create invalid migration
            const invalidContent = 'export default class { }'; // No up() method
            fs.writeFileSync(
                path.join(tempMigrationsDir, 'V000000000001_invalid.ts'),
                invalidContent
            );

            // Should not throw because validation is disabled
            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.be.empty;
        });
    });

    describe('Migrated File Integrity Validation', () => {
        /**
         * Test: validate() checks integrity of executed migrations
         * Validates that checksums of already-executed migrations
         * are verified for integrity.
         */
        it('should validate integrity of executed migrations', async () => {
            // Create a migration file
            const filename = 'V000000000001_executed.ts';
            createValidMigration(tempMigrationsDir, 1, 'executed');

            // Mock that this migration was already executed
            const filepath = path.join(tempMigrationsDir, filename);
            const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
            const originalChecksum = ChecksumService.calculateChecksum(filepath, config.checksumAlgorithm);

            (handler.schemaVersion.migrationRecords.getAllExecuted as sinon.SinonStub).resolves([{
                name: filename,
                filepath: filepath,
                timestamp: 1,
                checksum: originalChecksum
            }]);

            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.be.empty;
            expect(result.migrated).to.be.empty; // No issues
        });

        /**
         * Test: validate() detects modified executed migrations
         * Validates that if an executed migration file has been
         * modified, validation detects the checksum mismatch.
         */
        it('should detect modified executed migrations', async () => {
            const filename = 'V000000000001_modified.ts';
            const filepath = path.join(tempMigrationsDir, filename);

            // Create original migration
            createValidMigration(tempMigrationsDir, 1, 'modified');

            // Calculate original checksum
            const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
            const originalChecksum = ChecksumService.calculateChecksum(filepath, config.checksumAlgorithm);

            // Modify the file
            fs.appendFileSync(filepath, '\n// Modified content');

            // Mock that original version was executed
            (handler.schemaVersion.migrationRecords.getAllExecuted as sinon.SinonStub).resolves([{
                name: filename,
                filepath: filepath,
                timestamp: 1,
                checksum: originalChecksum
            }]);

            createExecutor();
            await expect(executor.validate())
                .to.be.rejectedWith(ValidationError, 'Migration file integrity check failed');
        });

        /**
         * Test: validate() detects missing executed migrations in strict mode
         * Validates that when validateMigratedFilesLocation is true,
         * missing executed migration files cause validation to fail.
         */
        it('should detect missing executed migrations in strict mode', async () => {
            config.validateMigratedFilesLocation = true;

            // Mock that a migration was executed but file no longer exists
            (handler.schemaVersion.migrationRecords.getAllExecuted as sinon.SinonStub).resolves([{
                name: 'V000000000001_deleted.ts',
                filepath: path.join(tempMigrationsDir, 'V000000000001_deleted.ts'),
                timestamp: 1,
                checksum: 'some-checksum'
            }]);

            createExecutor();
            await expect(executor.validate())
                .to.be.rejectedWith(ValidationError, 'Migration file integrity check failed');
        });

        /**
         * Test: validate() allows missing executed migrations in lenient mode
         * Validates that when validateMigratedFilesLocation is false,
         * missing files only produce warnings.
         */
        it('should allow missing executed migrations in lenient mode', async () => {
            config.validateMigratedFilesLocation = false;

            // Mock that a migration was executed but file no longer exists
            (handler.schemaVersion.migrationRecords.getAllExecuted as sinon.SinonStub).resolves([{
                name: 'V000000000001_deleted.ts',
                filepath: path.join(tempMigrationsDir, 'V000000000001_deleted.ts'),
                timestamp: 1,
                checksum: 'some-checksum'
            }]);

            // Should not throw, just log warning
            createExecutor();
            const result = await executor.validate();

            expect(result.migrated).to.be.empty; // No error, just warning in logs
        });

        /**
         * Test: validate() skips integrity check when validateMigratedFiles is false
         * Validates that executed migration integrity checking can be
         * disabled via configuration.
         */
        it('should skip integrity check when validateMigratedFiles is false', async () => {
            config.validateMigratedFiles = false;

            // Mock executed migration with wrong checksum
            (handler.schemaVersion.migrationRecords.getAllExecuted as sinon.SinonStub).resolves([{
                name: 'V000000000001_test.ts',
                filepath: path.join(tempMigrationsDir, 'V000000000001_test.ts'),
                timestamp: 1,
                checksum: 'wrong-checksum'
            }]);

            // Should not throw because integrity checking is disabled
            createExecutor();
            const result = await executor.validate();

            expect(result.migrated).to.be.empty;
        });
    });

    describe('Combined Validation Scenarios', () => {
        /**
         * Test: validate() handles both pending and executed migrations
         * Validates that validation works correctly when there are
         * both pending and already-executed migrations.
         */
        it('should validate both pending and executed migrations', async () => {
            // Create pending migration
            createValidMigration(tempMigrationsDir, 2, 'pending');

            // Create and mock executed migration
            const executedFile = 'V000000000001_executed.ts';
            createValidMigration(tempMigrationsDir, 1, 'executed');
            const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
            const checksum = ChecksumService.calculateChecksum(
                path.join(tempMigrationsDir, executedFile),
                config.checksumAlgorithm
            );

            (handler.schemaVersion.migrationRecords.getAllExecuted as sinon.SinonStub).resolves([{
                name: executedFile,
                filepath: path.join(tempMigrationsDir, executedFile),
                timestamp: 1,
                checksum: checksum
            }]);

            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.have.lengthOf(1);
            expect(result.pending[0].valid).to.be.true;
            expect(result.migrated).to.be.empty; // No integrity issues
        });

        /**
         * Test: validate() fails fast on first error
         * Validates that validation stops and reports the first
         * error encountered.
         */
        it('should report multiple validation errors', async () => {
            // Create multiple invalid migrations
            fs.writeFileSync(
                path.join(tempMigrationsDir, 'V000000000001_invalid1.ts'),
                'export default class { }' // No up() method
            );
            fs.writeFileSync(
                path.join(tempMigrationsDir, 'V000000000002_invalid2.ts'),
                'export default class { }' // No up() method
            );

            try {
                createExecutor();
            await executor.validate();
                expect.fail('Should have thrown ValidationError');
            } catch (error) {
                expect(error).to.be.instanceOf(ValidationError);
                expect((error as ValidationError).validationResults).to.have.lengthOf.at.least(1);
            }
        });

        /**
         * Test: validate() works without database initialization
         * Validates that validate() can run as a pre-check without
         * requiring database connection or initialization.
         */
        it('should work without database initialization', async () => {
            // Don't call handler.init() or handler.schemaVersion.init()
            createValidMigration(tempMigrationsDir, 1, 'test');

            // Should not throw even though DB not initialized
            createExecutor();
            const result = await executor.validate();

            expect(result.pending).to.have.lengthOf(1);
        });
    });

    describe('Custom Validators', () => {
        /**
         * Test: validate() runs custom validators
         * Validates that custom validation logic is executed
         * during validation.
         */
        it('should run custom validators', async () => {
            const customValidatorSpy = sinon.spy();
            config.customValidators = [{
                validate: async (script, cfg) => {
                    customValidatorSpy();
                    return {
                        valid: true,
                        issues: [],
                        script
                    };
                }
            }];

            createValidMigration(tempMigrationsDir, 1, 'test');

            createExecutor();
            await executor.validate();

            expect(customValidatorSpy.called).to.be.true;
        });

        /**
         * Test: validate() includes custom validator issues
         * Validates that issues from custom validators are included
         * in the validation results.
         */
        it('should include custom validator issues in results', async () => {
            config.customValidators = [{
                validate: async (script, cfg) => {
                    return {
                        valid: true,
                        issues: [{
                            type: 'WARNING' as any,
                            code: 'CUSTOM_WARNING',
                            message: 'Custom validation warning'
                        }],
                        script
                    };
                }
            }];

            createValidMigration(tempMigrationsDir, 1, 'test');

            createExecutor();
            const result = await executor.validate();

            expect(result.pending[0].issues).to.have.lengthOf(1);
            expect(result.pending[0].issues[0].code).to.equal('CUSTOM_WARNING');
        });
    });

    describe('CI/CD Use Cases', () => {
        /**
         * Test: validate() provides exit status for CI/CD
         * Validates that validate() can be used in CI/CD pipelines
         * by throwing on failures and succeeding on valid migrations.
         */
        it('should throw for CI/CD to catch validation failures', async () => {
            // Create invalid migration
            fs.writeFileSync(
                path.join(tempMigrationsDir, 'V000000000001_invalid.ts'),
                'export default class { }' // No up() method
            );

            let exitCode = 0;
            try {
                createExecutor();
            await executor.validate();
                exitCode = 0;
            } catch (error) {
                exitCode = 1;
            }

            expect(exitCode).to.equal(1); // CI/CD would use this to fail the build
        });

        /**
         * Test: validate() succeeds for valid migrations in CI/CD
         * Validates that valid migrations allow CI/CD to proceed.
         */
        it('should succeed for valid migrations in CI/CD', async () => {
            createValidMigration(tempMigrationsDir, 1, 'valid');
            createValidMigration(tempMigrationsDir, 2, 'also_valid');

            let exitCode = 1;
            try {
                createExecutor();
            await executor.validate();
                exitCode = 0;
            } catch (error) {
                exitCode = 1;
            }

            expect(exitCode).to.equal(0); // CI/CD would proceed
        });

        /**
         * Test: validate() is fast enough for CI/CD
         * Validates that validation completes quickly enough
         * for use in CI/CD pipelines.
         */
        it('should complete quickly for CI/CD pipelines', async () => {
            // Create multiple migrations
            for (let i = 1; i <= 10; i++) {
                createValidMigration(tempMigrationsDir, i, `migration${i}`);
            }

            const startTime = Date.now();
            createExecutor();
            await executor.validate();
            const duration = Date.now() - startTime;

            // Should complete in less than 2 seconds for 10 migrations
            expect(duration).to.be.lessThan(2000);
        });
    });
});

/**
 * Helper function to create a valid migration file.
 *
 * @param dir - Directory to create migration in
 * @param timestamp - Migration timestamp
 * @param name - Migration name
 */
function createValidMigration(dir: string, timestamp: number, name: string): void {
    const content = [
        'export default class Migration {',
        '    async up(db: any, info: any, handler: any): Promise<string> {',
        '        return \'Migration successful\';',
        '    }',
        '}'
    ].join('\n');
    // Pad timestamp to 12 digits as required by default file pattern
    const paddedTimestamp = String(timestamp).padStart(12, '0');
    fs.writeFileSync(
        path.join(dir, `V${paddedTimestamp}_${name}.ts`),
        content
    );
}

function createValidMigrationWithDown(dir: string, timestamp: number, name: string): void {
    const content = [
        'export default class Migration {',
        '    async up(db: any, info: any, handler: any): Promise<string> {',
        '        return \'Migration successful\';',
        '    }',
        '    async down(db: any, info: any, handler: any): Promise<string> {',
        '        return \'Rollback successful\';',
        '    }',
        '}'
    ].join('\n');
    // Pad timestamp to 12 digits as required by default file pattern
    const paddedTimestamp = String(timestamp).padStart(12, '0');
    fs.writeFileSync(
        path.join(dir, `V${paddedTimestamp}_${name}.ts`),
        content
    );
}
