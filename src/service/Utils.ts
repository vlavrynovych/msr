export class Utils {

    public static async promiseAll<T extends {[key: string]: Promise<any>}>(map:T):
        Promise<{ [K in keyof T]: T[K] extends Promise<infer R> ? R : never }> {
        const keys = Object.keys(map);
        const result = {} as { [K in keyof T]: T[K] extends Promise<infer R> ? R : never };

        await Promise.all(
            keys.map(async (key) => {
                const value = await map[key as keyof T] as T[keyof T] extends Promise<infer R> ? R : never;
                result[key as keyof T] = value;
            })
        );

        return result;
    }
}