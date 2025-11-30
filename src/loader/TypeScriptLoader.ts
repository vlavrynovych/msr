import {IMigrationScriptLoader} from '../interface/loader/IMigrationScriptLoader';
import {IRunnableScript} from '../interface/IRunnableScript';
import {MigrationScript} from '../model/MigrationScript';
import {ILogger} from '../interface/ILogger';
import {ConsoleLogger} from '../logger/ConsoleLogger';

/**
 * Loader for TypeScript and JavaScript migration files.
 *
 * Handles `.ts` and `.js` files using dynamic import and instantiation.
 * This is the default loader that maintains backward compatibility with
 * existing MSR TypeScript migrations.
 *
 * @example
 * ```typescript
 * const loader = new TypeScriptLoader();
 * const script = new MigrationScript('V123_create.ts', '/path/to/file', 123);
 * const runnable = await loader.load(script);
 * await runnable.up(db, info, handler);
 * ```
 */
export class TypeScriptLoader implements IMigrationScriptLoader {
    constructor(private readonly logger: ILogger = new ConsoleLogger()) {}

    /**
     * Check if this loader can handle TypeScript or JavaScript files.
     *
     * @param filePath - Path to the migration file
     * @returns true if file has .ts or .js extension
     */
    canHandle(filePath: string): boolean {
        return /\.(ts|js)$/i.test(filePath);
    }

    /**
     * Load TypeScript/JavaScript migration using dynamic import.
     *
     * This method:
     * 1. Dynamically imports the migration file
     * 2. Searches exports for a class with an up() method
     * 3. Instantiates the class
     * 4. Returns the instance as IRunnableScript
     *
     * @param script - Migration script to load
     * @returns IRunnableScript instance
     * @throws Error if no executable content found or multiple exports found
     */
    async load(script: MigrationScript): Promise<IRunnableScript> {
        const exports = await import(script.filepath);
        const runnable: IRunnableScript[] = [];
        const errorPrefix = `${script.name}: Cannot parse migration script`;

        for (const key in exports) {
            try {
                const clazz = exports[key];
                const instance = new clazz();
                const hasUpFunction = instance.up && typeof instance.up === 'function';

                if (hasUpFunction) {
                    runnable.push(instance as IRunnableScript);
                } else {
                    this.logger.warn(`${errorPrefix}: the 'up()' function was not found`);
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                this.logger.error(errorMsg);
                throw new Error(`${errorPrefix}: ${errorMsg}`);
            }
        }

        if (!runnable.length) {
            throw new Error(`${errorPrefix}: no executable content found`);
        }

        if (runnable.length > 1) {
            throw new Error(`${errorPrefix}: multiple executable instances were found`);
        }

        return runnable[0];
    }

    /**
     * Get loader name for logging and debugging.
     *
     * @returns 'TypeScriptLoader'
     */
    getName(): string {
        return 'TypeScriptLoader';
    }
}
