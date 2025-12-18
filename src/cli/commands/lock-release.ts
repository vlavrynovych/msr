import {Command} from 'commander';
import {MigrationScriptExecutor} from '../../service/MigrationScriptExecutor';
import {EXIT_CODES} from '../utils/exitCodes';
import {IDB} from '../../interface';
import * as readline from 'node:readline';

/**
 * Add lock:release command to CLI program.
 *
 * Force-releases a stuck migration lock. Requires --force flag for safety.
 *
 * @param program - Commander program instance
 * @param createExecutor - Factory function to create MigrationScriptExecutor
 *
 * @example
 * ```bash
 * # Force release stuck lock (requires confirmation)
 * msr lock:release --force
 *
 * # With options
 * msr lock:release --force --logger console
 * ```
 */
export function addLockReleaseCommand<DB extends IDB>(
    program: Command,
    createExecutor: () => MigrationScriptExecutor<DB>
): void {
    program
        .command('lock:release')
        .description('Force-release migration lock (⚠️ DANGEROUS)')
        .option('-f, --force', 'Force release without safety check')
        .action(async (options: { force?: boolean }) => {
            try {
                if (!options.force) {
                    console.error('✗ Error: --force flag is required for safety');
                    console.error('Usage: msr lock:release --force');
                    console.error('\nThis operation is dangerous and should only be used when:');
                    console.error('  - A migration process crashed leaving a stale lock');
                    console.error('  - You are CERTAIN no migration is actually running');
                    process.exit(EXIT_CODES.GENERAL_ERROR);
                    return;
                }

                const executor = createExecutor();
                const status = await executor.getLockStatus();

                if (!status) {
                    console.log('\n✗ Locking service is not configured');
                    console.log('Cannot release lock without a locking implementation in your database handler.');
                    process.exit(EXIT_CODES.GENERAL_ERROR);
                    return;
                }

                if (!status.isLocked) {
                    console.log('\n✓ No lock to release');
                    console.log('The lock is already released or was never acquired.');
                    process.exit(EXIT_CODES.SUCCESS);
                    return;
                }

                // Lock exists - show warning and ask for confirmation
                console.log('\n⚠️  WARNING: Force releasing migration lock');
                console.log('─'.repeat(50));
                console.log(`Lock held by: ${status.lockedBy || 'unknown'}`);
                console.log(`Locked at: ${status.lockedAt ? status.lockedAt.toISOString() : 'unknown'}`);
                console.log(`Expires at: ${status.expiresAt ? status.expiresAt.toISOString() : 'unknown'}`);
                console.log('─'.repeat(50));
                console.log('\nReleasing this lock while a migration is running could cause:');
                console.log('  • Race conditions');
                console.log('  • Corrupted migration state');
                console.log('  • Data loss');
                console.log('\nOnly proceed if you are CERTAIN the migration process has crashed.\n');

                // Ask for confirmation
                const confirmed = await askForConfirmation('Are you sure you want to release this lock? (y/N): ');

                if (!confirmed) {
                    console.log('\n✓ Operation cancelled');
                    process.exit(EXIT_CODES.SUCCESS);
                    return;
                }

                // Release the lock
                await executor.forceReleaseLock();

                console.log('\n✓ Lock forcibly released');
                console.log('You can now run migrations again.\n');
                process.exit(EXIT_CODES.SUCCESS);
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ Lock release error:`, message);
                process.exit(EXIT_CODES.GENERAL_ERROR);
            }
        });
}

/**
 * Ask user for confirmation via stdin.
 *
 * @param question - Question to ask
 * @returns Promise that resolves to true if user confirms (y/yes), false otherwise
 */
function askForConfirmation(question: string): Promise<boolean> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(question, (answer) => {
            rl.close();
            const normalized = answer.trim().toLowerCase();
            resolve(normalized === 'y' || normalized === 'yes');
        });
    });
}
