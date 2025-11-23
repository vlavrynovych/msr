import {IMigrationInfo, IRunnableScript} from "../interface";
import {Utils} from "../service/Utils";

/**
 * Represents a migration script file discovered in the migrations directory.
 *
 * Extends {@link IMigrationInfo} with file path and script loading functionality.
 * Each migration script is identified by its timestamp, name, and file location.
 *
 * @example
 * ```typescript
 * const script = new MigrationScript(
 *   'V202501220100_initial_setup.ts',
 *   '/path/to/migrations/V202501220100_initial_setup.ts',
 *   202501220100
 * );
 * await script.init(); // Load and parse the script
 * ```
 */
export class MigrationScript extends IMigrationInfo {

    /**
     * Absolute path to the migration script file.
     * @readonly
     */
    public readonly filepath!:string;

    /**
     * Parsed and instantiated migration script object.
     * Contains the `up()` method that executes the migration.
     * Populated after calling {@link init}.
     */
    public script!: IRunnableScript;

    /**
     * Creates a new MigrationScript instance.
     *
     * @param name - Filename of the migration script (e.g., 'V202501220100_initial_setup.ts')
     * @param filepath - Absolute path to the migration file
     * @param timestamp - Numeric timestamp extracted from the filename (e.g., 202501220100)
     */
    constructor(name: string,
                filepath: string,
                timestamp: number) {
        super();
        this.name = name;
        this.filepath = filepath;
        this.timestamp = timestamp;
    }

    /**
     * Load and parse the migration script file.
     *
     * Dynamically imports the migration file and instantiates the exported class.
     * The script must export a class that implements {@link IRunnableScript} with an `up()` method.
     *
     * @throws {Error} If the file cannot be parsed, doesn't export a valid migration class,
     *                 or exports multiple migration classes.
     *
     * @example
     * ```typescript
     * const script = new MigrationScript('V202501220100_test.ts', '/path/to/file.ts', 202501220100);
     * await script.init();
     * // Now script.script contains the loaded migration with up() method
     * await script.script.up(db, info, handler);
     * ```
     */
    async init():Promise<void> {
        this.script = await Utils.parseRunnable(this)
    }
}