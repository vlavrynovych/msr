import {IMigrationScanner} from "../interface/service/IMigrationScanner";
import {IScripts} from "../interface/IScripts";
import {IMigrationService} from "../interface/service/IMigrationService";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {MigrationScriptSelector} from "./MigrationScriptSelector";
import {Utils} from "./Utils";
import {Config} from "../model";
import {IDB} from "../interface/dao";

/**
 * Service for scanning and gathering the complete state of migrations.
 *
 * MigrationScanner orchestrates the collection of migration state by:
 * - Querying the database for executed migrations
 * - Reading migration script files from the filesystem
 * - Using MigrationScriptSelector to determine pending and ignored migrations
 *
 * This provides a clear separation between "gathering state" and "executing migrations",
 * making the code more testable and following the Single Responsibility Principle.
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
 * console.log(`Pending: ${scripts.pending.length}`);
 * console.log(`Ignored: ${scripts.ignored.length}`);
 * ```
 */
export class MigrationScanner<DB extends IDB> implements IMigrationScanner<DB> {
    /**
     * Creates a new MigrationScanner instance.
     *
     * @param migrationService - Service for reading migration files from filesystem (typed with generic DB parameter in v0.6.0)
     * @param schemaVersionService - Service for querying executed migrations from database (typed with generic DB parameter in v0.6.0)
     * @param selector - Service for determining which migrations are pending/ignored (typed with generic DB parameter in v0.6.0)
     * @param config - Configuration for migrations (folder, pattern, etc.)
     */
    constructor(
        private readonly migrationService: IMigrationService<DB>,
        private readonly schemaVersionService: ISchemaVersionService<DB>,
        private readonly selector: MigrationScriptSelector<DB>,
        private readonly config: Config
    ) {}

    /**
     * Scan and gather the complete state of migrations.
     *
     * This method performs the following steps:
     * 1. Queries database for all executed migrations
     * 2. Reads all migration script files from filesystem
     * 3. Determines which scripts are pending (newer than last executed)
     * 4. Determines which scripts are ignored (older than last executed)
     *
     * @returns Promise resolving to complete migration state
     *
     * @throws Error if filesystem scan fails
     * @throws Error if database query fails
     *
     * @example
     * ```typescript
     * const scripts = await scanner.scan();
     *
     * // Complete migration state
     * scripts.all       // All files found
     * scripts.migrated  // Previously executed
     * scripts.pending   // Waiting to execute
     * scripts.ignored   // Skipped (too old)
     * scripts.executed  // Empty (filled during execution)
     * ```
     */
    async scan(): Promise<IScripts<DB>> {
        // Gather information from database and filesystem in parallel
        const {migrated, all} = await Utils.promiseAll({
            migrated: this.schemaVersionService.getAllMigratedScripts(),
            all: this.migrationService.findMigrationScripts(this.config)
        }) as IScripts<DB>;

        // Determine which migrations should be executed and which should be ignored
        const pending = this.selector.getPending(migrated, all);
        const ignored = this.selector.getIgnored(migrated, all);

        // Return complete migration state
        return {
            all,
            migrated,
            pending,
            ignored,
            executed: []  // Will be populated during migration execution
        };
    }
}
