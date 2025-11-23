import { expect } from "chai";
import sinon from "sinon";
import { CompositeHooks, IMigrationHooks, MigrationScript, IMigrationResult } from "../../../src";

describe('CompositeHooks', () => {

    describe('constructor', () => {

        /**
         * Test that CompositeHooks can be created with no hooks.
         * Verifies empty array initialization.
         */
        it('should create with empty hooks array', () => {
            const composite = new CompositeHooks();
            expect(composite.getHooks()).to.be.an('array').that.is.empty;
        });

        /**
         * Test that CompositeHooks can be created with initial hooks.
         * Verifies constructor accepts array of hooks.
         */
        it('should create with initial hooks', () => {
            const hook1: IMigrationHooks = { onStart: sinon.stub() };
            const hook2: IMigrationHooks = { onComplete: sinon.stub() };
            const composite = new CompositeHooks([hook1, hook2]);

            expect(composite.getHooks()).to.have.lengthOf(2);
            expect(composite.getHooks()).to.include(hook1);
            expect(composite.getHooks()).to.include(hook2);
        });

        /**
         * Test that CompositeHooks creates a copy of the hooks array.
         * Verifies immutability of internal array.
         */
        it('should create a copy of the hooks array', () => {
            const hook1: IMigrationHooks = { onStart: sinon.stub() };
            const originalArray = [hook1];
            const composite = new CompositeHooks(originalArray);

            // Mutate original array
            const hook2: IMigrationHooks = { onComplete: sinon.stub() };
            originalArray.push(hook2);

            // CompositeHooks should not be affected
            expect(composite.getHooks()).to.have.lengthOf(1);
        });

    });

    describe('addHook', () => {

        /**
         * Test that a hook can be added to an empty composite.
         * Verifies basic addHook functionality.
         */
        it('should add hook to empty composite', () => {
            const composite = new CompositeHooks();
            const hook: IMigrationHooks = { onStart: sinon.stub() };

            composite.addHook(hook);

            expect(composite.getHooks()).to.have.lengthOf(1);
            expect(composite.getHooks()).to.include(hook);
        });

        /**
         * Test that multiple hooks can be added sequentially.
         * Verifies addHook can be called multiple times.
         */
        it('should add multiple hooks', () => {
            const composite = new CompositeHooks();
            const hook1: IMigrationHooks = { onStart: sinon.stub() };
            const hook2: IMigrationHooks = { onComplete: sinon.stub() };

            composite.addHook(hook1);
            composite.addHook(hook2);

            expect(composite.getHooks()).to.have.lengthOf(2);
            expect(composite.getHooks()).to.include(hook1);
            expect(composite.getHooks()).to.include(hook2);
        });

        /**
         * Test that the same hook instance can be added multiple times.
         * Verifies no duplicate prevention (intentional design).
         */
        it('should allow adding the same hook multiple times', () => {
            const composite = new CompositeHooks();
            const hook: IMigrationHooks = { onStart: sinon.stub() };

            composite.addHook(hook);
            composite.addHook(hook);

            expect(composite.getHooks()).to.have.lengthOf(2);
        });

    });

    describe('removeHook', () => {

        /**
         * Test that a hook can be removed from the composite.
         * Verifies basic removeHook functionality and return value.
         */
        it('should remove hook from composite', () => {
            const hook1: IMigrationHooks = { onStart: sinon.stub() };
            const hook2: IMigrationHooks = { onComplete: sinon.stub() };
            const composite = new CompositeHooks([hook1, hook2]);

            const result = composite.removeHook(hook1);

            expect(result).to.be.true;
            expect(composite.getHooks()).to.have.lengthOf(1);
            expect(composite.getHooks()).to.not.include(hook1);
            expect(composite.getHooks()).to.include(hook2);
        });

        /**
         * Test that removing a non-existent hook returns false.
         * Verifies error handling for missing hook.
         */
        it('should return false when removing non-existent hook', () => {
            const hook1: IMigrationHooks = { onStart: sinon.stub() };
            const hook2: IMigrationHooks = { onComplete: sinon.stub() };
            const composite = new CompositeHooks([hook1]);

            const result = composite.removeHook(hook2);

            expect(result).to.be.false;
            expect(composite.getHooks()).to.have.lengthOf(1);
        });

        /**
         * Test that removing from an empty composite returns false.
         * Verifies behavior with empty hooks array.
         */
        it('should return false when removing from empty composite', () => {
            const composite = new CompositeHooks();
            const hook: IMigrationHooks = { onStart: sinon.stub() };

            const result = composite.removeHook(hook);

            expect(result).to.be.false;
            expect(composite.getHooks()).to.be.empty;
        });

        /**
         * Test that removing a duplicate hook only removes the first instance.
         * Verifies single-instance removal behavior.
         */
        it('should remove only first instance of duplicate hook', () => {
            const hook: IMigrationHooks = { onStart: sinon.stub() };
            const composite = new CompositeHooks([hook, hook]);

            const result = composite.removeHook(hook);

            expect(result).to.be.true;
            expect(composite.getHooks()).to.have.lengthOf(1);
        });

    });

    describe('getHooks', () => {

        /**
         * Test that getHooks returns a copy of the hooks array.
         * Verifies immutability of internal state.
         */
        it('should return a copy of hooks array', () => {
            const hook1: IMigrationHooks = { onStart: sinon.stub() };
            const composite = new CompositeHooks([hook1]);

            const hooks1 = composite.getHooks();
            const hooks2 = composite.getHooks();

            expect(hooks1).to.not.equal(hooks2);
            expect(hooks1).to.deep.equal(hooks2);
        });

        /**
         * Test that mutating the returned array does not affect internal state.
         * Verifies encapsulation of internal hooks array.
         */
        it('should not allow external modification of internal array', () => {
            const hook1: IMigrationHooks = { onStart: sinon.stub() };
            const composite = new CompositeHooks([hook1]);

            const hooks = composite.getHooks();
            const hook2: IMigrationHooks = { onComplete: sinon.stub() };
            hooks.push(hook2);

            expect(composite.getHooks()).to.have.lengthOf(1);
        });

    });

    describe('lifecycle hooks', () => {

        let mockHook1: IMigrationHooks;
        let mockHook2: IMigrationHooks;
        let composite: CompositeHooks;
        let script: MigrationScript;
        let result: IMigrationResult;

        beforeEach(() => {
            mockHook1 = {
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
            mockHook2 = {
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
            composite = new CompositeHooks([mockHook1, mockHook2]);

            script = new MigrationScript('V123_test.ts', '/path/to/V123_test.ts', 123);
            result = {
                success: true,
                executed: [script],
                migrated: [],
                ignored: []
            };
        });

        /**
         * Test that onStart() forwards to all hooks.
         * Verifies parameters are passed correctly.
         */
        it('should forward onStart() to all hooks', async () => {
            await composite.onStart(10, 5);

            expect((mockHook1.onStart as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook1.onStart as sinon.SinonStub).calledWith(10, 5)).to.be.true;
            expect((mockHook2.onStart as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onStart as sinon.SinonStub).calledWith(10, 5)).to.be.true;
        });

        /**
         * Test that onBeforeBackup() forwards to all hooks.
         */
        it('should forward onBeforeBackup() to all hooks', async () => {
            await composite.onBeforeBackup();

            expect((mockHook1.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that onAfterBackup() forwards to all hooks.
         * Verifies backup path parameter is passed correctly.
         */
        it('should forward onAfterBackup() to all hooks', async () => {
            const backupPath = '/path/to/backup.bkp';
            await composite.onAfterBackup(backupPath);

            expect((mockHook1.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook1.onAfterBackup as sinon.SinonStub).calledWith(backupPath)).to.be.true;
            expect((mockHook2.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onAfterBackup as sinon.SinonStub).calledWith(backupPath)).to.be.true;
        });

        /**
         * Test that onBeforeMigrate() forwards to all hooks.
         * Verifies script parameter is passed correctly.
         */
        it('should forward onBeforeMigrate() to all hooks', async () => {
            await composite.onBeforeMigrate(script);

            expect((mockHook1.onBeforeMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook1.onBeforeMigrate as sinon.SinonStub).calledWith(script)).to.be.true;
            expect((mockHook2.onBeforeMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onBeforeMigrate as sinon.SinonStub).calledWith(script)).to.be.true;
        });

        /**
         * Test that onAfterMigrate() forwards to all hooks.
         * Verifies script and result parameters are passed correctly.
         */
        it('should forward onAfterMigrate() to all hooks', async () => {
            await composite.onAfterMigrate(script, 'success');

            expect((mockHook1.onAfterMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook1.onAfterMigrate as sinon.SinonStub).calledWith(script, 'success')).to.be.true;
            expect((mockHook2.onAfterMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onAfterMigrate as sinon.SinonStub).calledWith(script, 'success')).to.be.true;
        });

        /**
         * Test that onMigrationError() forwards to all hooks.
         * Verifies script and error parameters are passed correctly.
         */
        it('should forward onMigrationError() to all hooks', async () => {
            const error = new Error('Migration failed');
            await composite.onMigrationError(script, error);

            expect((mockHook1.onMigrationError as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook1.onMigrationError as sinon.SinonStub).calledWith(script, error)).to.be.true;
            expect((mockHook2.onMigrationError as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onMigrationError as sinon.SinonStub).calledWith(script, error)).to.be.true;
        });

        /**
         * Test that onBeforeRestore() forwards to all hooks.
         */
        it('should forward onBeforeRestore() to all hooks', async () => {
            await composite.onBeforeRestore();

            expect((mockHook1.onBeforeRestore as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onBeforeRestore as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that onAfterRestore() forwards to all hooks.
         */
        it('should forward onAfterRestore() to all hooks', async () => {
            await composite.onAfterRestore();

            expect((mockHook1.onAfterRestore as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onAfterRestore as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that onComplete() forwards to all hooks.
         * Verifies result parameter is passed correctly.
         */
        it('should forward onComplete() to all hooks', async () => {
            await composite.onComplete(result);

            expect((mockHook1.onComplete as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook1.onComplete as sinon.SinonStub).calledWith(result)).to.be.true;
            expect((mockHook2.onComplete as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onComplete as sinon.SinonStub).calledWith(result)).to.be.true;
        });

        /**
         * Test that onError() forwards to all hooks.
         * Verifies error parameter is passed correctly.
         */
        it('should forward onError() to all hooks', async () => {
            const error = new Error('Process failed');
            await composite.onError(error);

            expect((mockHook1.onError as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook1.onError as sinon.SinonStub).calledWith(error)).to.be.true;
            expect((mockHook2.onError as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook2.onError as sinon.SinonStub).calledWith(error)).to.be.true;
        });

        /**
         * Test that hooks work with empty hooks array.
         * Verifies no errors when no hooks are registered.
         */
        it('should handle calls with no registered hooks', async () => {
            const emptyComposite = new CompositeHooks();

            await expect(emptyComposite.onStart(10, 5)).to.not.be.rejected;
            await expect(emptyComposite.onBeforeBackup()).to.not.be.rejected;
            await expect(emptyComposite.onAfterBackup('/path')).to.not.be.rejected;
            await expect(emptyComposite.onBeforeMigrate(script)).to.not.be.rejected;
            await expect(emptyComposite.onAfterMigrate(script, 'success')).to.not.be.rejected;
            await expect(emptyComposite.onMigrationError(script, new Error())).to.not.be.rejected;
            await expect(emptyComposite.onBeforeRestore()).to.not.be.rejected;
            await expect(emptyComposite.onAfterRestore()).to.not.be.rejected;
            await expect(emptyComposite.onComplete(result)).to.not.be.rejected;
            await expect(emptyComposite.onError(new Error())).to.not.be.rejected;
        });

        /**
         * Test that hooks work with partial hook implementations.
         * Verifies optional hook methods are handled correctly.
         */
        it('should handle hooks with missing optional methods', async () => {
            const partialHook: IMigrationHooks = {
                onStart: sinon.stub().resolves()
                // Other methods intentionally missing
            };
            const composite = new CompositeHooks([partialHook]);

            // Call all methods to test optional chaining branches
            await expect(composite.onStart(10, 5)).to.not.be.rejected;
            await expect(composite.onBeforeBackup()).to.not.be.rejected;
            await expect(composite.onAfterBackup('/path')).to.not.be.rejected;
            await expect(composite.onBeforeMigrate(script)).to.not.be.rejected;
            await expect(composite.onAfterMigrate(script, 'success')).to.not.be.rejected;
            await expect(composite.onMigrationError(script, new Error())).to.not.be.rejected;
            await expect(composite.onBeforeRestore()).to.not.be.rejected;
            await expect(composite.onAfterRestore()).to.not.be.rejected;
            await expect(composite.onComplete(result)).to.not.be.rejected;
            await expect(composite.onError(new Error())).to.not.be.rejected;

            expect((partialHook.onStart as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that hooks are called in sequence.
         * Verifies order of execution matters for hooks.
         */
        it('should call hooks in registration order', async () => {
            const callOrder: string[] = [];

            const hook1: IMigrationHooks = {
                onStart: sinon.stub().callsFake(async () => {
                    callOrder.push('hook1');
                })
            };
            const hook2: IMigrationHooks = {
                onStart: sinon.stub().callsFake(async () => {
                    callOrder.push('hook2');
                })
            };
            const composite = new CompositeHooks([hook1, hook2]);

            await composite.onStart(10, 5);

            expect(callOrder).to.deep.equal(['hook1', 'hook2']);
        });

        /**
         * Test optional chaining with mixed hook implementations.
         * Verifies hooks with and without methods can coexist.
         */
        it('should skip hooks without specific methods', async () => {
            const hook1: IMigrationHooks = {
                onStart: sinon.stub().resolves()
                // No onBeforeBackup
            };
            const hook2: IMigrationHooks = {
                // No onStart
                onBeforeBackup: sinon.stub().resolves()
            };
            const hook3: IMigrationHooks = {
                onStart: sinon.stub().resolves(),
                onBeforeBackup: sinon.stub().resolves()
            };

            const composite = new CompositeHooks([hook1, hook2, hook3]);

            await composite.onStart(10, 5);
            await composite.onBeforeBackup();

            // hook1.onStart called, hook1.onBeforeBackup not called (doesn't exist)
            expect((hook1.onStart as sinon.SinonStub).calledOnce).to.be.true;

            // hook2.onStart not called (doesn't exist), hook2.onBeforeBackup called
            expect((hook2.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;

            // hook3 both called
            expect((hook3.onStart as sinon.SinonStub).calledOnce).to.be.true;
            expect((hook3.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that hook errors are propagated.
         * Verifies error handling during hook execution.
         */
        it('should propagate errors from hooks', async () => {
            const error = new Error('Hook failed');
            const failingHook: IMigrationHooks = {
                onStart: sinon.stub().rejects(error)
            };
            const composite = new CompositeHooks([failingHook, mockHook1]);

            await expect(composite.onStart(10, 5)).to.be.rejectedWith('Hook failed');

            // Second hook should not be called due to error
            expect((mockHook1.onStart as sinon.SinonStub).called).to.be.false;
        });

    });

    describe('integration scenarios', () => {

        /**
         * Test dynamic hook management during execution.
         * Verifies hooks can be added and removed dynamically.
         */
        it('should support dynamic hook management', async () => {
            const composite = new CompositeHooks();
            const mockHook: IMigrationHooks = {
                onStart: sinon.stub().resolves()
            };

            // Add hook dynamically
            composite.addHook(mockHook);
            await composite.onStart(10, 5);
            expect((mockHook.onStart as sinon.SinonStub).calledOnce).to.be.true;

            // Remove hook dynamically
            composite.removeHook(mockHook);
            await composite.onStart(10, 5);
            expect((mockHook.onStart as sinon.SinonStub).calledOnce).to.be.true; // Still once
        });

        /**
         * Test nested CompositeHooks scenario.
         * Verifies CompositeHooks can contain other CompositeHooks.
         */
        it('should support nested composite hooks', async () => {
            const mockHook: IMigrationHooks = {
                onStart: sinon.stub().resolves()
            };

            const innerComposite = new CompositeHooks([mockHook]);
            const outerComposite = new CompositeHooks([innerComposite]);

            await outerComposite.onStart(10, 5);

            expect((mockHook.onStart as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook.onStart as sinon.SinonStub).calledWith(10, 5)).to.be.true;
        });

        /**
         * Test multiple lifecycle hooks in sequence.
         * Verifies complete lifecycle execution.
         */
        it('should handle complete migration lifecycle', async () => {
            const mockHook: IMigrationHooks = {
                onStart: sinon.stub().resolves(),
                onBeforeBackup: sinon.stub().resolves(),
                onAfterBackup: sinon.stub().resolves(),
                onBeforeMigrate: sinon.stub().resolves(),
                onAfterMigrate: sinon.stub().resolves(),
                onComplete: sinon.stub().resolves()
            };
            const composite = new CompositeHooks([mockHook]);

            const script = new MigrationScript('V123_test.ts', '/path/to/V123_test.ts', 123);
            const result: IMigrationResult = {
                success: true,
                executed: [script],
                migrated: [],
                ignored: []
            };

            // Simulate full lifecycle
            await composite.onStart(1, 1);
            await composite.onBeforeBackup();
            await composite.onAfterBackup('/backup.bkp');
            await composite.onBeforeMigrate(script);
            await composite.onAfterMigrate(script, 'success');
            await composite.onComplete(result);

            expect((mockHook.onStart as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook.onBeforeBackup as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook.onAfterBackup as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook.onBeforeMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook.onAfterMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHook.onComplete as sinon.SinonStub).calledOnce).to.be.true;
        });

    });

});
