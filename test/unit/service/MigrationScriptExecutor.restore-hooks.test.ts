import { expect } from 'chai';
import sinon from 'sinon';
import {
    MigrationScriptExecutor,
    Config,
    SilentLogger,
    IDatabaseMigrationHandler,
    ISchemaVersion,
    IMigrationInfo,
    IDB,
    IMigrationHooks,
    RollbackStrategy,
    IBackupService
} from '../../../src';

/**
 * Unit tests for MigrationScriptExecutor restore hooks functionality.
 * Tests the onBeforeRestore and onAfterRestore hooks that execute during
 * backup restoration after migration failures.
 */
describe('MigrationScriptExecutor - Restore Hooks (Unit)', () => {
    let handler: IDatabaseMigrationHandler;
    let config: Config;
    const db: IDB = new class implements IDB {
        [key: string]: unknown;
        test() { throw new Error('Not implemented') }
    }

    beforeEach(() => {
        config = new Config();
        config.folder = '/test/path';
        config.rollbackStrategy = RollbackStrategy.BACKUP;

        handler = {
            db,
            schemaVersion: {
                isInitialized: () => Promise.resolve(true),
                createTable: () => Promise.resolve(true),
                validateTable: () => Promise.resolve(true),
                migrations: {
                    getAll: () => Promise.resolve([]),
                    save: (details: IMigrationInfo) => Promise.resolve()
                }
            } as ISchemaVersion,
            getName: () => 'TestHandler'
        } as IDatabaseMigrationHandler;
    });

    afterEach(() => {
        sinon.restore();
    });

    /**
     * Test: rollbackWithBackup calls onBeforeRestore and onAfterRestore hooks
     * Covers lines 671-681 in MigrationScriptExecutor.ts
     * Validates that restore hooks are called when rollback occurs with a valid backup path.
     */
    it('should call onBeforeRestore and onAfterRestore hooks when backupPath is provided', async () => {
        const restoreHooks: IMigrationHooks = {
            onBeforeRestore: sinon.stub().resolves(),
            onAfterRestore: sinon.stub().resolves()
        };

        const mockBackupService: IBackupService = {
            backup: sinon.stub().resolves('/path/to/backup.bkp'),
            restore: sinon.stub().resolves(),
            deleteBackup: sinon.stub()
        };

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger(),
            hooks: restoreHooks,
            backupService: mockBackupService
        });

        // Access the private method via type assertion for testing
        await (executor as any).rollbackWithBackup('/path/to/backup.bkp');

        // Verify restore hooks were called
        expect((restoreHooks.onBeforeRestore as sinon.SinonStub).calledOnce).to.be.true;
        expect((restoreHooks.onAfterRestore as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockBackupService.restore as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockBackupService.deleteBackup as sinon.SinonStub).calledOnce).to.be.true;
    });

    /**
     * Test: rollbackWithBackup calls restore hooks in correct order
     * Validates that onBeforeRestore is called before restoration,
     * and onAfterRestore is called after restoration completes.
     */
    it('should call restore hooks in correct order', async () => {
        const callOrder: string[] = [];

        const orderTrackingHooks: IMigrationHooks = {
            onBeforeRestore: sinon.stub().callsFake(async () => {
                callOrder.push('onBeforeRestore');
            }),
            onAfterRestore: sinon.stub().callsFake(async () => {
                callOrder.push('onAfterRestore');
            })
        };

        const mockBackupService: IBackupService = {
            backup: sinon.stub().resolves('/path/to/backup.bkp'),
            restore: sinon.stub().callsFake(async () => {
                callOrder.push('restore');
            }),
            deleteBackup: sinon.stub().callsFake(() => {
                callOrder.push('deleteBackup');
            })
        };

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger(),
            hooks: orderTrackingHooks,
            backupService: mockBackupService
        });

        // Access the private method via type assertion for testing
        await (executor as any).rollbackWithBackup('/path/to/backup.bkp');

        // Verify order: onBeforeRestore -> restore -> onAfterRestore -> deleteBackup
        expect(callOrder).to.deep.equal(['onBeforeRestore', 'restore', 'onAfterRestore', 'deleteBackup']);
    });

    /**
     * Test: rollbackWithBackup does not call restore hooks when backupPath is undefined
     * Validates that restore hooks are not called when no backup is available.
     */
    it('should not call restore hooks when backupPath is undefined', async () => {
        const restoreHooks: IMigrationHooks = {
            onBeforeRestore: sinon.stub().resolves(),
            onAfterRestore: sinon.stub().resolves()
        };

        const mockBackupService: IBackupService = {
            backup: sinon.stub().resolves(),
            restore: sinon.stub().resolves(),
            deleteBackup: sinon.stub()
        };

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger(),
            hooks: restoreHooks,
            backupService: mockBackupService
        });

        // Access the private method via type assertion for testing
        await (executor as any).rollbackWithBackup(undefined);

        // Verify restore hooks were NOT called
        expect((restoreHooks.onBeforeRestore as sinon.SinonStub).called).to.be.false;
        expect((restoreHooks.onAfterRestore as sinon.SinonStub).called).to.be.false;
        expect((mockBackupService.restore as sinon.SinonStub).called).to.be.false;
    });

    /**
     * Test: rollbackWithBackup does not call hooks when hooks are not provided
     * Validates that the method handles missing hooks gracefully.
     */
    it('should handle missing hooks gracefully', async () => {
        const mockBackupService: IBackupService = {
            backup: sinon.stub().resolves('/path/to/backup.bkp'),
            restore: sinon.stub().resolves(),
            deleteBackup: sinon.stub()
        };

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger(),
            backupService: mockBackupService
            // No hooks provided
        });

        // Should not throw error
        await (executor as any).rollbackWithBackup('/path/to/backup.bkp');

        // Verify restore was still called
        expect((mockBackupService.restore as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockBackupService.deleteBackup as sinon.SinonStub).calledOnce).to.be.true;
    });
});
