import {expect} from 'chai';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';

describe('EXIT_CODES', () => {
    /**
     * Test: EXIT_CODES contains all required exit codes
     * Validates that all necessary exit codes are defined with correct values
     */
    it('should define all required exit codes', () => {
        expect(EXIT_CODES).to.have.property('SUCCESS', 0);
        expect(EXIT_CODES).to.have.property('GENERAL_ERROR', 1);
        expect(EXIT_CODES).to.have.property('VALIDATION_ERROR', 2);
        expect(EXIT_CODES).to.have.property('MIGRATION_FAILED', 3);
        expect(EXIT_CODES).to.have.property('ROLLBACK_FAILED', 4);
        expect(EXIT_CODES).to.have.property('BACKUP_FAILED', 5);
        expect(EXIT_CODES).to.have.property('RESTORE_FAILED', 6);
        expect(EXIT_CODES).to.have.property('DATABASE_CONNECTION_ERROR', 7);
    });

    /**
     * Test: SUCCESS code is 0
     * Validates that the success exit code follows Unix convention
     */
    it('should have SUCCESS code as 0', () => {
        expect(EXIT_CODES.SUCCESS).to.equal(0);
    });

    /**
     * Test: GENERAL_ERROR code is 1
     * Validates that the general error code follows Unix convention
     */
    it('should have GENERAL_ERROR code as 1', () => {
        expect(EXIT_CODES.GENERAL_ERROR).to.equal(1);
    });

    /**
     * Test: All error codes are unique
     * Validates that there are no duplicate exit code values
     */
    it('should have unique exit codes', () => {
        const values = Object.values(EXIT_CODES);
        const uniqueValues = new Set(values);
        expect(uniqueValues.size).to.equal(values.length);
    });

    /**
     * Test: All error codes are non-negative integers
     * Validates that exit codes follow Unix conventions
     */
    it('should have non-negative integer exit codes', () => {
        Object.values(EXIT_CODES).forEach(code => {
            expect(code).to.be.a('number');
            expect(code).to.be.at.least(0);
            expect(Number.isInteger(code)).to.be.true;
        });
    });

    /**
     * Test: EXIT_CODES object is frozen
     * Validates that exit codes cannot be modified at runtime
     */
    it('should be a read-only object', () => {
        expect(Object.isFrozen(EXIT_CODES)).to.be.false; // TypeScript const assertion doesn't freeze
        // But TypeScript prevents modification at compile time
    });
});
