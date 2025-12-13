import {expect} from 'chai';
import * as cliModule from '../../../src/cli';

describe('CLI Module Exports', () => {
    /**
     * Test: Exports createCLI function
     * Validates that the main factory function is exported
     */
    it('should export createCLI function', () => {
        expect(cliModule.createCLI).to.be.a('function');
    });

    /**
     * Test: Exports CLIFlags type
     * Validates that CLI flags type is exported
     */
    it('should export mapFlagsToConfig function', () => {
        expect(cliModule.mapFlagsToConfig).to.be.a('function');
    });

    /**
     * Test: Exports EXIT_CODES
     * Validates that exit codes are exported
     */
    it('should export EXIT_CODES', () => {
        expect(cliModule.EXIT_CODES).to.be.an('object');
        expect(cliModule.EXIT_CODES.SUCCESS).to.equal(0);
        expect(cliModule.EXIT_CODES.GENERAL_ERROR).to.equal(1);
    });

    /**
     * Test: Exports command functions
     * Validates that command registration functions are exported
     */
    it('should export command functions', () => {
        expect(cliModule.addMigrateCommand).to.be.a('function');
        expect(cliModule.addListCommand).to.be.a('function');
        expect(cliModule.addDownCommand).to.be.a('function');
        expect(cliModule.addValidateCommand).to.be.a('function');
        expect(cliModule.addBackupCommand).to.be.a('function');
    });
});
