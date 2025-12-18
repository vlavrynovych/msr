import {expect} from 'chai';
import {MigrationScriptExecutor} from '../../../src/service/MigrationScriptExecutor';
import {Config} from '../../../src/model';
import {IDB, IDatabaseMigrationHandler} from '../../../src/interface';
import {ILockingService, ILockStatus} from '../../../src/interface/service/ILockingService';
import {SilentLogger} from '../../../src/logger/SilentLogger';

describe('MigrationScriptExecutor - Lock Management Methods', () => {
    describe('getLockStatus()', () => {
        it('should return null when locking service is not configured', async () => {
            const handler = {
                db: {} as IDB,
                schemaVersion: { init: async () => {}, getExecutedMigrations: async () => [] },
                backup: async () => 'backup-data',
                restore: async () => {},
                checkConnection: async () => true,
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0',
                // No lockingService
            } as unknown as IDatabaseMigrationHandler<IDB>;

            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            const status = await executor.getLockStatus();
            expect(status).to.be.null;
        });

        it('should return lock status when locking service is configured', async () => {
            const mockLockStatus: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date('2025-12-18T10:00:00Z'),
                expiresAt: new Date('2025-12-18T10:10:00Z'),
                processId: '12345'
            };

            const lockingService: ILockingService<IDB> = {
                initLockStorage: async () => {},
                ensureLockStorageAccessible: async () => true,
                acquireLock: async () => true,
                releaseLock: async () => {},
                verifyLockOwnership: async () => true,
                getLockStatus: async () => mockLockStatus,
                forceReleaseLock: async () => {},
                checkAndReleaseExpiredLock: async () => {}
            };

            const handler = {
                db: {} as IDB,
                schemaVersion: { init: async () => {}, getExecutedMigrations: async () => [] },
                backup: async () => 'backup-data',
                restore: async () => {},
                checkConnection: async () => true,
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0',
                lockingService
            } as unknown as IDatabaseMigrationHandler<IDB>;

            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            const status = await executor.getLockStatus();
            expect(status).to.deep.equal(mockLockStatus);
        });

        it('should return unlocked status when no lock is held', async () => {
            const mockLockStatus: ILockStatus = {
                isLocked: false,
                lockedBy: null,
                lockedAt: null,
                expiresAt: null,
                processId: undefined
            };

            const lockingService: ILockingService<IDB> = {
                initLockStorage: async () => {},
                ensureLockStorageAccessible: async () => true,
                acquireLock: async () => true,
                releaseLock: async () => {},
                verifyLockOwnership: async () => true,
                getLockStatus: async () => mockLockStatus,
                forceReleaseLock: async () => {},
                checkAndReleaseExpiredLock: async () => {}
            };

            const handler = {
                db: {} as IDB,
                schemaVersion: { init: async () => {}, getExecutedMigrations: async () => [] },
                backup: async () => 'backup-data',
                restore: async () => {},
                checkConnection: async () => true,
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0',
                lockingService
            } as unknown as IDatabaseMigrationHandler<IDB>;

            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            const status = await executor.getLockStatus();
            expect(status).to.deep.equal(mockLockStatus);
            expect(status?.isLocked).to.be.false;
        });
    });

    describe('forceReleaseLock()', () => {
        it('should throw error when locking service is not configured', async () => {
            const handler = {
                db: {} as IDB,
                schemaVersion: { init: async () => {}, getExecutedMigrations: async () => [] },
                backup: async () => 'backup-data',
                restore: async () => {},
                checkConnection: async () => true,
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0',
                // No lockingService
            } as unknown as IDatabaseMigrationHandler<IDB>;

            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            try {
                await executor.forceReleaseLock();
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).to.include('Locking service is not configured');
                expect((error as Error).message).to.include('Cannot release lock');
            }
        });

        it('should call forceReleaseLock on locking service', async () => {
            let forceReleaseWasCalled = false;

            const lockingService: ILockingService<IDB> = {
                initLockStorage: async () => {},
                ensureLockStorageAccessible: async () => true,
                acquireLock: async () => true,
                releaseLock: async () => {},
                verifyLockOwnership: async () => true,
                getLockStatus: async () => null,
                forceReleaseLock: async () => {
                    forceReleaseWasCalled = true;
                },
                checkAndReleaseExpiredLock: async () => {}
            };

            const handler = {
                db: {} as IDB,
                schemaVersion: { init: async () => {}, getExecutedMigrations: async () => [] },
                backup: async () => 'backup-data',
                restore: async () => {},
                checkConnection: async () => true,
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0',
                lockingService
            } as unknown as IDatabaseMigrationHandler<IDB>;

            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await executor.forceReleaseLock();
            expect(forceReleaseWasCalled).to.be.true;
        });

        it('should propagate errors from locking service', async () => {
            const lockingService: ILockingService<IDB> = {
                initLockStorage: async () => {},
                ensureLockStorageAccessible: async () => true,
                acquireLock: async () => true,
                releaseLock: async () => {},
                verifyLockOwnership: async () => true,
                getLockStatus: async () => null,
                forceReleaseLock: async () => {
                    throw new Error('Database error: failed to release lock');
                },
                checkAndReleaseExpiredLock: async () => {}
            };

            const handler = {
                db: {} as IDB,
                schemaVersion: { init: async () => {}, getExecutedMigrations: async () => [] },
                backup: async () => 'backup-data',
                restore: async () => {},
                checkConnection: async () => true,
                getName: () => 'TestHandler',
                getVersion: () => '1.0.0',
                lockingService
            } as unknown as IDatabaseMigrationHandler<IDB>;

            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            try {
                await executor.forceReleaseLock();
                expect.fail('Should have thrown');
            } catch (error) {
                expect((error as Error).message).to.equal('Database error: failed to release lock');
            }
        });
    });
});
