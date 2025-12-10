import {expect} from 'chai';
import sinon from 'sinon';
import {Command} from 'commander';
import {addListCommand} from '../../../../src/cli/commands/list';
import {MigrationScriptExecutor} from '../../../../src/service/MigrationScriptExecutor';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';
import {IDB} from '../../../../src/interface';

interface MockDB extends IDB {
    data: string;
}

describe('list command', () => {
    let program: Command;
    let mockExecutor: sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;
    let createExecutorStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;
    let processExitStub: sinon.SinonStub;

    beforeEach(() => {
        program = new Command();
        program.exitOverride(); // Prevent actual process exit in tests

        // Create mock executor
        mockExecutor = {
            list: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);

        // Stub console and process.exit
        consoleErrorStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // Add command
        addListCommand(program, createExecutorStub);
    });

    afterEach(() => {
        consoleErrorStub.restore();
        processExitStub.restore();
        sinon.restore();
    });

    describe('Command setup', () => {
        /**
         * Test: Command is registered with correct name
         * Validates that the list command is added to the program
         */
        it('should register "list" command', () => {
            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('list');
        });

        /**
         * Test: Command has description
         * Validates that the command has a user-friendly description
         */
        it('should have description', () => {
            const listCmd = program.commands.find(cmd => cmd.name() === 'list');
            expect(listCmd?.description()).to.equal('List all migrations with status');
        });

        /**
         * Test: Command has --number option
         * Validates that the --number option is registered
         */
        it('should have --number option', () => {
            const listCmd = program.commands.find(cmd => cmd.name() === 'list');
            const options = listCmd?.options.map(opt => opt.long);
            expect(options).to.include('--number');
        });

        /**
         * Test: Command has -n short option
         * Validates that the -n short option is registered
         */
        it('should have -n short option', () => {
            const listCmd = program.commands.find(cmd => cmd.name() === 'list');
            const options = listCmd?.options.map(opt => opt.short);
            expect(options).to.include('-n');
        });
    });

    describe('Success scenarios', () => {
        /**
         * Test: Lists all migrations with default count (0)
         * Validates that list() is called with count=0 when no --number specified
         */
        it('should list all migrations with default count', async () => {
            mockExecutor.list.resolves();

            await program.parseAsync(['node', 'test', 'list']);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.list.calledOnce).to.be.true;
            expect(mockExecutor.list.calledWith(0)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Lists specific number of migrations with --number option
         * Validates that list() is called with specified count
         */
        it('should list specific number of migrations with --number option', async () => {
            mockExecutor.list.resolves();

            await program.parseAsync(['node', 'test', 'list', '--number', '10']);

            expect(mockExecutor.list.calledWith(10)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Lists specific number of migrations with -n short option
         * Validates that list() is called with specified count using short option
         */
        it('should list specific number of migrations with -n short option', async () => {
            mockExecutor.list.resolves();

            await program.parseAsync(['node', 'test', 'list', '-n', '5']);

            expect(mockExecutor.list.calledWith(5)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles count of 0 (all migrations)
         * Validates that 0 is accepted as valid count
         */
        it('should handle count of 0 (all migrations)', async () => {
            mockExecutor.list.resolves();

            await program.parseAsync(['node', 'test', 'list', '--number', '0']);

            expect(mockExecutor.list.calledWith(0)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });
    });

    describe('Failure scenarios', () => {
        /**
         * Test: Handles invalid number format
         * Validates error handling for non-numeric count
         */
        it('should handle invalid number format', async () => {
            await program.parseAsync(['node', 'test', 'list', '--number', 'invalid']);

            expect(consoleErrorStub.calledWith('Error: Invalid number "invalid". Must be a non-negative integer.')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
            expect(mockExecutor.list.called).to.be.false;
        });

        /**
         * Test: Handles negative number
         * Validates error handling for negative count values
         */
        it('should handle negative number', async () => {
            await program.parseAsync(['node', 'test', 'list', '--number', '-5']);

            expect(consoleErrorStub.calledWith('Error: Invalid number "-5". Must be a non-negative integer.')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
            expect(mockExecutor.list.called).to.be.false;
        });

        /**
         * Test: Handles exception during list
         * Validates error handling when executor throws
         */
        it('should handle exception during list', async () => {
            const error = new Error('Database connection failed');
            mockExecutor.list.rejects(error);

            await program.parseAsync(['node', 'test', 'list']);

            expect(consoleErrorStub.calledWith('✗ List error:', 'Database connection failed')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        /**
         * Test: Handles non-Error exception
         * Validates error handling when executor throws non-Error object
         */
        it('should handle non-Error exception', async () => {
            mockExecutor.list.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'list']);

            expect(consoleErrorStub.calledWith('✗ List error:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        /**
         * Test: Handles Error with empty message
         * Validates fallback to String(error) when error.message is empty
         */
        it('should handle Error with empty message', async () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';
            mockExecutor.list.rejects(errorWithoutMessage);

            await program.parseAsync(['node', 'test', 'list']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });
    });

    describe('Executor creation', () => {
        /**
         * Test: Creates executor when action runs
         * Validates that factory is called to create executor
         */
        it('should create executor when action runs', async () => {
            mockExecutor.list.resolves();

            await program.parseAsync(['node', 'test', 'list']);

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

    describe('Edge cases', () => {
        /**
         * Test: Handles decimal number by parsing to integer
         * Validates that decimal numbers are converted to integers
         */
        it('should handle decimal number by parsing to integer', async () => {
            mockExecutor.list.resolves();

            await program.parseAsync(['node', 'test', 'list', '--number', '10.7']);

            expect(mockExecutor.list.calledWith(10)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles very large numbers
         * Validates that large count values are accepted
         */
        it('should handle very large numbers', async () => {
            mockExecutor.list.resolves();

            await program.parseAsync(['node', 'test', 'list', '--number', '999999']);

            expect(mockExecutor.list.calledWith(999999)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });
    });
});
