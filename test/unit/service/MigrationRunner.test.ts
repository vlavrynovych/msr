import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { IRunnableScript, MigrationRunner, MigrationScript, SilentLogger, ConsoleLogger, Config, SummaryFormat } from "../../../src";
const { ExecutionSummaryHook } = require('../../../src/hooks/ExecutionSummaryHook');
const { ExecutionSummaryLogger } = require('../../../src/service/ExecutionSummaryLogger');

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

describe('Transaction Management (v0.5.0)', () => {
    let runner: MigrationRunner;
    let handler: any;
    let schemaVersionService: any;
    let logger: any;

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
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('PER_MIGRATION Mode', () => {

        it('should wrap each migration in its own transaction', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
            );

            const scripts = [
                createScript(1, 'first'),
                createScript(2, 'second'),
                createScript(3, 'third')
            ];

            await runner.execute(scripts);

            // Should call begin/commit for each migration (3 times)
            expect(transactionManager.begin.callCount).to.equal(3);
            expect(transactionManager.commit.callCount).to.equal(3);
            expect(transactionManager.rollback.callCount).to.equal(0);
        });

        it('should rollback failed migration transaction', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
            );

            const script1 = createScript(1, 'first');
            const script2 = createScript(2, 'second');
            script2.script = {
                up: async () => { throw new Error('Migration failed'); }
            } as IRunnableScript;

            const scripts = [script1, script2];

            let error: Error | undefined;
            try {
                await runner.execute(scripts);
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
            // First migration: begin + commit
            // Second migration: begin + rollback (on failure)
            expect(transactionManager.begin.callCount).to.equal(2);
            expect(transactionManager.commit.callCount).to.equal(1);
            expect(transactionManager.rollback.callCount).to.equal(1);
        });

        it('should call transaction hooks for each migration', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                beforeTransactionBegin: sinon.stub().resolves(),
                afterTransactionBegin: sinon.stub().resolves(),
                beforeCommit: sinon.stub().resolves(),
                afterCommit: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                hooks as any
            );

            const scripts = [createScript(1, 'test'), createScript(2, 'test2')];
            await runner.execute(scripts);

            // Hooks should be called for each migration
            expect(hooks.beforeTransactionBegin.callCount).to.equal(2);
            expect(hooks.afterTransactionBegin.callCount).to.equal(2);
            expect(hooks.beforeCommit.callCount).to.equal(2);
            expect(hooks.afterCommit.callCount).to.equal(2);
        });

        it('should record transaction metrics through ExecutionSummaryHook', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.logging = {
                enabled: true,
                logSuccessful: true,
                path: './test-logs/summary-hook',
                format: SummaryFormat.JSON,
                maxFiles: 0
            };

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            // Create a proper handler for ExecutionSummaryHook
            const testHandler = {
                db: { test: () => {} },
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0-test'
            };

            // Create ExecutionSummaryHook (it creates its own ExecutionSummaryLogger)
            const executionSummaryHook = new ExecutionSummaryHook(cfg, logger, testHandler as any);

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                executionSummaryHook as any
            );

            const scripts = [createScript(1, 'test1'), createScript(2, 'test2')];
            await runner.execute(scripts);

            // Verify transactions were called
            expect(transactionManager.begin.callCount).to.equal(2);
            expect(transactionManager.commit.callCount).to.equal(2);

            // Verify ExecutionSummaryHook recorded transaction metrics (covers lines 144, 152)
            const summaryLogger = (executionSummaryHook as any).summaryLogger;
            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.transactionsStarted).to.equal(2);
            expect(metrics.transactionsCommitted).to.equal(2);
        });

        it('should record transaction rollback through ExecutionSummaryHook', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.logging = {
                enabled: true,
                logSuccessful: false, // Only log failures
                path: './test-logs/summary-hook',
                format: SummaryFormat.JSON,
                maxFiles: 0
            };

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            // Create a proper handler for ExecutionSummaryHook
            const testHandler = {
                db: { test: () => {} },
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0-test'
            };

            // Create ExecutionSummaryHook (it creates its own ExecutionSummaryLogger)
            const executionSummaryHook = new ExecutionSummaryHook(cfg, logger, testHandler as any);

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                executionSummaryHook as any
            );

            const script1 = createScript(1, 'first');
            const script2 = createScript(2, 'second');
            script2.script = {
                up: async () => { throw new Error('Migration failed'); }
            } as IRunnableScript;

            const scripts = [script1, script2];

            let error: Error | undefined;
            try {
                await runner.execute(scripts);
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;

            // Verify ExecutionSummaryHook recorded rollback (covers line 169)
            const summaryLogger = (executionSummaryHook as any).summaryLogger;
            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.transactionsStarted).to.equal(2);
            expect(metrics.transactionsCommitted).to.equal(1);
            expect(metrics.transactionsRolledBack).to.equal(1);
        });

        it('should record commit retries through ExecutionSummaryHook', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.transaction.retries = 3;
            cfg.logging = {
                enabled: true,
                logSuccessful: true,
                path: './test-logs/summary-hook',
                format: SummaryFormat.JSON,
                maxFiles: 0
            };

            let commitAttempts = 0;
            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().callsFake(async () => {
                    commitAttempts++;
                    if (commitAttempts === 1) {
                        const error: any = new Error('Commit failed');
                        error.code = 'SQLITE_BUSY'; // Retriable error
                        throw error;
                    }
                }),
                rollback: sinon.stub().resolves()
            };

            // Create a proper handler for ExecutionSummaryHook
            const testHandler = {
                db: { test: () => {} },
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0-test'
            };

            // Create ExecutionSummaryHook (it creates its own ExecutionSummaryLogger)
            const executionSummaryHook = new ExecutionSummaryHook(cfg, logger, testHandler as any);

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                executionSummaryHook as any
            );

            const scripts = [createScript(1, 'test1')];
            await runner.execute(scripts);

            // Verify commit was retried
            expect(commitAttempts).to.equal(2);

            // Verify ExecutionSummaryHook recorded retry (covers line 161)
            const summaryLogger = (executionSummaryHook as any).summaryLogger;
            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.transactionsStarted).to.equal(1);
            expect(metrics.transactionsCommitted).to.equal(1);
            expect(metrics.commitRetries).to.equal(1);
        });

        it('should rollback each transaction in dry run mode', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.dryRun = true; // Enable dry run mode

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                afterTransactionBegin: sinon.stub().resolves(),
                afterRollback: sinon.stub().resolves()
            };

            const loggerStub = {
                log: sinon.stub(),
                error: sinon.stub(),
                warn: sinon.stub(),
                info: sinon.stub(),
                debug: sinon.stub()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                loggerStub as any,
                transactionManager as any,
                hooks as any
            );

            const scripts = [
                createScript(1, 'test1'),
                createScript(2, 'test2')
            ];

            await runner.execute(scripts);

            // Should begin transaction for each migration
            expect(transactionManager.begin.callCount).to.equal(2);

            // Should NOT commit in dry run mode
            expect(transactionManager.commit.callCount).to.equal(0);

            // Should rollback each transaction in dry run mode (covers line 323)
            expect(transactionManager.rollback.callCount).to.equal(2);

            // Should call afterRollback hook for each migration (covers line 324)
            expect(hooks.afterRollback.callCount).to.equal(2);

            // Should log dry run rollback for each migration (covers line 322)
            expect(loggerStub.debug.calledWith(sinon.match(/Dry run: Rolling back transaction for/))).to.be.true;
        });

        it('should rollback each transaction in dry run mode without logger', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.dryRun = true; // Enable dry run mode

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                afterTransactionBegin: sinon.stub().resolves(),
                afterRollback: sinon.stub().resolves()
            };

            // No logger provided - covers optional chaining branch at line 322
            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                undefined, // No logger
                transactionManager as any,
                hooks as any
            );

            const scripts = [createScript(1, 'test1')];

            await runner.execute(scripts);

            // Should rollback in dry run mode even without logger
            expect(transactionManager.rollback.callCount).to.equal(1);
            expect(hooks.afterRollback.callCount).to.equal(1);
        });
    });

    describe('PER_BATCH Mode', () => {

        it('should wrap all migrations in single transaction', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
            );

            const scripts = [
                createScript(1, 'first'),
                createScript(2, 'second'),
                createScript(3, 'third')
            ];

            await runner.execute(scripts);

            // Should call begin/commit once for entire batch
            expect(transactionManager.begin.callCount).to.equal(1);
            expect(transactionManager.commit.callCount).to.equal(1);
            expect(transactionManager.rollback.callCount).to.equal(0);
        });

        it('should rollback entire batch if any migration fails', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
            );

            const script1 = createScript(1, 'first');
            const script2 = createScript(2, 'second');
            const script3 = createScript(3, 'third');
            
            // Second migration fails
            script2.script = {
                up: async () => { throw new Error('Migration failed'); }
            } as IRunnableScript;

            const scripts = [script1, script2, script3];

            let error: Error | undefined;
            try {
                await runner.execute(scripts);
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
            // One transaction for entire batch
            expect(transactionManager.begin.callCount).to.equal(1);
            expect(transactionManager.commit.callCount).to.equal(0);
            expect(transactionManager.rollback.callCount).to.equal(1);
        });

        it('should call transaction hooks once for entire batch', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                beforeTransactionBegin: sinon.stub().resolves(),
                afterTransactionBegin: sinon.stub().resolves(),
                beforeCommit: sinon.stub().resolves(),
                afterCommit: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                hooks as any
            );

            const scripts = [createScript(1, 'test'), createScript(2, 'test2'), createScript(3, 'test3')];
            await runner.execute(scripts);

            // Hooks should be called once for entire batch
            expect(hooks.beforeTransactionBegin.callCount).to.equal(1);
            expect(hooks.afterTransactionBegin.callCount).to.equal(1);
            expect(hooks.beforeCommit.callCount).to.equal(1);
            expect(hooks.afterCommit.callCount).to.equal(1);
        });

        it('should call rollback hooks when batch fails', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                beforeTransactionBegin: sinon.stub().resolves(),
                afterTransactionBegin: sinon.stub().resolves(),
                beforeRollback: sinon.stub().resolves(),
                afterRollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                hooks as any
            );

            const script = createScript(1, 'test');
            script.script = {
                up: async () => { throw new Error('Failed'); }
            } as IRunnableScript;

            try {
                await runner.execute([script]);
            } catch {
                // Expected
            }

            expect(hooks.beforeRollback.callCount).to.equal(1);
            expect(hooks.afterRollback.callCount).to.equal(1);
        });

        it('should handle rollback failure and log error', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;

            const rollbackError = new Error('Rollback failed');
            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().rejects(rollbackError)
            };

            const loggerStub = {
                log: sinon.stub(),
                error: sinon.stub(),
                warn: sinon.stub(),
                info: sinon.stub(),
                debug: sinon.stub()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                loggerStub as any,
                transactionManager as any
            );

            const script = createScript(1, 'test');
            script.script = {
                up: async () => { throw new Error('Migration failed'); }
            } as IRunnableScript;

            let error: Error | undefined;
            try {
                await runner.execute([script]);
            } catch (e) {
                error = e as Error;
            }

            // Should log the rollback error
            expect(loggerStub.error.called).to.be.true;
            expect(loggerStub.error.firstCall.args[0]).to.include('Rollback failed');

            // Should throw the rollback error
            expect(error).to.exist;
            expect(error).to.equal(rollbackError);
        });

        it('should handle rollback failure without logger', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;

            const rollbackError = new Error('Rollback failed');
            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().rejects(rollbackError)
            };

            // Create runner WITHOUT logger
            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                undefined,  // No logger
                transactionManager as any
            );

            const script = createScript(1, 'test');
            script.script = {
                up: async () => { throw new Error('Migration failed'); }
            } as IRunnableScript;

            let error: Error | undefined;
            try {
                await runner.execute([script]);
            } catch (e) {
                error = e as Error;
            }

            // Should throw the rollback error (no logger to verify)
            expect(error).to.exist;
            expect(error).to.equal(rollbackError);
        });

        it('should rollback batch transaction in dry run mode', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;
            cfg.dryRun = true; // Enable dry run mode

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                afterTransactionBegin: sinon.stub().resolves(),
                afterRollback: sinon.stub().resolves()
            };

            const loggerStub = {
                log: sinon.stub(),
                error: sinon.stub(),
                warn: sinon.stub(),
                info: sinon.stub(),
                debug: sinon.stub()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                loggerStub as any,
                transactionManager as any,
                hooks as any
            );

            const scripts = [
                createScript(1, 'test1'),
                createScript(2, 'test2')
            ];

            await runner.execute(scripts);

            // Should begin transaction
            expect(transactionManager.begin.callCount).to.equal(1);

            // Should NOT commit in dry run mode
            expect(transactionManager.commit.callCount).to.equal(0);

            // Should rollback in dry run mode (covers line 185)
            expect(transactionManager.rollback.callCount).to.equal(1);

            // Should call afterRollback hook (covers line 186)
            expect(hooks.afterRollback.callCount).to.equal(1);

            // Should log dry run rollback (covers line 184)
            expect(loggerStub.debug.calledWith(sinon.match(/Dry run: Rolling back batch transaction/))).to.be.true;
        });

        it('should rollback batch transaction in dry run mode without logger', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;
            cfg.dryRun = true; // Enable dry run mode

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                afterTransactionBegin: sinon.stub().resolves(),
                afterRollback: sinon.stub().resolves()
            };

            // No logger provided - covers optional chaining branch at line 184
            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                undefined, // No logger
                transactionManager as any,
                hooks as any
            );

            const scripts = [
                createScript(1, 'test1'),
                createScript(2, 'test2')
            ];

            await runner.execute(scripts);

            // Should rollback in dry run mode even without logger
            expect(transactionManager.rollback.callCount).to.equal(1);
            expect(hooks.afterRollback.callCount).to.equal(1);
        });

        it('should rollback batch transaction in dry run mode without hooks', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;
            cfg.dryRun = true; // Enable dry run mode

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            // No hooks provided - covers optional chaining branch at line 186
            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                undefined // No hooks
            );

            const scripts = [
                createScript(1, 'test1'),
                createScript(2, 'test2')
            ];

            await runner.execute(scripts);

            // Should rollback in dry run mode even without hooks
            expect(transactionManager.rollback.callCount).to.equal(1);
        });
    });

    describe('NONE Mode', () => {

        it('should not use transactions when mode is NONE', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'NONE' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
            );

            const scripts = [createScript(1, 'test'), createScript(2, 'test2')];
            await runner.execute(scripts);

            // No transaction methods should be called
            expect(transactionManager.begin.callCount).to.equal(0);
            expect(transactionManager.commit.callCount).to.equal(0);
            expect(transactionManager.rollback.callCount).to.equal(0);
        });

        it('should execute without transaction manager', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'NONE' as any;

            // No transaction manager provided
            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger
            );

            const scripts = [createScript(1, 'test'), createScript(2, 'test2')];
            const executed = await runner.execute(scripts);

            expect(executed).to.have.lengthOf(2);
        });
    });

    describe('Commit Retry Integration', () => {

        it('should retry commit on retriable errors', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.transaction.retries = 3;

            let commitAttempts = 0;
            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: async () => {
                    commitAttempts++;
                    if (commitAttempts < 2) {
                        throw new Error('deadlock detected');
                    }
                    // Success on 2nd attempt
                },
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                onCommitRetry: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                hooks as any
            );

            const scripts = [createScript(1, 'test')];
            await runner.execute(scripts);

            expect(commitAttempts).to.equal(2);
            expect(hooks.onCommitRetry.callCount).to.equal(1);
        });

        it('should rollback when commit fails after max retries', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.transaction.retries = 3;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: async () => {
                    throw new Error('deadlock detected');
                },
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
            );

            const scripts = [createScript(1, 'test')];

            let error: Error | undefined;
            try {
                await runner.execute(scripts);
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
            expect(transactionManager.rollback.callCount).to.equal(1);
        });

        it('should use default retries (3) when config.transaction.retries is undefined', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;
            cfg.transaction.retries = undefined;  // Test the ?? 3 fallback

            let commitAttempts = 0;
            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: async () => {
                    commitAttempts++;
                    if (commitAttempts < 2) {
                        throw new Error('deadlock detected');
                    }
                },
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
            );

            const scripts = [createScript(1, 'test')];
            await runner.execute(scripts);

            // Should use default of 3 retries
            expect(commitAttempts).to.equal(2);
        });
    });

    describe('Transaction Context', () => {

        it('should pass correct context to hooks in PER_MIGRATION mode', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                afterTransactionBegin: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                hooks as any
            );

            const scripts = [createScript(1, 'test')];
            await runner.execute(scripts);

            expect(hooks.afterTransactionBegin.callCount).to.equal(1);
            const context = hooks.afterTransactionBegin.getCall(0).args[0];

            expect(context).to.have.property('transactionId');
            expect(context).to.have.property('mode');
            expect(context).to.have.property('migrations');
            expect(context).to.have.property('startTime');
            expect(context).to.have.property('attempt');
            expect(context.migrations).to.have.lengthOf(1);
        });

        it('should pass correct context to hooks in PER_BATCH mode', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_BATCH' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            const hooks = {
                afterTransactionBegin: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any,
                hooks as any
            );

            const scripts = [createScript(1, 'test1'), createScript(2, 'test2'), createScript(3, 'test3')];
            await runner.execute(scripts);

            expect(hooks.afterTransactionBegin.callCount).to.equal(1);
            const context = hooks.afterTransactionBegin.getCall(0).args[0];

            expect(context.migrations).to.have.lengthOf(3);
        });
    });

    describe('Backward Compatibility', () => {

        it('should work without transaction manager', async () => {
            const cfg = new Config();

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger
            );

            const scripts = [createScript(1, 'test'), createScript(2, 'test2')];
            const executed = await runner.execute(scripts);

            expect(executed).to.have.lengthOf(2);
        });

        it('should work without hooks', async () => {
            const cfg = new Config();
            cfg.transaction.mode = 'PER_MIGRATION' as any;

            const transactionManager = {
                begin: sinon.stub().resolves(),
                commit: sinon.stub().resolves(),
                rollback: sinon.stub().resolves()
            };

            runner = new MigrationRunner(
                handler,
                schemaVersionService,
                cfg,
                logger,
                transactionManager as any
                // No hooks
            );

            const scripts = [createScript(1, 'test')];
            const executed = await runner.execute(scripts);

            expect(executed).to.have.lengthOf(1);
        });
    });
});
