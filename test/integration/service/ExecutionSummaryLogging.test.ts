import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    MigrationScriptExecutor,
    Config,
    SilentLogger,
    IDatabaseMigrationHandler,
    IDB,
    IMigrationInfo,
    RollbackStrategy,
    SummaryFormat,
    TransactionMode,
    IsolationLevel
} from '../../../src';
import { TestUtils } from '../../helpers';

describe('Execution Summary Logging Integration', () => {
    let config: Config;
    let handler: IDatabaseMigrationHandler<IDB>;
    const testLogDir = './test-logs/integration';

    beforeEach(() => {
        config = TestUtils.getConfig();
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions
        // Explicitly configure logging for tests
        config.logging = {
            enabled: true,
            logSuccessful: true,
            path: testLogDir,
            format: SummaryFormat.JSON,
            maxFiles: 0
        };

        // Clean up test log directory
        if (fs.existsSync(testLogDir)) {
            const files = fs.readdirSync(testLogDir);
            for (const file of files) {
                fs.unlinkSync(path.join(testLogDir, file));
            }
            fs.rmdirSync(testLogDir, { recursive: true });
        }

        // Mock handler
        handler = {
            db: {
                execute: async (sql: string) => {
                    return [];
                },
                checkConnection: async () => true
            } as IDB,
            backup: {
                backup: async () => {
                    return './test-backup.bkp';
                },
                restore: async (backupPath: string) => {
                    // Restore simulation
                }
            },
            migrationRecords: {
                save: async (details: IMigrationInfo) => {
                    // Save simulation
                },
                getAllExecuted: async () => [],
                remove: async (timestamp: number) => {
                    // Remove simulation
                }
            },
            schemaVersion: {
                save: async (details: IMigrationInfo) => {
                    // Save simulation
                },
                getAllExecuted: async () => [],
                remove: async (timestamp: number) => {
                    // Remove simulation
                },
                isInitialized: async () => true,
                createTable: async () => true,
                validateTable: async () => true,
                migrationRecords: {
                    save: async (details: IMigrationInfo) => {
                        // Save simulation
                    },
                    getAllExecuted: async () => [],
                    remove: async (timestamp: number) => {
                        // Remove simulation
                    }
                }
            },
            getName: () => 'TestHandler',
            getVersion: () => '1.0.0-test',
            createTable: async () => true,
            isInitialized: async () => true,
            validateTable: async () => true
        } as IDatabaseMigrationHandler<IDB>;
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

    it('should create execution summary file for successful migration', async () => {
        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        const result = await executor.up();

        // Verify migration succeeded
        expect(result.success).to.be.true;

        // Verify summary file was created
        expect(fs.existsSync(testLogDir)).to.be.true;
        const files = fs.readdirSync(testLogDir);
        expect(files.length).to.equal(1);
        expect(files[0]).to.include('migration-success');
        expect(files[0]).to.include('.json');

        // Verify summary content
        const filePath = path.join(testLogDir, files[0]);
        const content = fs.readFileSync(filePath, 'utf-8');
        const summary = JSON.parse(content);

        expect(summary.handler).to.equal('TestHandler');
        expect(summary.result.success).to.be.true;
        expect(summary.config.folder).to.exist;
        expect(summary.config.rollbackStrategy).to.exist;
});

    it('should not create summary file when logging is disabled', async () => {
        config.logging.enabled = false;
        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        await executor.up();

        // No summary file should be created
        expect(fs.existsSync(testLogDir)).to.be.false;
});

    it('should not create summary for successful runs when logSuccessful is false', async () => {
        config.logging.logSuccessful = false;
        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        await executor.up();

        // No summary file should be created
        expect(fs.existsSync(testLogDir)).to.be.false;
});

    it('should create summary in both JSON and TEXT formats', async () => {
        config.logging.format = SummaryFormat.BOTH;
        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        await executor.up();

        // Verify both files were created
        expect(fs.existsSync(testLogDir)).to.be.true;
        const files = fs.readdirSync(testLogDir);
        expect(files.length).to.equal(2);

        const jsonFile = files.find(f => f.endsWith('.json'));
        const textFile = files.find(f => f.endsWith('.txt'));

        expect(jsonFile).to.exist;
        expect(textFile).to.exist;
});

    it('should work with user-provided hooks', async () => {
        let onStartCalled = false;
        let onCompleteCalled = false;

        const customHooks = {
            onStart: async () => {
                onStartCalled = true;
            },
            onComplete: async () => {
                onCompleteCalled = true;
            }
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: customHooks
}, config);

        await executor.up();

        // Verify custom hooks were called
        expect(onStartCalled).to.be.true;
        expect(onCompleteCalled).to.be.true;

        // Verify summary file was still created
        expect(fs.existsSync(testLogDir)).to.be.true;
        const files = fs.readdirSync(testLogDir);
        expect(files.length).to.equal(1);
    });

    it('should include migration details in summary', async () => {
        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        await executor.up();

        // Verify summary has migration details
        const files = fs.readdirSync(testLogDir);
        const filePath = path.join(testLogDir, files[0]);
        const content = fs.readFileSync(filePath, 'utf-8');
        const summary = JSON.parse(content);

        expect(summary.handler).to.equal('TestHandler');
        expect(summary.config).to.exist;
        expect(summary.config.folder).to.exist;
        expect(summary.result).to.exist;
});

    it('should work without hooks when logging disabled and no user hooks', async () => {
        config.logging.enabled = false;
        // Don't provide hooks in dependencies - this makes this.hooks undefined
        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        // This should work fine even with this.hooks being undefined
        // All the optional chaining (?.) branches should handle undefined gracefully
        const result = await executor.up();

        // Should complete successfully
        expect(result.success).to.be.true;
});

    it('should include transaction configuration in summary when transactions are configured', async () => {
        // Enable transactions
        config.transaction.mode = TransactionMode.PER_MIGRATION;
        config.transaction.isolation = IsolationLevel.SERIALIZABLE;
        config.transaction.retries = 5;

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        await executor.up();

        // Verify summary includes transaction configuration
        const files = fs.readdirSync(testLogDir);
        const filePath = path.join(testLogDir, files[0]);
        const content = fs.readFileSync(filePath, 'utf-8');
        const summary = JSON.parse(content);

        // Verify transaction config is included in summary
        expect(summary.config.transactionMode).to.equal(TransactionMode.PER_MIGRATION);
        expect(summary.config.transactionIsolation).to.equal(IsolationLevel.SERIALIZABLE);
        expect(summary.config.transactionRetries).to.equal(5);

        // Note: Transaction metrics tracking requires a proper transactional DB implementation
        // which is tested separately in the MigrationScriptExecutor transaction tests
});

    it('should NOT include transaction metrics when transactions are disabled', async () => {
        // Ensure transactions are disabled
        config.transaction.mode = TransactionMode.NONE;

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() }, config);

        await executor.up();

        // Verify summary does NOT include transaction metrics
        const files = fs.readdirSync(testLogDir);
        const filePath = path.join(testLogDir, files[0]);
        const content = fs.readFileSync(filePath, 'utf-8');
        const summary = JSON.parse(content);

        // Transaction metrics should not be present
        expect(summary.transactions).to.be.undefined;
});

});
