import {Command} from 'commander';
import {MigrationScriptExecutor} from '../../service/MigrationScriptExecutor';
import {EXIT_CODES} from '../utils/exitCodes';
import {IDB} from '../../interface';

/**
 * Add lock:status command to CLI program.
 *
 * Displays the current migration lock status including who holds it and when it expires.
 *
 * @param program - Commander program instance
 * @param createExecutor - Factory function to create MigrationScriptExecutor
 *
 * @example
 * ```bash
 * # Check current lock status
 * msr lock:status
 *
 * # With options
 * msr lock:status --logger console
 * ```
 */
export function addLockStatusCommand<DB extends IDB>(
    program: Command,
    createExecutor: () => Promise<MigrationScriptExecutor<DB>>
): void {
    program
        .command('lock:status')
        .description('Display current migration lock status')
        .action(async () => {
            try {
                const executor = await createExecutor();
                const status = await executor.getLockStatus();

                if (!status) {
                    console.log('\nLock Status: NOT CONFIGURED');
                    console.log('Locking service is not available in your database handler.');
                    console.log('See documentation for implementing ILockingService.\n');
                    process.exit(EXIT_CODES.SUCCESS);
                    return;
                }

                if (!status.isLocked) {
                    console.log('\nLock Status: UNLOCKED');
                    console.log('No migration is currently running.\n');
                    process.exit(EXIT_CODES.SUCCESS);
                    return;
                }

                // Lock is held
                console.log('\nLock Status: LOCKED');
                console.log(`Locked by: ${status.lockedBy || 'unknown'}`);
                console.log(`Locked at: ${status.lockedAt ? status.lockedAt.toISOString() : 'unknown'}`);
                console.log(`Expires at: ${status.expiresAt ? status.expiresAt.toISOString() : 'unknown'}`);

                if (status.processId) {
                    console.log(`Process ID: ${status.processId}`);
                }

                console.log('\nAnother migration is currently running.');
                console.log('If you believe this is a stale lock, use: msr lock:release --force\n');

                process.exit(EXIT_CODES.SUCCESS);
            } catch (error) {
                let message: string;
                if (error instanceof Error) {
                    message = error.message ? error.message : String(error);
                } else {
                    message = String(error);
                }
                console.error(`✗ Lock status error:`, message);
                process.exit(EXIT_CODES.GENERAL_ERROR);
            }
        });
}
