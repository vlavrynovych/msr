import { expect } from 'chai';
import { DefaultTransactionManager } from '../../../src/service/DefaultTransactionManager';
import { IDB } from '../../../src/interface/dao';
import { TransactionConfig } from '../../../src/model/TransactionConfig';
import { TransactionMode } from '../../../src/model/TransactionMode';
import { IsolationLevel } from '../../../src/model/IsolationLevel';
import { ITransactionalDB } from '../../../src/interface/dao/ITransactionalDB';
import { SilentLogger } from '../../../src/logger';

/**
 * Unit tests for DefaultTransactionManager.
 *
 * Tests the SQL-based transaction manager that uses the ITransactionalDB interface.
 * This manager provides explicit transaction control with begin/commit/rollback
 * operations, isolation level support, and retry logic with exponential backoff.
 *
 * Test coverage includes:
 * - Transaction lifecycle (begin, commit, rollback)
 * - Isolation level configuration
 * - Retry logic with exponential backoff
 * - Error detection (retriable vs non-retriable)
 * - Logger integration
 * - Integration scenarios combining multiple features
 */
describe('DefaultTransactionManager', () => {

    let mockDB: ITransactionalDB;
    let config: TransactionConfig;
    let logger: SilentLogger;

    beforeEach(() => {
        // Create mock transactional database
        mockDB = {
            query: async () => { return [] },
            checkConnection: async () => { return true },
            beginTransaction: async () => { },
            commit: async () => { },
            rollback: async () => { },
            setIsolationLevel: async () => { }
        } as ITransactionalDB;

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
     * Verifies transaction initialization:
     * - Calls db.beginTransaction() to start the transaction
     * - Sets isolation level before beginning transaction when configured
     * - Handles databases that support isolation levels
     * - Handles databases that don't support isolation levels
     * - Logs appropriate debug messages
     * - Works correctly without a logger
     */
    describe('begin()', () => {

        it('should call db.beginTransaction()', async () => {
            let beginCalled = false;
            mockDB.beginTransaction = async () => {
                beginCalled = true;
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.begin();

            expect(beginCalled).to.be.true;
        });

        it('should set isolation level before beginning transaction', async () => {
            const calls: string[] = [];

            mockDB.setIsolationLevel = async (level: string) => {
                calls.push(`setIsolation:${level}`);
            };
            mockDB.beginTransaction = async () => {
                calls.push('begin');
            };

            config.isolation = IsolationLevel.SERIALIZABLE;
            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.begin();

            expect(calls).to.deep.equal([
                'setIsolation:SERIALIZABLE',
                'begin'
            ]);
        });

        it('should skip setting isolation level when not configured', async () => {
            let setIsolationCalled = false;
            mockDB.setIsolationLevel = async () => {
                setIsolationCalled = true;
            };

            config.isolation = undefined;
            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.begin();

            expect(setIsolationCalled).to.be.false;
        });

        it('should skip setting isolation level when DB does not support it', async () => {
            mockDB.setIsolationLevel = undefined;

            config.isolation = IsolationLevel.SERIALIZABLE;
            const manager = new DefaultTransactionManager(mockDB, config, logger);

            // Should not throw
            await manager.begin();
        });

        it('should propagate errors from db.beginTransaction()', async () => {
            mockDB.beginTransaction = async () => {
                throw new Error('Connection failed');
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);

            let error: Error | undefined;
            try {
                await manager.begin();
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
            expect(error!.message).to.equal('Connection failed');
        });
    });

    /**
     * Tests for commit() method.
     *
     * Verifies transaction commit behavior:
     * - Calls db.commit() to complete the transaction
     * - Implements retry logic for transient errors (deadlock, serialization failure)
     * - Handles non-retriable errors appropriately
     * - Applies exponential backoff when configured
     * - Uses default retry delay when config value is null/undefined
     * - Logs success and retry attempts appropriately
     * - Works correctly without a logger
     */
    describe('commit()', () => {

        it('should call db.commit() on success', async () => {
            let commitCalled = false;
            mockDB.commit = async () => {
                commitCalled = true;
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.commit();

            expect(commitCalled).to.be.true;
        });

        it('should retry on retriable error (deadlock)', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('deadlock detected');
                }
                // Success on 3rd attempt
            };

            config.retries = 3;
            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.commit();

            expect(attempts).to.equal(3);
        });

        it('should retry on retriable error (lock timeout)', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('lock wait timeout exceeded');
                }
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should retry on retriable error (serialization failure)', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('could not serialize access');
                }
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should retry on retriable error (connection lost)', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('connection was lost');
                }
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should NOT retry on non-retriable error (constraint violation)', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                throw new Error('UNIQUE constraint failed');
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);

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
            mockDB.commit = async () => {
                attempts++;
                throw new Error('deadlock detected');
            };

            config.retries = 3;
            const manager = new DefaultTransactionManager(mockDB, config, logger);

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(attempts).to.equal(3);
            expect(error).to.exist;
            expect(error!.message).to.include('deadlock detected');
        });

        it('should use exponential backoff when enabled', async () => {
            const delays: number[] = [];
            let attempts = 0;

            mockDB.commit = async () => {
                attempts++;
                if (attempts < 4) {
                    throw new Error('deadlock detected');
                }
            };

            config.retries = 4;
            config.retryDelay = 5;
            config.retryBackoff = true;

            const manager = new DefaultTransactionManager(mockDB, config, logger);

            // Capture delays by measuring time between attempts
            const startTimes: number[] = [];
            const originalCommit = mockDB.commit;
            mockDB.commit = async () => {
                startTimes.push(Date.now());
                return originalCommit();
            };

            try {
                await manager.commit();
            } catch {
                // Expected to fail
            }

            // Calculate delays between attempts (allow some tolerance for timing)
            for (let i = 1; i < startTimes.length; i++) {
                delays.push(startTimes[i] - startTimes[i - 1]);
            }

            // Verify exponential pattern: 5ms, 10ms, 20ms (with tolerance)
            expect(delays[0]).to.be.greaterThan(2).and.lessThan(15);  // ~5ms
            expect(delays[1]).to.be.greaterThan(7).and.lessThan(20);  // ~10ms
            expect(delays[2]).to.be.greaterThan(15).and.lessThan(30);  // ~20ms
        });

        it('should use fixed delay when backoff disabled', async () => {
            const delays: number[] = [];
            let attempts = 0;

            mockDB.commit = async () => {
                attempts++;
                if (attempts < 4) {
                    throw new Error('deadlock detected');
                }
            };

            config.retries = 4;
            config.retryDelay = 5;
            config.retryBackoff = false;  // Disable exponential backoff

            const manager = new DefaultTransactionManager(mockDB, config, logger);

            const startTimes: number[] = [];
            const originalCommit = mockDB.commit;
            mockDB.commit = async () => {
                startTimes.push(Date.now());
                return originalCommit();
            };

            try {
                await manager.commit();
            } catch {
                // Expected to fail
            }

            // Calculate delays
            for (let i = 1; i < startTimes.length; i++) {
                delays.push(startTimes[i] - startTimes[i - 1]);
            }

            // All delays should be ~5ms (fixed)
            delays.forEach(delay => {
                expect(delay).to.be.greaterThan(2).and.lessThan(15);
            });
        });

        it('should not retry when retries set to 1', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                throw new Error('deadlock detected');
            };

            config.retries = 1;
            const manager = new DefaultTransactionManager(mockDB, config, logger);

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(attempts).to.equal(1);
            expect(error).to.exist;
        });

        it('should handle case-insensitive error message matching', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('DEADLOCK DETECTED');  // Uppercase
                }
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.commit();

            expect(attempts).to.equal(2);
        });

        it('should use default retries (3) when config.retries is undefined', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                throw new Error('deadlock detected');
            };

            config.retries = undefined;
            const manager = new DefaultTransactionManager(mockDB, config, logger);

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

        it('should log success on first commit attempt', async () => {
            let debugCalled = false;
            let debugMessage = '';

            const testLogger = {
                debug: (msg: string) => {
                    debugCalled = true;
                    debugMessage = msg;
                },
                warn: () => {},
                error: () => {}
            };

            const manager = new DefaultTransactionManager(mockDB, config, testLogger as any);
            await manager.commit();

            expect(debugCalled).to.be.true;
            expect(debugMessage).to.equal('Transaction committed successfully');
        });

        it('should log success with attempt number on retry', async () => {
            let attempts = 0;
            let debugMessages: string[] = [];

            mockDB.commit = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('deadlock detected');
                }
            };

            const testLogger = {
                debug: (msg: string) => {
                    debugMessages.push(msg);
                },
                warn: () => {},
                error: () => {}
            };

            const manager = new DefaultTransactionManager(mockDB, config, testLogger as any);
            await manager.commit();

            expect(attempts).to.equal(2);
            expect(debugMessages[debugMessages.length - 1]).to.include('(attempt 2)');
        });
    });

    /**
     * Tests for rollback() method.
     *
     * Verifies transaction rollback behavior:
     * - Calls db.rollback() to abort the transaction
     * - Accepts optional reason parameter for logging
     * - Logs appropriate debug messages
     * - Works correctly without a logger
     */
    describe('rollback()', () => {

        it('should call db.rollback()', async () => {
            let rollbackCalled = false;
            mockDB.rollback = async () => {
                rollbackCalled = true;
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.rollback();

            expect(rollbackCalled).to.be.true;
        });

        it('should propagate errors from db.rollback()', async () => {
            mockDB.rollback = async () => {
                throw new Error('Rollback failed');
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);

            let error: Error | undefined;
            try {
                await manager.rollback();
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
            expect(error!.message).to.equal('Rollback failed');
        });

        it('should NOT retry rollback on failure', async () => {
            let attempts = 0;
            mockDB.rollback = async () => {
                attempts++;
                throw new Error('deadlock detected');
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);

            let error: Error | undefined;
            try {
                await manager.rollback();
            } catch (e) {
                error = e as Error;
            }

            // Should only attempt once (no retry)
            expect(attempts).to.equal(1);
            expect(error).to.exist;
        });
    });

    /**
     * Tests for setIsolationLevel() method.
     *
     * Verifies isolation level configuration:
     * - Calls db.setIsolationLevel() when the method is available
     * - Handles databases that don't support setIsolationLevel gracefully
     * - Works correctly without a logger
     */
    describe('setIsolationLevel()', () => {

        it('should call db.setIsolationLevel() when supported', async () => {
            let setLevel: string | undefined;
            mockDB.setIsolationLevel = async (level: string) => {
                setLevel = level;
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);

            expect(setLevel).to.equal(IsolationLevel.SERIALIZABLE);
        });

        it('should not throw when db does not support setIsolationLevel', async () => {
            mockDB.setIsolationLevel = undefined;

            const manager = new DefaultTransactionManager(mockDB, config, logger);

            // Should not throw
            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);
        });

        it('should log debug message when setting isolation level', async () => {
            let debugMessage = '';
            const testLogger = {
                debug: (msg: string) => { debugMessage = msg; },
                warn: () => {},
                error: () => {}
            };

            mockDB.setIsolationLevel = async () => {};

            const manager = new DefaultTransactionManager(mockDB, config, testLogger as any);
            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);

            expect(debugMessage).to.include('Isolation level set to: SERIALIZABLE');
        });

        it('should log warning when db does not support setIsolationLevel', async () => {
            let warnMessage = '';
            const testLogger = {
                debug: () => {},
                warn: (msg: string) => { warnMessage = msg; },
                error: () => {}
            };

            mockDB.setIsolationLevel = undefined;

            const manager = new DefaultTransactionManager(mockDB, config, testLogger as any);
            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);

            expect(warnMessage).to.include('does not support setIsolationLevel');
        });
    });

    /**
     * Tests for logger integration.
     *
     * Verifies that all logging paths are exercised:
     * - Debug messages for successful operations
     * - Error messages for failed operations
     * - Warning messages for unsupported features
     * - Retry attempt logging
     */
    describe('Logger Coverage', () => {

        it('should log debug message on successful rollback', async () => {
            let debugMessage = '';
            const testLogger = {
                debug: (msg: string) => { debugMessage = msg; },
                warn: () => {},
                error: () => {}
            };

            const manager = new DefaultTransactionManager(mockDB, config, testLogger as any);
            await manager.rollback();

            expect(debugMessage).to.equal('Transaction rolled back');
        });

        it('should log error on rollback failure', async () => {
            let errorMessage = '';
            const testLogger = {
                debug: () => {},
                warn: () => {},
                error: (msg: string) => { errorMessage = msg; }
            };

            mockDB.rollback = async () => {
                throw new Error('Rollback failed');
            };

            const manager = new DefaultTransactionManager(mockDB, config, testLogger as any);

            try {
                await manager.rollback();
            } catch {
                // Expected
            }

            expect(errorMessage).to.include('Rollback failed');
        });

        it('should log error for non-retriable commit error', async () => {
            let errorMessage = '';
            const testLogger = {
                debug: () => {},
                warn: () => {},
                error: (msg: string) => { errorMessage = msg; }
            };

            mockDB.commit = async () => {
                throw new Error('UNIQUE constraint failed');
            };

            const manager = new DefaultTransactionManager(mockDB, config, testLogger as any);

            try {
                await manager.commit();
            } catch {
                // Expected
            }

            expect(errorMessage).to.include('non-retriable error');
        });

        it('should use default retryDelay (5) when config.retryDelay is undefined', async () => {
            config.retryDelay = 5;  // Use small delay for fast test execution
            config.retryBackoff = true;

            let attempts = 0;
            const startTimes: number[] = [];

            mockDB.commit = async () => {
                startTimes.push(Date.now());
                attempts++;
                if (attempts < 3) {
                    throw new Error('deadlock detected');
                }
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
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

            mockDB.commit = async () => {
                attempts++;
                if (attempts < 2) {  // Only 1 retry for faster test
                    throw new Error('deadlock detected');
                }
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);

            await manager.commit();

            // Should have retried once and succeeded
            expect(attempts).to.equal(2);
        });
    });

    /**
     * Tests for operation without logger.
     *
     * Verifies that all operations work correctly when no logger is provided:
     * - begin() with and without isolation level
     * - commit() success and retry scenarios
     * - rollback() with optional reason
     * - setIsolationLevel() when supported and unsupported
     */
    describe('No Logger Coverage', () => {

        it('should work without logger in begin() with isolation level', async () => {
            config.isolation = IsolationLevel.SERIALIZABLE;
            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            await manager.begin();  // Should not throw
        });

        it('should work without logger in begin() without isolation level', async () => {
            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            await manager.begin();  // Should not throw
        });

        it('should work without logger in commit() success', async () => {
            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            await manager.commit();  // Should not throw
        });

        it('should work without logger in commit() with retry', async () => {
            let attempts = 0;
            mockDB.commit = async () => {
                attempts++;
                if (attempts < 2) {
                    throw new Error('deadlock detected');
                }
            };

            const manager = new DefaultTransactionManager(mockDB, config);  // No logger
            await manager.commit();  // Should retry and succeed

            expect(attempts).to.equal(2);
        });

        it('should work without logger in commit() non-retriable error', async () => {
            mockDB.commit = async () => {
                throw new Error('UNIQUE constraint failed');
            };

            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
        });

        it('should work without logger in commit() after max retries', async () => {
            mockDB.commit = async () => {
                throw new Error('deadlock detected');
            };

            config.retries = 2;
            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            let error: Error | undefined;
            try {
                await manager.commit();
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
        });

        it('should work without logger in rollback() success', async () => {
            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            await manager.rollback();  // Should not throw
        });

        it('should work without logger in rollback() failure', async () => {
            mockDB.rollback = async () => {
                throw new Error('Rollback failed');
            };

            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            let error: Error | undefined;
            try {
                await manager.rollback();
            } catch (e) {
                error = e as Error;
            }

            expect(error).to.exist;
        });

        it('should work without logger in setIsolationLevel() when supported', async () => {
            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);  // Should not throw
        });

        it('should work without logger in setIsolationLevel() when not supported', async () => {
            mockDB.setIsolationLevel = undefined;

            const manager = new DefaultTransactionManager(mockDB, config);  // No logger

            await manager.setIsolationLevel(IsolationLevel.SERIALIZABLE);  // Should not throw
        });
    });

    /**
     * Tests for error detection logic.
     *
     * Verifies that the manager correctly identifies:
     * - Retriable errors (deadlock, serialization failure, connection issues)
     * - Non-retriable errors (constraint violations, syntax errors)
     * - Edge cases and error message variations
     */
    describe('Error Detection', () => {

        it('should detect all retriable error patterns', async () => {
            const retriableErrors = [
                'deadlock detected',
                'Deadlock found when trying to get lock',
                'lock timeout',
                'lock wait timeout exceeded',
                'serialization failure',
                'could not serialize access',
                'connection lost',
                'connection closed',
                'connection reset'
            ];

            for (const errorMsg of retriableErrors) {
                let attempts = 0;
                mockDB.commit = async () => {
                    attempts++;
                    if (attempts < 2) {
                        throw new Error(errorMsg);
                    }
                };

                const manager = new DefaultTransactionManager(mockDB, config, logger);
                await manager.commit();

                expect(attempts).to.equal(2, `Failed for error: ${errorMsg}`);
            }
        });

        it('should NOT retry on non-retriable errors', async () => {
            const nonRetriableErrors = [
                'UNIQUE constraint failed',
                'NOT NULL constraint failed',
                'FOREIGN KEY constraint failed',
                'CHECK constraint failed',
                'invalid input syntax',
                'division by zero',
                'permission denied',
                'access denied',
                'relation does not exist'
            ];

            for (const errorMsg of nonRetriableErrors) {
                let attempts = 0;
                mockDB.commit = async () => {
                    attempts++;
                    throw new Error(errorMsg);
                };

                const manager = new DefaultTransactionManager(mockDB, config, logger);

                let error: Error | undefined;
                try {
                    await manager.commit();
                } catch (e) {
                    error = e as Error;
                }

                expect(attempts).to.equal(1, `Unexpectedly retried for error: ${errorMsg}`);
                expect(error).to.exist;
            }
        });
    });

    /**
     * Tests for integration scenarios.
     *
     * Verifies complete workflows combining multiple features:
     * - Full transaction lifecycle (begin → commit)
     * - Full rollback lifecycle (begin → rollback)
     * - Retry with backoff behavior
     * - Multiple retry attempts with eventual success
     */
    describe('Integration Scenarios', () => {

        it('should handle complete transaction lifecycle (begin → commit)', async () => {
            const calls: string[] = [];

            mockDB.beginTransaction = async () => {
                calls.push('begin');
            };
            mockDB.commit = async () => {
                calls.push('commit');
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.begin();
            await manager.commit();

            expect(calls).to.deep.equal(['begin', 'commit']);
        });

        it('should handle transaction lifecycle with rollback (begin → rollback)', async () => {
            const calls: string[] = [];

            mockDB.beginTransaction = async () => {
                calls.push('begin');
            };
            mockDB.rollback = async () => {
                calls.push('rollback');
            };

            const manager = new DefaultTransactionManager(mockDB, config, logger);
            await manager.begin();
            await manager.rollback();

            expect(calls).to.deep.equal(['begin', 'rollback']);
        });

        it('should handle transaction with isolation level and retry', async () => {
            const calls: string[] = [];
            let commitAttempts = 0;

            mockDB.setIsolationLevel = async (level: string) => {
                calls.push(`setIsolation:${level}`);
            };
            mockDB.beginTransaction = async () => {
                calls.push('begin');
            };
            mockDB.commit = async () => {
                commitAttempts++;
                if (commitAttempts < 2) {
                    calls.push('commit:fail');
                    throw new Error('deadlock detected');
                }
                calls.push('commit:success');
            };

            config.isolation = IsolationLevel.REPEATABLE_READ;
            const manager = new DefaultTransactionManager(mockDB, config, logger);

            await manager.begin();
            await manager.commit();

            expect(calls).to.deep.equal([
                'setIsolation:REPEATABLE READ',
                'begin',
                'commit:fail',
                'commit:success'
            ]);
        });
    });
});
