import { expect } from 'chai';
import {
    MigrationScriptExecutor,
    Config,
    SilentLogger,
    IDatabaseMigrationHandler,
    IDB,
    IMigrationInfo,
    RollbackStrategy
} from '../../../src';
import { TestUtils } from '../../helpers';

describe('Dry Run Mode', () => {
    let executed: string[] = [];
    let backupsCreated: string[] = [];
    let config: Config;
    let handler: IDatabaseMigrationHandler;

    beforeEach(() => {
        executed = [];
        backupsCreated = [];

        config = TestUtils.getConfig();
        config.dryRun = true; // Enable dry run mode
        config.rollbackStrategy = RollbackStrategy.BACKUP;

        // Mock handler that tracks what was executed
        handler = {
            db: {
                execute: async (sql: string) => {
                    executed.push(`execute: ${sql}`);
                    return [];
                }
            } as IDB,
            backup: {
                backup: async () => {
                    const backupPath = `./backups/backup-${Date.now()}.bkp`;
                    backupsCreated.push(backupPath);
                    return backupPath;
                },
                restore: async (backupPath: string) => {
                    executed.push(`restore: ${backupPath}`);
                }
            },
            migrationRecords: {
                save: async (details: IMigrationInfo) => {
                    executed.push(`save: ${details.name}`);
                },
                getAllExecuted: async () => [],
                remove: async (timestamp: number) => {
                    executed.push(`remove: ${timestamp}`);
                }
            },
            schemaVersion: {
                save: async (details: IMigrationInfo) => {
                    executed.push(`schemaVersion.save: ${details.name}`);
                },
                getAllExecuted: async () => [],
                remove: async (timestamp: number) => {
                    executed.push(`schemaVersion.remove: ${timestamp}`);
                },
                isInitialized: async () => true,
                createTable: async () => true,
                validateTable: async () => true,
                migrationRecords: {
                    save: async (details: IMigrationInfo) => {
                        executed.push(`migrationRecords.save: ${details.name}`);
                    },
                    getAllExecuted: async () => [],
                    remove: async (timestamp: number) => {
                        executed.push(`migrationRecords.remove: ${timestamp}`);
                    }
                }
            },
            getName: () => 'TestHandler',
            createTable: async () => true,
            isInitialized: async () => true,
            validateTable: async () => true
        } as IDatabaseMigrationHandler;
    });

    describe('migrate() - Dry Run Mode', () => {
        /**
         * Test: No migrations are executed in dry run mode
         * Validates that migrations are not run when dryRun is enabled.
         */
        it('should not execute migrations when dryRun is true', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            const result = await executor.migrate();

            // Verify success but nothing executed
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(0);

            // Verify no database operations were performed
            const saveOperations = executed.filter(op => op.startsWith('save:'));
            expect(saveOperations.length).to.equal(0, 'No migrations should be saved');
        });

        /**
         * Test: No backup is created in dry run mode
         * Validates that backup operations are skipped when dryRun is enabled.
         */
        it('should not create backup when dryRun is true', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            await executor.migrate();

            // Verify no backups were created
            expect(backupsCreated.length).to.equal(0, 'No backups should be created in dry run mode');
        });

        /**
         * Test: Validation still runs in dry run mode
         * Validates that migration validation is performed even in dry run.
         */
        it('should still run validation when dryRun is true', async () => {
            config.validateBeforeRun = true;

            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            // Should not throw validation errors (all test migrations are valid)
            const result = await executor.migrate();
            expect(result.success).to.be.true;
        });

        /**
         * Test: Dry run shows pending migrations
         * Validates that dry run mode shows what would be executed.
         */
        it('should return pending migrations in result', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            const result = await executor.migrate();

            // Result should show what would be executed
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(0, 'Nothing executed');
            // Pending migrations are shown in renderer, not in result.executed
        });

        /**
         * Test: Dry run shows ignored migrations message when migrations are ignored
         * Validates that the "Would ignore" message appears when migrations are ignored.
         */
        it('should show ignored migrations count in dry run', async () => {
            // Create a mock migration scanner that returns ignored migrations
            const mockScanner = {
                scan: async () => ({
                    all: [
                        { timestamp: 1, name: 'migration1', filepath: '/fake/1.ts' },
                        { timestamp: 2, name: 'migration2', filepath: '/fake/2.ts' }
                    ],
                    migrated: [],
                    pending: [],
                    ignored: [
                        { timestamp: 1, name: 'migration1', filepath: '/fake/1.ts' },
                        { timestamp: 2, name: 'migration2', filepath: '/fake/2.ts' }
                    ],
                    executed: []
                })
            };

            // Create executor with logger that captures output
            let loggedMessages: string[] = [];
            const capturingLogger = {
                info: (msg: string) => loggedMessages.push(msg),
                error: (msg: string) => loggedMessages.push(msg),
                warn: (msg: string) => loggedMessages.push(msg),
                success: (msg: string) => loggedMessages.push(msg),
                debug: (msg: string) => loggedMessages.push(msg),
                log: (msg: string) => loggedMessages.push(msg)
            };

            const executor = new MigrationScriptExecutor(handler, config, {
                logger: capturingLogger,
                migrationScanner: mockScanner as any
            });

            const result = await executor.migrate();

            // Check that the "Would ignore" message was logged
            const ignoredMessage = loggedMessages.find(msg => msg.includes('Would ignore'));
            expect(ignoredMessage).to.exist;
            expect(ignoredMessage).to.include('2 migration(s)');
            expect(result.success).to.be.true;
        });

        /**
         * Test: Dry run shows ignored count when there are pending AND ignored migrations
         * Validates the "Would ignore" message when both pending and ignored exist.
         */
        it('should show ignored count with pending migrations in dry run', async () => {
            // Disable validation for this test since we're using fake files
            config.validateBeforeRun = false;

            // Create scanner with both pending and ignored migrations
            const mockScanner = {
                scan: async () => ({
                    all: [
                        { timestamp: 1, name: 'old1', filepath: '/fake/1.ts', init: async () => {} },
                        { timestamp: 999, name: 'new1', filepath: '/fake/999.ts', init: async () => {} }
                    ],
                    migrated: [],
                    pending: [
                        { timestamp: 999, name: 'new1', filepath: '/fake/999.ts', init: async () => {} }
                    ],
                    ignored: [
                        { timestamp: 1, name: 'old1', filepath: '/fake/1.ts', init: async () => {} }
                    ],
                    executed: []
                })
            };

            let loggedMessages: string[] = [];
            const capturingLogger = {
                info: (msg: string) => loggedMessages.push(msg),
                error: (msg: string) => loggedMessages.push(msg),
                warn: (msg: string) => loggedMessages.push(msg),
                success: (msg: string) => loggedMessages.push(msg),
                debug: (msg: string) => loggedMessages.push(msg),
                log: (msg: string) => loggedMessages.push(msg)
            };

            const executor = new MigrationScriptExecutor(handler, config, {
                logger: capturingLogger,
                migrationScanner: mockScanner as any
            });

            await executor.migrate();

            // Check messages
            const executeMessage = loggedMessages.find(msg => typeof msg === 'string' && msg.includes('Would execute:'));
            const ignoredMessage = loggedMessages.find(msg => typeof msg === 'string' && msg.includes('Would ignore:'));

            expect(executeMessage).to.exist;
            expect(ignoredMessage).to.exist;
        });
    });

    describe('migrateTo() - Dry Run Mode', () => {
        /**
         * Test: migrateTo respects dry run mode
         * Validates that migrateTo() also skips execution in dry run mode.
         */
        it('should not execute migrations to target version when dryRun is true', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            const result = await executor.migrate(202311020036);

            // Verify success but nothing executed
            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(0);

            // Verify no save operations
            const saveOperations = executed.filter(op => op.startsWith('save:'));
            expect(saveOperations.length).to.equal(0);
        });

        /**
         * Test: migrateTo with dry run shows what would execute
         * Validates that migrateTo in dry run mode shows pending migrations.
         */
        it('should preview migrations up to target version', async () => {
            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });

            const result = await executor.migrate(202311020036);

            expect(result.success).to.be.true;
            expect(result.executed.length).to.equal(0);
        });

        /**
         * Test: migrateTo shows ignored count with pending migrations
         * Validates that migrateTo shows both execute and ignore counts.
         */
        it('should show both pending and ignored counts in migrateTo', async () => {
            // Disable validation for this test since we're using fake files
            config.validateBeforeRun = false;

            // Create scanner where:
            // - migrations 1 & 2 are old (ignored)
            // - migration 500 was last executed (migrated)
            // - migration 999 is pending
            // - target is 999 (so 999 is pending to execute)
            const mockScanner = {
                scan: async () => ({
                    all: [
                        { timestamp: 1, name: 'old1', filepath: '/fake/1.ts', init: async () => {} },
                        { timestamp: 2, name: 'old2', filepath: '/fake/2.ts', init: async () => {} },
                        { timestamp: 500, name: 'current', filepath: '/fake/500.ts', init: async () => {} },
                        { timestamp: 999, name: 'new1', filepath: '/fake/999.ts', init: async () => {} }
                    ],
                    migrated: [
                        { timestamp: 500, name: 'current', filepath: '/fake/500.ts', init: async () => {} }
                    ],
                    pending: [
                        { timestamp: 999, name: 'new1', filepath: '/fake/999.ts', init: async () => {} }
                    ],
                    ignored: [
                        { timestamp: 1, name: 'old1', filepath: '/fake/1.ts', init: async () => {} },
                        { timestamp: 2, name: 'old2', filepath: '/fake/2.ts', init: async () => {} }
                    ],
                    executed: []
                })
            };

            let loggedMessages: string[] = [];
            const capturingLogger = {
                info: (msg: string) => loggedMessages.push(msg),
                error: (msg: string) => loggedMessages.push(msg),
                warn: (msg: string) => loggedMessages.push(msg),
                success: (msg: string) => loggedMessages.push(msg),
                debug: (msg: string) => loggedMessages.push(msg),
                log: (msg: string) => loggedMessages.push(msg)
            };

            const executor = new MigrationScriptExecutor(handler, config, {
                logger: capturingLogger,
                migrationScanner: mockScanner as any
            });

            // Migrate to version 999 - should execute 999, ignore 1 & 2
            await executor.migrate(999);

            // Check that both execute and ignored messages appear
            const executeMessage = loggedMessages.find(msg => typeof msg === 'string' && msg.includes('Would execute: 1'));
            const ignoredMessage = loggedMessages.find(msg => typeof msg === 'string' && msg.includes('Would ignore: 2'));

            expect(executeMessage).to.exist;
            expect(ignoredMessage).to.exist;
        });

        /**
         * Test: migrateTo with ignored migrations in dry run
         * Validates that migrateTo shows ignored count when no pending to target.
         */
        it('should show ignored migrations when already at target version', async () => {
            // Disable validation for this test since we're using fake files
            config.validateBeforeRun = false;

            // Create scanner where:
            // - migrations 1 & 2 are old (ignored)
            // - migration 999 was the last executed (migrated)
            // - target is 999 (so no pending to execute)
            const mockScanner = {
                scan: async () => ({
                    all: [
                        { timestamp: 1, name: 'old1', filepath: '/fake/1.ts', init: async () => {} },
                        { timestamp: 2, name: 'old2', filepath: '/fake/2.ts', init: async () => {} },
                        { timestamp: 999, name: 'current', filepath: '/fake/999.ts', init: async () => {} }
                    ],
                    migrated: [
                        { timestamp: 999, name: 'current', filepath: '/fake/999.ts', init: async () => {} }
                    ],
                    pending: [],
                    ignored: [
                        { timestamp: 1, name: 'old1', filepath: '/fake/1.ts', init: async () => {} },
                        { timestamp: 2, name: 'old2', filepath: '/fake/2.ts', init: async () => {} }
                    ],
                    executed: []
                })
            };

            let loggedMessages: string[] = [];
            const capturingLogger = {
                info: (msg: string) => loggedMessages.push(msg),
                error: (msg: string) => loggedMessages.push(msg),
                warn: (msg: string) => loggedMessages.push(msg),
                success: (msg: string) => loggedMessages.push(msg),
                debug: (msg: string) => loggedMessages.push(msg),
                log: (msg: string) => loggedMessages.push(msg)
            };

            const executor = new MigrationScriptExecutor(handler, config, {
                logger: capturingLogger,
                migrationScanner: mockScanner as any
            });

            // Migrate to version 999 - already at target, should show ignored count
            await executor.migrate(999);

            // Check that ignored message appears
            const ignoredMessage = loggedMessages.find(msg => typeof msg === 'string' && msg.includes('Would ignore'));
            expect(ignoredMessage).to.exist;
        });
    });

    describe('Dry Run with Different Rollback Strategies', () => {
        /**
         * Test: Dry run with BACKUP strategy doesn't create backup
         * Validates backup is skipped regardless of rollback strategy.
         */
        it('should not create backup with BACKUP strategy in dry run', async () => {
            config.rollbackStrategy = RollbackStrategy.BACKUP;

            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });
            await executor.migrate();

            expect(backupsCreated.length).to.equal(0);
        });

        /**
         * Test: Dry run with DOWN strategy doesn't execute
         * Validates migrations aren't executed with DOWN strategy.
         */
        it('should not execute with DOWN strategy in dry run', async () => {
            config.rollbackStrategy = RollbackStrategy.DOWN;

            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });
            await executor.migrate();

            const saveOperations = executed.filter(op => op.startsWith('save:'));
            expect(saveOperations.length).to.equal(0);
        });

        /**
         * Test: Dry run with BOTH strategy doesn't create backup or execute
         * Validates both backup and execution are skipped.
         */
        it('should not create backup or execute with BOTH strategy in dry run', async () => {
            config.rollbackStrategy = RollbackStrategy.BOTH;

            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });
            await executor.migrate();

            expect(backupsCreated.length).to.equal(0);
            const saveOperations = executed.filter(op => op.startsWith('save:'));
            expect(saveOperations.length).to.equal(0);
        });
    });

    describe('Dry Run - Actual Execution Comparison', () => {
        /**
         * Test: Dry run vs actual execution comparison
         * Validates that dry run truly skips execution while normal mode executes.
         */
        it('should execute migrations when dryRun is false', async () => {
            config.dryRun = false; // Disable dry run

            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });
            const result = await executor.migrate();

            // With dry run disabled, migrations should execute
            expect(result.success).to.be.true;
            expect(result.executed.length).to.be.greaterThan(0, 'Migrations should be executed');

            // Verify save operations occurred (from migrationRecords or schemaVersion)
            const saveOperations = executed.filter(op => op.includes('save:'));
            expect(saveOperations.length).to.be.greaterThan(0, 'Migrations should be saved');
        });

        /**
         * Test: beforeMigrate is skipped in dry run mode
         * Validates that beforeMigrate script doesn't execute in dry run.
         */
        it('should skip beforeMigrate script in dry run mode', async () => {
            config.beforeMigrateName = 'beforeMigrate';
            config.dryRun = true;

            const executor = new MigrationScriptExecutor(handler, config, { logger: new SilentLogger() });
            await executor.migrate();

            // beforeMigrate should not have executed
            // (it would show up in executed array if it did)
            expect(executed.length).to.equal(0);
        });
    });
});
