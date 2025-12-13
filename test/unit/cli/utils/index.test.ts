import {expect} from 'chai';
import * as utilsModule from '../../../../src/cli/utils';

describe('CLI Utils Module Exports', () => {
    /**
     * Test: Exports EXIT_CODES
     * Validates that exit codes are exported from utils
     */
    it('should export EXIT_CODES', () => {
        expect(utilsModule.EXIT_CODES).to.be.an('object');
        expect(utilsModule.EXIT_CODES.SUCCESS).to.equal(0);
        expect(utilsModule.EXIT_CODES.GENERAL_ERROR).to.equal(1);
        expect(utilsModule.EXIT_CODES.VALIDATION_ERROR).to.equal(2);
        expect(utilsModule.EXIT_CODES.MIGRATION_FAILED).to.equal(3);
        expect(utilsModule.EXIT_CODES.ROLLBACK_FAILED).to.equal(4);
        expect(utilsModule.EXIT_CODES.BACKUP_FAILED).to.equal(5);
        expect(utilsModule.EXIT_CODES.RESTORE_FAILED).to.equal(6);
        expect(utilsModule.EXIT_CODES.DATABASE_CONNECTION_ERROR).to.equal(7);
    });

    /**
     * Test: Exports mapFlagsToConfig
     * Validates that flag mapping function is exported
     */
    it('should export mapFlagsToConfig function', () => {
        expect(utilsModule.mapFlagsToConfig).to.be.a('function');
    });
});
