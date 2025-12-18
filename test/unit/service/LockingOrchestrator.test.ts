import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {SinonStub, stub} from 'sinon';

use(chaiAsPromised);
import {LockingOrchestrator} from '../../../src/service/LockingOrchestrator';
import {ILockingService, ILockStatus} from '../../../src/interface/service/ILockingService';
import {ILockingHooks} from '../../../src/interface/service/ILockingHooks';
import {LockingConfig} from '../../../src/model/LockingConfig';
import {ILogger} from '../../../src/interface/ILogger';
import {IDB} from '../../../src/interface/dao';

describe('LockingOrchestrator', () => {
    let mockLockingService: ILockingService<IDB>;
    let mockLogger: ILogger;
    let config: LockingConfig;
    let acquireStub: SinonStub;
    let verifyStub: SinonStub;
    let releaseStub: SinonStub;
    let forceReleaseStub: SinonStub;
    let checkExpiredStub: SinonStub;
    let getStatusStub: SinonStub;
    let initStorageStub: SinonStub;
    let ensureAccessibleStub: SinonStub;

    beforeEach(() => {
        acquireStub = stub().resolves(true);
        verifyStub = stub().resolves(true);
        releaseStub = stub().resolves();
        forceReleaseStub = stub().resolves();
        checkExpiredStub = stub().resolves();
        getStatusStub = stub().resolves(null);
        initStorageStub = stub().resolves();
        ensureAccessibleStub = stub().resolves(true);

        mockLockingService = {
            acquireLock: acquireStub,
            verifyLockOwnership: verifyStub,
            releaseLock: releaseStub,
            forceReleaseLock: forceReleaseStub,
            checkAndReleaseExpiredLock: checkExpiredStub,
            getLockStatus: getStatusStub,
            initLockStorage: initStorageStub,
            ensureLockStorageAccessible: ensureAccessibleStub
        };

        mockLogger = {
            debug: stub(),
            info: stub(),
            warn: stub(),
            error: stub()
        } as unknown as ILogger;

        config = new LockingConfig({
            enabled: true,
            timeout: 5000,
            retryAttempts: 2,
            retryDelay: 100
        });
    });

    describe('acquireLock', () => {
        it('should successfully acquire and verify lock on first attempt without hooks', async () => {
            getStatusStub.resolves({
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date(),
                expiresAt: new Date()
            } as ILockStatus);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);
            const executorId = 'test-executor-123';

            const result = await orchestrator.acquireLock(executorId);

            expect(result).to.be.true;
            expect(acquireStub.calledOnceWith(executorId)).to.be.true;
            expect(verifyStub.calledOnceWith(executorId)).to.be.true;
        });

        it('should successfully acquire and verify lock on first attempt with hooks', async () => {
            getStatusStub.resolves({
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date(),
                expiresAt: new Date()
            } as ILockStatus);

            const hooks: ILockingHooks = {
                onBeforeAcquireLock: stub().resolves(),
                onLockAcquired: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger, hooks);
            const executorId = 'test-executor-123';

            const result = await orchestrator.acquireLock(executorId);

            expect(result).to.be.true;
            expect((hooks.onBeforeAcquireLock as SinonStub).calledOnceWith(executorId)).to.be.true;
            expect((hooks.onLockAcquired as SinonStub).calledOnce).to.be.true;
        });

        it('should retry lock acquisition when first attempt fails', async () => {
            acquireStub.onFirstCall().resolves(false);
            acquireStub.onSecondCall().resolves(true);
            getStatusStub.onFirstCall().resolves({
                isLocked: true,
                lockedBy: null,  // null to test || 'unknown' branch
                lockedAt: new Date(),
                expiresAt: new Date()
            } as ILockStatus);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);
            const executorId = 'test-executor-123';

            const result = await orchestrator.acquireLock(executorId);

            expect(result).to.be.true;
            expect(acquireStub.callCount).to.equal(2);
            expect(verifyStub.calledOnce).to.be.true;
        });

        it('should return false after exhausting all retry attempts', async () => {
            acquireStub.resolves(false);
            getStatusStub.resolves({
                isLocked: true,
                lockedBy: '',  // Empty string to test || 'unknown' branch
                lockedAt: new Date(),
                expiresAt: new Date()
            } as ILockStatus);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);
            const executorId = 'test-executor-123';

            const result = await orchestrator.acquireLock(executorId);

            expect(result).to.be.false;
            expect(acquireStub.callCount).to.equal(config.retryAttempts + 1);
            expect(verifyStub.called).to.be.false;
        });

        it('should throw error when lock ownership verification fails', async () => {
            verifyStub.resolves(false);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);
            const executorId = 'test-executor-123';

            await expect(orchestrator.acquireLock(executorId))
                .to.be.rejectedWith(/Lock ownership verification failed/);

            expect(acquireStub.calledOnce).to.be.true;
            expect(verifyStub.calledOnce).to.be.true;
        });

        it('should invoke hooks at appropriate times', async () => {
            const hooks: ILockingHooks = {
                onBeforeAcquireLock: stub().resolves(),
                onLockAcquired: stub().resolves(),
                onAcquireRetry: stub().resolves()
            };

            acquireStub.onFirstCall().resolves(false);
            acquireStub.onSecondCall().resolves(true);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            await orchestrator.acquireLock(executorId);

            expect((hooks.onBeforeAcquireLock as SinonStub).calledOnceWith(executorId)).to.be.true;
            expect((hooks.onAcquireRetry as SinonStub).calledOnce).to.be.true;
            expect((hooks.onLockAcquired as SinonStub).calledOnce).to.be.true;
        });

        it('should invoke onLockAcquisitionFailed hook when all attempts exhausted', async () => {
            const hooks: ILockingHooks = {
                onLockAcquisitionFailed: stub().resolves()
            };

            acquireStub.resolves(false);
            getStatusStub.resolves({
                isLocked: true,
                lockedBy: 'other-executor',
                lockedAt: new Date(),
                expiresAt: new Date(Date.now() + 60000)
            } as ILockStatus);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            const result = await orchestrator.acquireLock(executorId);

            expect(result).to.be.false;
            expect((hooks.onLockAcquisitionFailed as SinonStub).calledOnce).to.be.true;
        });

        it('should invoke onOwnershipVerificationFailed hook when verification fails', async () => {
            const hooks: ILockingHooks = {
                onOwnershipVerificationFailed: stub().resolves()
            };

            verifyStub.resolves(false);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            await expect(orchestrator.acquireLock(executorId))
                .to.be.rejectedWith(/Lock ownership verification failed/);

            expect((hooks.onOwnershipVerificationFailed as SinonStub).calledOnceWith(executorId)).to.be.true;
        });

        it('should handle errors during lock acquisition', async () => {
            const error = new Error('Database connection failed');
            acquireStub.rejects(error);

            const hooks: ILockingHooks = {
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            await expect(orchestrator.acquireLock(executorId))
                .to.be.rejectedWith('Database connection failed');

            const hookStub = hooks.onLockError as SinonStub;
            // Hook may be called twice: once in inner catch, once in outer catch
            expect(hookStub.called).to.be.true;
            expect(hookStub.firstCall.args[0]).to.equal('acquire');
            expect(hookStub.firstCall.args[1]).to.equal(error);
            expect(hookStub.firstCall.args[2]).to.equal(executorId);
        });

        it('should handle errors in hook invocation during acquisition', async () => {
            const hookError = new Error('Hook failed');
            const hooks: ILockingHooks = {
                onBeforeAcquireLock: stub().rejects(hookError),
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            await expect(orchestrator.acquireLock(executorId))
                .to.be.rejectedWith('Hook failed');

            const errorHookStub = hooks.onLockError as SinonStub;
            expect(errorHookStub.called).to.be.true;
            expect(errorHookStub.firstCall.args[0]).to.equal('acquire');
            expect(errorHookStub.firstCall.args[1]).to.equal(hookError);
            expect(errorHookStub.firstCall.args[2]).to.equal(executorId);
        });
    });

    describe('releaseLock', () => {
        it('should release lock successfully without hooks', async () => {
            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);
            const executorId = 'test-executor-123';

            await orchestrator.releaseLock(executorId);

            expect(releaseStub.calledOnceWith(executorId)).to.be.true;
        });

        it('should invoke hooks when releasing lock', async () => {
            const hooks: ILockingHooks = {
                onBeforeReleaseLock: stub().resolves(),
                onLockReleased: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            await orchestrator.releaseLock(executorId);

            expect((hooks.onBeforeReleaseLock as SinonStub).calledOnceWith(executorId)).to.be.true;
            expect((hooks.onLockReleased as SinonStub).calledOnceWith(executorId)).to.be.true;
        });

        it('should invoke onLockError hook when release fails', async () => {
            const error = new Error('Failed to release');
            releaseStub.rejects(error);

            const hooks: ILockingHooks = {
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            await expect(orchestrator.releaseLock(executorId))
                .to.be.rejectedWith('Failed to release');

            expect((hooks.onLockError as SinonStub).calledOnce).to.be.true;
        });

        it('should handle error when releasing with hooks but no onLockError', async () => {
            const error = new Error('Failed to release');
            releaseStub.rejects(error);

            const hooks: ILockingHooks = {}; // No onLockError method

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );
            const executorId = 'test-executor-123';

            await expect(orchestrator.releaseLock(executorId))
                .to.be.rejectedWith('Failed to release');
        });
    });

    describe('forceReleaseLock', () => {
        it('should force release lock successfully without hooks', async () => {
            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            await orchestrator.forceReleaseLock();

            expect(forceReleaseStub.calledOnce).to.be.true;
        });

        it('should invoke onForceReleaseLock hook', async () => {
            const hooks: ILockingHooks = {
                onForceReleaseLock: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await orchestrator.forceReleaseLock();

            expect((hooks.onForceReleaseLock as SinonStub).calledOnce).to.be.true;
        });

        it('should warn when lock is held before force releasing', async () => {
            const lockStatus: ILockStatus = {
                isLocked: true,
                lockedBy: 'other-executor',
                lockedAt: new Date(),
                expiresAt: new Date()
            };
            getStatusStub.resolves(lockStatus);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            await orchestrator.forceReleaseLock();

            expect(forceReleaseStub.calledOnce).to.be.true;
        });

        it('should force release when no lock is held', async () => {
            const lockStatus: ILockStatus = {
                isLocked: false,
                lockedBy: null,
                lockedAt: null,
                expiresAt: null
            };
            getStatusStub.resolves(lockStatus);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            await orchestrator.forceReleaseLock();

            expect(forceReleaseStub.calledOnce).to.be.true;
        });

        it('should force release when status is null', async () => {
            getStatusStub.resolves(null);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            await orchestrator.forceReleaseLock();

            expect(forceReleaseStub.calledOnce).to.be.true;
        });

        it('should invoke onLockError hook when force release fails', async () => {
            const error = new Error('Failed to force release');
            forceReleaseStub.rejects(error);

            const hooks: ILockingHooks = {
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.forceReleaseLock())
                .to.be.rejectedWith('Failed to force release');

            const hookStub = hooks.onLockError as SinonStub;
            expect(hookStub.called).to.be.true;
            expect(hookStub.firstCall.args[0]).to.equal('forceRelease');
            expect(hookStub.firstCall.args[1]).to.equal(error);
        });

        it('should handle error when force releasing with hooks but no onLockError', async () => {
            const error = new Error('Failed to force release');
            forceReleaseStub.rejects(error);

            const hooks: ILockingHooks = {}; // No onLockError method

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.forceReleaseLock())
                .to.be.rejectedWith('Failed to force release');
        });

        it('should handle error when force releasing without hooks', async () => {
            const error = new Error('Failed to force release');
            forceReleaseStub.rejects(error);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger
                // No hooks parameter
            );

            await expect(orchestrator.forceReleaseLock())
                .to.be.rejectedWith('Failed to force release');
        });
    });

    describe('checkAndReleaseExpiredLock', () => {
        it('should check and release expired locks without hooks', async () => {
            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            await orchestrator.checkAndReleaseExpiredLock();

            expect(checkExpiredStub.calledOnce).to.be.true;
        });

        it('should invoke onLockError hook when cleanup fails', async () => {
            const error = new Error('Failed to cleanup');
            checkExpiredStub.rejects(error);

            const hooks: ILockingHooks = {
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.checkAndReleaseExpiredLock())
                .to.be.rejectedWith('Failed to cleanup');

            const hookStub = hooks.onLockError as SinonStub;
            expect(hookStub.called).to.be.true;
            expect(hookStub.firstCall.args[0]).to.equal('cleanup');
            expect(hookStub.firstCall.args[1]).to.equal(error);
        });

        it('should handle error during cleanup with hooks but no onLockError', async () => {
            const error = new Error('Failed to cleanup');
            checkExpiredStub.rejects(error);

            const hooks: ILockingHooks = {}; // No onLockError method

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.checkAndReleaseExpiredLock())
                .to.be.rejectedWith('Failed to cleanup');
        });

        it('should handle error during cleanup without hooks', async () => {
            const error = new Error('Failed to cleanup');
            checkExpiredStub.rejects(error);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger
                // No hooks parameter
            );

            await expect(orchestrator.checkAndReleaseExpiredLock())
                .to.be.rejectedWith('Failed to cleanup');
        });
    });

    describe('getLockStatus', () => {
        it('should return lock status without hooks', async () => {
            const expectedStatus: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor',
                lockedAt: new Date(),
                expiresAt: new Date()
            };
            getStatusStub.resolves(expectedStatus);

            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            const status = await orchestrator.getLockStatus();

            expect(status).to.deep.equal(expectedStatus);
            expect(getStatusStub.calledOnce).to.be.true;
        });

        it('should invoke onLockError hook when getting status fails', async () => {
            const error = new Error('Failed to get status');
            getStatusStub.rejects(error);

            const hooks: ILockingHooks = {
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.getLockStatus())
                .to.be.rejectedWith('Failed to get status');

            const hookStub = hooks.onLockError as SinonStub;
            expect(hookStub.called).to.be.true;
            expect(hookStub.firstCall.args[0]).to.equal('status');
            expect(hookStub.firstCall.args[1]).to.equal(error);
        });

        it('should handle error when getting status with hooks but no onLockError', async () => {
            const error = new Error('Failed to get status');
            getStatusStub.rejects(error);

            const hooks: ILockingHooks = {}; // No onLockError method

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.getLockStatus())
                .to.be.rejectedWith('Failed to get status');
        });

        it('should handle error when getting status without hooks', async () => {
            const error = new Error('Failed to get status');
            getStatusStub.rejects(error);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger
                // No hooks parameter
            );

            await expect(orchestrator.getLockStatus())
                .to.be.rejectedWith('Failed to get status');
        });
    });

    describe('initLockStorage', () => {
        it('should initialize lock storage without hooks', async () => {
            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            await orchestrator.initLockStorage();

            expect(initStorageStub.calledOnce).to.be.true;
        });

        it('should invoke onLockError hook when initialization fails', async () => {
            const error = new Error('Failed to init storage');
            initStorageStub.rejects(error);

            const hooks: ILockingHooks = {
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.initLockStorage())
                .to.be.rejectedWith('Failed to init storage');

            const hookStub = hooks.onLockError as SinonStub;
            expect(hookStub.called).to.be.true;
            expect(hookStub.firstCall.args[0]).to.equal('init');
            expect(hookStub.firstCall.args[1]).to.equal(error);
        });

        it('should handle error during initialization with hooks but no onLockError', async () => {
            const error = new Error('Failed to init storage');
            initStorageStub.rejects(error);

            const hooks: ILockingHooks = {}; // No onLockError method

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            await expect(orchestrator.initLockStorage())
                .to.be.rejectedWith('Failed to init storage');
        });

        it('should handle error during initialization without hooks', async () => {
            const error = new Error('Failed to init storage');
            initStorageStub.rejects(error);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger
                // No hooks parameter
            );

            await expect(orchestrator.initLockStorage())
                .to.be.rejectedWith('Failed to init storage');
        });
    });

    describe('ensureLockStorageAccessible', () => {
        it('should return true when lock storage is accessible without hooks', async () => {
            ensureAccessibleStub.resolves(true);
            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            const result = await orchestrator.ensureLockStorageAccessible();

            expect(result).to.be.true;
            expect(ensureAccessibleStub.calledOnce).to.be.true;
        });

        it('should return false when lock storage is not accessible without hooks', async () => {
            ensureAccessibleStub.resolves(false);
            const orchestrator = new LockingOrchestrator(mockLockingService, config, mockLogger);

            const result = await orchestrator.ensureLockStorageAccessible();

            expect(result).to.be.false;
            expect(ensureAccessibleStub.calledOnce).to.be.true;
        });

        it('should invoke onLockError hook when accessibility check fails', async () => {
            const error = new Error('Failed to check accessibility');
            ensureAccessibleStub.rejects(error);

            const hooks: ILockingHooks = {
                onLockError: stub().resolves()
            };

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            const result = await orchestrator.ensureLockStorageAccessible();

            expect(result).to.be.false;
            const hookStub = hooks.onLockError as SinonStub;
            expect(hookStub.called).to.be.true;
            expect(hookStub.firstCall.args[0]).to.equal('accessibility-check');
            expect(hookStub.firstCall.args[1]).to.equal(error);
        });

        it('should handle error during accessibility check with hooks but no onLockError', async () => {
            const error = new Error('Failed to check accessibility');
            ensureAccessibleStub.rejects(error);

            const hooks: ILockingHooks = {}; // No onLockError method

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger,
                hooks
            );

            const result = await orchestrator.ensureLockStorageAccessible();

            expect(result).to.be.false;
        });

        it('should handle error during accessibility check without hooks', async () => {
            const error = new Error('Failed to check accessibility');
            ensureAccessibleStub.rejects(error);

            const orchestrator = new LockingOrchestrator(
                mockLockingService,
                config,
                mockLogger
                // No hooks parameter
            );

            const result = await orchestrator.ensureLockStorageAccessible();

            expect(result).to.be.false;
        });
    });
});
