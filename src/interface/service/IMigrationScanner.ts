import {IScripts} from "../IScripts";
import {IDB} from "../dao";

/**
 * Interface for scanning and gathering migration state.
 *
 * The migration scanner is responsible for collecting the complete picture of
 * migration state by querying both the database (for executed migrations) and
 * the filesystem (for available migration scripts), then determining which
 * migrations are pending, ignored, or already executed.
 *
 * This provides a clear separation between gathering migration state and
 * executing migrations.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const scanner = new MigrationScanner<IDB>(
 *     migrationService,
 *     schemaVersionService,
 *     selector,
 *     config
 * );
 *
 * const scripts = await scanner.scan();
 * console.log(`Found ${scripts.pending.length} pending migrations`);
 * console.log(`Found ${scripts.ignored.length} ignored migrations`);
 * ```
 */
export interface IMigrationScanner<DB extends IDB> {
    /**
     * Scan and gather the complete state of migrations.
     *
     * This method:
     * 1. Retrieves all executed migrations from the database
     * 2. Reads all migration script files from the filesystem
     * 3. Determines which scripts are pending (to be executed)
     * 4. Determines which scripts are ignored (older than last executed)
     *
     * @returns Promise resolving to complete migration state including (typed with generic DB parameter in v0.6.0):
     *   - all: All migration scripts found in filesystem
     *   - migrated: Previously executed migrations from database
     *   - pending: Migrations waiting to be executed
     *   - ignored: Migrations skipped (older than last executed)
     *   - executed: Empty array (populated later during execution)
     *
     * @throws Error if filesystem scan fails
     * @throws Error if database query fails
     */
    scan(): Promise<IScripts<DB>>;
}
