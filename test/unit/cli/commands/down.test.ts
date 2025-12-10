import {expect} from 'chai';
import sinon from 'sinon';
import {Command} from 'commander';
import {addDownCommand} from '../../../../src/cli/commands/down';
import {MigrationScriptExecutor} from '../../../../src/service/MigrationScriptExecutor';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';
import {IDB} from '../../../../src/interface';

interface MockDB extends IDB {
    data: string;
}

describe('down command', () => {
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
            down: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);

        // Stub console and process.exit
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // Add command
        addDownCommand(program, createExecutorStub);
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
         * Validates that the down command is added to the program
         */
        it('should register "down" command', () => {
            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('down');
        });

        /**
         * Test: Command has "rollback" alias
         * Validates that the command can be invoked as "rollback"
         */
        it('should have "rollback" alias', () => {
            const downCmd = program.commands.find(cmd => cmd.name() === 'down');
            expect(downCmd?.aliases()).to.include('rollback');
        });

        /**
         * Test: Command has description
         * Validates that the command has a user-friendly description
         */
        it('should have description', () => {
            const downCmd = program.commands.find(cmd => cmd.name() === 'down');
            expect(downCmd?.description()).to.equal('Roll back migrations to target version');
        });

        /**
         * Test: Command requires targetVersion argument
         * Validates that targetVersion is a required argument
         */
        it('should require targetVersion argument', () => {
            const downCmd = program.commands.find(cmd => cmd.name() === 'down');
            const args = downCmd?.registeredArguments || [];
            expect(args.length).to.be.greaterThan(0);
            expect(args[0].required).to.be.true;
        });
    });

    describe('Success scenarios', () => {
        /**
         * Test: Rolls back to target version successfully
         * Validates that down() is called with parsed target version
         */
        it('should roll back to target version successfully', async () => {
            mockExecutor.down.resolves({
                success: true,
                executed: [
                    {timestamp: 3, name: 'migration3'},
                    {timestamp: 2, name: 'migration2'},
                ] as any,
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'down', '202501220100']);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.down.calledOnce).to.be.true;
            expect(mockExecutor.down.calledWith(202501220100)).to.be.true;
            expect(consoleLogStub.calledWith('✓ Successfully rolled back 2 migration(s) to version 202501220100')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Reports zero migrations when none rolled back
         * Validates correct message when already at target version
         */
        it('should report zero migrations when none rolled back', async () => {
            mockExecutor.down.resolves({
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'down', '100']);

            expect(consoleLogStub.calledWith('✓ Successfully rolled back 0 migration(s) to version 100')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles single migration rollback
         * Validates correct singular message for one migration
         */
        it('should handle single migration rollback', async () => {
            mockExecutor.down.resolves({
                success: true,
                executed: [{timestamp: 2, name: 'migration2'}] as any,
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'down', '1']);

            expect(consoleLogStub.calledWith('✓ Successfully rolled back 1 migration(s) to version 1')).to.be.true;
        });
    });

    describe('Failure scenarios', () => {
        /**
         * Test: Handles rollback failure with errors
         * Validates error handling when rollback fails
         */
        it('should handle rollback failure with errors', async () => {
            mockExecutor.down.resolves({
                success: false,
                executed: [],
                migrated: [],
                ignored: [],
                errors: [new Error('Migration file not found'), new Error('Database error')],
            });

            await program.parseAsync(['node', 'test', 'down', '100']);

            expect(consoleErrorStub.calledWith('✗ Rollback failed:')).to.be.true;
            expect(consoleErrorStub.calledWith('  - Migration file not found')).to.be.true;
            expect(consoleErrorStub.calledWith('  - Database error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.ROLLBACK_FAILED)).to.be.true;
        });

        /**
         * Test: Handles rollback failure without errors array
         * Validates error handling when errors is undefined
         */
        it('should handle rollback failure without errors array', async () => {
            mockExecutor.down.resolves({
                success: false,
                executed: [],
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'down', '100']);

            expect(consoleErrorStub.calledWith('✗ Rollback failed:')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.ROLLBACK_FAILED)).to.be.true;
        });

        /**
         * Test: Handles invalid target version format
         * Validates error handling for non-numeric version
         */
        it('should handle invalid target version format', async () => {
            await program.parseAsync(['node', 'test', 'down', 'invalid']);

            expect(consoleErrorStub.calledWith('Error: Invalid target version "invalid". Must be a number.')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
            expect(mockExecutor.down.called).to.be.false;
        });

        /**
         * Test: Handles exception during rollback
         * Validates error handling when executor throws
         */
        it('should handle exception during rollback', async () => {
            const error = new Error('Unexpected database error');
            mockExecutor.down.rejects(error);

            await program.parseAsync(['node', 'test', 'down', '100']);

            expect(consoleErrorStub.calledWith('✗ Rollback error:', 'Unexpected database error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.ROLLBACK_FAILED)).to.be.true;
        });

        /**
         * Test: Handles non-Error exception
         * Validates error handling when executor throws non-Error object
         */
        it('should handle non-Error exception', async () => {
            mockExecutor.down.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'down', '100']);

            expect(consoleErrorStub.calledWith('✗ Rollback error:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.ROLLBACK_FAILED)).to.be.true;
        });

        /**
         * Test: Handles Error with empty message
         * Validates fallback to String(error) when error.message is empty
         */
        it('should handle Error with empty message', async () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';
            mockExecutor.down.rejects(errorWithoutMessage);

            await program.parseAsync(['node', 'test', 'down', '100']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.ROLLBACK_FAILED)).to.be.true;
        });

        /**
         * Test: Handles string exception
         * Validates handling of non-Error thrown values
         */
        it('should handle string exception', async () => {
            mockExecutor.down.rejects('plain string error');

            await program.parseAsync(['node', 'test', 'down', '100']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.ROLLBACK_FAILED)).to.be.true;
        });
    });

    describe('Executor creation', () => {
        /**
         * Test: Creates executor when action runs
         * Validates that factory is called to create executor
         */
        it('should create executor when action runs', async () => {
            mockExecutor.down.resolves({success: true, executed: [], migrated: [], ignored: []});

            await program.parseAsync(['node', 'test', 'down', '100']);

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

    describe('Alias usage', () => {
        /**
         * Test: Works with "rollback" alias
         * Validates that the command can be invoked using the "rollback" alias
         */
        it('should work with "rollback" alias', async () => {
            mockExecutor.down.resolves({success: true, executed: [], migrated: [], ignored: []});

            await program.parseAsync(['node', 'test', 'rollback', '100']);

            expect(mockExecutor.down.calledWith(100)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });
    });

    describe('Edge cases', () => {
        /**
         * Test: Handles version 0 (rollback to beginning)
         * Validates that 0 is accepted as valid target version
         */
        it('should handle version 0 (rollback to beginning)', async () => {
            mockExecutor.down.resolves({success: true, executed: [], migrated: [], ignored: []});

            await program.parseAsync(['node', 'test', 'down', '0']);

            expect(mockExecutor.down.calledWith(0)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles very large version numbers
         * Validates that large version numbers are accepted
         */
        it('should handle very large version numbers', async () => {
            mockExecutor.down.resolves({success: true, executed: [], migrated: [], ignored: []});

            await program.parseAsync(['node', 'test', 'down', '999999999999']);

            expect(mockExecutor.down.calledWith(999999999999)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });
    });
});
