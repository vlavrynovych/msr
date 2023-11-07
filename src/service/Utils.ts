import {MigrationScript} from "../model";
import {IRunnableScript} from "../interface";

export class Utils {

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