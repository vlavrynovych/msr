import {expect} from 'chai';
import sinon from 'sinon';
import {Command} from 'commander';
import {addMigrateCommand} from '../../../../src/cli/commands/migrate';
import {MigrationScriptExecutor} from '../../../../src/service/MigrationScriptExecutor';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';
import {IDB} from '../../../../src/interface';

interface MockDB extends IDB {
    data: string;
}

describe('migrate command', () => {
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
            migrate: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);

        // Stub console and process.exit
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // Add command
        addMigrateCommand(program, createExecutorStub);
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
         * Validates that the migrate command is added to the program
         */
        it('should register "migrate" command', () => {
            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('migrate');
        });

        /**
         * Test: Command has "up" alias
         * Validates that the command can be invoked as "up"
         */
        it('should have "up" alias', () => {
            const migrateCmd = program.commands.find(cmd => cmd.name() === 'migrate');
            expect(migrateCmd?.aliases()).to.include('up');
        });

        /**
         * Test: Command has description
         * Validates that the command has a user-friendly description
         */
        it('should have description', () => {
            const migrateCmd = program.commands.find(cmd => cmd.name() === 'migrate');
            expect(migrateCmd?.description()).to.equal('Run pending migrations');
        });
    });

    describe('Success scenarios', () => {
        /**
         * Test: Executes all migrations when no target version specified
         * Validates that migrate() is called without target parameter
         */
        it('should execute all migrations when no target version specified', async () => {
            mockExecutor.migrate.resolves({
                success: true,
                executed: [{timestamp: 1, name: 'migration1'}] as any,
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.migrate.calledOnce).to.be.true;
            expect(mockExecutor.migrate.calledWith(undefined)).to.be.true;
            expect(consoleLogStub.calledWith('✓ Successfully executed 1 migration(s)')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Migrates to specific version when target specified
         * Validates that migrate() is called with parsed target version
         */
        it('should migrate to specific version when target specified', async () => {
            mockExecutor.migrate.resolves({
                success: true,
                executed: [{timestamp: 1, name: 'migration1'}, {timestamp: 2, name: 'migration2'}] as any,
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'migrate', '202501220100']);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.migrate.calledOnce).to.be.true;
            expect(mockExecutor.migrate.calledWith(202501220100)).to.be.true;
            expect(consoleLogStub.calledWith('✓ Successfully executed 2 migration(s)')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Reports zero migrations executed when none pending
         * Validates correct message when no migrations to run
         */
        it('should report zero migrations when none executed', async () => {
            mockExecutor.migrate.resolves({
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(consoleLogStub.calledWith('✓ Successfully executed 0 migration(s)')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });
    });

    describe('Failure scenarios', () => {
        /**
         * Test: Handles migration failure with errors
         * Validates error handling when migrations fail
         */
        it('should handle migration failure with errors', async () => {
            mockExecutor.migrate.resolves({
                success: false,
                executed: [],
                migrated: [],
                ignored: [],
                errors: [new Error('Database connection failed'), new Error('Transaction rolled back')],
            });

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(consoleErrorStub.calledWith('✗ Migration failed:')).to.be.true;
            expect(consoleErrorStub.calledWith('  - Database connection failed')).to.be.true;
            expect(consoleErrorStub.calledWith('  - Transaction rolled back')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.MIGRATION_FAILED)).to.be.true;
        });

        /**
         * Test: Handles migration failure without errors array
         * Validates error handling when errors is undefined
         */
        it('should handle migration failure without errors array', async () => {
            mockExecutor.migrate.resolves({
                success: false,
                executed: [],
                migrated: [],
                ignored: [],
            });

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(consoleErrorStub.calledWith('✗ Migration failed:')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.MIGRATION_FAILED)).to.be.true;
        });

        /**
         * Test: Handles invalid target version format
         * Validates error handling for non-numeric version
         */
        it('should handle invalid target version format', async () => {
            await program.parseAsync(['node', 'test', 'migrate', 'invalid']);

            expect(consoleErrorStub.calledWith('Error: Invalid target version "invalid". Must be a number.')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
            expect(mockExecutor.migrate.called).to.be.false;
        });

        /**
         * Test: Handles exception during migration
         * Validates error handling when executor throws
         */
        it('should handle exception during migration', async () => {
            const error = new Error('Unexpected database error');
            mockExecutor.migrate.rejects(error);

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(consoleErrorStub.calledWith('✗ Migration error:', 'Unexpected database error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.MIGRATION_FAILED)).to.be.true;
        });

        /**
         * Test: Handles non-Error exception
         * Validates error handling when executor throws non-Error object
         */
        it('should handle non-Error exception', async () => {
            mockExecutor.migrate.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(consoleErrorStub.calledWith('✗ Migration error:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.MIGRATION_FAILED)).to.be.true;
        });

        /**
         * Test: Handles Error with empty message
         * Validates fallback to String(error) when error.message is empty
         */
        it('should handle Error with empty message', async () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';
            mockExecutor.migrate.rejects(errorWithoutMessage);

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.MIGRATION_FAILED)).to.be.true;
        });

        /**
         * Test: Handles truly non-Error exception (string)
         * Validates handling of non-Error thrown values
         */
        it('should handle string exception', async () => {
            mockExecutor.migrate.rejects('plain string error');

            await program.parseAsync(['node', 'test', 'migrate']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.MIGRATION_FAILED)).to.be.true;
        });
    });

    describe('Executor creation', () => {
        /**
         * Test: Creates executor when action runs
         * Validates that factory is called to create executor
         */
        it('should create executor when action runs', async () => {
            mockExecutor.migrate.resolves({success: true, executed: [], migrated: [], ignored: []});

            await program.parseAsync(['node', 'test', 'migrate']);

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
         * Test: Works with "up" alias
         * Validates that the command can be invoked using the "up" alias
         */
        it('should work with "up" alias', async () => {
            mockExecutor.migrate.resolves({success: true, executed: [], migrated: [], ignored: []});

            await program.parseAsync(['node', 'test', 'up']);

            expect(mockExecutor.migrate.calledOnce).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Works with "up" alias and target version
         * Validates that alias works with parameters
         */
        it('should work with "up" alias and target version', async () => {
            mockExecutor.migrate.resolves({success: true, executed: [], migrated: [], ignored: []});

            await program.parseAsync(['node', 'test', 'up', '123456']);

            expect(mockExecutor.migrate.calledWith(123456)).to.be.true;
        });
    });
});
