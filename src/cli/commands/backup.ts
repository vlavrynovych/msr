import {Command} from 'commander';
import {MigrationScriptExecutor} from '../../service/MigrationScriptExecutor';
import {EXIT_CODES} from '../utils/exitCodes';
import {IDB} from '../../interface';

/**
 * Add backup commands to CLI program.
 *
 * Provides subcommands for backup operations:
 * - create: Create a database backup
 * - restore: Restore from a backup file
 * - delete: Delete backup file
 *
 * @param program - Commander program instance
 * @param createExecutor - Factory function to create MigrationScriptExecutor
 *
 * @example
 * ```bash
 * # Create a backup
 * msr backup create
 *
 * # Restore from specific backup
 * msr backup restore ./backups/backup-2025-01-22.bkp
 *
 * # Restore from most recent backup
 * msr backup restore
 *
 * # Delete backup file
 * msr backup delete
 * ```
 */
export function addBackupCommand<DB extends IDB>(
    program: Command,
    createExecutor: () => MigrationScriptExecutor<DB>
): void {
    const backup = program
        .command('backup')
        .description('Backup and restore operations');

    // backup create
    backup
        .command('create')
        .description('Create a database backup')
        .action(async () => {
            try {
                const executor = createExecutor();
                const backupPath = await executor.createBackup();
                console.log(`✓ Backup created successfully: ${backupPath}`);
                process.exit(EXIT_CODES.SUCCESS);
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ Backup creation failed:`, message);
                process.exit(EXIT_CODES.BACKUP_FAILED);
            }
        });

    // backup restore
    backup
        .command('restore [backupPath]')
        .description('Restore from backup file (uses most recent if path not provided)')
        .action(async (backupPath?: string) => {
            try {
                const executor = createExecutor();
                await executor.restoreFromBackup(backupPath);
                console.log(`✓ Database restored successfully${backupPath ? ` from ${backupPath}` : ' from most recent backup'}`);
                process.exit(EXIT_CODES.SUCCESS);
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ Restore failed:`, message);
                process.exit(EXIT_CODES.RESTORE_FAILED);
            }
        });

    // backup delete
    backup
        .command('delete')
        .description('Delete backup file')
        .action(() => {
            try {
                const executor = createExecutor();
                executor.deleteBackup();
                console.log(`✓ Backup deleted successfully`);
                process.exit(EXIT_CODES.SUCCESS);
            } catch (error) {
                const message = error instanceof Error ? (error.message || String(error)) : String(error);
                console.error(`✗ Delete backup failed:`, message);
                process.exit(EXIT_CODES.GENERAL_ERROR);
            }
        });
}
