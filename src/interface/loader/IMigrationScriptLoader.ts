import {IRunnableScript} from '../IRunnableScript';
import {MigrationScript} from '../../model/MigrationScript';

/**
 * Interface for loading migration scripts from different file types.
 *
 * Implementations handle specific file formats (TypeScript, JavaScript, SQL, etc.)
 * and convert them into IRunnableScript instances that MSR can execute.
 *
 * @example
 * ```typescript
 * class TypeScriptLoader implements IMigrationScriptLoader {
 *     canHandle(filePath: string): boolean {
 *         return /\.(ts|js)$/i.test(filePath);
 *     }
 *
 *     async load(script: MigrationScript): Promise<IRunnableScript> {
 *         const exports = await import(script.filepath);
 *         return new exports.default();
 *     }
 *
 *     getName(): string {
 *         return 'TypeScriptLoader';
 *     }
 * }
 * ```
 */
export interface IMigrationScriptLoader {
    /**
     * Check if this loader can handle the given file.
     *
     * Typically checks file extension or naming pattern to determine
     * if this loader is appropriate for loading the migration file.
     *
     * @param filePath - Absolute path to the migration file
     * @returns true if this loader supports the file type, false otherwise
     *
     * @example
     * ```typescript
     * // TypeScript loader
     * canHandle('/migrations/V123_create.ts') // returns true
     * canHandle('/migrations/V123_create.sql') // returns false
     *
     * // SQL loader
     * canHandle('/migrations/V123_create.up.sql') // returns true
     * canHandle('/migrations/V123_create.ts') // returns false
     * ```
     */
    canHandle(filePath: string): boolean;

    /**
     * Load migration script from file and return IRunnableScript.
     *
     * This method is responsible for:
     * 1. Reading the migration file content
     * 2. Parsing/processing the content appropriately for the file type
     * 3. Creating an IRunnableScript instance that MSR can execute
     *
     * The returned IRunnableScript must implement:
     * - `up()` method (required) - Forward migration logic
     * - `down()` method (optional) - Rollback logic
     *
     * @param script - MigrationScript with filepath and metadata
     * @returns IRunnableScript instance ready for execution
     * @throws Error if file cannot be loaded, parsed, or is invalid
     *
     * @example
     * ```typescript
     * const script = new MigrationScript('V123_create.ts', 123, '/path/to/file');
     * const runnable = await loader.load(script);
     *
     * // Execute the migration
     * await runnable.up(db, info, handler);
     * ```
     */
    load(script: MigrationScript): Promise<IRunnableScript>;

    /**
     * Get loader name for logging and debugging purposes.
     *
     * @returns Human-readable loader name
     *
     * @example
     * ```typescript
     * getName() // returns 'TypeScriptLoader'
     * getName() // returns 'SqlLoader'
     * getName() // returns 'JavaScriptLoader'
     * ```
     */
    getName(): string;
}
