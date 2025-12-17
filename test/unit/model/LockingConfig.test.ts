import { expect } from 'chai';
import { LockingConfig } from '../../../src/model/LockingConfig';

describe('LockingConfig', () => {
    describe('constructor', () => {
        it('should create with default values', () => {
            const config = new LockingConfig();

            expect(config.enabled).to.equal(true);
            expect(config.timeout).to.equal(600_000); // 10 minutes
            expect(config.tableName).to.equal('migration_locks');
            expect(config.retryAttempts).to.equal(0);
            expect(config.retryDelay).to.equal(1000);
        });

        it('should create with custom enabled value', () => {
            const config = new LockingConfig({ enabled: false });

            expect(config.enabled).to.equal(false);
            expect(config.timeout).to.equal(600_000);
        });

        it('should create with custom timeout', () => {
            const config = new LockingConfig({ timeout: 300_000 });

            expect(config.timeout).to.equal(300_000);
            expect(config.enabled).to.equal(true);
        });

        it('should create with custom table name', () => {
            const config = new LockingConfig({ tableName: 'custom_locks' });

            expect(config.tableName).to.equal('custom_locks');
        });

        it('should create with custom retry attempts', () => {
            const config = new LockingConfig({ retryAttempts: 5 });

            expect(config.retryAttempts).to.equal(5);
            expect(config.retryDelay).to.equal(1000);
        });

        it('should create with custom retry delay', () => {
            const config = new LockingConfig({ retryDelay: 2000 });

            expect(config.retryDelay).to.equal(2000);
            expect(config.retryAttempts).to.equal(0);
        });

        it('should create with all custom values', () => {
            const config = new LockingConfig({
                enabled: false,
                timeout: 1_800_000,
                tableName: 'my_locks',
                retryAttempts: 10,
                retryDelay: 5000
            });

            expect(config.enabled).to.equal(false);
            expect(config.timeout).to.equal(1_800_000);
            expect(config.tableName).to.equal('my_locks');
            expect(config.retryAttempts).to.equal(10);
            expect(config.retryDelay).to.equal(5000);
        });
    });

    describe('validate', () => {
        describe('timeout validation', () => {
            it('should pass validation with valid timeout', () => {
                const config = new LockingConfig({ timeout: 600_000 });
                expect(() => config.validate()).not.to.throw();
            });

            it('should throw RangeError for zero timeout', () => {
                const config = new LockingConfig({ timeout: 0 });
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.timeout must be positive, got 0'
                );
            });

            it('should throw RangeError for negative timeout', () => {
                const config = new LockingConfig({ timeout: -1000 });
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.timeout must be positive, got -1000'
                );
            });

            it('should throw RangeError for timeout exceeding 1 hour', () => {
                const config = new LockingConfig({ timeout: 3_600_001 });
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.timeout should not exceed 1 hour (3600000ms), got 3600001'
                );
            });

            it('should allow timeout of exactly 1 hour', () => {
                const config = new LockingConfig({ timeout: 3_600_000 });
                expect(() => config.validate()).not.to.throw();
            });
        });

        describe('retryAttempts validation', () => {
            it('should pass validation with zero retry attempts', () => {
                const config = new LockingConfig({ retryAttempts: 0 });
                expect(() => config.validate()).not.to.throw();
            });

            it('should pass validation with valid retry attempts', () => {
                const config = new LockingConfig({ retryAttempts: 50 });
                expect(() => config.validate()).not.to.throw();
            });

            it('should throw RangeError for negative retry attempts', () => {
                const config = new LockingConfig({ retryAttempts: -1 });
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.retryAttempts must be non-negative, got -1'
                );
            });

            it('should throw RangeError for retry attempts exceeding 100', () => {
                const config = new LockingConfig({ retryAttempts: 101 });
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.retryAttempts should not exceed 100, got 101'
                );
            });

            it('should allow retry attempts of exactly 100', () => {
                const config = new LockingConfig({ retryAttempts: 100 });
                expect(() => config.validate()).not.to.throw();
            });
        });

        describe('retryDelay validation', () => {
            it('should pass validation with zero retry delay', () => {
                const config = new LockingConfig({ retryDelay: 0 });
                expect(() => config.validate()).not.to.throw();
            });

            it('should pass validation with valid retry delay', () => {
                const config = new LockingConfig({ retryDelay: 30_000 });
                expect(() => config.validate()).not.to.throw();
            });

            it('should throw RangeError for negative retry delay', () => {
                const config = new LockingConfig({ retryDelay: -1000 });
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.retryDelay must be non-negative, got -1000'
                );
            });

            it('should throw RangeError for retry delay exceeding 1 minute', () => {
                const config = new LockingConfig({ retryDelay: 60_001 });
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.retryDelay should not exceed 1 minute (60000ms), got 60001'
                );
            });

            it('should allow retry delay of exactly 1 minute', () => {
                const config = new LockingConfig({ retryDelay: 60_000 });
                expect(() => config.validate()).not.to.throw();
            });
        });

        describe('tableName validation', () => {
            it('should pass validation with valid table name', () => {
                const config = new LockingConfig({ tableName: 'migration_locks' });
                expect(() => config.validate()).not.to.throw();
            });

            it('should pass validation with table name containing underscores', () => {
                const config = new LockingConfig({ tableName: 'my_migration_locks_2' });
                expect(() => config.validate()).not.to.throw();
            });

            it('should pass validation with uppercase table name', () => {
                const config = new LockingConfig({ tableName: 'MIGRATION_LOCKS' });
                expect(() => config.validate()).not.to.throw();
            });

            it('should throw TypeError for empty table name', () => {
                const config = new LockingConfig({ tableName: '' });
                expect(() => config.validate()).to.throw(
                    TypeError,
                    'LockingConfig.tableName must not be empty'
                );
            });

            it('should throw TypeError for whitespace-only table name', () => {
                const config = new LockingConfig({ tableName: '   ' });
                expect(() => config.validate()).to.throw(
                    TypeError,
                    'LockingConfig.tableName must not be empty'
                );
            });

            it('should throw TypeError for table name starting with number', () => {
                const config = new LockingConfig({ tableName: '1_locks' });
                expect(() => config.validate()).to.throw(
                    TypeError,
                    "LockingConfig.tableName must be a valid SQL identifier (alphanumeric and underscore), got '1_locks'"
                );
            });

            it('should throw TypeError for table name with special characters', () => {
                const config = new LockingConfig({ tableName: 'locks-table' });
                expect(() => config.validate()).to.throw(
                    TypeError,
                    "LockingConfig.tableName must be a valid SQL identifier (alphanumeric and underscore), got 'locks-table'"
                );
            });

            it('should throw TypeError for table name with spaces', () => {
                const config = new LockingConfig({ tableName: 'migration locks' });
                expect(() => config.validate()).to.throw(
                    TypeError,
                    "LockingConfig.tableName must be a valid SQL identifier (alphanumeric and underscore), got 'migration locks'"
                );
            });

            it('should throw TypeError for table name with SQL injection attempt', () => {
                const config = new LockingConfig({ tableName: "locks'; DROP TABLE users; --" });
                expect(() => config.validate()).to.throw(
                    TypeError,
                    "LockingConfig.tableName must be a valid SQL identifier (alphanumeric and underscore), got 'locks'; DROP TABLE users; --'"
                );
            });

            it('should throw TypeError for table name with semicolon', () => {
                const config = new LockingConfig({ tableName: 'locks;' });
                expect(() => config.validate()).to.throw(
                    TypeError,
                    "LockingConfig.tableName must be a valid SQL identifier (alphanumeric and underscore), got 'locks;'"
                );
            });
        });

        describe('combined validation', () => {
            it('should validate all properties successfully', () => {
                const config = new LockingConfig({
                    enabled: true,
                    timeout: 1_800_000,
                    tableName: 'custom_locks',
                    retryAttempts: 10,
                    retryDelay: 5000
                });

                expect(() => config.validate()).not.to.throw();
            });

            it('should throw on first validation error encountered', () => {
                const config = new LockingConfig({
                    timeout: -1000,
                    tableName: 'invalid-name'
                });

                // Should throw on first error (timeout)
                expect(() => config.validate()).to.throw(
                    RangeError,
                    'LockingConfig.timeout must be positive, got -1000'
                );
            });
        });
    });
});
