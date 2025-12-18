import {expect} from 'chai';
import sinon from 'sinon';
import {Command} from 'commander';
import {addLockStatusCommand} from '../../../../src/cli/commands/lock-status';
import {MigrationScriptExecutor} from '../../../../src/service/MigrationScriptExecutor';
import {EXIT_CODES} from '../../../../src/cli/utils/exitCodes';
import {IDB} from '../../../../src/interface';
import {ILockStatus} from '../../../../src/interface/service/ILockingService';

interface MockDB extends IDB {
    data: string;
}

describe('lock:status command', () => {
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
            getLockStatus: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);

        // Stub console and process.exit
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');
        processExitStub = sinon.stub(process, 'exit');

        // Add command
        addLockStatusCommand(program, createExecutorStub);
    });

    afterEach(() => {
        consoleLogStub.restore();
        consoleErrorStub.restore();
        processExitStub.restore();
        sinon.restore();
    });

    describe('Command setup', () => {
        it('should register "lock:status" command', () => {
            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('lock:status');
        });

        it('should have description', () => {
            const cmd = program.commands.find(c => c.name() === 'lock:status');
            expect(cmd?.description()).to.equal('Display current migration lock status');
        });
    });

    describe('Execution', () => {
        it('should show NOT CONFIGURED when locking service is not available', async () => {
            mockExecutor.getLockStatus.resolves(null);

            await program.parseAsync(['node', 'test', 'lock:status']);

            expect(consoleLogStub.calledWith('\nLock Status: NOT CONFIGURED')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        it('should show UNLOCKED when no lock is held', async () => {
            const status: ILockStatus = {
                isLocked: false,
                lockedBy: null,
                lockedAt: null,
                expiresAt: null,
                processId: undefined
            };
            mockExecutor.getLockStatus.resolves(status);

            await program.parseAsync(['node', 'test', 'lock:status']);

            expect(consoleLogStub.calledWith('\nLock Status: UNLOCKED')).to.be.true;
            expect(consoleLogStub.calledWith('No migration is currently running.\n')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        it('should show LOCKED with details when lock is held', async () => {
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

            await program.parseAsync(['node', 'test', 'lock:status']);

            expect(consoleLogStub.calledWith('\nLock Status: LOCKED')).to.be.true;
            expect(consoleLogStub.calledWith('Locked by: test-executor-123')).to.be.true;
            expect(consoleLogStub.calledWith(`Locked at: ${lockedAt.toISOString()}`)).to.be.true;
            expect(consoleLogStub.calledWith(`Expires at: ${expiresAt.toISOString()}`)).to.be.true;
            expect(consoleLogStub.calledWith('Process ID: 12345')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        it('should handle locked status without process ID', async () => {
            const status: ILockStatus = {
                isLocked: true,
                lockedBy: 'test-executor-456',
                lockedAt: new Date('2025-12-18T10:00:00Z'),
                expiresAt: new Date('2025-12-18T10:10:00Z'),
                processId: undefined
            };
            mockExecutor.getLockStatus.resolves(status);

            await program.parseAsync(['node', 'test', 'lock:status']);

            expect(consoleLogStub.calledWith('Process ID: 12345')).to.be.false;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
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

            await program.parseAsync(['node', 'test', 'lock:status']);

            expect(consoleLogStub.calledWith('Locked by: unknown')).to.be.true;
            expect(consoleLogStub.calledWith('Locked at: unknown')).to.be.true;
            expect(consoleLogStub.calledWith('Expires at: unknown')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.SUCCESS)).to.be.true;
        });

        it('should handle errors gracefully', async () => {
            mockExecutor.getLockStatus.rejects(new Error('Database connection failed'));

            await program.parseAsync(['node', 'test', 'lock:status']);

            expect(consoleErrorStub.calledWith('✗ Lock status error:', 'Database connection failed')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        it('should handle non-Error exceptions', async () => {
            mockExecutor.getLockStatus.callsFake(async () => {
                throw 'String error';
            });

            await program.parseAsync(['node', 'test', 'lock:status']);

            expect(consoleErrorStub.calledWith('✗ Lock status error:', 'String error')).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });

        it('should handle Error with null message property', async () => {
            // Create an Error-like object with null message to test the || branch
            const errorWithNullMessage = Object.create(Error.prototype);
            errorWithNullMessage.message = null;
            errorWithNullMessage.name = 'Error';
            mockExecutor.getLockStatus.rejects(errorWithNullMessage);

            await program.parseAsync(['node', 'test', 'lock:status']);

            // When error.message is null/falsy, String(error) is called
            expect(consoleErrorStub.called).to.be.true;
            expect(processExitStub.calledWith(EXIT_CODES.GENERAL_ERROR)).to.be.true;
        });
    });
});
