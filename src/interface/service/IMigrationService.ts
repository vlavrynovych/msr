import {Config, MigrationScript} from "../../model";
import {IDB} from "../dao";

/**
 * Service interface for discovering and loading migration script files.
 *
 * Implementations scan the filesystem for migration files matching configured patterns,
 * parse filenames to extract timestamps and names, and locate special scripts like
 * beforeMigrate.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * const migrationService = new MigrationService<IDB>(logger);
 * const config = new Config();
 *
 * // Find all migration scripts
 * const scripts = await migrationService.findMigrationScripts(config);
 * console.log(`Found ${scripts.length} migration files`);
 *
 * // Find beforeMigrate script if it exists
 * const beforeMigrate = await migrationService.findBeforeMigrateScript(config);
 * if (beforeMigrate) {
 *   console.log(`Found setup script: ${beforeMigrate}`);
 * }
 * ```
 */
export interface IMigrationService<DB extends IDB> {
    /**
     * Find and parse all migration script files in the configured folder.
     *
     * Scans the migrations folder for files matching the configured file patterns,
     * extracts timestamp and name from each filename, and returns MigrationScript
     * objects sorted chronologically.
     *
     * Files must match the pattern: V{timestamp}_{name}.{ext}
     * Example: V202501220100_create_users.ts
     *
     * @param cfg - Configuration with folder path and file patterns
     * @returns Promise<MigrationScript<DB>[]> - Array of discovered migrations sorted by timestamp (typed with generic DB parameter in v0.6.0)
     *
     * @example
     * ```typescript
     * const config = new Config();
     * config.folder = './migrations';
     * config.filePatterns = [/^V(\d{12})_.*\.ts$/];
     *
     * const scripts = await migrationService.findMigrationScripts(config);
     * scripts.forEach(script => {
     *   console.log(`${script.timestamp}: ${script.name} (${script.filepath})`);
     * });
     * ```
     */
    findMigrationScripts(cfg: Config): Promise<MigrationScript<DB>[]>

    /**
     * Find the beforeMigrate setup script if it exists.
     *
     * Looks for a special beforeMigrate.ts or beforeMigrate.js file in the migrations
     * folder. This script runs before any migrations and is typically used for database
     * reset or setup operations.
     *
     * @param cfg - Configuration with folder path
     * @returns Promise<string | undefined> - Absolute path to beforeMigrate script, or undefined if not found
     *
     * @example
     * ```typescript
     * const config = new Config();
     * config.folder = './migrations';
     * config.beforeMigrateName = 'beforeMigrate';
     *
     * const scriptPath = await migrationService.findBeforeMigrateScript(config);
     * if (scriptPath) {
     *   console.log(`Found setup script: ${scriptPath}`);
     *   // Execute the setup script before running migrations
     * } else {
     *   console.log('No beforeMigrate script found');
     * }
     * ```
     */
    findBeforeMigrateScript(cfg: Config): Promise<string | undefined>
}