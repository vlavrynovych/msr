import {MigrationScript} from "../model";
import {IRunnableScript} from "../interface";

/**
 * Utility functions for the migration system.
 *
 * Provides helper methods for asynchronous operations and migration script parsing.
 */
export class Utils {

    /**
     * Resolve all promises in an object, preserving keys.
     *
     * Similar to `Promise.all()` but works with objects instead of arrays.
     * Resolves all promise values and returns an object with the same keys
     * containing the resolved values.
     *
     * @template T - Object type with promise values
     * @param map - Object where values are promises
     * @returns Object with same keys but resolved values
     *
     * @throws {Error} If any promise rejects, the entire operation rejects
     *
     * @example
     * ```typescript
     * const result = await Utils.promiseAll({
     *   users: fetchUsers(),
     *   posts: fetchPosts(),
     *   comments: fetchComments()
     * });
     * // result = { users: [...], posts: [...], comments: [...] }
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static async promiseAll<T extends {[key: string]: Promise<any>}>(map:T):
        Promise<{ [K in keyof T]: T[K] extends Promise<infer R> ? R : never }> {
        const keys = Object.keys(map);
        const result = {} as { [K in keyof T]: T[K] extends Promise<infer R> ? R : never };

        await Promise.all(
            keys.map(async (key) => {
                result[key as keyof T] = await map[key as keyof T] as T[keyof T] extends Promise<infer R> ? R : never;
            })
        );

        return result;
    }

    /**
     * Dynamically import and instantiate a migration script from a file.
     *
     * Loads the migration script file, finds the exported class that implements
     * {@link IRunnableScript}, instantiates it, and returns the instance.
     *
     * The script file must:
     * - Export exactly one class with an `up()` method
     * - Not export multiple executable classes
     *
     * @param script - MigrationScript object containing the filepath to load
     *
     * @returns Instantiated migration script object with `up()` method
     *
     * @throws {Error} If no executable content found (no class with up() method)
     * @throws {Error} If multiple executable instances found (ambiguous export)
     * @throws {Error} If the file cannot be parsed or imported
     *
     * @example
     * ```typescript
     * const script = new MigrationScript(
     *   'V202501220100_test.ts',
     *   '/path/to/V202501220100_test.ts',
     *   202501220100
     * );
     *
     * const runnable = await Utils.parseRunnable(script);
     * // Now can call: await runnable.up(db, info, handler)
     * ```
     */
    public static async parseRunnable(script:MigrationScript):Promise<IRunnableScript> | never {
        const exports = await import(script.filepath);
        const runnable:IRunnableScript[] = [];
        const errorPrefix:string = `${script.name}: Cannot parse migration script`

        for(const key in exports) {
            try {
                const clazz = exports[key];
                const instance = new clazz();
                const hasUpFunction = instance.up && typeof instance.up === 'function'
                if(hasUpFunction) {
                    runnable.push(instance as IRunnableScript)
                } else {
                    console.warn(`${errorPrefix}: the 'up()' function was not found`)
                }
            } catch (e) {
                console.error(e);
                throw new Error(`${errorPrefix}: ${e}`)
            }
        }

        if(!runnable.length) throw new Error(`${errorPrefix}: no executable content found`)
        if(runnable.length > 1) throw new Error(`${errorPrefix}: multiple executable instances were found`)

        return runnable[0];
    }
}