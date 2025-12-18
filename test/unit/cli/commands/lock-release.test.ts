import {expect} from 'chai';
import sinon from 'sinon';
import {Command} from 'commander';
import {addLockReleaseCommand} from '../../../../src/cli/commands/lock-release';
import {MigrationScriptExecutor} from '../../../../src/service/MigrationScriptExecutor';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';
import {IDB} from '../../../../src/interface';
import {ILockStatus} from '../../../../src/interface/service/ILockingService';

interface MockDB extends IDB {
    data: string;
}

describe('lock:release command', () => {
    let program: Command;
    let mockExecutor: sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;
    let createExecutorStub: sinon.SinonStub;
    let consoleLogStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;
    let processExitStub: sinon.SinonStub;
    let mockPromptFunction: sinon.SinonStub;

    beforeEach(() => {
        program = new Command();
        program.exitOverride(); // Prevent actual process exit in tests

        // Create mock executor
        mockExecutor = {
            getLockStatus: sinon.stub(),
            forceReleaseLock: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);

        // Stub console and process.exit
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // Create mock prompt function
        mockPromptFunction = sinon.stub();

        // Add command with mock prompt function
        addLockReleaseCommand(program, createExecutorStub, mockPromptFunction);
    });

    afterEach(() => {
        consoleLogStub.restore();
        consoleErrorStub.restore();
        processExitStub.restore();
        sinon.restore();
    });

    describe('Command setup', () => {
        it('should register "lock:release" command', () => {
            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('lock:release');
        });

        it('should have description', () => {
            const cmd = program.commands.find(c => c.name() === 'lock:release');
            expect(cmd?.description()).to.equal('Force-release migration lock (⚠️ DANGEROUS)');
        });

        it('should have --force option', () => {
            const cmd = program.commands.find(c => c.name() === 'lock:release');
            const options = cmd?.options.map(opt => opt.long);
            expect(options).to.include('--force');
        });

        it('should have -f short option', () => {
            const cmd = program.commands.find(c => c.name() === 'lock:release');
            const options = cmd?.options.map(opt => opt.short);
            expect(options).to.include('-f');
        });
    });

    describe('Execution without --force flag', () => {
        it('should require --force flag', async () => {
            await program.parseAsync(['node', 'test', 'lock:release']);

            expect(consoleErrorStub.calledWith('✗ Error: --force flag is required for safety')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });
    });

    describe('Execution with --force flag', () => {
        it('should show error when locking service is not configured', async () => {
            mockExecutor.getLockStatus.resolves(null);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(consoleLogStub.calledWith('\n✗ Locking service is not configured')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        it('should show success when no lock to release', async () => {
            const status: ILockStatus = {
                isLocked: false,
                lockedBy: null,
                lockedAt: null,
                expiresAt: null,
                processId: undefined
            };
            mockExecutor.getLockStatus.resolves(status);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(consoleLogStub.calledWith('\n✓ No lock to release')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        it('should release lock when user confirms with "y"', async () => {
            const lockedAt = new Date('2025-12-18T10:00:00Z');
            const expiresAt = new Date('2025-12-18T10:10:00Z');
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt,
                expiresAt,
                processId: '12345'
            };
            mockExecutor.getLockStatus.resolves(status);
            mockExecutor.forceReleaseLock.resolves();
            mockPromptFunction.resolves(true);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(mockExecutor.forceReleaseLock.called).to.be.true;
            expect(consoleLogStub.calledWith('\n✓ Lock forcibly released')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        it('should release lock when user confirms with "yes"', async () => {
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date(),
                expiresAt: new Date(),
                processId: '12345'
            };
            mockExecutor.getLockStatus.resolves(status);
            mockExecutor.forceReleaseLock.resolves();
            mockPromptFunction.resolves(true);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(mockExecutor.forceReleaseLock.called).to.be.true;
            expect(consoleLogStub.calledWith('\n✓ Lock forcibly released')).to.be.true;
        });

        it('should cancel when user types "n"', async () => {
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date(),
                expiresAt: new Date(),
                processId: '12345'
            };
            mockExecutor.getLockStatus.resolves(status);
            mockPromptFunction.resolves(false);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(mockExecutor.forceReleaseLock.called).to.be.false;
            expect(consoleLogStub.calledWith('\n✓ Operation cancelled')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        it('should cancel when user types "no"', async () => {
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date(),
                expiresAt: new Date(),
                processId: '12345'
            };
            mockExecutor.getLockStatus.resolves(status);
            mockPromptFunction.resolves(false);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(mockExecutor.forceReleaseLock.called).to.be.false;
            expect(consoleLogStub.calledWith('\n✓ Operation cancelled')).to.be.true;
        });

        it('should cancel when user presses enter (default no)', async () => {
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date(),
                expiresAt: new Date(),
                processId: '12345'
            };
            mockExecutor.getLockStatus.resolves(status);
            mockPromptFunction.resolves(false);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(mockExecutor.forceReleaseLock.called).to.be.false;
            expect(consoleLogStub.calledWith('\n✓ Operation cancelled')).to.be.true;
        });

        it('should handle errors during lock release', async () => {
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-123',
                lockedAt: new Date(),
                expiresAt: new Date(),
                processId: '12345'
            };
            mockExecutor.getLockStatus.resolves(status);
            mockExecutor.forceReleaseLock.rejects(new Error('Database error'));
            mockPromptFunction.resolves(true);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(consoleErrorStub.calledWith('✗ Lock release error:', 'Database error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        it('should handle errors during lock status check', async () => {
            mockExecutor.getLockStatus.rejects(new Error('Connection failed'));

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(consoleErrorStub.calledWith('✗ Lock release error:', 'Connection failed')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        it('should handle non-Error exceptions', async () => {
            mockExecutor.getLockStatus.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(consoleErrorStub.calledWith('✗ Lock release error:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        it('should handle Error with null message property', async () => {
            // Create an Error-like object with null message to test the || branch
            const errorWithNullMessage = Object.create(Error.prototype);
            errorWithNullMessage.message = null;
            errorWithNullMessage.name = 'Error';
            mockExecutor.getLockStatus.rejects(errorWithNullMessage);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            // When error.message is null/falsy, String(error) is called
            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        it('should show "unknown" for null lock details', async () => {
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: null,
                lockedAt: null,
                expiresAt: null,
                processId: undefined
            };
            mockExecutor.getLockStatus.resolves(status);
            mockPromptFunction.resolves(false);

            await program.parseAsync(['node', 'test', 'lock:release', '--force']);

            expect(consoleLogStub.calledWith('Lock held by: unknown')).to.be.true;
            expect(consoleLogStub.calledWith('Locked at: unknown')).to.be.true;
            expect(consoleLogStub.calledWith('Expires at: unknown')).to.be.true;
            expect(consoleLogStub.calledWith('\n✓ Operation cancelled')).to.be.true;
        });
    });
});
