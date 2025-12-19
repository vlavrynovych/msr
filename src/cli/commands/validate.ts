import {Command} from 'commander';
import {MigrationScriptExecutor} from '../../service/MigrationScriptExecutor';
import {EXIT_CODES} from '../utils/exitCodes';
import {IDB} from '../../interface';
import {ValidationIssueType} from '../../model/ValidationIssueType';

/**
 * Add validate command to CLI program.
 *
 * Validates all migration scripts without executing them.
 * Checks pending migrations structure and executed migrations integrity.
 *
 * @param program - Commander program instance
 * @param createExecutor - Factory function to create MigrationScriptExecutor
 *
 * @example
 * ```bash
 * # Validate all migrations
 * msr validate
 *
 * # With options
 * msr validate --logger console --log-level debug
 * ```
 */
export function addValidateCommand<DB extends IDB>(
    program: Command,
    createExecutor: () => Promise<MigrationScriptExecutor<DB>>
): void {
    program
        .command('validate')
        .description('Validate migration scripts without executing them')
        .action(async () => {
            try {
                const executor = await createExecutor();
                const results = await executor.validate();

                const pendingCount = results.pending.length;
                const migratedCount = results.migrated.length;

                const pendingErrors = results.pending.filter(r =>
                    r.issues.some(issue => issue.type === ValidationIssueType.ERROR)
                ).length;
                const migratedErrors = results.migrated.filter(issue =>
                    issue.type === ValidationIssueType.ERROR
                ).length;

                console.log(`\nValidation Results:`);
                console.log(`  Pending migrations validated: ${pendingCount}`);
                console.log(`  Pending migrations with errors: ${pendingErrors}`);
                console.log(`  Executed migrations validated: ${migratedCount}`);
                console.log(`  Executed migrations with issues: ${migratedCount}`);

                if (pendingErrors > 0 || migratedErrors > 0) {
                    console.error(`\n✗ Validation failed`);
                    process.exit(EXIT_CODES.VALIDATION_ERROR);
                } else {
                    console.log(`\n✓ All migrations are valid`);
                    process.exit(EXIT_CODES.SUCCESS);
                }
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ Validation error:`, message);
                process.exit(EXIT_CODES.VALIDATION_ERROR);
            }
        });
}
