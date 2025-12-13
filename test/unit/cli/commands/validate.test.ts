import {expect} from 'chai';
import sinon from 'sinon';
import {Command} from 'commander';
import {addValidateCommand} from '../../../../src/cli/commands/validate';
import {MigrationScriptExecutor} from '../../../../src/service/MigrationScriptExecutor';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';
import {IDB} from '../../../../src/interface';
import {ValidationIssueType} from '../../../../src/model/ValidationIssueType';

interface MockDB extends IDB {
    data: string;
}

describe('validate command', () => {
    let program: Command;
    let mockExecutor: sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;
    let createExecutorStub: sinon.SinonStub;
    let consoleLogStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;
    let processExitStub: sinon.SinonStub;

    beforeEach(() => {
        program = new Command();
        program.exitOverride(); // Prevent actual process exit in tests

        // Create mock executor
        mockExecutor = {
            validate: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);

        // Stub console and process.exit
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // Add command
        addValidateCommand(program, createExecutorStub);
    });

    afterEach(() => {
        consoleLogStub.restore();
        consoleErrorStub.restore();
        processExitStub.restore();
        sinon.restore();
    });

    describe('Command setup', () => {
        /**
         * Test: Command is registered with correct name
         * Validates that the validate command is added to the program
         */
        it('should register "validate" command', () => {
            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('validate');
        });

        /**
         * Test: Command has description
         * Validates that the command has a user-friendly description
         */
        it('should have description', () => {
            const validateCmd = program.commands.find(cmd => cmd.name() === 'validate');
            expect(validateCmd?.description()).to.equal('Validate migration scripts without executing them');
        });
    });

    describe('Success scenarios', () => {
        /**
         * Test: Validates all migrations successfully
         * Validates that validate() is called and success message is displayed
         */
        it('should validate all migrations successfully', async () => {
            mockExecutor.validate.resolves({
                pending: [
                    {valid: true, issues: [], script: {timestamp: 1, name: 'migration1'} as any},
                    {valid: true, issues: [], script: {timestamp: 2, name: 'migration2'} as any},
                ],
                migrated: [
                    {type: ValidationIssueType.WARNING, message: 'Valid', code: 'initial'},
                ],
            });

            await program.parseAsync(['node', 'test', 'validate']);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.validate.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith('\nValidation Results:')).to.be.true;
            expect(consoleLogStub.calledWith('  Pending migrations validated: 2')).to.be.true;
            expect(consoleLogStub.calledWith('  Pending migrations with errors: 0')).to.be.true;
            expect(consoleLogStub.calledWith('  Executed migrations validated: 1')).to.be.true;
            expect(consoleLogStub.calledWith('  Executed migrations with issues: 1')).to.be.true;
            expect(consoleLogStub.calledWith('\n✓ All migrations are valid')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Validates with no migrations
         * Validates correct output when no migrations exist
         */
        it('should validate with no migrations', async () => {
            mockExecutor.validate.resolves({
                pending: [],
                migrated: [],
            });

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleLogStub.calledWith('  Pending migrations validated: 0')).to.be.true;
            expect(consoleLogStub.calledWith('  Executed migrations validated: 0')).to.be.true;
            expect(consoleLogStub.calledWith('\n✓ All migrations are valid')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });
    });

    describe('Failure scenarios', () => {
        /**
         * Test: Handles pending migrations with errors
         * Validates error reporting when pending migrations have errors
         */
        it('should handle pending migrations with errors', async () => {
            mockExecutor.validate.resolves({
                pending: [
                    {valid: false, issues: [{type: ValidationIssueType.ERROR, message: 'Syntax error', code: 'migration1'}], script: {timestamp: 1, name: 'migration1'} as any},
                    {valid: false, issues: [{type: ValidationIssueType.ERROR, message: 'Missing up method', code: 'migration2'}, {type: ValidationIssueType.ERROR, message: 'Invalid return type', code: 'migration2'}], script: {timestamp: 2, name: 'migration2'} as any},
                    {valid: true, issues: [], script: {timestamp: 3, name: 'migration3'} as any},
                ],
                migrated: [],
            });

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleLogStub.calledWith('  Pending migrations validated: 3')).to.be.true;
            expect(consoleLogStub.calledWith('  Pending migrations with errors: 2')).to.be.true;
            expect(consoleErrorStub.calledWith('\n✗ Validation failed')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.VALIDATION_ERROR)).to.be.true;
        });

        /**
         * Test: Handles migrated migrations with issues
         * Validates error reporting when executed migrations have issues
         */
        it('should handle migrated migrations with issues', async () => {
            mockExecutor.validate.resolves({
                pending: [],
                migrated: [
                    {type: ValidationIssueType.ERROR, message: 'Checksum mismatch', code: 'migration1'},
                    {type: ValidationIssueType.ERROR, message: 'File not found', code: 'migration2'},
                ],
            });

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleLogStub.calledWith('  Executed migrations validated: 2')).to.be.true;
            expect(consoleLogStub.calledWith('  Executed migrations with issues: 2')).to.be.true;
            expect(consoleErrorStub.calledWith('\n✗ Validation failed')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.VALIDATION_ERROR)).to.be.true;
        });

        /**
         * Test: Handles both pending and migrated errors
         * Validates error reporting when both types have issues
         */
        it('should handle both pending and migrated errors', async () => {
            mockExecutor.validate.resolves({
                pending: [
                    {valid: false, issues: [{type: ValidationIssueType.ERROR, message: 'Invalid syntax', code: 'migration3'}], script: {timestamp: 3, name: 'migration3'} as any},
                ],
                migrated: [
                    {type: ValidationIssueType.ERROR, message: 'Checksum mismatch', code: 'migration1'},
                ],
            });

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleLogStub.calledWith('  Pending migrations with errors: 1')).to.be.true;
            expect(consoleLogStub.calledWith('  Executed migrations with issues: 1')).to.be.true;
            expect(consoleErrorStub.calledWith('\n✗ Validation failed')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.VALIDATION_ERROR)).to.be.true;
        });

        /**
         * Test: Handles exception during validation
         * Validates error handling when executor throws
         */
        it('should handle exception during validation', async () => {
            const error = new Error('Failed to load migrations');
            mockExecutor.validate.rejects(error);

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleErrorStub.calledWith('✗ Validation error:', 'Failed to load migrations')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.VALIDATION_ERROR)).to.be.true;
        });

        /**
         * Test: Handles non-Error exception
         * Validates error handling when executor throws non-Error object
         */
        it('should handle non-Error exception', async () => {
            mockExecutor.validate.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleErrorStub.calledWith('✗ Validation error:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.VALIDATION_ERROR)).to.be.true;
        });

        /**
         * Test: Handles Error with empty message
         * Validates fallback to String(error) when error.message is empty
         */
        it('should handle Error with empty message', async () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';
            mockExecutor.validate.rejects(errorWithoutMessage);

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.VALIDATION_ERROR)).to.be.true;
        });
    });

    describe('Executor creation', () => {
        /**
         * Test: Creates executor when action runs
         * Validates that factory is called to create executor
         */
        it('should create executor when action runs', async () => {
            mockExecutor.validate.resolves({pending: [], migrated: []});

            await program.parseAsync(['node', 'test', 'validate']);

            expect(createExecutorStub.calledOnce).to.be.true;
        });

        /**
         * Test: Does not create executor before action
         * Validates that factory is not called during command setup
         */
        it('should not create executor before action', () => {
            expect(createExecutorStub.called).to.be.false;
        });
    });

    describe('Output formatting', () => {
        /**
         * Test: Displays comprehensive validation summary
         * Validates that all relevant metrics are shown
         */
        it('should display comprehensive validation summary', async () => {
            mockExecutor.validate.resolves({
                pending: [
                    {valid: true, issues: [], script: {timestamp: 3, name: 'migration3'} as any},
                    {valid: false, issues: [{type: ValidationIssueType.ERROR, message: 'Error 1', code: 'migration4'}], script: {timestamp: 4, name: 'migration4'} as any},
                ],
                migrated: [
                    {type: ValidationIssueType.WARNING, message: 'Valid', code: 'migration1'},
                    {type: ValidationIssueType.WARNING, message: 'Valid', code: 'migration2'},
                ],
            });

            await program.parseAsync(['node', 'test', 'validate']);

            expect(consoleLogStub.calledWith('\nValidation Results:')).to.be.true;
            expect(consoleLogStub.calledWith('  Pending migrations validated: 2')).to.be.true;
            expect(consoleLogStub.calledWith('  Pending migrations with errors: 1')).to.be.true;
            expect(consoleLogStub.calledWith('  Executed migrations validated: 2')).to.be.true;
            expect(consoleLogStub.calledWith('  Executed migrations with issues: 2')).to.be.true;
        });
    });
});
