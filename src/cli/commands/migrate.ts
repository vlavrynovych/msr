import {Command} from 'commander';
import {MigrationScriptExecutor} from '../../service/MigrationScriptExecutor';
import {EXIT_CODES} from '../utils/exitCodes';
import {IDB} from '../../interface';

/**
 * Add migrate command to CLI program.
 *
 * Executes pending database migrations. Can optionally target a specific version.
 *
 * @param program - Commander program instance
 * @param createExecutor - Factory function to create MigrationScriptExecutor
 *
 * @example
 * ```bash
 * # Run all pending migrations
 * msr migrate
 *
 * # Migrate to specific version
 * msr migrate 202501220100
 *
 * # With options
 * msr migrate --dry-run --logger console --log-level debug
 * ```
 */
export function addMigrateCommand<DB extends IDB>(
    program: Command,
    createExecutor: () => MigrationScriptExecutor<DB>
): void {
    program
        .command('migrate [targetVersion]')
        .alias('up')
        .description('Run pending migrations')
        .action(async (targetVersion?: string) => {
            try {
                const executor = createExecutor();
                const target = targetVersion ? parseInt(targetVersion, 10) : undefined;

                if (targetVersion && isNaN(target!)) {
                    console.error(`Error: Invalid target version "${targetVersion}". Must be a number.`);
                    process.exit(EXIT_CODES.GENERAL_ERROR);
                    return;
                }

                const result = await executor.migrate(target);

                if (result.success) {
                    console.log(`✓ Successfully executed ${result.executed.length} migration(s)`);
                    process.exit(EXIT_CODES.SUCCESS);
                } else {
                    console.error(`✗ Migration failed:`);
                    result.errors?.forEach(error => console.error(`  - ${error.message}`));
                    process.exit(EXIT_CODES.MIGRATION_FAILED);
                }
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ Migration error:`, message);
                process.exit(EXIT_CODES.MIGRATION_FAILED);
            }
        });
}
