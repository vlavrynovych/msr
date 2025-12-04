import _ from 'lodash';
import {MigrationScript} from "../model/MigrationScript";
import {IDB} from "../interface/dao";

/**
 * Service for determining which migration scripts should be executed.
 *
 * Responsible for filtering and categorizing migration scripts based on
 * their execution status and timestamps. Separates scripts into those that
 * should be executed, those already executed, and those ignored.
 *
 *
 * @template DB - Database interface type
 * @example
 * ```typescript
 * const selector = new MigrationScriptSelector<DB>();
 *
 * const pending = selector.getPending(migratedScripts, allScripts);
 * const ignored = selector.getIgnored(migratedScripts, allScripts);
 * ```
 */
export class MigrationScriptSelector<DB extends IDB> {

    /**
     * Determine which migration scripts are pending execution.
     *
     * Compares all discovered migration files against already-executed migrations
     * and returns only those that:
     * 1. Haven't been executed yet
     * 2. Have a timestamp newer than the last executed migration
     *
     * Scripts with timestamps older than the last migration are considered ignored
     * (these represent out-of-order migrations that won't be run).
     *
     * @param migrated - Array of previously executed migrations from the database
     * @param all - Array of all migration script files discovered in the migrations folder
     * @returns Array of migration scripts pending execution
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const selector = new MigrationScriptSelector<DB>();
     * const migratedScripts = await schemaVersionService.getAllMigratedScripts();
     * const allScripts = await migrationService.readMigrationScripts(config);
     *
     * const pendingScripts = selector.getPending(migratedScripts, allScripts);
     * console.log(`${pendingScripts.length} migrations pending execution`);
     * ```
     */
    getPending(migrated: MigrationScript<DB>[], all: MigrationScript<DB>[]): MigrationScript<DB>[] {
        if (!migrated.length) return all;

        const lastMigrated: number = Math.max(...migrated.map(s => s.timestamp));
        const newScripts: MigrationScript<DB>[] = _.differenceBy(all, migrated, 'timestamp');
        const pending: MigrationScript<DB>[] = newScripts.filter(s => s.timestamp > lastMigrated);

        return pending;
    }

    /**
     * Get scripts that were ignored due to being older than the last migration.
     *
     * Returns migration scripts that have timestamps older than the last executed
     * migration. These represent out-of-order migrations that won't be executed.
     *
     * @param migrated - Array of previously executed migrations from the database
     * @param all - Array of all migration script files discovered in the migrations folder
     * @returns Array of ignored migration scripts
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const selector = new MigrationScriptSelector<DB>();
     * const ignoredScripts = selector.getIgnored(migratedScripts, allScripts);
     *
     * if (ignoredScripts.length > 0) {
     *   console.warn(`${ignoredScripts.length} migrations ignored (older than last executed)`);
     * }
     * ```
     */
    getIgnored(migrated: MigrationScript<DB>[], all: MigrationScript<DB>[]): MigrationScript<DB>[] {
        if (!migrated.length) return [];

        const lastMigrated: number = Math.max(...migrated.map(s => s.timestamp));
        const newScripts: MigrationScript<DB>[] = _.differenceBy(all, migrated, 'timestamp');
        const pending: MigrationScript<DB>[] = newScripts.filter(s => s.timestamp > lastMigrated);

        return _.differenceBy(newScripts, pending, 'timestamp');
    }

    /**
     * Get pending migrations up to a specific target version.
     *
     * Returns migrations that need to be executed to reach the target version,
     * filtered to only include those with timestamps <= targetVersion.
     *
     * @param migrated - Array of previously executed migrations from the database
     * @param all - Array of all migration script files discovered in the migrations folder
     * @param targetVersion - The target version timestamp to migrate to
     * @returns Array of migration scripts to execute, sorted by timestamp
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const selector = new MigrationScriptSelector<DB>();
     * // Migrate up to version 202501220100
     * const toExecute = selector.getPendingUpTo(migratedScripts, allScripts, 202501220100);
     * console.log(`Will execute ${toExecute.length} migrations to reach version 202501220100`);
     * ```
     */
    getPendingUpTo(migrated: MigrationScript<DB>[], all: MigrationScript<DB>[], targetVersion: number): MigrationScript<DB>[] {
        const pending = this.getPending(migrated, all);
        return pending.filter(s => s.timestamp <= targetVersion).sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Get executed migrations that need to be rolled back to reach a target version.
     *
     * Returns migrations that have been executed and have timestamps greater than
     * the target version. These need to have their down() methods called in reverse
     * chronological order.
     *
     * @param migrated - Array of previously executed migrations from the database
     * @param targetVersion - The target version timestamp to downgrade to
     * @returns Array of migration scripts to roll back, sorted in reverse chronological order
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const selector = new MigrationScriptSelector<DB>();
     * // Roll back to version 202501220100
     * const toRollback = selector.getMigratedDownTo(migratedScripts, 202501220100);
     * console.log(`Will roll back ${toRollback.length} migrations to reach version 202501220100`);
     * // Scripts are returned newest-first for proper rollback order
     * ```
     */
    getMigratedDownTo(migrated: MigrationScript<DB>[], targetVersion: number): MigrationScript<DB>[] {
        return migrated
            .filter(s => s.timestamp > targetVersion)
            .sort((a, b) => b.timestamp - a.timestamp); // Reverse chronological order for rollback
    }

    /**
     * Get executed migrations between two version ranges.
     *
     * Returns migrations that were executed between fromVersion (exclusive) and
     * toVersion (inclusive). Used for partial rollbacks or selective migration operations.
     *
     * @param migrated - Array of previously executed migrations from the database
     * @param fromVersion - The starting version (exclusive - migrations after this)
     * @param toVersion - The ending version (inclusive - migrations up to and including this)
     * @returns Array of migration scripts in the range, sorted in reverse chronological order
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const selector = new MigrationScriptSelector<DB>();
     * // Get migrations between versions for selective rollback
     * const range = selector.getMigratedInRange(migratedScripts, 202501220100, 202501230100);
     * console.log(`Found ${range.length} migrations in version range`);
     * ```
     */
    getMigratedInRange(migrated: MigrationScript<DB>[], fromVersion: number, toVersion: number): MigrationScript<DB>[] {
        return migrated
            .filter(s => s.timestamp > fromVersion && s.timestamp <= toVersion)
            .sort((a, b) => b.timestamp - a.timestamp); // Reverse chronological order
    }
}
