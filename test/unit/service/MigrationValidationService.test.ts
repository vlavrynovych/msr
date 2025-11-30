import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'node:fs';
import {
    MigrationValidationService,
    MigrationScript,
    Config,
    SilentLogger,
    ValidationIssueType,
    ValidationErrorCode,
    ValidationWarningCode,
    DownMethodPolicy,
    RollbackStrategy,
    IRunnableScript,
    IMigrationValidator,
    IValidationResult,
    LoaderRegistry,
    ILoaderRegistry
} from "../../../src";

describe('MigrationValidationService', () => {
    let validator: MigrationValidationService;
    let config: Config;
    let fsExistsSyncStub: sinon.SinonStub;
    let loaderRegistry: ILoaderRegistry;

    beforeEach(() => {
        validator = new MigrationValidationService(new SilentLogger());
        config = new Config();
        loaderRegistry = LoaderRegistry.createDefault();
        fsExistsSyncStub = sinon.stub(fs, 'existsSync');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Constructor', () => {
        /**
         * Test: Constructor creates instance with default logger
         * Validates that MigrationValidationService can be instantiated without
         * any parameters, using the default ConsoleLogger (covers line 48).
         */
        it('should create instance with default logger', () => {
            const service = new MigrationValidationService();
            expect(service).to.be.instanceOf(MigrationValidationService);
        });

        /**
         * Test: Constructor creates instance with logger only
         * Validates that MigrationValidationService can be instantiated with
         * just a logger parameter without custom validators.
         */
        it('should create instance with logger only', () => {
            const service = new MigrationValidationService(new SilentLogger());
            expect(service).to.be.instanceOf(MigrationValidationService);
        });

        /**
         * Test: Constructor creates instance with logger and custom validators
         * Validates that custom validators can be passed during instantiation
         * for extensible validation logic.
         */
        it('should create instance with custom validators', () => {
            const customValidator: IMigrationValidator = {
                validate: async () => ({ valid: true, issues: [], script: {} as MigrationScript })
            };
            const service = new MigrationValidationService(new SilentLogger(), [customValidator]);
            expect(service).to.be.instanceOf(MigrationValidationService);
        });
    });

    describe('validateAll()', () => {
        /**
         * Test: validateAll() returns results for all scripts
         * Validates that when multiple scripts are provided, validateAll
         * returns a validation result for each one.
         */
        it('should validate all scripts and return results', async () => {
            const scripts = [
                createValidScript(1, 'migration1'),
                createValidScript(2, 'migration2')
            ];

            fsExistsSyncStub.returns(true);

            const results = await validator.validateAll(scripts, config, loaderRegistry);

            expect(results).to.have.lengthOf(2);
            expect(results[0].valid).to.be.true;
            expect(results[1].valid).to.be.true;
        });

        /**
         * Test: validateAll() handles empty scripts array
         * Validates that validateAll returns an empty array when no scripts
         * are provided, without throwing errors.
         */
        it('should handle empty scripts array', async () => {
            const results = await validator.validateAll([], config, loaderRegistry);
            expect(results).to.be.an('array').that.is.empty;
        });

        /**
         * Test: validateAll() continues validation even after errors
         * Validates that when one script has validation errors, validateAll
         * continues to validate remaining scripts and returns all results.
         */
        it('should continue validation even if one script fails', async () => {
            const validScript = createValidScript(1, 'migration1');
            const invalidScript = new MigrationScript('V2_migration2.ts', '/nonexistent/path.ts', 2);

            fsExistsSyncStub.withArgs(validScript.filepath).returns(true);
            fsExistsSyncStub.withArgs(invalidScript.filepath).returns(false);

            const results = await validator.validateAll([validScript, invalidScript], config, loaderRegistry);

            expect(results).to.have.lengthOf(2);
            expect(results[0].valid).to.be.true;
            expect(results[1].valid).to.be.false;
        });
    });

    describe('validateOne() - Structure Validation', () => {
        /**
         * Test: validateOne() detects missing file
         * Validates that when a migration script file doesn't exist at the
         * specified path, a FILE_NOT_FOUND error is reported.
         */
        it('should detect missing file', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(false);

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues).to.have.lengthOf(1);
            expect(result.issues[0].type).to.equal(ValidationIssueType.ERROR);
            expect(result.issues[0].code).to.equal(ValidationErrorCode.FILE_NOT_FOUND);
        });

        /**
         * Test: validateOne() detects initialization failure
         * Validates that when script.init() fails (e.g., syntax errors),
         * an appropriate error is reported based on the error message.
         */
        it('should detect script initialization failure', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);

            // Restore and re-stub init() to reject
            (script.init as sinon.SinonStub).restore();
            sinon.stub(script, 'init').rejects(new Error('Cannot parse migration script: syntax error'));

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues).to.have.lengthOf(1);
            expect(result.issues[0].type).to.equal(ValidationIssueType.ERROR);
            expect(result.issues[0].code).to.equal(ValidationErrorCode.IMPORT_FAILED);
        });

        /**
         * Test: validateOne() detects no export
         * Validates that when a migration file has no executable content
         * (no class with up() method), a NO_EXPORT error is reported.
         */
        it('should detect missing exports', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            // Restore and re-stub init() to reject
            (script.init as sinon.SinonStub).restore();

            sinon.stub(script, 'init').rejects(new Error('no executable content found'));

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.NO_EXPORT);
        });

        /**
         * Test: validateOne() detects multiple exports
         * Validates that when a migration file exports multiple classes
         * with up() methods, a MULTIPLE_EXPORTS error is reported.
         */
        it('should detect multiple exports', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);

            // Restore and re-stub init() to reject
            (script.init as sinon.SinonStub).restore();
            sinon.stub(script, 'init').rejects(new Error('multiple executable instances were found'));

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.MULTIPLE_EXPORTS);
        });

        /**
         * Test: validateOne() detects not instantiable class
         * Validates that when a migration class cannot be instantiated,
         * a NOT_INSTANTIABLE error is reported.
         */
        it('should detect not instantiable class', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);

            // Restore and re-stub init() to reject
            (script.init as sinon.SinonStub).restore();
            sinon.stub(script, 'init').rejects(new Error('Constructor threw error'));

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.NOT_INSTANTIABLE);
        });
    });

    describe('validateOne() - Interface Validation', () => {
        /**
         * Test: validateOne() detects missing up() method
         * Validates that when a migration class doesn't have an up() method,
         * a MISSING_UP_METHOD error is reported.
         */
        it('should detect missing up() method', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            script.script = {} as IRunnableScript;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.MISSING_UP_METHOD);
        });

        /**
         * Test: validateOne() detects invalid up() signature
         * Validates that when up() exists but is not a function,
         * an INVALID_UP_SIGNATURE error is reported.
         */
        it('should detect invalid up() signature', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            script.script = { up: 'not a function' } as unknown as IRunnableScript;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.INVALID_UP_SIGNATURE);
        });

        /**
         * Test: validateOne() warns when up() is not async
         * Validates that when up() is not declared as async, a warning
         * is issued (not an error, since it might return Promise manually).
         */
        it('should warn when up() is not async', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            script.script = {
                up: function() { return Promise.resolve('success'); }
            } as unknown as IRunnableScript;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.true; // Warning, not error
            expect(result.issues).to.have.lengthOf(1);
            expect(result.issues[0].type).to.equal(ValidationIssueType.WARNING);
            expect(result.issues[0].code).to.equal('UP_NOT_ASYNC_FUNCTION');
        });

        /**
         * Test: validateOne() detects invalid down() signature
         * Validates that when down() exists but is not a function,
         * an INVALID_DOWN_SIGNATURE error is reported.
         */
        it('should detect invalid down() signature', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            script.script = {
                up: async () => 'success',
                down: 'not a function'
            } as unknown as IRunnableScript;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.INVALID_DOWN_SIGNATURE);
        });

        /**
         * Test: validateOne() warns when down() is not async
         * Validates that when down() is not declared as async, a warning
         * is issued.
         */
        it('should warn when down() is not async', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            script.script = {
                up: async () => 'success',
                down: function() { return Promise.resolve('rollback'); }
            } as unknown as IRunnableScript;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.true; // Warning, not error
            const downWarning = result.issues.find(i => i.code === 'DOWN_NOT_ASYNC_FUNCTION');
            expect(downWarning).to.exist;
            expect(downWarning!.type).to.equal(ValidationIssueType.WARNING);
        });
    });

    describe('validateOne() - down() Method Policy', () => {
        /**
         * Test: validateOne() requires down() when policy is REQUIRED
         * Validates that when downMethodPolicy is REQUIRED and down() is missing,
         * a MISSING_DOWN_WITH_DOWN_STRATEGY error is reported.
         */
        it('should require down() when policy is REQUIRED', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            config.downMethodPolicy = DownMethodPolicy.REQUIRED;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.MISSING_DOWN_WITH_DOWN_STRATEGY);
        });

        /**
         * Test: validateOne() warns about missing down() when policy is RECOMMENDED
         * Validates that when downMethodPolicy is RECOMMENDED and down() is missing,
         * a warning is issued but validation passes.
         */
        it('should warn about missing down() when policy is RECOMMENDED', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.true; // Warning, not error
            expect(result.issues).to.have.lengthOf(1);
            expect(result.issues[0].type).to.equal(ValidationIssueType.WARNING);
            expect(result.issues[0].code).to.equal(ValidationWarningCode.MISSING_DOWN_WITH_BOTH_STRATEGY);
        });

        /**
         * Test: validateOne() allows missing down() when policy is OPTIONAL
         * Validates that when downMethodPolicy is OPTIONAL and down() is missing,
         * no issues are reported.
         */
        it('should allow missing down() when policy is OPTIONAL', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            config.downMethodPolicy = DownMethodPolicy.OPTIONAL;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.true;
            expect(result.issues).to.be.empty;
        });

        /**
         * Test: validateOne() auto-detects policy from rollbackStrategy DOWN
         * Validates that when downMethodPolicy is AUTO and rollbackStrategy is DOWN,
         * down() method becomes REQUIRED.
         */
        it('should auto-detect REQUIRED policy when rollbackStrategy is DOWN', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            config.downMethodPolicy = DownMethodPolicy.AUTO;
            config.rollbackStrategy = RollbackStrategy.DOWN;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.MISSING_DOWN_WITH_DOWN_STRATEGY);
        });

        /**
         * Test: validateOne() auto-detects policy from rollbackStrategy BOTH
         * Validates that when downMethodPolicy is AUTO and rollbackStrategy is BOTH,
         * down() method becomes RECOMMENDED (warning).
         */
        it('should auto-detect RECOMMENDED policy when rollbackStrategy is BOTH', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            config.downMethodPolicy = DownMethodPolicy.AUTO;
            config.rollbackStrategy = RollbackStrategy.BOTH;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.true;
            expect(result.issues[0].code).to.equal(ValidationWarningCode.MISSING_DOWN_WITH_BOTH_STRATEGY);
        });

        /**
         * Test: validateOne() auto-detects policy from rollbackStrategy BACKUP
         * Validates that when downMethodPolicy is AUTO and rollbackStrategy is BACKUP,
         * down() method becomes OPTIONAL.
         */
        it('should auto-detect OPTIONAL policy when rollbackStrategy is BACKUP', async () => {
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);
            config.downMethodPolicy = DownMethodPolicy.AUTO;
            config.rollbackStrategy = RollbackStrategy.BACKUP;

            const result = await validator.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.true;
            expect(result.issues).to.be.empty;
        });
    });

    describe('validateOne() - Custom Validators', () => {
        /**
         * Test: validateOne() runs custom validators
         * Validates that custom validators are executed and their issues
         * are included in the final validation result.
         */
        it('should run custom validators and include their issues', async () => {
            const customValidator: IMigrationValidator = {
                validate: async (script: MigrationScript, cfg: Config) => {
                    return {
                        valid: true,
                        issues: [{
                            type: ValidationIssueType.WARNING,
                            code: 'CUSTOM_WARNING',
                            message: 'Custom validation warning'
                        }],
                        script
                    };
                }
            };

            const validatorWithCustom = new MigrationValidationService(new SilentLogger(), [customValidator]);
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);

            const result = await validatorWithCustom.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.true;
            expect(result.issues).to.have.lengthOf(1);
            expect(result.issues[0].code).to.equal('CUSTOM_WARNING');
        });

        /**
         * Test: validateOne() skips custom validators if built-in validation fails
         * Validates that when built-in validation finds errors, custom validators
         * are not executed to save time.
         */
        it('should skip custom validators if built-in validation fails', async () => {
            const customValidatorSpy = sinon.spy();
            const customValidator: IMigrationValidator = {
                validate: async (script: MigrationScript, cfg: Config) => {
                    customValidatorSpy();
                    return { valid: true, issues: [], script };
                }
            };

            const validatorWithCustom = new MigrationValidationService(new SilentLogger(), [customValidator]);
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(false); // File doesn't exist - built-in validation fails

            const result = await validatorWithCustom.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(customValidatorSpy.called).to.be.false;
        });

        /**
         * Test: validateOne() handles custom validator errors
         * Validates that when a custom validator throws an error, it's caught
         * and reported as a CUSTOM_VALIDATION_FAILED error.
         */
        it('should handle custom validator errors', async () => {
            const customValidator: IMigrationValidator = {
                validate: async () => {
                    throw new Error('Custom validator crashed');
                }
            };

            const validatorWithCustom = new MigrationValidationService(new SilentLogger(), [customValidator]);
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(true);

            const result = await validatorWithCustom.validateOne(script, config, loaderRegistry);

            expect(result.valid).to.be.false;
            expect(result.issues[0].code).to.equal(ValidationErrorCode.CUSTOM_VALIDATION_FAILED);
            expect(result.issues[0].message).to.include('Custom validator crashed');
        });
    });

    describe('validateMigratedFileIntegrity()', () => {
        /**
         * Test: validateMigratedFileIntegrity() returns empty when feature disabled
         * Validates that when validateMigratedFiles is false, no validation
         * is performed and an empty array is returned.
         */
        it('should return empty array when feature is disabled', async () => {
            config.validateMigratedFiles = false;
            const scripts = [createValidScript(1, 'migration1')];

            const issues = await validator.validateMigratedFileIntegrity(scripts, config);

            expect(issues).to.be.empty;
        });

        /**
         * Test: validateMigratedFileIntegrity() detects missing file in strict mode
         * Validates that when validateMigratedFilesLocation is true and a file
         * is missing, a MIGRATED_FILE_MISSING error is reported.
         */
        it('should detect missing file in strict mode', async () => {
            config.validateMigratedFiles = true;
            config.validateMigratedFilesLocation = true;
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(false);

            const issues = await validator.validateMigratedFileIntegrity([script], config);

            expect(issues).to.have.lengthOf(1);
            expect(issues[0].type).to.equal(ValidationIssueType.ERROR);
            expect(issues[0].code).to.equal(ValidationErrorCode.MIGRATED_FILE_MISSING);
        });

        /**
         * Test: validateMigratedFileIntegrity() allows missing file in lenient mode
         * Validates that when validateMigratedFilesLocation is false and a file
         * is missing, no error is reported (just logged as warning).
         */
        it('should allow missing file in lenient mode', async () => {
            config.validateMigratedFiles = true;
            config.validateMigratedFilesLocation = false;
            const script = createValidScript(1, 'migration1');
            fsExistsSyncStub.returns(false);

            const issues = await validator.validateMigratedFileIntegrity([script], config);

            expect(issues).to.be.empty; // No error, just warning in logs
        });

        /**
         * Test: validateMigratedFileIntegrity() detects checksum mismatch
         * Validates that when a file's checksum doesn't match the stored value,
         * a MIGRATED_FILE_CHECKSUM_MISMATCH error is reported.
         */
        it('should detect checksum mismatch', async () => {
            config.validateMigratedFiles = true;
            config.checksumAlgorithm = 'sha256';

            const script = createValidScript(1, 'migration1');
            script.checksum = 'original-checksum';

            fsExistsSyncStub.returns(true);

            // Mock ChecksumService to return different checksum
            const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
            const checksumStub = sinon.stub(ChecksumService, 'calculateChecksum').returns('modified-checksum');

            const issues = await validator.validateMigratedFileIntegrity([script], config);

            expect(issues).to.have.lengthOf(1);
            expect(issues[0].type).to.equal(ValidationIssueType.ERROR);
            expect(issues[0].code).to.equal(ValidationErrorCode.MIGRATED_FILE_CHECKSUM_MISMATCH);
            expect(issues[0].details).to.include('original-checksum');
            expect(issues[0].details).to.include('modified-checksum');

            checksumStub.restore();
        });

        /**
         * Test: validateMigratedFileIntegrity() passes when checksum matches
         * Validates that when a file's checksum matches the stored value,
         * no issues are reported.
         */
        it('should pass when checksum matches', async () => {
            config.validateMigratedFiles = true;
            config.checksumAlgorithm = 'sha256';

            const script = createValidScript(1, 'migration1');
            script.checksum = 'correct-checksum';

            fsExistsSyncStub.returns(true);

            const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
            const checksumStub = sinon.stub(ChecksumService, 'calculateChecksum').returns('correct-checksum');

            const issues = await validator.validateMigratedFileIntegrity([script], config);

            expect(issues).to.be.empty;

            checksumStub.restore();
        });

        /**
         * Test: validateMigratedFileIntegrity() skips checksum if not stored
         * Validates that when a script has no stored checksum, checksum
         * validation is skipped for that script.
         */
        it('should skip checksum validation when checksum not stored', async () => {
            config.validateMigratedFiles = true;

            const script = createValidScript(1, 'migration1');
            // No checksum set

            fsExistsSyncStub.returns(true);

            const issues = await validator.validateMigratedFileIntegrity([script], config);

            expect(issues).to.be.empty;
        });

        /**
         * Test: validateMigratedFileIntegrity() handles file read errors
         * Validates that when calculating checksum fails (e.g., file unreadable),
         * an appropriate error is reported.
         */
        it('should handle file read errors during checksum calculation', async () => {
            config.validateMigratedFiles = true;

            const script = createValidScript(1, 'migration1');
            script.checksum = 'stored-checksum';

            fsExistsSyncStub.returns(true);

            const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
            const checksumStub = sinon.stub(ChecksumService, 'calculateChecksum')
                .throws(new Error('Permission denied'));

            const issues = await validator.validateMigratedFileIntegrity([script], config);

            expect(issues).to.have.lengthOf(1);
            expect(issues[0].type).to.equal(ValidationIssueType.ERROR);
            expect(issues[0].code).to.equal(ValidationErrorCode.IMPORT_FAILED);
            expect(issues[0].details).to.include('Permission denied');

            checksumStub.restore();
        });

        /**
         * Test: validateMigratedFileIntegrity() validates multiple scripts
         * Validates that integrity validation works correctly with multiple
         * scripts, reporting issues for each problematic script.
         */
        it('should validate multiple scripts', async () => {
            config.validateMigratedFiles = true;
            config.validateMigratedFilesLocation = true;

            const script1 = createValidScript(1, 'migration1');
            script1.checksum = 'checksum1';

            const script2 = createValidScript(2, 'migration2');
            script2.checksum = 'checksum2';

            const script3 = createValidScript(3, 'migration3');
            // No checksum

            fsExistsSyncStub.withArgs(script1.filepath).returns(true);
            fsExistsSyncStub.withArgs(script2.filepath).returns(false); // Missing
            fsExistsSyncStub.withArgs(script3.filepath).returns(true);

            const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
            const checksumStub = sinon.stub(ChecksumService, 'calculateChecksum');
            checksumStub.withArgs(script1.filepath).returns('checksum1'); // Matches

            const issues = await validator.validateMigratedFileIntegrity([script1, script2, script3], config);

            expect(issues).to.have.lengthOf(1); // Only script2 has issue
            expect(issues[0].code).to.equal(ValidationErrorCode.MIGRATED_FILE_MISSING);

            checksumStub.restore();
        });
    });
});

/**
 * Helper function to create a valid migration script for testing.
 *
 * Creates a MigrationScript instance with a default valid up() method.
 * The script is pre-initialized (script.script is set) and init() is
 * stubbed to resolve successfully, simulating a migration that has
 * already been loaded without needing the actual file.
 *
 * Tests that need to test init() failure behavior should re-stub it
 * to reject with the desired error.
 *
 * @param timestamp - Unix timestamp for the migration
 * @param name - Descriptive name for the migration
 * @returns MigrationScript instance with valid structure and stubbed init
 */
function createValidScript(timestamp: number, name: string): MigrationScript {
    const filename = `V${timestamp}_${name}.ts`;
    const filepath = `/fake/path/${filename}`;
    const script = new MigrationScript(filename, filepath, timestamp);

    // Set up a valid script object (simulates successful init)
    script.script = {
        up: async () => 'success'
    } as IRunnableScript;

    // Stub init() to prevent actual file loading
    // Tests that need init() to fail should restore and re-stub
    sinon.stub(script, 'init').resolves();

    return script;
}
