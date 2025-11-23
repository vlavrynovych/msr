import _ from 'lodash';
import {MigrationScript} from "../model/MigrationScript";

/**
 * Service for determining which migration scripts should be executed.
 *
 * Responsible for filtering and categorizing migration scripts based on
 * their execution status and timestamps. Separates scripts into those that
 * should be executed, those already executed, and those ignored.
 *
 * @example
 * ```typescript
 * const selector = new MigrationScriptSelector();
 *
 * const pending = selector.getPending(migratedScripts, allScripts);
 * const ignored = selector.getIgnored(migratedScripts, allScripts);
 * ```
 */
export class MigrationScriptSelector {

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
     * @example
     * ```typescript
     * const selector = new MigrationScriptSelector();
     * const migratedScripts = await schemaVersionService.getAllMigratedScripts();
     * const allScripts = await migrationService.readMigrationScripts(config);
     *
     * const pendingScripts = selector.getPending(migratedScripts, allScripts);
     * console.log(`${pendingScripts.length} migrations pending execution`);
     * ```
     */
    getPending(migrated: MigrationScript[], all: MigrationScript[]): MigrationScript[] {
        if (!migrated.length) return all;

        const lastMigrated: number = Math.max(...migrated.map(s => s.timestamp));
        const newScripts: MigrationScript[] = _.differenceBy(all, migrated, 'timestamp');
        const pending: MigrationScript[] = newScripts.filter(s => s.timestamp > lastMigrated);

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
     * @example
     * ```typescript
     * const selector = new MigrationScriptSelector();
     * const ignoredScripts = selector.getIgnored(migratedScripts, allScripts);
     *
     * if (ignoredScripts.length > 0) {
     *   console.warn(`${ignoredScripts.length} migrations ignored (older than last executed)`);
     * }
     * ```
     */
    getIgnored(migrated: MigrationScript[], all: MigrationScript[]): MigrationScript[] {
        if (!migrated.length) return [];

        const lastMigrated: number = Math.max(...migrated.map(s => s.timestamp));
        const newScripts: MigrationScript[] = _.differenceBy(all, migrated, 'timestamp');
        const pending: MigrationScript[] = newScripts.filter(s => s.timestamp > lastMigrated);

        return _.differenceBy(newScripts, pending, 'timestamp');
    }
}
