import { expect } from 'chai';
import sinon from 'sinon';
import {
    RollbackService,
    Config,
    RollbackStrategy,
    BackupMode,
    MigrationScript,
    SilentLogger
} from "../../../src";
import {IDatabaseMigrationHandler} from "../../../src/interface/IDatabaseMigrationHandler";
import {IBackupService} from "../../../src/interface/service/IBackupService";
import {IMigrationHooks} from "../../../src/interface/IMigrationHooks";

describe('RollbackService', () => {
    let rollbackService: RollbackService;
    let handler: IDatabaseMigrationHandler;
    let config: Config;
    let backupService: IBackupService;
    let logger: any;
    let hooks: IMigrationHooks;

    beforeEach(() => {
        config = new Config();
        logger = new SilentLogger();

        // Mock handler
        handler = {
            db: { test: () => {} },
            schemaVersion: {
                init: sinon.stub().resolves(),
                save: sinon.stub().resolves(),
                remove: sinon.stub().resolves(),
                getAllExecuted: sinon.stub().resolves([])
            },
            backup: {
                backup: sinon.stub().resolves('backup-data'),
                restore: sinon.stub().resolves()
            },
            getName: () => 'Test Handler'
        } as any;

        // Mock backup service
        backupService = {
            backup: sinon.stub().resolves('/path/to/backup.bkp'),
            restore: sinon.stub().resolves(),
            deleteBackup: sinon.stub()
        };

        // Mock hooks
        hooks = {
            onBeforeRestore: sinon.stub().resolves(),
            onAfterRestore: sinon.stub().resolves()
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Constructor', () => {
        /**
         * Test: Constructor creates instance with all parameters
         * Validates that RollbackService can be instantiated with handler,
         * config, backupService, logger, and hooks.
         */
        it('should create instance with all parameters', () => {
            rollbackService = new RollbackService(handler, config, backupService, logger, hooks);
            expect(rollbackService).to.be.instanceOf(RollbackService);
        });

        /**
         * Test: Constructor creates instance without optional hooks
         * Validates that RollbackService can be instantiated without the optional
         * hooks parameter.
         */
        it('should create instance without hooks', () => {
            rollbackService = new RollbackService(handler, config, backupService, logger);
            expect(rollbackService).to.be.instanceOf(RollbackService);
        });
    });

    describe('shouldCreateBackup()', () => {
        /**
         * Test: shouldCreateBackup returns true for BACKUP strategy with FULL mode
         * Validates that backup is created when strategy is BACKUP and mode is FULL.
         */
        it('should return true for BACKUP strategy with FULL mode', () => {
            config.rollbackStrategy = RollbackStrategy.BACKUP;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.true;
        });

        /**
         * Test: shouldCreateBackup returns true for BOTH strategy with FULL mode
         * Validates that backup is created when strategy is BOTH and mode is FULL.
         */
        it('should return true for BOTH strategy with FULL mode', () => {
            config.rollbackStrategy = RollbackStrategy.BOTH;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.true;
        });

        /**
         * Test: shouldCreateBackup returns true for BACKUP strategy with CREATE_ONLY mode
         * Validates that backup is created when mode is CREATE_ONLY.
         */
        it('should return true for BACKUP strategy with CREATE_ONLY mode', () => {
            config.rollbackStrategy = RollbackStrategy.BACKUP;
            config.backupMode = BackupMode.CREATE_ONLY;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.true;
        });

        /**
         * Test: shouldCreateBackup returns false for BACKUP strategy with RESTORE_ONLY mode
         * Validates that backup is NOT created when mode is RESTORE_ONLY.
         */
        it('should return false for BACKUP strategy with RESTORE_ONLY mode', () => {
            config.rollbackStrategy = RollbackStrategy.BACKUP;
            config.backupMode = BackupMode.RESTORE_ONLY;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.false;
        });

        /**
         * Test: shouldCreateBackup returns false for BACKUP strategy with MANUAL mode
         * Validates that backup is NOT created when mode is MANUAL.
         */
        it('should return false for BACKUP strategy with MANUAL mode', () => {
            config.rollbackStrategy = RollbackStrategy.BACKUP;
            config.backupMode = BackupMode.MANUAL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.false;
        });

        /**
         * Test: shouldCreateBackup returns false for DOWN strategy
         * Validates that backup is NOT created when strategy is DOWN.
         */
        it('should return false for DOWN strategy', () => {
            config.rollbackStrategy = RollbackStrategy.DOWN;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.false;
        });

        /**
         * Test: shouldCreateBackup returns false for NONE strategy
         * Validates that backup is NOT created when strategy is NONE.
         */
        it('should return false for NONE strategy', () => {
            config.rollbackStrategy = RollbackStrategy.NONE;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.false;
        });

        /**
         * Test: shouldCreateBackup returns false when handler has no backup interface
         * Validates that backup is NOT created when handler doesn't support backups.
         */
        it('should return false when handler has no backup interface', () => {
            const handlerWithoutBackup = {
                ...handler,
                backup: undefined
            };
            config.rollbackStrategy = RollbackStrategy.BACKUP;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handlerWithoutBackup as any, config, backupService, logger);

            expect(rollbackService.shouldCreateBackup()).to.be.false;
        });
    });

    describe('rollback() with BACKUP strategy', () => {
        beforeEach(() => {
            config.rollbackStrategy = RollbackStrategy.BACKUP;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger, hooks);
        });

        /**
         * Test: rollback calls backupService.restore with provided backup path
         * Validates that BACKUP strategy restores from the provided backup file.
         */
        it('should restore from provided backup path', async () => {
            const backupPath = '/path/to/backup.bkp';
            await rollbackService.rollback([], backupPath);

            expect((backupService.restore as sinon.SinonStub).calledOnce).to.be.true;
            expect((backupService.restore as sinon.SinonStub).calledWith(backupPath)).to.be.true;
            expect((backupService.deleteBackup as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test: rollback calls hooks onBeforeRestore and onAfterRestore
         * Validates that lifecycle hooks are called during backup restoration.
         */
        it('should call restore hooks', async () => {
            const backupPath = '/path/to/backup.bkp';
            await rollbackService.rollback([], backupPath);

            expect((hooks.onBeforeRestore as sinon.SinonStub)!.calledOnce).to.be.true;
            expect((hooks.onAfterRestore as sinon.SinonStub)!.calledOnce).to.be.true;
        });

        /**
         * Test: rollback works without hooks
         * Validates that backup restoration works when hooks are not provided.
         */
        it('should work without hooks', async () => {
            rollbackService = new RollbackService(handler, config, backupService, logger);
            const backupPath = '/path/to/backup.bkp';

            await rollbackService.rollback([], backupPath);

            expect((backupService.restore as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test: rollback uses existingBackupPath with RESTORE_ONLY mode
         * Validates that when mode is RESTORE_ONLY, it uses config.backup.existingBackupPath.
         */
        it('should use existingBackupPath with RESTORE_ONLY mode', async () => {
            config.backupMode = BackupMode.RESTORE_ONLY;
            config.backup.existingBackupPath = '/existing/backup.bkp';
            rollbackService = new RollbackService(handler, config, backupService, logger);

            await rollbackService.rollback([], undefined);

            expect((backupService.restore as sinon.SinonStub).calledOnce).to.be.true;
            expect((backupService.restore as sinon.SinonStub).calledWith('/existing/backup.bkp')).to.be.true;
        });

        /**
         * Test: rollback throws error when RESTORE_ONLY mode but no existingBackupPath
         * Validates that an error is thrown when RESTORE_ONLY mode is used without
         * specifying existingBackupPath in config.
         */
        it('should throw error when RESTORE_ONLY mode but no existingBackupPath', async () => {
            config.backupMode = BackupMode.RESTORE_ONLY;
            config.backup.existingBackupPath = undefined;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            try {
                await rollbackService.rollback([], undefined);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect((error as Error).message).to.include('existingBackupPath');
            }
        });

        /**
         * Test: rollback skips restore with CREATE_ONLY mode
         * Validates that restore is skipped when mode is CREATE_ONLY.
         */
        it('should skip restore with CREATE_ONLY mode', async () => {
            config.backupMode = BackupMode.CREATE_ONLY;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            await rollbackService.rollback([], '/path/to/backup.bkp');

            expect((backupService.restore as sinon.SinonStub).called).to.be.false;
        });
    });

    describe('rollback() with DOWN strategy', () => {
        let script1: MigrationScript;
        let script2: MigrationScript;
        let downStub1: sinon.SinonStub;
        let downStub2: sinon.SinonStub;

        beforeEach(() => {
            config.rollbackStrategy = RollbackStrategy.DOWN;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            downStub1 = sinon.stub().resolves();
            downStub2 = sinon.stub().resolves();

            script1 = new MigrationScript('migration1', '/path/to/migration1.ts', 1);
            script1.script = { up: sinon.stub().resolves(), down: downStub1 };

            script2 = new MigrationScript('migration2', '/path/to/migration2.ts', 2);
            script2.script = { up: sinon.stub().resolves(), down: downStub2 };
        });

        /**
         * Test: rollback calls down() on all scripts in reverse order
         * Validates that DOWN strategy executes down() methods in reverse chronological order.
         */
        it('should call down() on all scripts in reverse order', async () => {
            await rollbackService.rollback([script1, script2], undefined);

            expect(downStub2.calledBefore(downStub1)).to.be.true;
            expect(downStub1.calledOnce).to.be.true;
            expect(downStub2.calledOnce).to.be.true;
        });

        /**
         * Test: rollback skips scripts without down() method
         * Validates that scripts without down() are skipped with a warning.
         */
        it('should skip scripts without down() method', async () => {
            const script3 = new MigrationScript('migration3', '/path/to/migration3.ts', 3);
            script3.script = { up: sinon.stub().resolves() };

            await rollbackService.rollback([script1, script2, script3], undefined);

            expect(downStub1.calledOnce).to.be.true;
            expect(downStub2.calledOnce).to.be.true;
        });

        /**
         * Test: rollback handles empty script array
         * Validates that DOWN strategy handles empty array gracefully.
         */
        it('should handle empty script array', async () => {
            await rollbackService.rollback([], undefined);
            // Should complete without errors
        });

        /**
         * Test: rollback does not call backupService
         * Validates that DOWN strategy does not use backup service.
         */
        it('should not call backup service', async () => {
            await rollbackService.rollback([script1, script2], '/path/to/backup.bkp');

            expect((backupService.restore as sinon.SinonStub).called).to.be.false;
            expect((backupService.deleteBackup as sinon.SinonStub).called).to.be.false;
        });
    });

    describe('rollback() with BOTH strategy', () => {
        let script1: MigrationScript;
        let downStub1: sinon.SinonStub;

        beforeEach(() => {
            config.rollbackStrategy = RollbackStrategy.BOTH;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger, hooks);

            downStub1 = sinon.stub().resolves();
            script1 = new MigrationScript('migration1', '/path/to/migration1.ts', 1);
            script1.script = { up: sinon.stub().resolves(), down: downStub1 };
        });

        /**
         * Test: rollback tries down() first
         * Validates that BOTH strategy attempts down() methods first.
         */
        it('should try down() first', async () => {
            await rollbackService.rollback([script1], '/path/to/backup.bkp');

            expect(downStub1.calledOnce).to.be.true;
            expect((backupService.restore as sinon.SinonStub).called).to.be.false;
        });

        /**
         * Test: rollback falls back to backup when down() fails
         * Validates that BOTH strategy restores from backup if down() throws an error.
         */
        it('should fall back to backup when down() fails', async () => {
            downStub1.rejects(new Error('down() failed'));

            await rollbackService.rollback([script1], '/path/to/backup.bkp');

            expect(downStub1.calledOnce).to.be.true;
            expect((backupService.restore as sinon.SinonStub).calledOnce).to.be.true;
            expect((backupService.restore as sinon.SinonStub).calledWith('/path/to/backup.bkp')).to.be.true;
        });

        /**
         * Test: rollback calls restore hooks only on backup fallback
         * Validates that restore hooks are only called when falling back to backup.
         */
        it('should call restore hooks only on backup fallback', async () => {
            downStub1.rejects(new Error('down() failed'));

            await rollbackService.rollback([script1], '/path/to/backup.bkp');

            expect((hooks.onBeforeRestore as sinon.SinonStub)!.calledOnce).to.be.true;
            expect((hooks.onAfterRestore as sinon.SinonStub)!.calledOnce).to.be.true;
        });

        /**
         * Test: rollback does not call restore hooks when down() succeeds
         * Validates that restore hooks are not called when down() succeeds.
         */
        it('should not call restore hooks when down() succeeds', async () => {
            await rollbackService.rollback([script1], '/path/to/backup.bkp');

            expect((hooks.onBeforeRestore as sinon.SinonStub)!.called).to.be.false;
            expect((hooks.onAfterRestore as sinon.SinonStub)!.called).to.be.false;
        });
    });

    describe('rollback() with NONE strategy', () => {
        beforeEach(() => {
            config.rollbackStrategy = RollbackStrategy.NONE;
            rollbackService = new RollbackService(handler, config, backupService, logger);
        });

        /**
         * Test: rollback does nothing with NONE strategy
         * Validates that NONE strategy performs no rollback operations.
         */
        it('should do nothing', async () => {
            const script1 = new MigrationScript('migration1', '/path/to/migration1.ts', 1);
            script1.script = {
                up: sinon.stub().resolves(),
                down: sinon.stub().resolves()
            };

            await rollbackService.rollback([script1], '/path/to/backup.bkp');

            expect((backupService.restore as sinon.SinonStub).called).to.be.false;
            expect((backupService.deleteBackup as sinon.SinonStub).called).to.be.false;
            expect((script1.script.down as sinon.SinonStub).called).to.be.false;
        });
    });

    describe('Edge cases for backup mode logic', () => {
        /**
         * Test: rollback with BOTH strategy but down() succeeds should not call restore
         * This specifically tests that shouldRestoreInMode() returns false for non-backup strategies,
         * covering the defensive return false at line 272.
         */
        it('should not attempt backup restore when BOTH strategy succeeds with down()', async () => {
            config.rollbackStrategy = RollbackStrategy.BOTH;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            const script1 = new MigrationScript('migration1', '/path/to/migration1.ts', 1);
            const downStub = sinon.stub().resolves();
            script1.script = { up: sinon.stub().resolves(), down: downStub };

            await rollbackService.rollback([script1], '/path/to/backup.bkp');

            // down() succeeded, so backup restore should NOT be called
            expect(downStub.calledOnce).to.be.true;
            expect((backupService.restore as sinon.SinonStub).called).to.be.false;
        });

        /**
         * Test: rollback skips restore with NONE strategy even with FULL mode
         * Validates defensive code path for NONE strategy.
         */
        it('should skip restore with NONE strategy even with FULL mode', async () => {
            config.rollbackStrategy = RollbackStrategy.NONE;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            await rollbackService.rollback([], '/path/to/backup.bkp');

            // Should do nothing
            expect((backupService.restore as sinon.SinonStub).called).to.be.false;
        });

        /**
         * Test: shouldRestoreInMode returns false for DOWN strategy (defensive code coverage)
         * Uses reflection to directly test the private method shouldRestoreInMode()
         * to achieve 100% coverage of line 272 (defensive return false).
         */
        it('should return false from shouldRestoreInMode with DOWN strategy', () => {
            config.rollbackStrategy = RollbackStrategy.DOWN;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            // Access private method via type casting for coverage
            const shouldRestore = (rollbackService as any).shouldRestoreInMode();

            // Should return false because strategy is DOWN (doesn't involve backups)
            expect(shouldRestore).to.be.false;
        });

        /**
         * Test: shouldRestoreInMode returns false for NONE strategy (defensive code coverage)
         * Uses reflection to test the defensive code path.
         */
        it('should return false from shouldRestoreInMode with NONE strategy', () => {
            config.rollbackStrategy = RollbackStrategy.NONE;
            config.backupMode = BackupMode.FULL;
            rollbackService = new RollbackService(handler, config, backupService, logger);

            // Access private method via type casting for coverage
            const shouldRestore = (rollbackService as any).shouldRestoreInMode();

            // Should return false because strategy is NONE (doesn't involve backups)
            expect(shouldRestore).to.be.false;
        });
    });
});
