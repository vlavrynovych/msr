import {expect} from 'chai';
import sinon from 'sinon';
import {
    Config,
    IDB,
    IMigrationInfo,
    IDatabaseMigrationHandler,
    MigrationScriptExecutor,
    IBackup,
    ISchemaVersion,
    SilentLogger,
    IMigrationHooks,
    CompositeHooks,
    TransactionMode
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

/**
 * Integration tests for MigrationScriptExecutor hooks functionality.
 * Tests the complete lifecycle hooks integration during migrations.
 */
describe('MigrationScriptExecutor - Hooks Integration', () => {

    let handler: IDatabaseMigrationHandler<IDB>;
    let executor: MigrationScriptExecutor<IDB>;
    let mockHooks: IMigrationHooks<IDB>;
    let cfg: Config;

    before(() => {
        cfg = TestUtils.getConfig();
        cfg.transaction.mode = TransactionMode.NONE; // Tests don't use transactions
        const db: IDB = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
            async checkConnection(): Promise<boolean> {
                return true;
            }
        }
        handler = new class implements IDatabaseMigrationHandler<IDB> {
            backup: IBackup<IDB> = {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            };
            schemaVersion: ISchemaVersion<IDB> = {
                migrationRecords: {
                    getAllExecuted(): Promise<any> {
                        return Promise.resolve([]);
                    },
                    save(details: IMigrationInfo): Promise<any> {
                        return Promise.resolve();
                    },
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            };
            db: IDB = db;
            getName(): string { return "Test Implementation" }
            getVersion(): string { return "1.0.0-test" }
        }
        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()}, cfg);
});

    beforeEach(() => {
        // Create mock hooks with all methods
        mockHooks = {
            onStart: sinon.stub().resolves(),
            onBeforeBackup: sinon.stub().resolves(),
            onAfterBackup: sinon.stub().resolves(),
            onBeforeMigrate: sinon.stub().resolves(),
            onAfterMigrate: sinon.stub().resolves(),
            onMigrationError: sinon.stub().resolves(),
            onBeforeRestore: sinon.stub().resolves(),
            onAfterRestore: sinon.stub().resolves(),
            onComplete: sinon.stub().resolves(),
            onError: sinon.stub().resolves()
        };
    });

    /**
     * Test: migrate() calls all hooks in success path
     * Verifies that all lifecycle hooks are called during successful migration
     */
    it('should call all success path hooks during migration', async () => {
        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: mockHooks
}, cfg);

        const result = await executor.migrate();

        // Verify success path hooks were called
        expect((mockHooks.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockHooks.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockHooks.onStart as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockHooks.onBeforeMigrate as sinon.SinonStub).called).to.be.true;
        expect((mockHooks.onAfterMigrate as sinon.SinonStub).called).to.be.true;
        expect((mockHooks.onComplete as sinon.SinonStub).calledOnce).to.be.true;

        // Verify error path hooks were NOT called
        expect((mockHooks.onMigrationError as sinon.SinonStub).called).to.be.false;
        expect((mockHooks.onBeforeRestore as sinon.SinonStub).called).to.be.false;
        expect((mockHooks.onAfterRestore as sinon.SinonStub).called).to.be.false;
        expect((mockHooks.onError as sinon.SinonStub).called).to.be.false;

        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() calls hooks with correct parameters
     * Verifies that hooks receive expected parameters
     */
    it('should call hooks with correct parameters', async () => {
        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: mockHooks
}, cfg);

        const result = await executor.migrate();

        // Check onStart parameters
        const [totalScripts, pendingScripts] = (mockHooks.onStart as sinon.SinonStub).firstCall.args;
        expect(totalScripts).to.be.a('number');
        expect(pendingScripts).to.be.a('number');

        // Check onAfterBackup parameter (backup path)
        const [backupPath] = (mockHooks.onAfterBackup as sinon.SinonStub).firstCall.args;
        expect(backupPath).to.be.a('string');

        // Check onBeforeMigrate parameter (script)
        if ((mockHooks.onBeforeMigrate as sinon.SinonStub).called) {
            const [script] = (mockHooks.onBeforeMigrate as sinon.SinonStub).firstCall.args;
            expect(script).to.have.property('name');
            expect(script).to.have.property('timestamp');
        }

        // Check onComplete parameter (result)
        const [migrationResult] = (mockHooks.onComplete as sinon.SinonStub).firstCall.args;
        expect(migrationResult).to.have.property('success');
        expect(migrationResult).to.have.property('executed');

        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() works without hooks
     * Verifies backward compatibility when no hooks are provided
     */
    it('should work without hooks provided', async () => {
        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
            // No hooks provided
}, cfg);

        const result = await executor.migrate();

        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() works with partial hooks
     * Verifies optional chaining works when only some hooks are implemented
     */
    it('should work with partial hook implementation', async () => {
        const partialHooks: IMigrationHooks<IDB> = {
            onStart: sinon.stub().resolves(),
            onComplete: sinon.stub().resolves()
            // Only two hooks implemented
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: partialHooks
}, cfg);

        const result = await executor.migrate();

        expect((partialHooks.onStart as sinon.SinonStub).calledOnce).to.be.true;
        expect((partialHooks.onComplete as sinon.SinonStub).calledOnce).to.be.true;
        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() calls error hooks on failure
     * Verifies error path hooks are called when migration fails
     */
    it('should call error hooks when migration fails', async () => {
        // Create a handler that will fail during migration
        const failingHandler: IDatabaseMigrationHandler<IDB> = {
            db: handler.db,
            getName: handler.getName.bind(handler),
            getVersion: handler.getVersion.bind(handler),
            backup: handler.backup,
            schemaVersion: {
                isInitialized: handler.schemaVersion.isInitialized,
                createTable: handler.schemaVersion.createTable,
                validateTable: handler.schemaVersion.validateTable,
                migrationRecords: {
                    getAllExecuted: sinon.stub().rejects(new Error('Database error')),
                    save: sinon.stub().resolves(),
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                }
            }
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: failingHandler, logger: new SilentLogger(),
            hooks: mockHooks
}, cfg);

        try {
            await executor.migrate();
            expect.fail('Should have thrown error');
        } catch (error) {
            // Expected error
        }

        // Verify error hooks were called
        // Note: onBeforeRestore/onAfterRestore are NOT called because error happens during scan (before backup)
        expect((mockHooks.onError as sinon.SinonStub).called).to.be.true;

        // Verify success hooks onComplete was NOT called
        expect((mockHooks.onComplete as sinon.SinonStub).called).to.be.false;
    });

    /**
     * Test: migrate() calls hooks in correct order
     * Verifies lifecycle hooks are executed in expected sequence
     */
    it('should call hooks in correct order', async () => {
        const callOrder: string[] = [];

        const orderTrackingHooks: IMigrationHooks<IDB> = {
            onBeforeBackup: sinon.stub().callsFake(async () => {
                callOrder.push('onBeforeBackup');
            }),
            onAfterBackup: sinon.stub().callsFake(async () => {
                callOrder.push('onAfterBackup');
            }),
            onStart: sinon.stub().callsFake(async () => {
                callOrder.push('onStart');
            }),
            onBeforeMigrate: sinon.stub().callsFake(async () => {
                callOrder.push('onBeforeMigrate');
            }),
            onAfterMigrate: sinon.stub().callsFake(async () => {
                callOrder.push('onAfterMigrate');
            }),
            onComplete: sinon.stub().callsFake(async () => {
                callOrder.push('onComplete');
            })
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: orderTrackingHooks
}, cfg);

        await executor.migrate();

        // Verify order: backup hooks → onStart → migration hooks → onComplete
        expect(callOrder[0]).to.equal('onBeforeBackup');
        expect(callOrder[1]).to.equal('onAfterBackup');
        expect(callOrder[2]).to.equal('onStart');

        // onBeforeMigrate and onAfterMigrate may be called multiple times (once per script)
        // Just verify they appear after onStart and before onComplete
        const startIndex = callOrder.indexOf('onStart');
        const completeIndex = callOrder.indexOf('onComplete');

        callOrder.slice(startIndex + 1, completeIndex).forEach(hookName => {
            expect(['onBeforeMigrate', 'onAfterMigrate']).to.include(hookName);
        });

        expect(callOrder[callOrder.length - 1]).to.equal('onComplete');
    });

    /**
     * Test: onAfterBackup receives backup path
     * Verifies backup path is passed to the hook
     */
    it('should pass backup path to onAfterBackup hook', async () => {
        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: mockHooks
}, cfg);

        await executor.migrate();

        expect((mockHooks.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;
        const [backupPath] = (mockHooks.onAfterBackup as sinon.SinonStub).firstCall.args;

        // Backup path should be a non-empty string
        expect(backupPath).to.be.a('string');
        expect(backupPath.length).to.be.greaterThan(0);
    });

    /**
     * Test: migrate() with no pending migrations still calls hooks
     * Verifies hooks are called even when there are no migrations to execute
     */
    it('should call hooks even when no migrations to execute', async () => {
        // Configure handler to return all scripts as already migrated
        const allMigratedHandler: IDatabaseMigrationHandler<IDB> = {
            db: handler.db,
            getName: handler.getName.bind(handler),
            getVersion: handler.getVersion.bind(handler),
            backup: handler.backup,
            schemaVersion: {
                isInitialized: handler.schemaVersion.isInitialized,
                createTable: handler.schemaVersion.createTable,
                validateTable: handler.schemaVersion.validateTable,
                migrationRecords: {
                    // Return a script with a very high timestamp so all real scripts are ignored
                    getAllExecuted: sinon.stub().resolves([{
                        name: 'V999999999999_already_migrated.ts',
                        timestamp: 999999999999,
                        migratedAt: new Date().toISOString(),
                        username: 'test'
                    }]),
                    save: sinon.stub().resolves(),
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                }
            }
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: allMigratedHandler, logger: new SilentLogger(),
            hooks: mockHooks
}, cfg);

        const result = await executor.migrate();

        // Start and completion hooks should still be called
        expect((mockHooks.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockHooks.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockHooks.onStart as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockHooks.onComplete as sinon.SinonStub).calledOnce).to.be.true;

        // Migration hooks should NOT be called (no migrations to execute)
        expect((mockHooks.onBeforeMigrate as sinon.SinonStub).called).to.be.false;
        expect((mockHooks.onAfterMigrate as sinon.SinonStub).called).to.be.false;

        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() with hooks that don't include migration-specific hooks
     * Verifies migration works correctly with only non-migration hooks
     */
    it('should work with only non-migration hooks', async () => {
        const nonMigrationHooks: IMigrationHooks<IDB> = {
            onStart: sinon.stub().resolves(),
            onBeforeBackup: sinon.stub().resolves(),
            onAfterBackup: sinon.stub().resolves(),
            onComplete: sinon.stub().resolves()
            // No onBeforeMigrate, onAfterMigrate, or onMigrationError
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: nonMigrationHooks
}, cfg);

        const result = await executor.migrate();

        // Non-migration hooks should be called
        expect((nonMigrationHooks.onStart as sinon.SinonStub).calledOnce).to.be.true;
        expect((nonMigrationHooks.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
        expect((nonMigrationHooks.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;
        expect((nonMigrationHooks.onComplete as sinon.SinonStub).calledOnce).to.be.true;

        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() with only onBeforeMigrate hook
     * Verifies optional chaining for onAfterMigrate and onMigrationError
     */
    it('should handle when only onBeforeMigrate is implemented', async () => {
        const partialMigrationHooks: IMigrationHooks<IDB> = {
            onBeforeMigrate: sinon.stub().resolves()
            // No onAfterMigrate or onMigrationError
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: partialMigrationHooks
}, cfg);

        const result = await executor.migrate();

        expect((partialMigrationHooks.onBeforeMigrate as sinon.SinonStub).called).to.be.true;
        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() with only onAfterMigrate hook
     * Verifies optional chaining for onBeforeMigrate and onMigrationError
     */
    it('should handle when only onAfterMigrate is implemented', async () => {
        const partialMigrationHooks: IMigrationHooks<IDB> = {
            onAfterMigrate: sinon.stub().resolves()
            // No onBeforeMigrate or onMigrationError
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: partialMigrationHooks
}, cfg);

        const result = await executor.migrate();

        expect((partialMigrationHooks.onAfterMigrate as sinon.SinonStub).called).to.be.true;
        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() with only onMigrationError hook
     * Verifies optional chaining for onBeforeMigrate and onAfterMigrate
     */
    it('should handle when only onMigrationError is implemented', async () => {
        const errorOnlyHook: IMigrationHooks<IDB> = {
            onMigrationError: sinon.stub().resolves()
            // No onBeforeMigrate or onAfterMigrate
        };

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: errorOnlyHook
}, cfg);

        const result = await executor.migrate();

        // onMigrationError should NOT be called in success case
        expect((errorOnlyHook.onMigrationError as sinon.SinonStub).called).to.be.false;
        expect(result.success).to.be.true;
    });

    /**
     * Test: CompositeHooks<IDB> integration
     * Verifies CompositeHooks works correctly with multiple hook implementations
     */
    it('should work with CompositeHooks', async () => {
        const hook1: IMigrationHooks<IDB> = {
            onStart: sinon.stub().resolves(),
            onComplete: sinon.stub().resolves()
        };

        const hook2: IMigrationHooks<IDB> = {
            onBeforeBackup: sinon.stub().resolves(),
            onAfterBackup: sinon.stub().resolves()
        };

        const compositeHooks = new CompositeHooks<IDB>([hook1, hook2]);

        executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
            hooks: compositeHooks
}, cfg);

        const result = await executor.migrate();

        // Verify both hook implementations were called
        expect((hook1.onStart as sinon.SinonStub).calledOnce).to.be.true;
        expect((hook1.onComplete as sinon.SinonStub).calledOnce).to.be.true;
        expect((hook2.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
        expect((hook2.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;

        expect(result.success).to.be.true;
    });

});
