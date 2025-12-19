import {Command} from 'commander';
import {MigrationScriptExecutor} from '../../service/MigrationScriptExecutor';
import {EXIT_CODES} from '../utils/exitCodes';
import {IDB} from '../../interface';

/**
 * Add list command to CLI program.
 *
 * Lists all migrations with their execution status.
 *
 * @param program - Commander program instance
 * @param createExecutor - Factory function to create MigrationScriptExecutor (returns Promise in v0.8.2+)
 *
 * @example
 * ```bash
 * # List all migrations
 * msr list
 *
 * # List only the last 10 migrations
 * msr list --number 10
 * msr list -n 10
 *
 * # With options
 * msr list --logger console --format table
 * ```
 */
export function addListCommand<DB extends IDB>(
    program: Command,
    createExecutor: () => Promise<MigrationScriptExecutor<DB>>
): void {
    program
        .command('list')
        .description('List all migrations with status')
        .option('-n, --number <count>', 'Number of migrations to display (0=all)', '0')
        .action(async (options: { number: string }) => {
            try {
                const executor = await createExecutor();
                const count = parseInt(options.number, 10);

                if (isNaN(count) || count < 0) {
                    console.error(`Error: Invalid number "${options.number}". Must be a non-negative integer.`);
                    process.exit(EXIT_CODES.GENERAL_ERROR);
                    return;
                }

                await executor.list(count);
                process.exit(EXIT_CODES.SUCCESS);
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ List error:`, message);
                process.exit(EXIT_CODES.GENERAL_ERROR);
            }
        });
}
