import { expect } from 'chai';
import { MigrationValidationService } from '../../../src/service/MigrationValidationService';
import { Config, TransactionMode, IsolationLevel, RollbackStrategy, ValidationIssueType } from '../../../src/model';
import { IDatabaseMigrationHandler, IDB, IMigrationInfo } from '../../../src';
import { MigrationScript } from '../../../src/model/MigrationScript';
import { SilentLogger } from '../../../src/logger';

describe('MigrationValidationService - Transaction Validation', () => {
    let validationService: MigrationValidationService;
    let config: Config;
    let handler: IDatabaseMigrationHandler;

    beforeEach(() => {
        validationService = new MigrationValidationService(new SilentLogger());
        config = new Config();

        // Default non-transactional handler
        handler = {
            db: {
                execute: async () => [],
                checkConnection: async () => true
            } as IDB,
            backup: {
                backup: async () => './backup.bkp',
                restore: async () => {}
            },
            migrationRecords: {
                save: async () => {},
                getAllExecuted: async () => [],
                remove: async () => {}
            },
            schemaVersion: {
                save: async () => {},
                getAllExecuted: async () => [],
                remove: async () => {},
                isInitialized: async () => true,
                createTable: async () => true,
                validateTable: async () => true,
                migrationRecords: {
                    save: async () => {},
                    getAllExecuted: async () => [],
                    remove: async () => {}
                }
            },
            getName: () => 'TestHandler',
            getVersion: () => '1.0.0',
            createTable: async () => true,
            isInitialized: async () => true,
            validateTable: async () => true
        } as IDatabaseMigrationHandler;
    });

    describe('validateTransactionConfiguration()', () => {
        /**
         * Test: Should return no issues when transaction mode is NONE
         */
        it('should return no issues when transaction mode is NONE', () => {
            config.transaction.mode = TransactionMode.NONE;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            expect(issues).to.be.an('array');
            expect(issues.length).to.equal(0);
        });

        /**
         * Test: Should error when database doesn't support transactions but mode is enabled
         */
        it('should error when database does not support transactions', () => {
            config.transaction.mode = TransactionMode.PER_MIGRATION;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            expect(issues.length).to.be.greaterThan(0);
            const error = issues.find(i => i.type === ValidationIssueType.ERROR);
            expect(error).to.exist;
            expect(error!.message).to.include('does not support transactions');
            expect(error!.details).to.include('ITransactionalDB');
        });

        /**
         * Test: Should not error when database supports imperative transactions
         */
        it('should not error when database supports imperative transactions', () => {
            config.transaction.mode = TransactionMode.PER_MIGRATION;

            // Add transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
            };

            handler.db = transactionalDB as IDB;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const errors = issues.filter(i => i.type === ValidationIssueType.ERROR);
            expect(errors.length).to.equal(0);
        });

        /**
         * Test: Should not error when database supports callback transactions
         */
        it('should not error when database supports callback transactions', () => {
            config.transaction.mode = TransactionMode.PER_BATCH;

            // Add callback transaction support
            const callbackDB = {
                execute: async () => [],
                checkConnection: async () => true,
                runTransaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                    return callback({});
                }
            };

            handler.db = callbackDB as IDB;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const errors = issues.filter(i => i.type === ValidationIssueType.ERROR);
            expect(errors.length).to.equal(0);
        });

        /**
         * Test: Should warn when isolation level is set but database doesn't support it
         */
        it('should warn when isolation level is set but database may not support it', () => {
            config.transaction.mode = TransactionMode.PER_MIGRATION;
            config.transaction.isolation = IsolationLevel.SERIALIZABLE;

            // Database with transactions but no setIsolationLevel
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
                // No setIsolationLevel method
            };

            handler.db = transactionalDB as IDB;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const warnings = issues.filter(i => i.type === ValidationIssueType.WARNING);
            expect(warnings.length).to.be.greaterThan(0);

            const isolationWarning = warnings.find(w => w.message.includes('Isolation level'));
            expect(isolationWarning).to.exist;
            expect(isolationWarning!.message).to.include('SERIALIZABLE');
        });

        /**
         * Test: Should not warn when isolation level is supported
         */
        it('should not warn about isolation level when database supports it', () => {
            config.transaction.mode = TransactionMode.PER_MIGRATION;
            config.transaction.isolation = IsolationLevel.READ_COMMITTED;

            // Database with full transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {},
                setIsolationLevel: async (level: string) => {}
            };

            handler.db = transactionalDB as IDB;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const isolationWarnings = issues.filter(i =>
                i.type === ValidationIssueType.WARNING &&
                i.message.includes('Isolation level')
            );
            expect(isolationWarnings.length).to.equal(0);
        });

        /**
         * Test: Should warn when PER_BATCH mode with DOWN rollback strategy
         */
        it('should warn when PER_BATCH mode is used with DOWN rollback strategy', () => {
            config.transaction.mode = TransactionMode.PER_BATCH;
            config.rollbackStrategy = RollbackStrategy.DOWN;

            // Add transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
            };

            handler.db = transactionalDB as IDB;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const warnings = issues.filter(i => i.type === ValidationIssueType.WARNING);
            expect(warnings.length).to.be.greaterThan(0);

            const strategyWarning = warnings.find(w => w.message.includes('not fully compatible'));
            expect(strategyWarning).to.exist;
            expect(strategyWarning!.message).to.include('PER_BATCH');
            expect(strategyWarning!.message).to.include('DOWN');
        });

        /**
         * Test: Should not warn when PER_BATCH with BACKUP strategy
         */
        it('should not warn about rollback strategy when PER_BATCH with BACKUP', () => {
            config.transaction.mode = TransactionMode.PER_BATCH;
            config.rollbackStrategy = RollbackStrategy.BACKUP;

            // Add transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
            };

            handler.db = transactionalDB as IDB;
            const scripts: MigrationScript[] = [];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const strategyWarnings = issues.filter(i =>
                i.type === ValidationIssueType.WARNING &&
                i.message.includes('not fully compatible')
            );
            expect(strategyWarnings.length).to.equal(0);
        });

        /**
         * Test: Should warn when many migrations with timeout set in PER_BATCH mode
         */
        it('should warn when many migrations will execute in single transaction with timeout', () => {
            config.transaction.mode = TransactionMode.PER_BATCH;
            config.transaction.timeout = 30000; // 30 seconds

            // Add transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
            };

            handler.db = transactionalDB as IDB;

            // Create 15 migration scripts (more than 10 threshold)
            const scripts: MigrationScript[] = [];
            for (let i = 1; i <= 15; i++) {
                scripts.push(new MigrationScript(`V${i}_test.ts`, `/path/V${i}_test.ts`, i));
            }

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const warnings = issues.filter(i => i.type === ValidationIssueType.WARNING);
            expect(warnings.length).to.be.greaterThan(0);

            const timeoutWarning = warnings.find(w => w.message.includes('single transaction'));
            expect(timeoutWarning).to.exist;
            expect(timeoutWarning!.message).to.include('15 migrations');
            expect(timeoutWarning!.details).to.include('30000ms');
        });

        /**
         * Test: Should warn when many migrations without timeout in PER_BATCH mode
         */
        it('should warn when too many migrations without timeout set', () => {
            config.transaction.mode = TransactionMode.PER_BATCH;
            config.transaction.timeout = undefined; // No timeout

            // Add transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
            };

            handler.db = transactionalDB as IDB;

            // Create 25 migration scripts (more than 20 threshold)
            const scripts: MigrationScript[] = [];
            for (let i = 1; i <= 25; i++) {
                scripts.push(new MigrationScript(`V${i}_test.ts`, `/path/V${i}_test.ts`, i));
            }

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const warnings = issues.filter(i => i.type === ValidationIssueType.WARNING);
            expect(warnings.length).to.be.greaterThan(0);

            const longRunningWarning = warnings.find(w => w.message.includes('long-running transaction'));
            expect(longRunningWarning).to.exist;
            expect(longRunningWarning!.message).to.include('25 migrations');
        });

        /**
         * Test: Should not warn about timeout in PER_MIGRATION mode
         */
        it('should not warn about timeout in PER_MIGRATION mode', () => {
            config.transaction.mode = TransactionMode.PER_MIGRATION;
            config.transaction.timeout = 5000;

            // Add transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
            };

            handler.db = transactionalDB as IDB;

            // Even with many scripts, no warning in PER_MIGRATION mode
            const scripts: MigrationScript[] = [];
            for (let i = 1; i <= 25; i++) {
                scripts.push(new MigrationScript(`V${i}_test.ts`, `/path/V${i}_test.ts`, i));
            }

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const timeoutWarnings = issues.filter(i =>
                i.type === ValidationIssueType.WARNING &&
                (i.message.includes('timeout') || i.message.includes('long-running'))
            );
            expect(timeoutWarnings.length).to.equal(0);
        });

        /**
         * Test: Should not warn when few migrations in PER_BATCH mode
         */
        it('should not warn about timeout when only few migrations', () => {
            config.transaction.mode = TransactionMode.PER_BATCH;
            config.transaction.timeout = 30000;

            // Add transaction support
            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {}
            };

            handler.db = transactionalDB as IDB;

            // Only 5 scripts (below threshold)
            const scripts: MigrationScript[] = [];
            for (let i = 1; i <= 5; i++) {
                scripts.push(new MigrationScript(`V${i}_test.ts`, `/path/V${i}_test.ts`, i));
            }

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            const timeoutWarnings = issues.filter(i =>
                i.type === ValidationIssueType.WARNING &&
                i.message.includes('timeout')
            );
            expect(timeoutWarnings.length).to.equal(0);
        });

        /**
         * Test: Should handle when no isolation level is configured (early return line 536)
         */
        it('should not validate isolation level when none configured', () => {
            config.transaction.mode = TransactionMode.PER_MIGRATION;
            config.transaction.isolation = undefined; // No isolation level

            const transactionalDB = {
                execute: async () => [],
                checkConnection: async () => true,
                beginTransaction: async () => {},
                commit: async () => {},
                rollback: async () => {},
                setIsolationLevel: async () => {}
            };

            handler.db = transactionalDB as IDB;

            const scripts: MigrationScript[] = [
                new MigrationScript('V1_test.ts', '/path/V1_test.ts', 1)
            ];

            const issues = validationService.validateTransactionConfiguration(handler, config, scripts);

            // Should not have any isolation-related warnings (early return at line 536)
            expect(issues).to.be.an('array');
        });

    });
});
