import { expect } from "chai";
import sinon from "sinon";
import { MigrationScriptExecutor } from "../../../src/service/MigrationScriptExecutor";
import { MigrationScript } from "../../../src/model/MigrationScript";
import { Config } from "../../../src/model/Config";
import { IMigrationHooks } from "../../../src/interface/IMigrationHooks";
import { IRunnableScript } from "../../../src/interface/IRunnableScript";
import { SilentLogger } from "../../../src/logger/SilentLogger";

/**
 * Unit tests for MigrationScriptExecutor hooks execution paths.
 * Tests the executeWithHooks method and hook integration.
 */
describe('MigrationScriptExecutor - Hooks Execution', () => {

    let handler: any;
    let executor: MigrationScriptExecutor;
    let mockHooks: IMigrationHooks;
    let script1: MigrationScript;
    let script2: MigrationScript;
    let cfg: Config;

    beforeEach(() => {
        cfg = new Config();
        handler = {
            db: { test: () => {} },
            getName: () => 'Test Handler',
            schemaVersion: {
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true),
                migrationRecords: {
                    getAllExecuted: sinon.stub().resolves([]),
                    save: sinon.stub().resolves(),
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                }
            }
        };

        // Create test scripts
        script1 = new MigrationScript('V123_test1.ts', '/path/to/V123_test1.ts', 123);
        script1.script = {
            up: sinon.stub().resolves('success1')
        } as IRunnableScript;
        script1.init = sinon.stub().resolves();

        script2 = new MigrationScript('V124_test2.ts', '/path/to/V124_test2.ts', 124);
        script2.script = {
            up: sinon.stub().resolves('success2')
        } as IRunnableScript;
        script2.init = sinon.stub().resolves();

        // Create mock hooks
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

    describe('executeWithHooks - with hooks registered', () => {

        /**
         * Test that executeWithHooks calls onBeforeMigrate for each script.
         * Verifies hooks are called before script execution.
         */
        it('should call onBeforeMigrate for each migration', async () => {
            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: mockHooks,
                logger: new SilentLogger()
            });

            // Access private method via any cast
            const executedArray: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1, script2], executedArray);

            expect(executedArray).to.have.lengthOf(2);
            expect((mockHooks.onBeforeMigrate as sinon.SinonStub).callCount).to.equal(2);
            expect((mockHooks.onBeforeMigrate as sinon.SinonStub).firstCall.args[0]).to.equal(script1);
            expect((mockHooks.onBeforeMigrate as sinon.SinonStub).secondCall.args[0]).to.equal(script2);
        });

        /**
         * Test that executeWithHooks calls onAfterMigrate for each script.
         * Verifies hooks are called after successful script execution.
         */
        it('should call onAfterMigrate after each successful migration', async () => {
            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: mockHooks,
                logger: new SilentLogger()
            });

            const executedArray: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1, script2], executedArray);

            expect(executedArray).to.have.lengthOf(2);
            expect((mockHooks.onAfterMigrate as sinon.SinonStub).callCount).to.equal(2);

            // Check first call
            const [firstScript, firstResult] = (mockHooks.onAfterMigrate as sinon.SinonStub).firstCall.args;
            expect(firstScript.name).to.equal('V123_test1.ts');
            expect(firstResult).to.equal('success1');

            // Check second call
            const [secondScript, secondResult] = (mockHooks.onAfterMigrate as sinon.SinonStub).secondCall.args;
            expect(secondScript.name).to.equal('V124_test2.ts');
            expect(secondResult).to.equal('success2');
        });

        /**
         * Test that executeWithHooks calls onMigrationError when migration fails.
         * Verifies error hook is called and error is propagated.
         */
        it('should call onMigrationError when migration fails', async () => {
            const testError = new Error('Migration failed');
            script1.script.up = sinon.stub().rejects(testError);

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: mockHooks,
                logger: new SilentLogger()
            });

            try {
                const executedArray: MigrationScript[] = [];
                await (executor as any).executeWithHooks([script1, script2], executedArray);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.equal(testError);
            }

            // Verify onMigrationError was called
            expect((mockHooks.onMigrationError as sinon.SinonStub).calledOnce).to.be.true;
            const [errorScript, errorObj] = (mockHooks.onMigrationError as sinon.SinonStub).firstCall.args;
            expect(errorScript).to.equal(script1);
            expect(errorObj).to.equal(testError);

            // Verify onAfterMigrate was NOT called for failed migration
            expect((mockHooks.onAfterMigrate as sinon.SinonStub).called).to.be.false;
        });

        /**
         * Test that executeWithHooks stops execution after first failure.
         * Verifies fail-fast behavior with hooks.
         */
        it('should stop execution after first failed migration', async () => {
            script1.script.up = sinon.stub().rejects(new Error('First failed'));

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: mockHooks,
                logger: new SilentLogger()
            });

            try {
                const executedArray: MigrationScript[] = [];
                await (executor as any).executeWithHooks([script1, script2], executedArray);
                expect.fail('Should have thrown error');
            } catch (error) {
                // Expected
            }

            // Verify first script hooks were called
            expect((mockHooks.onBeforeMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((mockHooks.onMigrationError as sinon.SinonStub).calledOnce).to.be.true;

            // Verify second script was never attempted
            expect((script2.script.up as sinon.SinonStub).called).to.be.false;
        });

        /**
         * Test that executeWithHooks handles empty result from migration.
         * Verifies empty string result is handled correctly.
         */
        it('should handle empty migration result', async () => {
            script1.script.up = sinon.stub().resolves('');

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: mockHooks,
                logger: new SilentLogger()
            });

            const executedArray: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1], executedArray);

            expect((mockHooks.onAfterMigrate as sinon.SinonStub).calledOnce).to.be.true;
            const [, result] = (mockHooks.onAfterMigrate as sinon.SinonStub).firstCall.args;
            expect(result).to.equal('');
        });

        /**
         * Test that executeWithHooks handles undefined result from migration.
         * Verifies undefined result is converted to empty string.
         */
        it('should handle undefined migration result', async () => {
            script1.script.up = sinon.stub().resolves(undefined);

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: mockHooks,
                logger: new SilentLogger()
            });

            const executedArray: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1], executedArray);

            expect((mockHooks.onAfterMigrate as sinon.SinonStub).calledOnce).to.be.true;
            const [, result] = (mockHooks.onAfterMigrate as sinon.SinonStub).firstCall.args;
            expect(result).to.equal('');
        });

    });

    describe('executeWithHooks - without migration hooks', () => {

        /**
         * Test that executeWithHooks works when no migration hooks are provided.
         * Verifies the method still executes scripts correctly without hooks.
         */
        it('should execute scripts when no migration hooks provided', async () => {
            const noMigrationHooks: IMigrationHooks = {
                onStart: sinon.stub().resolves(),
                onComplete: sinon.stub().resolves()
                // No onBeforeMigrate, onAfterMigrate, or onMigrationError
            };

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: noMigrationHooks,
                logger: new SilentLogger()
            });

            const result: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1, script2], result);

            // Verify both scripts were executed
            expect(result).to.have.lengthOf(2);
            expect((script1.script.up as sinon.SinonStub).calledOnce).to.be.true;
            expect((script2.script.up as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that executeWithHooks works with partial hooks.
         * Verifies only implemented hooks are called.
         */
        it('should execute with partial migration hooks', async () => {
            const partialHooks: IMigrationHooks = {
                onStart: sinon.stub().resolves(),
                onBeforeMigrate: sinon.stub().resolves()
                // No onAfterMigrate or onMigrationError
            };

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: partialHooks,
                logger: new SilentLogger()
            });

            const result: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1], result);

            // Verify script was executed and onBeforeMigrate was called
            expect(result).to.have.lengthOf(1);
            expect((partialHooks.onBeforeMigrate as sinon.SinonStub).calledOnce).to.be.true;
            expect((script1.script.up as sinon.SinonStub).calledOnce).to.be.true;
        });

        /**
         * Test that executeWithHooks handles error hook.
         * Verifies onMigrationError is called when provided.
         */
        it('should call onMigrationError when provided and error occurs', async () => {
            const errorOnlyHook: IMigrationHooks = {
                onMigrationError: sinon.stub().resolves()
                // No onBeforeMigrate or onAfterMigrate
            };

            script1.script.up = sinon.stub().rejects(new Error('Test error'));

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: errorOnlyHook,
                logger: new SilentLogger()
            });

            try {
                const executedArray: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1], executedArray);
                expect.fail('Should have thrown error');
            } catch (err) {
                // Expected
            }

            // Verify onMigrationError was called
            expect((errorOnlyHook.onMigrationError as sinon.SinonStub).calledOnce).to.be.true;
        });

    });

    describe('executeWithHooks - empty scripts array', () => {

        /**
         * Test that executeWithHooks handles empty array.
         * Verifies no errors with empty input.
         */
        it('should handle empty scripts array', async () => {
            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: mockHooks,
                logger: new SilentLogger()
            });

            const result: MigrationScript[] = [];
            await (executor as any).executeWithHooks([], result);

            expect(result).to.be.an('array').that.is.empty;
            expect((mockHooks.onBeforeMigrate as sinon.SinonStub).called).to.be.false;
            expect((mockHooks.onAfterMigrate as sinon.SinonStub).called).to.be.false;
        });

    });

    describe('executeWithHooks - hook execution order', () => {

        /**
         * Test that hooks are called in correct order.
         * Verifies lifecycle: onBeforeMigrate → execute → onAfterMigrate.
         */
        it('should call hooks in correct order', async () => {
            const callOrder: string[] = [];

            const orderTrackingHooks: IMigrationHooks = {
                onBeforeMigrate: sinon.stub().callsFake(async () => {
                    callOrder.push('before');
                }),
                onAfterMigrate: sinon.stub().callsFake(async () => {
                    callOrder.push('after');
                })
            };

            script1.script.up = sinon.stub().callsFake(async () => {
                callOrder.push('execute');
                return 'success';
            });

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: orderTrackingHooks,
                logger: new SilentLogger()
            });

            const executedArray: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1], executedArray);

            expect(callOrder).to.deep.equal(['before', 'execute', 'after']);
        });

        /**
         * Test hook order when migration fails.
         * Verifies onMigrationError is called but not onAfterMigrate.
         */
        it('should call onMigrationError but not onAfterMigrate on failure', async () => {
            const callOrder: string[] = [];

            const orderTrackingHooks: IMigrationHooks = {
                onBeforeMigrate: sinon.stub().callsFake(async () => {
                    callOrder.push('before');
                }),
                onAfterMigrate: sinon.stub().callsFake(async () => {
                    callOrder.push('after');
                }),
                onMigrationError: sinon.stub().callsFake(async () => {
                    callOrder.push('error');
                })
            };

            script1.script.up = sinon.stub().callsFake(async () => {
                callOrder.push('execute');
                throw new Error('Failed');
            });

            executor = new MigrationScriptExecutor(handler, cfg, {
                hooks: orderTrackingHooks,
                logger: new SilentLogger()
            });

            try {
                const executedArray: MigrationScript[] = [];
            await (executor as any).executeWithHooks([script1], executedArray);
            } catch (error) {
                // Expected
            }

            expect(callOrder).to.deep.equal(['before', 'execute', 'error']);
        });

    });

});
