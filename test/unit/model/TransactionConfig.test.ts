import { expect } from 'chai';
import { TransactionConfig, TransactionMode, IsolationLevel } from '../../../src/index';

describe('TransactionConfig', () => {

    /**
     * Test: TransactionConfig has correct default values
     * Validates that a new TransactionConfig instance is initialized with
     * expected defaults that provide safe and performant transaction behavior.
     */
    it('should have correct default values', () => {
        const config = new TransactionConfig();

        // Verify transaction mode defaults to PER_MIGRATION (safest option)
        expect(config.mode).to.eq(TransactionMode.PER_MIGRATION);

        // Verify isolation level defaults to READ_COMMITTED (standard SQL default)
        expect(config.isolation).to.eq(IsolationLevel.READ_COMMITTED);

        // Verify timeout defaults to 30 seconds
        expect(config.timeout).to.eq(30000);

        // Verify retry defaults to 3 attempts (retry by default for resilience)
        expect(config.retries).to.eq(3);

        // Verify retry delay defaults to 100ms
        expect(config.retryDelay).to.eq(100);

        // Verify exponential backoff is enabled by default
        expect(config.retryBackoff).to.be.true;
    });

    /**
     * Test: TransactionConfig can be created with custom values
     * Validates that all properties can be customized when creating
     * a TransactionConfig instance.
     */
    it('should allow custom values', () => {
        const config = new TransactionConfig();

        // Customize all properties
        config.mode = TransactionMode.PER_BATCH;
        config.isolation = IsolationLevel.SERIALIZABLE;
        config.timeout = 60000;
        config.retries = 5;
        config.retryDelay = 200;
        config.retryBackoff = false;

        // Verify all customizations applied
        expect(config.mode).to.eq(TransactionMode.PER_BATCH);
        expect(config.isolation).to.eq(IsolationLevel.SERIALIZABLE);
        expect(config.timeout).to.eq(60000);
        expect(config.retries).to.eq(5);
        expect(config.retryDelay).to.eq(200);
        expect(config.retryBackoff).to.be.false;
    });

    /**
     * Test: TransactionConfig supports NONE mode (no transactions)
     * Validates that transaction management can be completely disabled
     * for databases that don't support transactions or when manual
     * transaction control is needed.
     */
    it('should support NONE mode for disabling transactions', () => {
        const config = new TransactionConfig();
        config.mode = TransactionMode.NONE;

        expect(config.mode).to.eq(TransactionMode.NONE);
    });

    /**
     * Test: TransactionConfig supports all isolation levels
     * Validates that all standard SQL isolation levels can be configured
     * for different concurrency control requirements.
     */
    it('should support all SQL isolation levels', () => {
        const config = new TransactionConfig();

        // Test READ_UNCOMMITTED (least strict)
        config.isolation = IsolationLevel.READ_UNCOMMITTED;
        expect(config.isolation).to.eq(IsolationLevel.READ_UNCOMMITTED);

        // Test READ_COMMITTED (default)
        config.isolation = IsolationLevel.READ_COMMITTED;
        expect(config.isolation).to.eq(IsolationLevel.READ_COMMITTED);

        // Test REPEATABLE_READ
        config.isolation = IsolationLevel.REPEATABLE_READ;
        expect(config.isolation).to.eq(IsolationLevel.REPEATABLE_READ);

        // Test SERIALIZABLE (most strict)
        config.isolation = IsolationLevel.SERIALIZABLE;
        expect(config.isolation).to.eq(IsolationLevel.SERIALIZABLE);
    });

    /**
     * Test: TransactionConfig supports disabling retries
     * Validates that automatic commit retry can be disabled by setting
     * retries to 0 or 1 (single attempt, no retries).
     */
    it('should allow disabling retries', () => {
        const config = new TransactionConfig();

        // Disable retries (single attempt only)
        config.retries = 1;
        expect(config.retries).to.eq(1);

        // Also test 0 retries
        config.retries = 0;
        expect(config.retries).to.eq(0);
    });

    /**
     * Test: TransactionConfig supports custom retry delays
     * Validates that retry timing can be customized for different
     * load scenarios and database responsiveness.
     */
    it('should allow custom retry delays', () => {
        const config = new TransactionConfig();

        // Very short delay for fast databases
        config.retryDelay = 50;
        expect(config.retryDelay).to.eq(50);

        // Longer delay for slower/congested databases
        config.retryDelay = 1000;
        expect(config.retryDelay).to.eq(1000);
    });

    /**
     * Test: TransactionConfig supports optional timeout
     * Validates that timeout can be undefined, allowing database
     * to use its own default timeout settings.
     */
    it('should support optional timeout', () => {
        const config = new TransactionConfig();

        // Clear timeout to use database defaults
        config.timeout = undefined;
        expect(config.timeout).to.be.undefined;
    });

    /**
     * Test: TransactionConfig supports optional isolation level
     * Validates that isolation level can be undefined, allowing database
     * to use its own default isolation level.
     */
    it('should support optional isolation level', () => {
        const config = new TransactionConfig();

        // Clear isolation to use database defaults
        config.isolation = undefined;
        expect(config.isolation).to.be.undefined;
    });
});
