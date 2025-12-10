import {Command} from 'commander';
import {MigrationScriptExecutor} from '../../service/MigrationScriptExecutor';
import {EXIT_CODES} from '../utils/exitCodes';
import {IDB} from '../../interface';

/**
 * Add down/rollback command to CLI program.
 *
 * Rolls back database migrations to a specific target version.
 * Executes down() methods in reverse chronological order.
 *
 * @param program - Commander program instance
 * @param createExecutor - Factory function to create MigrationScriptExecutor
 *
 * @example
 * ```bash
 * # Roll back to specific version
 * msr down 202501220100
 * msr rollback 202501220100
 *
 * # With options
 * msr down 202501220100 --logger console --log-level debug
 * ```
 */
export function addDownCommand<DB extends IDB>(
    program: Command,
    createExecutor: () => MigrationScriptExecutor<DB>
): void {
    program
        .command('down <targetVersion>')
        .alias('rollback')
        .description('Roll back migrations to target version')
        .action(async (targetVersion: string) => {
            try {
                const executor = createExecutor();
                const target = parseInt(targetVersion, 10);

                if (isNaN(target)) {
                    console.error(`Error: Invalid target version "${targetVersion}". Must be a number.`);
                    process.exit(EXIT_CODES.GENERAL_ERROR);
                    return;
                }

                const result = await executor.down(target);

                if (result.success) {
                    console.log(`✓ Successfully rolled back ${result.executed.length} migration(s) to version ${target}`);
                    process.exit(EXIT_CODES.SUCCESS);
                } else {
                    console.error(`✗ Rollback failed:`);
                    result.errors?.forEach(error => console.error(`  - ${error.message}`));
                    process.exit(EXIT_CODES.ROLLBACK_FAILED);
                }
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ Rollback error:`, message);
                process.exit(EXIT_CODES.ROLLBACK_FAILED);
            }
        });
}
