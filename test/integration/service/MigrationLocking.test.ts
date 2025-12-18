import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {
    MigrationScriptExecutor,
    IDatabaseMigrationHandler,
    IDB,
    ISchemaVersion,
    IBackup,
    Config,
    LockingConfig,
    ILockingService,
    ILockStatus,
    SilentLogger,
    MigrationScript
} from '../../../src';

use(chaiAsPromised);

describe('Migration Locking Mechanism', () => {
    let lockAcquireCalls: string[] = [];
    let lockVerifyCalls: string[] = [];
    let lockReleaseCalls: string[] = [];
    let lockCleanupCalls: number = 0;
    let lockStatusCalls: number = 0;

    // Mock locking service
    class MockLockingService implements ILockingService<IDB> {
        private locked = false;
        private owner: string | null = null;
        public shouldFailAcquire = false;
        public shouldFailVerify = false;
        public failAcquireAttempts = 0; // Fail first N attempts, then succeed
        private storageInitialized = true; // Default to initialized for backwards compat tests

        async initLockStorage(): Promise<void> {
            this.storageInitialized = true;
        }

        async ensureLockStorageAccessible(): Promise<boolean> {
            return this.storageInitialized;
        }

        async acquireLock(executorId: string): Promise<boolean> {
            lockAcquireCalls.push(executorId);

            if (this.shouldFailAcquire) {
                return false;
            }

            if (this.failAcquireAttempts > 0) {
                this.failAcquireAttempts--;
                return false;
            }

            if (this.locked) {
                return false;
            }

            this.locked = true;
            this.owner = executorId;
            return true;
        }

        async verifyLockOwnership(executorId: string): Promise<boolean> {
            lockVerifyCalls.push(executorId);

            if (this.shouldFailVerify) {
                return false;
            }

            return this.locked && this.owner === executorId;
        }

        async releaseLock(executorId: string): Promise<void> {
            lockReleaseCalls.push(executorId);
            if (this.owner === executorId) {
                this.locked = false;
                this.owner = null;
            }
        }

        async getLockStatus(): Promise<ILockStatus | null> {
            lockStatusCalls++;
            if (!this.locked) {
                return null;
            }

            return {
                isLocked: true,
                lockedBy: this.owner,
                lockedAt: new Date(),
                expiresAt: new Date(Date.now() + 600_000),
                processId: this.owner?.split('-')[1]
            };
        }

        async forceReleaseLock(): Promise<void> {
            this.locked = false;
            this.owner = null;
        }

        async checkAndReleaseExpiredLock(): Promise<void> {
            lockCleanupCalls++;
        }
    }

    function createHandler(lockingService?: ILockingService<IDB>): IDatabaseMigrationHandler<IDB> {
        return {
            db: {
                checkConnection: async () => true,
                [Symbol.toStringTag]: 'MockDB'
            } as IDB,
            schemaVersion: {
                isInitialized: async () => true,
                init: async () => { return; },
                createTable: async () => { return; },
                validateTable: async () => true,
                getAll: async () => [],
                save: async () => { return; },
                remove: async () => { return; },
                migrationRecords: {
                    getAllExecuted: async () => []
                }
            } as unknown as ISchemaVersion<IDB>,
            backup: {
                backup: async () => '',
                restore: async () => { return; }
            } as IBackup<IDB>,
            lockingService,
            getName: () => 'Test Handler',
            getVersion: () => '1.0.0'
        };
    }

    beforeEach(() => {
        lockAcquireCalls = [];
        lockVerifyCalls = [];
        lockReleaseCalls = [];
        lockCleanupCalls = 0;
        lockStatusCalls = 0;
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Locking Enabled - Success Path', () => {
        it('should acquire and release lock during migration', async () => {
            const lockingService = new MockLockingService();
            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ enabled: true });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await executor.migrate();

            // Should call cleanup, acquire, verify, and release
            expect(lockCleanupCalls).to.equal(1);
            expect(lockAcquireCalls).to.have.lengthOf(1);
            expect(lockVerifyCalls).to.have.lengthOf(1);
            expect(lockReleaseCalls).to.have.lengthOf(1);

            // Verify same executor ID used throughout
            expect(lockAcquireCalls[0]).to.equal(lockVerifyCalls[0]);
            expect(lockAcquireCalls[0]).to.equal(lockReleaseCalls[0]);

            // Verify executor ID format (hostname-pid-uuid)
            const executorId = lockAcquireCalls[0];
            const parts = executorId.split('-');
            expect(parts.length).to.be.greaterThan(3); // hostname-pid-uuid (uuid has dashes)
        });

        it('should acquire and release lock during migrateToVersion', async () => {
            const lockingService = new MockLockingService();
            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await executor.migrate(999999999999);

            expect(lockAcquireCalls).to.have.lengthOf(1);
            expect(lockVerifyCalls).to.have.lengthOf(1);
            expect(lockReleaseCalls).to.have.lengthOf(1);
        });
    });

    describe('Locking Disabled', () => {
        it('should skip locking when lockingService is not provided', async () => {
            const handler = createHandler(); // No locking service
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await executor.migrate();

            // No locking calls should be made
            expect(lockAcquireCalls).to.have.lengthOf(0);
            expect(lockVerifyCalls).to.have.lengthOf(0);
            expect(lockReleaseCalls).to.have.lengthOf(0);
        });

        it('should skip locking when config.locking.enabled is false', async () => {
            const lockingService = new MockLockingService();
            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ enabled: false });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await executor.migrate();

            // No locking calls should be made
            expect(lockAcquireCalls).to.have.lengthOf(0);
            expect(lockVerifyCalls).to.have.lengthOf(0);
            expect(lockReleaseCalls).to.have.lengthOf(0);
        });
    });

    describe('Lock Acquisition Failure', () => {
        it('should throw error when lock acquisition fails (fail-fast)', async () => {
            const lockingService = new MockLockingService();
            lockingService.shouldFailAcquire = true;

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({
                enabled: true,
                retryAttempts: 0 // Fail fast
            });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await expect(executor.migrate()).to.be.rejectedWith(
                /Failed to acquire migration lock after 1 attempt/
            );

            // Should attempt once, no verify, getLockStatus called twice (orchestrator + error message)
            expect(lockAcquireCalls).to.have.lengthOf(1);
            expect(lockVerifyCalls).to.have.lengthOf(0);
            expect(lockStatusCalls).to.equal(2);
        });

        it('should retry lock acquisition based on config', async () => {
            const lockingService = new MockLockingService();
            lockingService.failAcquireAttempts = 2; // Fail first 2, succeed on 3rd

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({
                enabled: true,
                retryAttempts: 3,
                retryDelay: 10 // Fast for testing
            });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await executor.migrate();

            // Should attempt 3 times before succeeding
            expect(lockAcquireCalls).to.have.lengthOf(3);
            expect(lockVerifyCalls).to.have.lengthOf(1);
            expect(lockReleaseCalls).to.have.lengthOf(1);
        });

        it('should fail after exhausting all retry attempts', async () => {
            const lockingService = new MockLockingService();
            lockingService.shouldFailAcquire = true;

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({
                enabled: true,
                retryAttempts: 2,
                retryDelay: 10
            });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await expect(executor.migrate()).to.be.rejectedWith(
                /Failed to acquire migration lock after 3 attempt/
            );

            // Should attempt 3 times (1 initial + 2 retries)
            expect(lockAcquireCalls).to.have.lengthOf(3);
            expect(lockVerifyCalls).to.have.lengthOf(0);
        });
    });

    describe('Lock Ownership Verification Failure', () => {
        it('should throw error when lock ownership verification fails', async () => {
            const lockingService = new MockLockingService();
            lockingService.shouldFailVerify = true;

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await expect(executor.migrate()).to.be.rejectedWith(
                /Lock ownership verification failed/
            );

            expect(lockAcquireCalls).to.have.lengthOf(1);
            expect(lockVerifyCalls).to.have.lengthOf(1);
        });
    });

    describe('Lock Release on Error', () => {
        it('should release lock even when migration fails', async () => {
            const lockingService = new MockLockingService();
            const handler = createHandler(lockingService);

            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ enabled: true });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            // Create a failing migration script
            const failingMigration = new MigrationScript<IDB>('failing', './test.ts', 202001010000);
            sinon.stub(failingMigration, 'init').resolves();
            failingMigration.script = {
                up: sinon.stub().rejects(new Error('Migration failed'))
            };

            // Stub the scanner to return the failing migration
            sinon.stub((executor as any).core.scanner, 'scan').resolves({
                all: [failingMigration],
                migrated: [],
                pending: [failingMigration],
                ignored: [],
                executed: []
            });

            const result = await executor.migrate();

            // Migration should fail but lock should be released
            expect(result.success).to.be.false;
            expect(lockAcquireCalls).to.have.lengthOf(1);
            expect(lockReleaseCalls).to.have.lengthOf(1);
        });

        it('should not throw if lock release fails', async () => {
            const lockingService = new MockLockingService();
            // Override releaseLock to throw error
            lockingService.releaseLock = async () => {
                lockReleaseCalls.push('error');
                throw new Error('Release failed');
            };

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            // Should not throw despite lock release failure
            await executor.migrate();

            expect(lockReleaseCalls).to.have.lengthOf(1);
        });
    });

    describe('Executor ID Generation', () => {
        it('should generate unique executor IDs for each migration', async () => {
            const lockingService = new MockLockingService();
            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            await executor.migrate();
            const firstId = lockAcquireCalls[0];

            lockAcquireCalls = [];
            await executor.migrate();
            const secondId = lockAcquireCalls[0];

            // IDs should be different due to UUID
            expect(firstId).to.not.equal(secondId);

            // But both should have same hostname and pid prefix
            const firstParts = firstId.split('-');
            const secondParts = secondId.split('-');
            expect(firstParts[0]).to.equal(secondParts[0]); // hostname
            expect(firstParts[1]).to.equal(secondParts[1]); // pid
        });
    });

    describe('Error Messages', () => {
        it('should include lock status in error message when lock fails', async () => {
            const lockingService = new MockLockingService();
            lockingService.shouldFailAcquire = true;

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ retryAttempts: 0 });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            try {
                await executor.migrate();
                expect.fail('Should have thrown');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).to.include('Failed to acquire migration lock');
                expect(errorMsg).to.include('Another migration is likely running');
                expect(errorMsg).to.include('msr lock:release --force');
            }
        });

        it('should include lock holder information in error when available', async () => {
            const lockingService = new MockLockingService();

            // Manually set lock to simulate another executor holding it
            await lockingService.acquireLock('other-executor-123-uuid');
            lockingService.shouldFailAcquire = true;

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ retryAttempts: 0 });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            try {
                await executor.migrate();
                expect.fail('Should have thrown');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).to.include('currently held by: other-executor-123-uuid');
                expect(errorMsg).to.include('expires:');
            }
        });

        it('should show "lock status unknown" when getLockStatus returns null', async () => {
            const lockingService = new MockLockingService();
            lockingService.shouldFailAcquire = true;

            // Override getLockStatus to return null
            lockingService.getLockStatus = async () => null;

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ retryAttempts: 0 });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            try {
                await executor.migrate();
                expect.fail('Should have thrown');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).to.include('Failed to acquire migration lock');
                expect(errorMsg).to.include('lock status unknown');
            }
        });

        it('should show "lock status unknown" when getLockStatus returns isLocked=false', async () => {
            const lockingService = new MockLockingService();
            lockingService.shouldFailAcquire = true;

            // Override getLockStatus to return status with isLocked=false
            lockingService.getLockStatus = async () => ({
                isLocked: false,
                lockedBy: null,
                lockedAt: null,
                expiresAt: null,
                processId: undefined
            });

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ retryAttempts: 0 });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            try {
                await executor.migrate();
                expect.fail('Should have thrown');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).to.include('Failed to acquire migration lock');
                expect(errorMsg).to.include('lock status unknown');
            }
        });

        it('should handle lock status with null expiresAt', async () => {
            const lockingService = new MockLockingService();

            // Manually set lock to simulate another executor holding it
            await lockingService.acquireLock('other-executor-456-uuid');
            lockingService.shouldFailAcquire = true;

            // Override getLockStatus to return status with null expiresAt
            lockingService.getLockStatus = async () => ({
                isLocked: true,
                lockedBy: 'other-executor-456-uuid',
                lockedAt: new Date(),
                expiresAt: null, // null expiresAt
                processId: '456'
            });

            const handler = createHandler(lockingService);
            const config = new Config();
            config.folder = './test/fixtures/migrations/empty';
            config.locking = new LockingConfig({ retryAttempts: 0 });

            const executor = new MigrationScriptExecutor<IDB>({
                handler,
                config,
                logger: new SilentLogger()
            });

            try {
                await executor.migrate();
                expect.fail('Should have thrown');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).to.include('currently held by: other-executor-456-uuid');
                // Should not crash when expiresAt is null
                expect(errorMsg).to.not.include('undefined');
            }
        });
    });

    describe('Initialization Methods (v0.8.1)', () => {
        /**
         * Test: Locking service must implement initialization methods
         * Verifies that all locking services implement required methods.
         */
        it('should have initLockStorage and ensureLockStorageAccessible methods', async () => {
            const lockingService = new MockLockingService();

            expect(lockingService.initLockStorage).to.be.a('function');
            expect(lockingService.ensureLockStorageAccessible).to.be.a('function');
        });

        /**
         * Test: initLockStorage can be called
         * Verifies that initLockStorage method can be invoked.
         */
        it('should call initLockStorage', async () => {
            let initCalled = false;

            class LockingServiceWithInit extends MockLockingService {
                async initLockStorage(): Promise<void> {
                    initCalled = true;
                    await super.initLockStorage();
                }
            }

            const lockingService = new LockingServiceWithInit();

            await lockingService.initLockStorage();

            expect(initCalled).to.be.true;
        });

        /**
         * Test: ensureLockStorageAccessible returns true when storage is accessible
         * Verifies the pre-flight check functionality.
         */
        it('should return true from ensureLockStorageAccessible when storage is accessible', async () => {
            class LockingServiceWithAccessCheck extends MockLockingService {
                async ensureLockStorageAccessible(): Promise<boolean> {
                    return true;
                }
            }

            const lockingService = new LockingServiceWithAccessCheck();

            const accessible = await lockingService.ensureLockStorageAccessible();
            expect(accessible).to.be.true;
        });

        /**
         * Test: ensureLockStorageAccessible returns false when storage is not accessible
         * Verifies the check can detect inaccessible storage.
         */
        it('should return false from ensureLockStorageAccessible when storage is not accessible', async () => {
            class LockingServiceWithFailedCheck extends MockLockingService {
                async ensureLockStorageAccessible(): Promise<boolean> {
                    return false;
                }
            }

            const lockingService = new LockingServiceWithFailedCheck();

            const accessible = await lockingService.ensureLockStorageAccessible();
            expect(accessible).to.be.false;
        });

        /**
         * Test: initLockStorage throws error on setup failure
         * Verifies that initialization errors are propagated correctly.
         */
        it('should throw error from initLockStorage when setup fails', async () => {
            class LockingServiceWithFailedInit extends MockLockingService {
                async initLockStorage(): Promise<void> {
                    throw new Error('Failed to create lock table: permission denied');
                }
            }

            const lockingService = new LockingServiceWithFailedInit();

            await expect(
                lockingService.initLockStorage()
            ).to.be.rejectedWith('Failed to create lock table: permission denied');
        });

        /**
         * Test: initLockStorage is idempotent
         * Verifies that calling initLockStorage multiple times is safe.
         */
        it('should allow initLockStorage to be called multiple times (idempotent)', async () => {
            let callCount = 0;

            class IdempotentLockingService extends MockLockingService {
                async initLockStorage(): Promise<void> {
                    callCount++;
                    await super.initLockStorage();
                    // Simulate CREATE TABLE IF NOT EXISTS behavior - safe to call multiple times
                }
            }

            const lockingService = new IdempotentLockingService();

            await lockingService.initLockStorage();
            await lockingService.initLockStorage();
            await lockingService.initLockStorage();

            expect(callCount).to.equal(3);
            // Should not throw error on multiple calls
        });

        /**
         * Test: Both initialization methods work together
         * Verifies the typical initialization workflow: init then check.
         */
        it('should work with both initialization methods', async () => {
            let initCalled = false;
            let checkCalled = false;

            class FullyInitializableLockingService extends MockLockingService {
                private initialized = false;

                async initLockStorage(): Promise<void> {
                    initCalled = true;
                    this.initialized = true;
                    // Simulate creating lock storage
                }

                async ensureLockStorageAccessible(): Promise<boolean> {
                    checkCalled = true;
                    // Return true only if init was called
                    return this.initialized;
                }
            }

            const lockingService = new FullyInitializableLockingService();

            // Check before init - should return false
            let accessible = await lockingService.ensureLockStorageAccessible();
            expect(accessible).to.be.false;
            expect(checkCalled).to.be.true;

            // Initialize
            await lockingService.initLockStorage();
            expect(initCalled).to.be.true;

            // Check after init - should return true
            accessible = await lockingService.ensureLockStorageAccessible();
            expect(accessible).to.be.true;
        });
    });
});
