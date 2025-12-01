import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as sinon from 'sinon';
import { ExecutionSummaryLogger } from '../../../src/service/ExecutionSummaryLogger';
import { Config } from '../../../src/model/Config';
import { SilentLogger } from '../../../src/logger';
import { SummaryFormat } from '../../../src/interface/logging/IExecutionSummary';
import { IDatabaseMigrationHandler } from '../../../src/interface/IDatabaseMigrationHandler';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../../package.json');

describe('ExecutionSummaryLogger', () => {
    let config: Config;
    let logger: SilentLogger;
    let summaryLogger: ExecutionSummaryLogger;
    let mockHandler: IDatabaseMigrationHandler;
    const testLogDir = './test-logs/migrations';

    beforeEach(() => {
        config = new Config();
        config.logging.enabled = true;
        config.logging.path = testLogDir;
        config.logging.maxFiles = 0;
        logger = new SilentLogger();

        mockHandler = {
            getName: () => 'TestHandler',
            getVersion: () => '1.0.0',
            db: {} as any,
            schemaVersion: {} as any
        };

        summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);

        // Clean up test log directory
        if (fs.existsSync(testLogDir)) {
            const files = fs.readdirSync(testLogDir);
            for (const file of files) {
                fs.unlinkSync(path.join(testLogDir, file));
            }
            fs.rmdirSync(testLogDir, { recursive: true });
        }
    });

    afterEach(() => {
        // Clean up test log directory
        if (fs.existsSync(testLogDir)) {
            const files = fs.readdirSync(testLogDir);
            for (const file of files) {
                fs.unlinkSync(path.join(testLogDir, file));
            }
            fs.rmdirSync(testLogDir, { recursive: true });
        }
    });

    describe('startRun()', () => {
        it('should initialize a new run', () => {
            // Should not throw when starting a run
            expect(() => summaryLogger.startRun()).to.not.throw();
        });
    });

    describe('recordMigrationStart()', () => {
        it('should record migration start', () => {
            summaryLogger.startRun();
            // Should not throw when recording migration start
            expect(() => summaryLogger.recordMigrationStart('TestMigration', 202501010001)).to.not.throw();
        });
    });

    describe('recordMigrationSuccess()', () => {
        it('should record successful migration', () => {
            summaryLogger.startRun();
            summaryLogger.recordMigrationStart('TestMigration', 202501010001);
            // Should not throw when recording migration success
            expect(() => summaryLogger.recordMigrationSuccess('TestMigration', 202501010001, 1000)).to.not.throw();
        });
    });

    describe('recordMigrationFailure()', () => {
        it('should record failed migration with error', () => {
            summaryLogger.startRun();
            summaryLogger.recordMigrationStart('TestMigration', 202501010001);
            const error = new Error('Test error');
            // Should not throw when recording migration failure
            expect(() => summaryLogger.recordMigrationFailure('TestMigration', 202501010001, error)).to.not.throw();
        });
    });

    describe('recordBackup()', () => {
        it('should record backup creation', () => {
            summaryLogger.startRun();
            // Should not throw when recording backup creation
            expect(() => summaryLogger.recordBackup('/backups/test.bkp', 1024)).to.not.throw();
        });
    });

    describe('recordMigrationRollback()', () => {
        it('should record migration rollback', () => {
            summaryLogger.startRun();
            summaryLogger.recordMigrationStart('TestMigration', 202501010001);
            // Should not throw when recording migration rollback
            expect(() => summaryLogger.recordMigrationRollback('TestMigration')).to.not.throw();
        });
    });

    describe('recordRollback()', () => {
        it('should record rollback action', () => {
            summaryLogger.startRun();
            // Should not throw when recording successful rollback
            expect(() => summaryLogger.recordRollback('BACKUP', true)).to.not.throw();
        });

        it('should record failed rollback with error', () => {
            summaryLogger.startRun();
            // Should not throw when recording failed rollback
            expect(() => summaryLogger.recordRollback('BACKUP', false, 'Rollback failed')).to.not.throw();
        });
    });

    describe('saveSummary()', () => {
        it('should not save when logging is disabled', async () => {
            config.logging.enabled = false;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();

            await summaryLogger.saveSummary(true, 1, 0, 1000);

            // No files should be created
            expect(fs.existsSync(testLogDir)).to.be.false;
        });

        it('should not save successful runs when logSuccessful is false', async () => {
            config.logging.logSuccessful = false;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();

            await summaryLogger.saveSummary(true, 1, 0, 1000);

            // No files should be created
            expect(fs.existsSync(testLogDir)).to.be.false;
        });

        it('should save failed runs even when logSuccessful is false', async () => {
            config.logging.logSuccessful = false;
            config.logging.format = SummaryFormat.JSON;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();

            await summaryLogger.saveSummary(false, 0, 1, 1000);

            // File should be created
            expect(fs.existsSync(testLogDir)).to.be.true;
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(1);
            expect(files[0]).to.include('migration-failed');
            expect(files[0]).to.include('.json');
        });

        it('should save JSON format', async () => {
            config.logging.format = SummaryFormat.JSON;
            config.logging.logSuccessful = true; // Enable logging successful runs
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordMigrationStart('TestMigration', 202501010001);
            summaryLogger.recordMigrationSuccess('TestMigration', 202501010001, 1000);

            await summaryLogger.saveSummary(true, 1, 0, 1500);

            // Check file was created
            expect(fs.existsSync(testLogDir)).to.be.true;
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(1);
            expect(files[0]).to.include('.json');

            // Check file content
            const filePath = path.join(testLogDir, files[0]);
            const content = fs.readFileSync(filePath, 'utf-8');
            const summary = JSON.parse(content);

            expect(summary.msrVersion).to.equal(packageJson.version); // From package.json
            expect(summary.adapterVersion).to.equal('1.0.0');
            expect(summary.handler).to.equal('TestHandler');
            expect(summary.result.success).to.be.true;
            expect(summary.result.executed).to.equal(1);
            expect(summary.result.failed).to.equal(0);
            expect(summary.result.totalDuration).to.equal(1500);
            expect(summary.migrations).to.have.length(1);
            expect(summary.migrations[0].name).to.equal('TestMigration');
            expect(summary.migrations[0].status).to.equal('success');
        });

        it('should save TEXT format', async () => {
            config.logging.format = SummaryFormat.TEXT;
            config.logging.logSuccessful = true;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordMigrationStart('TestMigration', 202501010001);
            summaryLogger.recordMigrationSuccess('TestMigration', 202501010001, 1000);

            await summaryLogger.saveSummary(true, 1, 0, 1500);

            // Check file was created
            expect(fs.existsSync(testLogDir)).to.be.true;
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(1);
            expect(files[0]).to.include('.txt');

            // Check file content
            const filePath = path.join(testLogDir, files[0]);
            const content = fs.readFileSync(filePath, 'utf-8');

            expect(content).to.include('MIGRATION EXECUTION SUMMARY');
            expect(content).to.include('TestHandler');
            expect(content).to.include('SUCCESS');
            expect(content).to.include('TestMigration');
        });

        it('should save BOTH formats', async () => {
            config.logging.format = SummaryFormat.BOTH;
            config.logging.logSuccessful = true;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordMigrationStart('TestMigration', 202501010001);
            summaryLogger.recordMigrationSuccess('TestMigration', 202501010001, 1000);

            await summaryLogger.saveSummary(true, 1, 0, 1500);

            // Check both files were created
            expect(fs.existsSync(testLogDir)).to.be.true;
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(2);

            const jsonFile = files.find(f => f.endsWith('.json'));
            const textFile = files.find(f => f.endsWith('.txt'));

            expect(jsonFile).to.exist;
            expect(textFile).to.exist;
        });

        it('should include backup information in summary', async () => {
            config.logging.format = SummaryFormat.JSON;
            config.logging.logSuccessful = true;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordBackup('/backups/test.bkp', 2048);

            await summaryLogger.saveSummary(true, 0, 0, 1000);

            const files = fs.readdirSync(testLogDir);
            const filePath = path.join(testLogDir, files[0]);
            const content = fs.readFileSync(filePath, 'utf-8');
            const summary = JSON.parse(content);

            expect(summary.backup).to.exist;
            expect(summary.backup.created).to.be.true;
            expect(summary.backup.path).to.equal('/backups/test.bkp');
            expect(summary.backup.size).to.equal(2048);
        });

        it('should include rollback information in summary', async () => {
            config.logging.format = SummaryFormat.JSON;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordRollback('BACKUP', true);

            await summaryLogger.saveSummary(false, 0, 1, 1000);

            const files = fs.readdirSync(testLogDir);
            const filePath = path.join(testLogDir, files[0]);
            const content = fs.readFileSync(filePath, 'utf-8');
            const summary = JSON.parse(content);

            expect(summary.rollback).to.exist;
            expect(summary.rollback.triggered).to.be.true;
            expect(summary.rollback.strategy).to.equal('BACKUP');
            expect(summary.rollback.success).to.be.true;
        });
    });

    describe('Text Format with Errors', () => {
        it('should include error and stack trace in text format', async () => {
            config.logging.format = SummaryFormat.TEXT;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordMigrationStart('FailedMigration', 202501010001);
            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at line 1\n    at line 2';
            summaryLogger.recordMigrationFailure('FailedMigration', 202501010001, error);

            await summaryLogger.saveSummary(false, 0, 1, 1500);

            const files = fs.readdirSync(testLogDir);
            const filePath = path.join(testLogDir, files[0]);
            const content = fs.readFileSync(filePath, 'utf-8');

            expect(content).to.include('FailedMigration');
            expect(content).to.include('failed');
            expect(content).to.include('Error:     Test error');
            expect(content).to.include('Stack Trace:');
            expect(content).to.include('at line 1');
        });

        it('should include backup info in text format', async () => {
            config.logging.format = SummaryFormat.TEXT;
            config.logging.logSuccessful = true;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordBackup('/backups/test.bkp', 2048);

            await summaryLogger.saveSummary(true, 0, 0, 1000);

            const files = fs.readdirSync(testLogDir);
            const filePath = path.join(testLogDir, files[0]);
            const content = fs.readFileSync(filePath, 'utf-8');

            expect(content).to.include('BACKUP');
            expect(content).to.include('Created: true');
            expect(content).to.include('Path:    /backups/test.bkp');
            expect(content).to.include('Size:    2048 bytes');
        });

        it('should include rollback info with error in text format', async () => {
            config.logging.format = SummaryFormat.TEXT;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
            summaryLogger.recordRollback('BACKUP', false, 'Rollback failed: timeout');

            await summaryLogger.saveSummary(false, 0, 1, 1000);

            const files = fs.readdirSync(testLogDir);
            const filePath = path.join(testLogDir, files[0]);
            const content = fs.readFileSync(filePath, 'utf-8');

            expect(content).to.include('ROLLBACK');
            expect(content).to.include('Triggered: true');
            expect(content).to.include('Strategy:  BACKUP');
            expect(content).to.include('Success:   false');
            expect(content).to.include('Error:     Rollback failed: timeout');
        });
    });

    describe('Default Configuration', () => {
        it('should use default log path when not configured', async () => {
            config.logging.logSuccessful = true;
            config.logging.path = undefined; // Test default path branch
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();

            await summaryLogger.saveSummary(true, 1, 0, 1000);

            // Check file was created in default location
            const defaultPath = './logs/migrations';
            expect(fs.existsSync(defaultPath)).to.be.true;

            // Cleanup
            const files = fs.readdirSync(defaultPath);
            for (const file of files) {
                fs.unlinkSync(path.join(defaultPath, file));
            }
            fs.rmdirSync(defaultPath, { recursive: true });
        });

        it('should use default format (JSON) when not configured', async () => {
            config.logging.logSuccessful = true;
            config.logging.format = undefined; // Test default format branch
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();

            await summaryLogger.saveSummary(true, 1, 0, 1000);

            // Check JSON file was created
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(1);
            expect(files[0]).to.include('.json');
        });
    });

    describe('File Rotation', () => {
        it('should rotate files when maxFiles is exceeded', async () => {
            config.logging.format = SummaryFormat.JSON;
            config.logging.logSuccessful = true;
            config.logging.maxFiles = 3;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);

            // Create 5 summary files
            for (let i = 0; i < 5; i++) {
                summaryLogger.startRun();
                await summaryLogger.saveSummary(true, 1, 0, 1000);
                // Small delay to ensure different timestamps
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Should only have 3 files (the most recent)
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(3);
        });

        it('should not rotate files when maxFiles is 0', async () => {
            config.logging.format = SummaryFormat.JSON;
            config.logging.logSuccessful = true;
            config.logging.maxFiles = 0; // No limit
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);

            // Create 5 summary files
            for (let i = 0; i < 5; i++) {
                summaryLogger.startRun();
                await summaryLogger.saveSummary(true, 1, 0, 1000);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Should have all 5 files
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(5);
        });

        it('should ignore non-migration files during rotation', async () => {
            config.logging.format = SummaryFormat.JSON;
            config.logging.logSuccessful = true;
            config.logging.maxFiles = 2;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);

            // Create some migration summary files
            summaryLogger.startRun();
            await summaryLogger.saveSummary(true, 1, 0, 1000);
            await new Promise(resolve => setTimeout(resolve, 10));
            summaryLogger.startRun();
            await summaryLogger.saveSummary(true, 1, 0, 1000);

            // Create files that should be ignored during rotation
            fs.writeFileSync(path.join(testLogDir, 'other-file.json'), 'test');
            fs.writeFileSync(path.join(testLogDir, 'migration-test.xml'), 'test'); // wrong extension
            fs.writeFileSync(path.join(testLogDir, 'not-migration.txt'), 'test'); // wrong prefix

            await new Promise(resolve => setTimeout(resolve, 10));

            // Add another migration file to trigger rotation
            summaryLogger.startRun();
            await summaryLogger.saveSummary(true, 1, 0, 1000);

            // Check that only migration summary files were considered for rotation
            // Should have 2 migration files (oldest deleted) + 3 other files
            const files = fs.readdirSync(testLogDir);
            const migrationFiles = files.filter(f => f.startsWith('migration-') && (f.endsWith('.json') || f.endsWith('.txt')));
            const otherFiles = files.filter(f => !f.startsWith('migration-') || (!f.endsWith('.json') && !f.endsWith('.txt')));

            expect(migrationFiles.length).to.equal(2); // Rotation kept only 2
            expect(otherFiles.length).to.equal(3); // Other files untouched
        });

        it('should handle rotation errors gracefully when file deletion fails', async () => {
            config.logging.format = SummaryFormat.JSON;
            config.logging.logSuccessful = true;
            config.logging.maxFiles = 2; // Keep 2 files, will delete when 3rd is added
            const testDir = './test-logs/rotation-test';
            config.logging.path = testDir;

            // Use a logger that captures warnings so we can verify the error was caught
            const warnings: string[] = [];
            const testLogger = {
                ...logger,
                warn: (message: string) => warnings.push(message),
                debug: () => {}, // Silent debug
                info: () => {} // Silent info
            };
            summaryLogger = new ExecutionSummaryLogger(config, testLogger as any, mockHandler);

            // Create test directory
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }

            // Create a directory with the same naming pattern FIRST - this will cause unlinkSync to fail
            // when rotation tries to delete it (it will be the oldest file and should be deleted)
            const fakeFile = path.join(testDir, 'migration-success-1970-01-01T00-00-00-000Z.json');
            if (!fs.existsSync(fakeFile)) {
                fs.mkdirSync(fakeFile);
            }

            // Wait a bit to ensure different mtimes
            await new Promise(resolve => setTimeout(resolve, 10));

            // Now create 2 files - they will have newer mtimes
            for (let i = 0; i < 2; i++) {
                summaryLogger.startRun();
                await summaryLogger.saveSummary(true, 1, 0, 1000);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            try {
                // This will trigger rotation, which will try to delete the directory as if it were a file
                // This should be caught and handled gracefully (catch block on line 401)
                summaryLogger.startRun();
                await summaryLogger.saveSummary(true, 1, 0, 1000);

                // Verify that the warning was logged (proves catch block was executed)
                expect(warnings.length).to.be.greaterThan(0);
                expect(warnings[0]).to.include('Failed to rotate summary files');
            } finally {
                // Clean up
                const cleanupFiles = fs.readdirSync(testDir);
                for (const file of cleanupFiles) {
                    const filePath = path.join(testDir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.isDirectory()) {
                            fs.rmdirSync(filePath);
                        } else {
                            fs.unlinkSync(filePath);
                        }
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
                fs.rmdirSync(testDir, { recursive: true });
            }
        });
    });

    describe('Version Handling', () => {
        it('should read MSR version from package.json', () => {
            // Verify that the logger is created successfully with the version from package.json
            const summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            expect(summaryLogger).to.be.instanceOf(ExecutionSummaryLogger);

            // The version should be available in the summary (tested indirectly through summary creation)
            const summary = (summaryLogger as any).createEmptySummary();
            expect(summary.msrVersion).to.be.a('string');
            expect(summary.msrVersion.length).to.be.greaterThan(0);
        });
    });

    describe('Transaction Metrics Recording', () => {
        let summaryLogger: ExecutionSummaryLogger;
        const testDir = './test-logs/transaction-metrics';

        beforeEach(() => {
            config.logging.enabled = true;
            config.logging.logSuccessful = true;
            config.logging.path = testDir;
            config.logging.format = SummaryFormat.JSON;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();
        });

        afterEach(() => {
            if (fs.existsSync(testDir)) {
                const files = fs.readdirSync(testDir);
                for (const file of files) {
                    fs.unlinkSync(path.join(testDir, file));
                }
                fs.rmdirSync(testDir, { recursive: true });
            }
        });

        it('should record transaction begin', () => {
            summaryLogger.recordTransactionBegin('tx-1');
            summaryLogger.recordTransactionBegin('tx-2');

            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.transactionsStarted).to.equal(2);
        });

        it('should record transaction commit and duration', () => {
            summaryLogger.recordTransactionBegin('tx-1');
            summaryLogger.recordTransactionCommit('tx-1');

            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.transactionsCommitted).to.equal(1);
            expect(metrics.totalTransactionDuration).to.be.greaterThanOrEqual(0);
        });

        it('should record transaction rollback and duration', () => {
            summaryLogger.recordTransactionBegin('tx-1');
            summaryLogger.recordTransactionRollback('tx-1');

            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.transactionsRolledBack).to.equal(1);
            expect(metrics.totalTransactionDuration).to.be.greaterThanOrEqual(0);
        });

        it('should record commit retries', () => {
            summaryLogger.recordCommitRetry();
            summaryLogger.recordCommitRetry();
            summaryLogger.recordCommitRetry();

            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.commitRetries).to.equal(3);
        });

        it('should include transaction metrics in JSON summary when transactions were used', async () => {
            summaryLogger.recordTransactionBegin('tx-1');
            summaryLogger.recordTransactionCommit('tx-1');
            summaryLogger.recordCommitRetry();

            await summaryLogger.saveSummary(true, 0, 0, 1000);

            const files = fs.readdirSync(testDir);
            const jsonFile = files.find(f => f.endsWith('.json'));
            expect(jsonFile).to.exist;

            const content = fs.readFileSync(path.join(testDir, jsonFile!), 'utf-8');
            const summary = JSON.parse(content);

            expect(summary.transactions).to.exist;
            expect(summary.transactions.transactionsStarted).to.equal(1);
            expect(summary.transactions.transactionsCommitted).to.equal(1);
            expect(summary.transactions.commitRetries).to.equal(1);
        });

        it('should NOT include transaction metrics in summary when no transactions were used', async () => {
            await summaryLogger.saveSummary(true, 0, 0, 1000);

            const files = fs.readdirSync(testDir);
            const jsonFile = files.find(f => f.endsWith('.json'));
            expect(jsonFile).to.exist;

            const content = fs.readFileSync(path.join(testDir, jsonFile!), 'utf-8');
            const summary = JSON.parse(content);

            expect(summary.transactions).to.be.undefined;
        });

        it('should include transaction section in TEXT format when transactions were used', async () => {
            config.logging.format = SummaryFormat.TEXT;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();

            summaryLogger.recordTransactionBegin('tx-1');
            summaryLogger.recordTransactionCommit('tx-1');
            summaryLogger.recordCommitRetry();

            await summaryLogger.saveSummary(true, 0, 0, 1000);

            const files = fs.readdirSync(testDir);
            const textFile = files.find(f => f.endsWith('.txt'));
            expect(textFile).to.exist;

            const content = fs.readFileSync(path.join(testDir, textFile!), 'utf-8');

            expect(content).to.include('TRANSACTIONS');
            expect(content).to.include('Started:');
            expect(content).to.include('Committed:');
            expect(content).to.include('Rolled Back:');
            expect(content).to.include('Commit Retries:');
        });

        it('should NOT include transaction section in TEXT format when no transactions were used', async () => {
            config.logging.format = SummaryFormat.TEXT;
            summaryLogger = new ExecutionSummaryLogger(config, logger, mockHandler);
            summaryLogger.startRun();

            await summaryLogger.saveSummary(true, 0, 0, 1000);

            const files = fs.readdirSync(testDir);
            const textFile = files.find(f => f.endsWith('.txt'));
            expect(textFile).to.exist;

            const content = fs.readFileSync(path.join(testDir, textFile!), 'utf-8');

            expect(content).to.not.include('TRANSACTIONS');
        });

        it('should accumulate transaction duration across multiple transactions', () => {
            summaryLogger.recordTransactionBegin('tx-1');
            summaryLogger.recordTransactionCommit('tx-1');

            summaryLogger.recordTransactionBegin('tx-2');
            summaryLogger.recordTransactionCommit('tx-2');

            summaryLogger.recordTransactionBegin('tx-3');
            summaryLogger.recordTransactionRollback('tx-3');

            const metrics = (summaryLogger as any).transactionMetrics;
            expect(metrics.transactionsStarted).to.equal(3);
            expect(metrics.transactionsCommitted).to.equal(2);
            expect(metrics.transactionsRolledBack).to.equal(1);
            expect(metrics.totalTransactionDuration).to.be.greaterThanOrEqual(0);
        });
    });
});
