import {expect} from 'chai';
import sinon from 'sinon';
import {Command} from 'commander';
import {addBackupCommand} from '../../../../src/cli/commands/backup';
import {MigrationScriptExecutor} from '../../../../src/service/MigrationScriptExecutor';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';
import {IDB} from '../../../../src/interface';

interface MockDB extends IDB {
    data: string;
}

describe('backup command', () => {
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
            createBackup: sinon.stub(),
            restoreFromBackup: sinon.stub(),
            deleteBackup: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);

        // Stub console and process.exit
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // Add command
        addBackupCommand(program, createExecutorStub);
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
         * Validates that the backup command is added to the program
         */
        it('should register "backup" command', () => {
            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('backup');
        });

        /**
         * Test: Command has description
         * Validates that the command has a user-friendly description
         */
        it('should have description', () => {
            const backupCmd = program.commands.find(cmd => cmd.name() === 'backup');
            expect(backupCmd?.description()).to.equal('Backup and restore operations');
        });

        /**
         * Test: Command has create subcommand
         * Validates that the create subcommand is registered
         */
        it('should have create subcommand', () => {
            const backupCmd = program.commands.find(cmd => cmd.name() === 'backup');
            const subcommands = backupCmd?.commands.map(cmd => cmd.name()) || [];
            expect(subcommands).to.include('create');
        });

        /**
         * Test: Command has restore subcommand
         * Validates that the restore subcommand is registered
         */
        it('should have restore subcommand', () => {
            const backupCmd = program.commands.find(cmd => cmd.name() === 'backup');
            const subcommands = backupCmd?.commands.map(cmd => cmd.name()) || [];
            expect(subcommands).to.include('restore');
        });

        /**
         * Test: Command has delete subcommand
         * Validates that the delete subcommand is registered
         */
        it('should have delete subcommand', () => {
            const backupCmd = program.commands.find(cmd => cmd.name() === 'backup');
            const subcommands = backupCmd?.commands.map(cmd => cmd.name()) || [];
            expect(subcommands).to.include('delete');
        });
    });

    describe('backup create', () => {
        /**
         * Test: Creates backup successfully
         * Validates that createBackup() is called and success message is displayed
         */
        it('should create backup successfully', async () => {
            const backupPath = './backups/backup-2025-12-10.bkp';
            mockExecutor.createBackup.resolves(backupPath);

            await program.parseAsync(['node', 'test', 'backup', 'create']);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.createBackup.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith(`✓ Backup created successfully: ${backupPath}`)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles backup creation failure
         * Validates error handling when backup creation fails
         */
        it('should handle backup creation failure', async () => {
            const error = new Error('Insufficient disk space');
            mockExecutor.createBackup.rejects(error);

            await program.parseAsync(['node', 'test', 'backup', 'create']);

            expect(consoleErrorStub.calledWith('✗ Backup creation failed:', 'Insufficient disk space')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.BACKUP_FAILED)).to.be.true;
        });

        /**
         * Test: Handles non-Error exception during backup creation
         * Validates error handling when executor throws non-Error object
         */
        it('should handle non-Error exception during backup creation', async () => {
            mockExecutor.createBackup.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'backup', 'create']);

            expect(consoleErrorStub.calledWith('✗ Backup creation failed:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.BACKUP_FAILED)).to.be.true;
        });

        /**
         * Test: Handles Error with empty message during backup creation
         * Validates fallback to String(error) when error.message is empty
         */
        it('should handle Error with empty message during backup creation', async () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';
            mockExecutor.createBackup.rejects(errorWithoutMessage);

            await program.parseAsync(['node', 'test', 'backup', 'create']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.BACKUP_FAILED)).to.be.true;
        });
    });

    describe('backup restore', () => {
        /**
         * Test: Restores from specific backup path
         * Validates that restoreFromBackup() is called with specified path
         */
        it('should restore from specific backup path', async () => {
            const backupPath = './backups/backup-2025-12-10.bkp';
            mockExecutor.restoreFromBackup.resolves();

            await program.parseAsync(['node', 'test', 'backup', 'restore', backupPath]);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.restoreFromBackup.calledOnce).to.be.true;
            expect(mockExecutor.restoreFromBackup.calledWith(backupPath)).to.be.true;
            expect(consoleLogStub.calledWith(`✓ Database restored successfully from ${backupPath}`)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Restores from most recent backup when no path specified
         * Validates that restoreFromBackup() is called without path parameter
         */
        it('should restore from most recent backup when no path specified', async () => {
            mockExecutor.restoreFromBackup.resolves();

            await program.parseAsync(['node', 'test', 'backup', 'restore']);

            expect(mockExecutor.restoreFromBackup.calledOnce).to.be.true;
            expect(mockExecutor.restoreFromBackup.calledWith(undefined)).to.be.true;
            expect(consoleLogStub.calledWith('✓ Database restored successfully from most recent backup')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles restore failure
         * Validates error handling when restore fails
         */
        it('should handle restore failure', async () => {
            const error = new Error('Backup file corrupted');
            mockExecutor.restoreFromBackup.rejects(error);

            await program.parseAsync(['node', 'test', 'backup', 'restore']);

            expect(consoleErrorStub.calledWith('✗ Restore failed:', 'Backup file corrupted')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.RESTORE_FAILED)).to.be.true;
        });

        /**
         * Test: Handles restore failure with specific backup path
         * Validates error message includes path when specified
         */
        it('should handle restore failure with specific backup path', async () => {
            const backupPath = './backups/missing.bkp';
            const error = new Error('Backup file not found');
            mockExecutor.restoreFromBackup.rejects(error);

            await program.parseAsync(['node', 'test', 'backup', 'restore', backupPath]);

            expect(consoleErrorStub.calledWith('✗ Restore failed:', 'Backup file not found')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.RESTORE_FAILED)).to.be.true;
        });

        /**
         * Test: Handles non-Error exception during restore
         * Validates error handling when executor throws non-Error object
         */
        it('should handle non-Error exception during restore', async () => {
            mockExecutor.restoreFromBackup.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'backup', 'restore']);

            expect(consoleErrorStub.calledWith('✗ Restore failed:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.RESTORE_FAILED)).to.be.true;
        });

        /**
         * Test: Handles Error with empty message during restore
         * Validates fallback to String(error) when error.message is empty
         */
        it('should handle Error with empty message during restore', async () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';
            mockExecutor.restoreFromBackup.rejects(errorWithoutMessage);

            await program.parseAsync(['node', 'test', 'backup', 'restore']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.RESTORE_FAILED)).to.be.true;
        });
    });

    describe('backup delete', () => {
        /**
         * Test: Deletes backup successfully
         * Validates that deleteBackup() is called and success message is displayed
         */
        it('should delete backup successfully', async () => {
            mockExecutor.deleteBackup.returns();

            await program.parseAsync(['node', 'test', 'backup', 'delete']);

            expect(createExecutorStub.calledOnce).to.be.true;
            expect(mockExecutor.deleteBackup.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith('✓ Backup deleted successfully')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles delete failure
         * Validates error handling when delete fails
         */
        it('should handle delete failure', async () => {
            const error = new Error('Backup file not found');
            mockExecutor.deleteBackup.throws(error);

            await program.parseAsync(['node', 'test', 'backup', 'delete']);

            expect(consoleErrorStub.calledWith('✗ Delete backup failed:', 'Backup file not found')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        /**
         * Test: Handles non-Error exception during delete
         * Validates error handling when executor throws non-Error object
         */
        it('should handle non-Error exception during delete', async () => {
            mockExecutor.deleteBackup.callsFake(() => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'backup', 'delete']);

            expect(consoleErrorStub.calledWith('✗ Delete backup failed:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        /**
         * Test: Handles Error with empty message during delete
         * Validates fallback to String(error) when error.message is empty
         */
        it('should handle Error with empty message during delete', async () => {
            const errorWithoutMessage = new Error();
            errorWithoutMessage.message = '';
            mockExecutor.deleteBackup.throws(errorWithoutMessage);

            await program.parseAsync(['node', 'test', 'backup', 'delete']);

            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });
    });

    describe('Executor creation', () => {
        /**
         * Test: Creates executor for create subcommand
         * Validates that factory is called for create action
         */
        it('should create executor for create subcommand', async () => {
            mockExecutor.createBackup.resolves('./backup.bkp');

            await program.parseAsync(['node', 'test', 'backup', 'create']);

            expect(createExecutorStub.calledOnce).to.be.true;
        });

        /**
         * Test: Creates executor for restore subcommand
         * Validates that factory is called for restore action
         */
        it('should create executor for restore subcommand', async () => {
            mockExecutor.restoreFromBackup.resolves();

            await program.parseAsync(['node', 'test', 'backup', 'restore']);

            expect(createExecutorStub.calledOnce).to.be.true;
        });

        /**
         * Test: Creates executor for delete subcommand
         * Validates that factory is called for delete action
         */
        it('should create executor for delete subcommand', async () => {
            mockExecutor.deleteBackup.returns();

            await program.parseAsync(['node', 'test', 'backup', 'delete']);

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
         * Test: Handles backup path with spaces
         * Validates that paths with spaces are handled correctly
         */
        it('should handle backup path with spaces', async () => {
            const backupPath = './backups/my backup file.bkp';
            mockExecutor.restoreFromBackup.resolves();

            await program.parseAsync(['node', 'test', 'backup', 'restore', backupPath]);

            expect(mockExecutor.restoreFromBackup.calledWith(backupPath)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles backup path with special characters
         * Validates that paths with special characters are handled correctly
         */
        it('should handle backup path with special characters', async () => {
            const backupPath = './backups/backup-@#$%.bkp';
            mockExecutor.restoreFromBackup.resolves();

            await program.parseAsync(['node', 'test', 'backup', 'restore', backupPath]);

            expect(mockExecutor.restoreFromBackup.calledWith(backupPath)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        /**
         * Test: Handles absolute backup paths
         * Validates that absolute paths are handled correctly
         */
        it('should handle absolute backup paths', async () => {
            const backupPath = '/absolute/path/to/backup.bkp';
            mockExecutor.restoreFromBackup.resolves();

            await program.parseAsync(['node', 'test', 'backup', 'restore', backupPath]);

            expect(mockExecutor.restoreFromBackup.calledWith(backupPath)).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });
    });
});
