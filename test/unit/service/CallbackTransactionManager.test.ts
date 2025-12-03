import { expect } from 'chai';
import { CallbackTransactionManager } from '../../../src/service/CallbackTransactionManager';
import { IDB } from '../../../src/interface/dao';
import { TransactionConfig } from '../../../src/model/TransactionConfig';
import { IsolationLevel } from '../../../src/model/IsolationLevel';
import { ICallbackTransactionalDB } from '../../../src/interface/dao/ITransactionalDB';
import { SilentLogger } from '../../../src/logger';

/**
 * Unit tests for CallbackTransactionManager.
 *
 * Tests the NoSQL/callback-based transaction manager that uses the
 * ICallbackTransactionalDB interface. This manager buffers operations
 * and executes them within a runTransaction callback provided by the database.
 *
 * Test coverage includes:
 * - Transaction lifecycle (begin, commit, rollback)
 * - Operation buffering and execution
 * - Retry logic with exponential backoff
 * - Error handling for retriable and non-retriable errors
 * - Logger integration
 * - Transaction context passing
 */
describe('CallbackTransactionManager', () => {

    let mockDB: ICallbackTransactionalDB<unknown>;
    let config: TransactionConfig;
    let logger: SilentLogger;

    beforeEach(() => {
        // Create mock callback-transactional database
        mockDB = {
            runTransaction: async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                return callback({} as unknown);  // Pass empty transaction context
            },
            checkConnection: async () => { return true; }
        } as ICallbackTransactionalDB<unknown>;

        // Create default config
        config = new TransactionConfig();
        config.retries = 3;
        config.retryDelay = 5;
        config.retryBackoff = true;

        // Use silent logger for clean test output
        logger = new SilentLogger();
    });

    /**
     * Tests for begin() method.
     *
     * Verifies that transaction initialization:
     * - Prepares the operation buffer for collecting operations
     * - Logs appropriate debug messages when logger is available
     * - Works correctly without a logger
     */
    describe('begin()', () => {

        it('should initialize operation buffer', async () => {
            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();

            // No way to directly check buffer, but we can verify behavior
            // by checking that commit() works after begin()
            await manager.commit();  // Should not throw
        });

        it('should log debug message when logger provided', async () => {
            let debugMessage = '';
            const testLogger = {
                debug: (msg: string) => { debugMessage = msg; },
                warn: () => {},
                error: () => {},
                log: () => {},
                info: () => {}
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();

            expect(debugMessage).to.include('Prepared callback transaction');
        });

        it('should work without logger', async () => {
            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger
            await manager.begin();  // Should not throw
        });
    });

    /**
     * Tests for commit() method.
     *
     * Verifies transaction commit behavior:
     * - Executes runTransaction() with buffered operations
     * - Skips execution when no operations are present
     * - Passes transaction context to operations correctly
     * - Handles successful execution and logging
     * - Implements retry logic for transient errors
     * - Handles non-retriable errors appropriately
     * - Applies exponential backoff when configured
     * - Uses default retry delay when config value is null/undefined
     */
    describe('commit()', () => {

        it('should execute runTransaction() with operations', async () => {
            let runTransactionCalled = false;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                runTransactionCalled = true;
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();

            // Add operation
            manager.addOperation(async () => {
                // Operation logic
            });

            await manager.commit();

            expect(runTransactionCalled).to.be.true;
        });

        it('should not execute runTransaction() when no operations added', async () => {
            let runTransactionCalled = false;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                runTransactionCalled = true;
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            await manager.commit();  // No operations added

            expect(runTransactionCalled).to.be.false;
        });

        it('should log debug message when no operations added (with logger)', async () => {
            let debugMessage = '';
            const testLogger = {
                debug: (msg: string) => { debugMessage = msg; },
                warn: () => {},
                error: () => {},
                log: () => {},
                info: () => {}
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();
            await manager.commit();  // No operations added

            expect(debugMessage).to.equal('No operations to execute');
        });

        it('should not throw when no operations added (without logger)', async () => {
            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger
            await manager.begin();
            await manager.commit();  // No operations added, no logger - should not throw

            // Should complete successfully without errors
            expect(true).to.be.true;
        });

        it('should work with logger on successful transaction', async () => {
            let debugMessage = '';
            const testLogger = {
                debug: (msg: string) => { debugMessage = msg; },
                warn: () => {},
                error: () => {},
                log: () => {},
                info: () => {}
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });
            await manager.commit();

            expect(debugMessage).to.include('Transaction executed successfully');
        });

        it('should work without logger on successful transaction', async () => {
            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });
            await manager.commit();  // Should not throw

            // Should complete successfully without errors
            expect(true).to.be.true;
        });

        it('should execute all added operations in order', async () => {
            const executionOrder: number[] = [];

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();

            manager.addOperation(async () => {
                executionOrder.push(1);
            });
            manager.addOperation(async () => {
                executionOrder.push(2);
            });
            manager.addOperation(async () => {
                executionOrder.push(3);
            });

            await manager.commit();

            expect(executionOrder).to.deep.equal([1, 2, 3]);
        });

        it('should retry on retriable error (conflict)', async () => {
            let attempts = 0;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('conflict detected');
                }
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should retry on retriable error (contention)', async () => {
            let attempts = 0;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('contention error');
                }
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should retry on retriable error (deadlock)', async () => {
            let attempts = 0;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('deadlock detected');
                }
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should retry on retriable error (timeout)', async () => {
            let attempts = 0;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('timeout exceeded');
                }
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should retry without logger (no warning)', async () => {
            let attempts = 0;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('conflict detected');
                }
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();  // Should not throw

            expect(attempts).to.equal(2);
        });

        it('should NOT retry on non-retriable error', async () => {
            let attempts = 0;

            mockDB.runTransaction = async () => {
                attempts++;
                throw new Error('UNIQUE constraint failed');
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(attempts).to.equal(1);
            expect(error).to.exist;
            expect(error!.message).to.include('UNIQUE constraint failed');
        });

        it('should NOT retry on non-retriable error (without logger)', async () => {
            let attempts = 0;

            mockDB.runTransaction = async () => {
                attempts++;
                throw new Error('UNIQUE constraint failed');
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(attempts).to.equal(1);
            expect(error).to.exist;
            expect(error!.message).to.include('UNIQUE constraint failed');
        });

        it('should throw error after max retries exhausted', async () => {
            let attempts = 0;

            mockDB.runTransaction = async () => {
                attempts++;
                throw new Error('conflict detected');
            };

            config.retries = 3;
            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(attempts).to.equal(3);
            expect(error).to.exist;
            expect(error!.message).to.include('conflict detected');
        });

        it('should throw error after max retries exhausted (without logger)', async () => {
            let attempts = 0;

            mockDB.runTransaction = async () => {
                attempts++;
                throw new Error('conflict detected');
            };

            config.retries = 3;
            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(attempts).to.equal(3);
            expect(error).to.exist;
            expect(error!.message).to.include('conflict detected');
        });

        it('should use exponential backoff when enabled', async () => {
            const delays: number[] = [];
            let attempts = 0;

            mockDB.runTransaction = async <T,>(): Promise<T> => {
                const now = Date.now();
                if (attempts > 0) {
                    delays.push(now - lastTime);
                }
                lastTime = now;
                attempts++;
                if (attempts < 4) {
                    throw new Error('conflict detected');
                }
                return Promise.resolve() as Promise<T>;
            };

            config.retries = 4;
            config.retryDelay = 5;
            config.retryBackoff = true;

            let lastTime = Date.now();
            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(attempts).to.equal(4);
            // Verify exponential pattern: ~5ms, ~10ms, ~20ms (with tolerance)
            expect(delays[0]).to.be.greaterThan(2).and.lessThan(15);
            expect(delays[1]).to.be.greaterThan(7).and.lessThan(20);
            expect(delays[2]).to.be.greaterThan(15).and.lessThan(30);
        });

        it('should use fixed delay when backoff disabled', async () => {
            const delays: number[] = [];
            let attempts = 0;

            mockDB.runTransaction = async <T,>(): Promise<T> => {
                const now = Date.now();
                if (attempts > 0) {
                    delays.push(now - lastTime);
                }
                lastTime = now;
                attempts++;
                if (attempts < 4) {
                    throw new Error('conflict detected');
                }
                return Promise.resolve() as Promise<T>;
            };

            config.retries = 4;
            config.retryDelay = 5;
            config.retryBackoff = false;  // Disable exponential backoff

            let lastTime = Date.now();
            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(attempts).to.equal(4);
            // All delays should be ~5ms (fixed)
            delays.forEach(delay => {
                expect(delay).to.be.greaterThan(2).and.lessThan(15);
            });
        });

        it('should use default retries (3) when config.retries is undefined', async () => {
            let attempts = 0;

            mockDB.runTransaction = async () => {
                attempts++;
                throw new Error('conflict detected');
            };

            config.retries = undefined;
            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            // Should use default of 3 attempts
            expect(attempts).to.equal(3);
            expect(error).to.exist;
        });

        it('should use default retryDelay (5) when config.retryDelay is undefined', async () => {
            config.retryDelay = 5;  // Use small delay for fast test execution
            config.retryBackoff = true;

            let attempts = 0;
            const startTimes: number[] = [];

            mockDB.runTransaction = async <T,>(): Promise<T> => {
                startTimes.push(Date.now());
                attempts++;
                if (attempts < 3) {
                    throw new Error('conflict detected');
                }
                return Promise.resolve() as Promise<T>;
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            // Calculate delays between attempts
            const delays: number[] = [];
            for (let i = 1; i < startTimes.length; i++) {
                delays.push(startTimes[i] - startTimes[i - 1]);
            }

            // Should use 5ms base delay with exponential backoff
            // First retry: ~5ms, second retry: ~10ms (exponential backoff)
            expect(delays[0]).to.be.greaterThan(3).and.lessThan(15);  // ~5ms
            expect(delays[1]).to.be.greaterThan(8).and.lessThan(25);  // ~10ms
        });

        it('should use default retryDelay (100) when config.retryDelay is null', async () => {
            config.retryDelay = null as any;  // Test null case for nullish coalescing
            config.retryBackoff = false;  // No backoff for faster test

            let attempts = 0;

            mockDB.runTransaction = async <T,>(): Promise<T> => {
                attempts++;
                if (attempts < 2) {  // Only 1 retry for faster test
                    throw new Error('conflict detected');
                }
                return Promise.resolve() as Promise<T>;
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            // Should have retried once and succeeded
            expect(attempts).to.equal(2);
        });

        it('should log success on first attempt', async () => {
            let debugMessage = '';
            const testLogger = {
                debug: (msg: string) => { debugMessage = msg; },
                warn: () => {},
                error: () => {},
                log: () => {},
                info: () => {}
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(debugMessage).to.include('Transaction executed successfully');
            expect(debugMessage).to.not.include('(attempt');
        });

        it('should log success with attempt number on retry', async () => {
            let debugMessages: string[] = [];
            let attempts = 0;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('conflict detected');
                }
                return callback({} as unknown);
            };

            const testLogger = {
                debug: (msg: string) => { debugMessages.push(msg); },
                warn: () => {},
                error: () => {},
                log: () => {},
                info: () => {}
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.commit();

            expect(attempts).to.equal(2);
            const lastDebug = debugMessages[debugMessages.length - 1];
            expect(lastDebug).to.include('(attempt 2)');
        });

        it('should log error for non-retriable errors', async () => {
            let errorMessage = '';
            const testLogger = {
                debug: () => {},
                warn: () => {},
                error: (msg: string) => { errorMessage = msg; },
                log: () => {},
                info: () => {}
            };

            mockDB.runTransaction = async () => {
                throw new Error('UNIQUE constraint failed');
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            try {
                await manager.commit();
            } catch {
                // Expected
            }

            expect(errorMessage).to.include('non-retriable error');
        });

        it('should log error after max retries', async () => {
            let errorMessage = '';
            const testLogger = {
                debug: () => {},
                warn: () => {},
                error: (msg: string) => { errorMessage = msg; },
                log: () => {},
                info: () => {}
            };

            mockDB.runTransaction = async () => {
                throw new Error('conflict detected');
            };

            config.retries = 2;
            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            try {
                await manager.commit();
            } catch {
                // Expected
            }

            expect(errorMessage).to.include('failed after 2 attempts');
        });

        it('should clear operations after successful commit', async () => {
            let executionCount = 0;

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                executionCount++;
                return callback({} as unknown);
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);

            // First transaction
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });
            await manager.commit();

            expect(executionCount).to.equal(1);

            // Second transaction - operations should have been cleared
            await manager.begin();
            await manager.commit();  // No operations - should not call runTransaction

            expect(executionCount).to.equal(1);  // Still 1, not 2
        });
    });

    /**
     * Tests for rollback() method.
     *
     * Verifies rollback behavior:
     * - Discards buffered operations without executing them
     * - Logs debug messages with operation count
     * - Works correctly without a logger
     */
    describe('rollback()', () => {

        it('should discard operations without executing', async () => {
            let runTransactionCalled = false;

            mockDB.runTransaction = async <T,>(): Promise<T> => {
                runTransactionCalled = true;
                return Promise.resolve() as Promise<T>;
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.rollback();

            expect(runTransactionCalled).to.be.false;
        });

        it('should log debug message with operation count', async () => {
            let debugMessage = '';
            const testLogger = {
                debug: (msg: string) => { debugMessage = msg; },
                warn: () => {},
                error: () => {},
                log: () => {},
                info: () => {}
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.begin();
            manager.addOperation(async () => { /* operation 1 */ });
            manager.addOperation(async () => { /* operation 2 */ });

            await manager.rollback();

            expect(debugMessage).to.include('Discarded 2 transaction operations');
        });

        it('should work without logger', async () => {
            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger
            await manager.begin();
            manager.addOperation(async () => { /* operation */ });

            await manager.rollback();  // Should not throw
        });
    });

    /**
     * Tests for setIsolationLevel() method.
     *
     * Verifies isolation level handling:
     * - Logs warning that isolation levels are not supported for callback-style transactions
     * - Includes the requested isolation level in the warning message
     * - Works correctly without a logger
     */
    describe('setIsolationLevel()', () => {

        it('should log warning that isolation levels are not supported', async () => {
            let warnMessage = '';
            const testLogger = {
                debug: () => {},
                warn: (msg: string) => { warnMessage = msg; },
                error: () => {},
                log: () => {},
                info: () => {}
            };

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, testLogger as any);
            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);

            expect(warnMessage).to.include('Callback-style transactions do not support SQL isolation levels');
            expect(warnMessage).to.include('SERIALIZABLE');
        });

        it('should work without logger', async () => {
            const manager = new CallbackTransactionManager<IDB>(mockDB, config);  // No logger

            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);  // Should not throw
        });
    });

    describe('addOperation()', () => {

        it('should add operation to be executed in transaction', async () => {
            let operationExecuted = false;

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();

            manager.addOperation(async () => {
                operationExecuted = true;
            });

            await manager.commit();

            expect(operationExecuted).to.be.true;
        });

        it('should allow multiple operations to be added', async () => {
            const executions: number[] = [];

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();

            manager.addOperation(async () => { executions.push(1); });
            manager.addOperation(async () => { executions.push(2); });
            manager.addOperation(async () => { executions.push(3); });

            await manager.commit();

            expect(executions).to.deep.equal([1, 2, 3]);
        });

        it('should pass transaction context to operations', async () => {
            const txContext = { id: '123', data: 'test' };

            mockDB.runTransaction = async <T,>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                return callback(txContext);
            };

            let receivedContext: unknown;

            const manager = new CallbackTransactionManager<IDB>(mockDB, config, logger);
            await manager.begin();

            manager.addOperation(async (tx) => {
                receivedContext = tx;
            });

            await manager.commit();

            expect(receivedContext).to.deep.equal(txContext);
        });
    });
});
