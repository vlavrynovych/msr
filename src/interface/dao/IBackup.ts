/**
 * Interface for database backup and restore operations.
 *
 * This interface provides backup and restore functionality for database migration rollback.
 * Implementations can use file-based backups, in-memory snapshots, or database-native
 * backup mechanisms depending on the database system.
 *
 * @example
 * ```typescript
 * // File-based backup implementation (PostgreSQL/MySQL)
 * export class FileBackup implements IBackup {
 *   async backup(): Promise<string> {
 *     const timestamp = Date.now();
 *     const backupPath = `/backups/db-${timestamp}.sql`;
 *     await exec(`pg_dump mydb > ${backupPath}`);
 *     return backupPath;
 *   }
 *
 *   async restore(backupData: string): Promise<void> {
 *     // backupData is file path
 *     await exec(`psql mydb < ${backupData}`);
 *   }
 * }
 *
 * // Content-based backup implementation (SQLite/MongoDB)
 * export class ContentBackup implements IBackup {
 *   async backup(): Promise<string> {
 *     const data = await this.db.serialize();
 *     return JSON.stringify(data);
 *   }
 *
 *   async restore(backupData: string): Promise<void> {
 *     // backupData is serialized content
 *     const data = JSON.parse(backupData);
 *     await this.db.restore(data);
 *   }
 * }
 * ```
 */
export interface IBackup {
    /**
     * Create a backup of the current database state.
     *
     * Returns a string identifier that can be used to restore this backup later.
     * The return value format depends on the implementation:
     * - File-based: Returns absolute file path to backup file
     * - Content-based: Returns serialized database content
     * - Cloud-based: Returns backup ID or URL
     *
     * @returns Promise<string> - Backup identifier (file path, content, or ID)
     *
     * @example
     * ```typescript
     * // File-based backup
     * const backupPath = await backup.backup();
     * console.log(`Backup created: ${backupPath}`);
     * // Returns: "/backups/db-1706123456789.sql"
     *
     * // Content-based backup
     * const backupData = await backup.backup();
     * console.log(`Backup size: ${backupData.length} bytes`);
     * // Returns: "{\"collections\":[...]}"
     * ```
     */
    backup(): Promise<string>

    /**
     * Restore database from a backup.
     *
     * The backupData parameter format depends on the implementation:
     * - File-based implementations: Expects file path to backup file
     * - Content-based implementations: Expects serialized database content
     * - Cloud-based implementations: Expects backup ID or URL
     *
     * @param backupData - Backup identifier (file path, serialized content, or backup ID)
     * @returns Promise<void> - Resolves when restore completes
     *
     * @throws {Error} If backup cannot be found or restore fails
     *
     * @example
     * ```typescript
     * // File-based restore
     * await backup.restore('/backups/db-1706123456789.sql');
     *
     * // Content-based restore
     * await backup.restore(backupContentString);
     *
     * // Cloud-based restore
     * await backup.restore('backup-id-12345');
     * ```
     */
    restore(backupData: string): Promise<void>;
}