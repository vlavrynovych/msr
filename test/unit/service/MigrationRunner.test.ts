import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { IRunnableScript, MigrationRunner, MigrationScript, SilentLogger, ConsoleLogger, Config } from "../../../src";

describe('MigrationRunner', () => {
    let runner: MigrationRunner;
    let handler: any;
    let schemaVersionService: any;
    let logger: any;
    let tempDir: string;

    beforeEach(() => {
        const cfg = new Config();

        handler = {
            db: { test: () => {} },
            cfg: cfg,
            getName: () => 'Test Handler',
            getVersion: () => '1.0.0-test',
        };

        schemaVersionService = {
            save: sinon.stub().resolves()
        };

        logger = new SilentLogger();

        // Create temporary directory for test migration files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-runner-test-'));
    });

    afterEach(() => {
        sinon.restore();

        // Cleanup temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Constructor', () => {

        /**
         * Test: Constructor creates instance with all parameters
         * Validates that MigrationRunner can be instantiated with handler,
         * schemaVersionService, config, and logger. This tests the full constructor
         * signature with optional logger included.
         */
        it('should create instance with all parameters', () => {
            const cfg = new Config();
            const runner = new MigrationRunner(handler, schemaVersionService, cfg, logger);
            expect(runner).to.be.instanceOf(MigrationRunner);
        });

        /**
         * Test: Constructor creates instance without optional logger
         * Validates that MigrationRunner can be instantiated without the optional
         * logger parameter. This ensures the logger is truly optional and the
         * runner works in silent mode when no logger is provided.
         */
        it('should create instance without logger', () => {
            const cfg = new Config();
            const runner = new MigrationRunner(handler, schemaVersionService, cfg);
            expect(runner).to.be.instanceOf(MigrationRunner);
        });
    });

    describe('execute()', () => {
        beforeEach(() => {
            const cfg = new Config();
            runner = new MigrationRunner(handler, schemaVersionService, cfg, logger);
        });

        /**
         * Test: execute() runs scripts in chronological order by timestamp
         * Validates that when migrations are provided in random order, execute()
         * sorts them by timestamp and executes them sequentially in ascending
         * order. This ensures migrations always run in the correct sequence.
         */
        it('should execute scripts in chronological order', async () => {
            const scripts = [
                createScript(3, 'migration3'),
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];

            const result = await runner.execute(scripts);

            expect(result).to.have.lengthOf(3);
            expect(result[0].timestamp).to.equal(1);
            expect(result[1].timestamp).to.equal(2);
            expect(result[2].timestamp).to.equal(3);
        });

        /**
         * Test: execute() sets username on each executed script
         * Validates that the current system username is recorded on each
         * migration script during execution. This provides audit trail
         * information about who ran which migration.
         */
        it('should set username on each script', async () => {
            const scripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];

            const result = await runner.execute(scripts);

            expect(result[0].username).to.be.a('string').that.is.not.empty;
            expect(result[1].username).to.be.a('string').that.is.not.empty;
            expect(result[0].username).to.equal(result[1].username);
        });

        /**
         * Test: execute() records execution timing for each script
         * Validates that startedAt and finishedAt timestamps are recorded
         * for each migration. This timing data is used for performance
         * tracking and troubleshooting slow migrations.
         */
        it('should execute each script and record timing', async () => {
            const scripts = [createScript(1, 'migration1')];

            const result = await runner.execute(scripts);

            expect(result[0].startedAt).to.be.a('number');
            expect(result[0].finishedAt).to.be.a('number');
            expect(result[0].finishedAt).to.be.at.least(result[0].startedAt!);
        });

        /**
         * Test: execute() saves each script to schema version table
         * Validates that after each migration executes, its metadata is
         * persisted to the schema version table. This ensures the database
         * tracks which migrations have been applied.
         */
        it('should save each script to schema version service', async () => {
            const scripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];

            await runner.execute(scripts);

            expect(schemaVersionService.save.callCount).to.equal(2);
            expect(schemaVersionService.save.firstCall.args[0].timestamp).to.equal(1);
            expect(schemaVersionService.save.secondCall.args[0].timestamp).to.equal(2);
        });

        /**
         * Test: execute() calls script.up() and stores result
         * Validates that each migration script's up() method is invoked
         * and its return value is stored in the result property. This
         * allows migrations to return metadata about their execution.
         */
        it('should execute script.up() and store result', async () => {
            const script = createScript(1, 'migration1');
            const expectedResult = 'Migration successful';
            const upStub = sinon.stub().resolves(expectedResult);
            script.script = {
                up: upStub
            } as IRunnableScript;

            const result = await runner.execute([script]);

            expect(result[0].result).to.equal(expectedResult);
            expect(upStub.calledOnce).to.be.true;
        });

        /**
         * Test: execute() handles empty scripts array gracefully
         * Validates that when no scripts need to be executed, execute()
         * returns an empty array without errors and doesn't attempt any
         * database operations. Edge case for up-to-date databases.
         */
        it('should handle empty scripts array', async () => {
            const result = await runner.execute([]);

            expect(result).to.be.an('array').that.is.empty;
            expect(schemaVersionService.save.called).to.be.false;
        });

        /**
         * Test: execute() stops on first error and doesn't execute remaining scripts
         * Validates fail-fast behavior where if any migration fails, execution
         * stops immediately and subsequent migrations are not executed. This
         * prevents cascading failures and maintains database consistency.
         */
        it('should stop execution on first error', async () => {
            const script1 = createScript(1, 'migration1');
            const upStub1 = sinon.stub().resolves('success');
            script1.script = {
                up: upStub1
            } as IRunnableScript;

            const script2 = createScript(2, 'migration2');
            const upStub2 = sinon.stub().rejects(new Error('Migration failed'));
            script2.script = {
                up: upStub2
            } as IRunnableScript;

            const script3 = createScript(3, 'migration3');
            const upStub3 = sinon.stub().resolves('success');
            script3.script = {
                up: upStub3
            } as IRunnableScript;

            await expect(runner.execute([script1, script2, script3]))
                .to.be.rejectedWith('Migration failed');

            // First script should have been executed
            expect(upStub1.calledOnce).to.be.true;

            // Second script should have been attempted
            expect(upStub2.calledOnce).to.be.true;

            // Third script should not have been executed
            expect(upStub3.called).to.be.false;
        });

        /**
         * Test: execute() propagates schema version service errors
         * Validates that if the schema version service fails to save migration
         * metadata, the error is propagated to the caller. This ensures
         * failures in recording migrations are not silently ignored.
         */
        it('should propagate schema version save errors', async () => {
            const script = createScript(1, 'migration1');
            schemaVersionService.save.rejects(new Error('Failed to save'));

            await expect(runner.execute([script]))
                .to.be.rejectedWith('Failed to save');
        });
    });

    describe('executeOne()', () => {
        beforeEach(() => {
            const cfg = new Config();
            runner = new MigrationRunner(handler, schemaVersionService, cfg, logger);
        });

        /**
         * Test: executeOne() executes single script and returns it with metadata
         * Validates that executeOne processes a single migration script,
         * sets timing information, and returns the same script object
         * with updated properties.
         */
        it('should execute single script and return it', async () => {
            const script = createScript(1, 'migration1');

            const result = await runner.executeOne(script);

            expect(result).to.equal(script);
            expect(result.startedAt).to.be.a('number');
            expect(result.finishedAt).to.be.a('number');
        });

        /**
         * Test: executeOne() calls script.up() with correct parameters
         * Validates that the migration script's up() method receives the
         * correct parameters: database connection, migration info, and handler.
         * This contract is essential for migrations to access needed resources.
         */
        it('should call script.up() with correct parameters', async () => {
            const script = createScript(1, 'migration1');
            const upStub = sinon.stub().resolves('success');
            script.script = {
                up: upStub
            } as IRunnableScript;

            await runner.executeOne(script);

            expect(upStub.calledOnce).to.be.true;
            expect(upStub.firstCall.args[0]).to.equal(handler.db);
            expect(upStub.firstCall.args[1]).to.equal(script);
            expect(upStub.firstCall.args[2]).to.equal(handler);
        });

        /**
         * Test: executeOne() saves script metadata to schema version table
         * Validates that after executing a migration, executeOne saves
         * the script's metadata to the schema version service for tracking.
         */
        it('should save script to schema version service', async () => {
            const script = createScript(1, 'migration1');

            await runner.executeOne(script);

            expect(schemaVersionService.save.calledOnce).to.be.true;
            expect(schemaVersionService.save.firstCall.args[0]).to.equal(script);
        });

        /**
         * Test: executeOne() logs processing message when logger is provided
         * Validates that when a logger is configured, executeOne outputs
         * a processing message including the migration name. This provides
         * visibility into migration execution progress.
         */
        it('should log processing message when logger is provided', async () => {
            const loggerWithSpy = new ConsoleLogger();
            const logSpy = sinon.spy(loggerWithSpy, 'log');
            const cfg = new Config();
            const runnerWithLogger = new MigrationRunner(handler, schemaVersionService, cfg, loggerWithSpy);

            const script = createScript(1, 'migration1');

            await runnerWithLogger.executeOne(script);

            expect(logSpy.calledOnce).to.be.true;
            expect(logSpy.firstCall.args[0]).to.include('migration1');
            expect(logSpy.firstCall.args[0]).to.include('processing');

            logSpy.restore();
        });

        /**
         * Test: executeOne() works without errors when logger is undefined
         * Validates that when no logger is configured, executeOne still
         * executes successfully without attempting to log. This ensures
         * the optional logger doesn't cause null reference errors.
         */
        it('should not throw when logger is undefined', async () => {
            const cfg = new Config();
            const runnerNoLogger = new MigrationRunner(handler, schemaVersionService, cfg);
            const script = createScript(1, 'migration1');

            await expect(runnerNoLogger.executeOne(script)).to.not.be.rejected;
        });

        /**
         * Test: executeOne() propagates errors from script execution
         * Validates that if a migration script's up() method throws an error,
         * executeOne propagates that error to the caller without catching it.
         * This ensures migration failures are properly reported.
         */
        it('should propagate script execution errors', async () => {
            const script = createScript(1, 'migration1');
            script.script = {
                up: sinon.stub().rejects(new Error('Script error'))
            } as IRunnableScript;

            await expect(runner.executeOne(script))
                .to.be.rejectedWith('Script error');
        });

        /**
         * Test: executeOne() calculates and stores checksum for migration file
         * Validates that after executing a migration, its file checksum
         * is calculated and stored for integrity tracking.
         */
        it('should calculate and store checksum for migration file', async () => {
            // Create actual migration file for checksum calculation
            const filename = 'V1_migration1.ts';
            const filepath = path.join(tempDir, filename);
            fs.writeFileSync(filepath, 'export default class { async up() { return "success"; } }');

            const script = new MigrationScript(filename, filepath, 1);
            script.script = {
                up: async () => 'success'
            } as IRunnableScript;

            await runner.executeOne(script);

            expect(script.checksum).to.be.a('string');
            expect(script.checksum).to.have.lengthOf(64); // SHA256 default
        });

        /**
         * Test: executeOne() uses configured checksum algorithm
         * Validates that the runner uses the checksum algorithm
         * specified in config (MD5 vs SHA256).
         */
        it('should use configured checksum algorithm', async () => {
            const cfg = new Config();
            cfg.checksumAlgorithm = 'md5';
            const md5Runner = new MigrationRunner(handler, schemaVersionService, cfg, logger);

            // Create actual migration file
            const filename = 'V2_migration2.ts';
            const filepath = path.join(tempDir, filename);
            fs.writeFileSync(filepath, 'export default class { async up() { return "success"; } }');

            const script = new MigrationScript(filename, filepath, 2);
            script.script = {
                up: async () => 'success'
            } as IRunnableScript;

            await md5Runner.executeOne(script);

            expect(script.checksum).to.be.a('string');
            expect(script.checksum).to.have.lengthOf(32); // MD5 is 32 hex chars
        });

        /**
         * Test: executeOne() continues execution if checksum calculation fails
         * Validates that if checksum calculation fails (e.g., file not found),
         * the migration continues and checksum is not set, with a warning logged.
         */
        it('should continue execution if checksum calculation fails', async () => {
            const script = new MigrationScript('V1_nonexistent.ts', '/nonexistent/path/that/does/not/exist.ts', 1);
            script.script = {
                up: async () => 'success'
            } as IRunnableScript;

            // Should not throw, just log warning
            await expect(runner.executeOne(script)).to.not.be.rejected;

            // Checksum should be undefined
            expect(script.checksum).to.be.undefined;
        });

        /**
         * Test: executeOne() logs warning when checksum calculation fails
         * Validates that when checksum calculation fails, a warning
         * is logged with the script name and error message.
         */
        it('should log warning when checksum calculation fails', async () => {
            const loggerWithSpy = new ConsoleLogger();
            const warnSpy = sinon.spy(loggerWithSpy, 'warn');
            const cfg = new Config();
            const runnerWithLogger = new MigrationRunner(handler, schemaVersionService, cfg, loggerWithSpy);

            const script = new MigrationScript('V1_nonexistent.ts', '/nonexistent/path.ts', 1);
            script.script = {
                up: async () => 'success'
            } as IRunnableScript;

            await runnerWithLogger.executeOne(script);

            expect(warnSpy.called).to.be.true;
            const warnMessage = warnSpy.firstCall.args[0];
            expect(warnMessage).to.include('Could not calculate checksum');
            expect(warnMessage).to.include('nonexistent');

            warnSpy.restore();
        });

        /**
         * Test: executeOne() calculates checksum after migration execution
         * Validates that checksum is calculated after the migration runs,
         * ensuring timing is correct (checksum reflects executed migration).
         */
        it('should calculate checksum after migration execution', async () => {
            // Create actual migration file
            const filename = 'V3_migration3.ts';
            const filepath = path.join(tempDir, filename);
            fs.writeFileSync(filepath, 'export default class { async up() { return "success"; } }');

            const script = new MigrationScript(filename, filepath, 3);
            let checksumCalculatedAfterUp = false;

            script.script = {
                up: async () => {
                    // At this point, checksum should not be set yet
                    if (script.checksum) {
                        checksumCalculatedAfterUp = false;
                    } else {
                        checksumCalculatedAfterUp = true;
                    }
                    return 'success';
                }
            } as IRunnableScript;

            await runner.executeOne(script);

            expect(checksumCalculatedAfterUp).to.be.true;
            expect(script.checksum).to.be.a('string'); // Now it should be set
        });

        /**
         * Test: executeOne() saves checksum to schema version service
         * Validates that the checksum is included when saving migration
         * metadata to the schema version table.
         */
        it('should save checksum to schema version service', async () => {
            // Create actual migration file
            const filename = 'V4_migration4.ts';
            const filepath = path.join(tempDir, filename);
            fs.writeFileSync(filepath, 'export default class { async up() { return "success"; } }');

            const script = new MigrationScript(filename, filepath, 4);
            script.script = {
                up: async () => 'success'
            } as IRunnableScript;

            await runner.executeOne(script);

            expect(schemaVersionService.save.calledOnce).to.be.true;
            const savedScript = schemaVersionService.save.firstCall.args[0];
            expect(savedScript.checksum).to.be.a('string');
            expect(savedScript.checksum).to.equal(script.checksum);
        });
    });
});

/**
 * Helper function to create a migration script for testing.
 *
 * Creates a MigrationScript instance with a default successful up() method
 * that returns 'success'. Tests that need different behavior should override
 * the script.script property with a custom stub.
 *
 * @param timestamp - Unix timestamp for the migration (e.g., 202311020036)
 * @param name - Descriptive name for the migration without V prefix (e.g., 'add_users_table')
 * @returns MigrationScript instance with name, filepath, timestamp, and default up() method
 *
 * @example
 * const script = createScript(123, 'add_users_table');
 * // Creates script named 'V123_add_users_table.ts' at '/fake/path/V123_add_users_table.ts'
 * // with up() method that resolves to 'success'
 *
 * @example
 * // Override the up() method for custom behavior
 * const script = createScript(123, 'test');
 * script.script = { up: sinon.stub().rejects(new Error('test error')) } as IRunnableScript;
 */
function createScript(timestamp: number, name: string): MigrationScript {
    const filename = `V${timestamp}_${name}.ts`;
    const script = new MigrationScript(filename, `/fake/path/${filename}`, timestamp);
    script.script = {
        up: async () => 'success'
    } as IRunnableScript;
    return script;
}
