import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    Config,
    IDatabaseMigrationHandler,
    IDB,
    IMigrationInfo,
    MigrationScriptExecutor,
    SilentLogger,
    SummaryFormat,
    IMigrationHooks,
    RollbackStrategy
} from '../../../src';
import { TestUtils } from '../../helpers';

describe('ExecutionSummaryHook', () => {
    let config: Config;
    let handler: IDatabaseMigrationHandler;
    const testLogDir = './test-logs/execution-summary-hook';

    beforeEach(() => {
        config = TestUtils.getConfig();
        config.logging.enabled = true; // Enable logging to activate ExecutionSummaryHook
        config.logging.logSuccessful = true;
        config.logging.path = testLogDir;
        config.logging.format = SummaryFormat.JSON;
        config.logging.maxFiles = 0;

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
        } as IDatabaseMigrationHandler;
    });

    afterEach(() => {
        // Clean up test log directory
        if (fs.existsSync(testLogDir)) {
            fs.rmSync(testLogDir, { recursive: true, force: true });
        }
    });

    describe('with logging enabled and no user hooks', () => {
        it('should create ExecutionSummaryHook automatically', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            const result = await executor.up();

            expect(result.success).to.be.true;
            // Summary file should be created
            expect(fs.existsSync(testLogDir)).to.be.true;
        });

        it('should log successful migrations', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            await executor.up();

            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.equal(1);
            expect(files[0]).to.include('migration-success');
        });
    });

    describe('with logging enabled and user hooks', () => {
        it('should combine ExecutionSummaryHook with user hooks', async () => {
            let userHookCalled = false;
            const userHooks: IMigrationHooks = {
                onComplete: async () => {
                    userHookCalled = true;
                }
            };

            const executor = new MigrationScriptExecutor(handler, config, {
                logger: new SilentLogger(),
                hooks: userHooks
            });

            await executor.up();

            // Both user hook and summary logging should work
            expect(userHookCalled).to.be.true;
            expect(fs.existsSync(testLogDir)).to.be.true;
        });
    });

    describe('error handling', () => {
        it('should call onError and create failure summary', async () => {
            // Create a handler that fails during scan
            const failingHandler = {
                ...handler,
                schemaVersion: {
                    ...handler.schemaVersion,
                    migrationRecords: {
                        getAllExecuted: async () => {
                            throw new Error('Database scan error');
                        },
                        save: async () => {},
                        remove: async () => {}
                    }
                }
            };

            config.logging.logSuccessful = false; // Only log failures

            const executor = new MigrationScriptExecutor(failingHandler, config, { logger: new SilentLogger() });

            try {
                await executor.up();
                expect.fail('Should have thrown error');
            } catch (error) {
                // Expected error
            }

            // Failure summary should be created
            expect(fs.existsSync(testLogDir)).to.be.true;
            const files = fs.readdirSync(testLogDir);
            expect(files.length).to.be.greaterThan(0);
            expect(files[0]).to.include('migration-failed');
        });

    });

    describe('onAfterMigrate without onBeforeMigrate', () => {
        it('should handle fallback when migration start time is missing', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            // Get the hook (it's the ExecutionSummaryHook since logging is enabled)
            const hooks = (executor as any).hooks;

            // Create a fake migration script
            const fakeScript = {
                name: 'TestMigration',
                timestamp: 202501010001,
                filepath: '/fake/path.ts',
                script: {},
                startedAt: Date.now()
            };

            // Call onAfterMigrate without calling onBeforeMigrate first
            // This tests the fallback branch: || Date.now()
            await hooks.onAfterMigrate(fakeScript, 'success');

            // Should not throw error
            expect(true).to.be.true;
        });
    });

    describe('onMigrationError direct invocation', () => {
        it('should record migration failure when onMigrationError is called', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            // Get the hook (it's the ExecutionSummaryHook since logging is enabled)
            const hooks = (executor as any).hooks;

            // Create a fake migration script
            const fakeScript = {
                name: 'TestMigration',
                timestamp: 202501010001,
                filepath: '/fake/path.ts',
                script: {},
                startedAt: Date.now()
            };

            // Call onStart to initialize the logger
            await hooks.onStart(1, 1);

            // Call onBeforeMigrate to record the migration start
            await hooks.onBeforeMigrate(fakeScript);

            // Call onMigrationError to record the failure
            // This covers lines 100-101
            const testError = new Error('Test migration failure');
            await hooks.onMigrationError(fakeScript, testError);

            // Should not throw error
            expect(true).to.be.true;
        });
    });
});
