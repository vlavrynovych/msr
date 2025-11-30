import { expect } from 'chai';
import {IMigrationInfo, IDatabaseMigrationHandler, Utils, SilentLogger} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

describe('Utils', () => {

    describe('promiseAll()', () => {

        /**
         * Test: promiseAll preserves object keys
         * Validates that Utils.promiseAll resolves all promises in a map and returns
         * an object with the same keys. This is critical for the migration system
         * which uses promiseAll to run multiple async operations in parallel.
         */
        it('should preserve object keys', async () => {
            // Create a map with two promises that will resolve to numbers
            const map = {
                a: Promise.resolve(1),
                b: Promise.resolve(2),
            }

            // Execute promiseAll to resolve all promises in parallel
            // TypeScript infers the type as { a: number; b: number }
            const res = await Utils.promiseAll(map);

            // Verify the result object has the same keys with resolved values
            expect(res.a === 1, 'Should have key "a" with 1 as value').is.true
            expect(res.b === 2, 'Should have key "b" with 2 as value').is.true
            expect((res as Record<string, unknown>).c, 'key "c" should be undefined').is.undefined
        })

        /**
         * Test: promiseAll preserves TypeScript types
         * Validates that Utils.promiseAll correctly handles promises of different types
         * (number, string, boolean, array, undefined, custom objects) and maintains
         * type safety after resolution.
         */
        it('should preserve TypeScript types', async () => {
            // Define a custom type to test type preservation
            type T = {a:1, b:2};

            // Create a map with promises resolving to various types
            const map = {
                num: Promise.resolve(1),
                str: Promise.resolve('str'),
                bool: Promise.resolve(true),
                arr: Promise.resolve([]),
                undef: Promise.resolve(),
                custom: Promise.resolve({b:2} as T),
            }

            // Execute promiseAll to resolve all promises
            const res = await Utils.promiseAll(map);

            // Verify each resolved value maintains its correct type
            expect(typeof res.num).eq('number', 'Should have number type')
            expect(typeof res.str).eq('string', 'Should have string type')
            expect(typeof res.bool).eq('boolean', 'Should have boolean type')
            expect(typeof res.arr).eq('object', 'Should have boolean type')
            expect(res.arr instanceof Array, 'Should be an array').is.true
            expect(res.undef, 'Should be undefined').is.undefined

            expect(typeof res.custom).eq('object', 'Should have number type')
            expect(res.custom.a, 'Field a of custom type T should be undefined').is.undefined
            expect(res.custom.b).eq(2, 'Field b of custom type T should have 2 as a value')
        })

        /**
         * Test: promiseAll handles single promise rejection
         * Validates that if one promise in the map rejects, the entire promiseAll
         * operation rejects with that error. This maintains Promise.all behavior
         * which is critical for the migration system's error handling.
         */
        it('should handle single rejected promise', async () => {
            // Create a map where one promise will reject
            const map = {
                a: Promise.resolve(1),
                b: Promise.reject(new Error('Promise B failed')),
                c: Promise.resolve(3)
            }

            // Verify the entire operation rejects with the failing promise's error
            await expect(Utils.promiseAll(map)).to.be.rejectedWith('Promise B failed');
        })

        /**
         * Test: promiseAll handles multiple promise rejections
         * Validates that when multiple promises reject, promiseAll rejects with
         * an error (following Promise.all behavior where first rejection wins).
         */
        it('should handle multiple rejected promises', async () => {
            // Create a map where multiple promises will reject
            const map = {
                a: Promise.reject(new Error('Promise A failed')),
                b: Promise.reject(new Error('Promise B failed')),
                c: Promise.resolve(3)
            }

            // Verify the operation rejects (first rejection wins per Promise.all semantics)
            await expect(Utils.promiseAll(map)).to.be.rejected;
        })

        /**
         * Test: promiseAll handles complete failure
         * Validates error handling when all promises in the map reject.
         * The operation should still reject properly without hanging.
         */
        it('should handle all promises rejected', async () => {
            // Create a map where all promises will reject
            const map = {
                a: Promise.reject(new Error('Error A')),
                b: Promise.reject(new Error('Error B'))
            }

            // Verify the operation rejects when all promises fail
            await expect(Utils.promiseAll(map)).to.be.rejected;
        })

        /**
         * Test: promiseAll handles empty input
         * Validates that passing an empty object returns an empty object.
         * This edge case ensures the function handles "nothing to do" gracefully.
         */
        it('should handle empty object', async () => {
            // Pass an empty map with no promises
            const map = {}

            // Execute promiseAll with empty input
            const res = await Utils.promiseAll(map);

            // Verify it returns an empty object without errors
            expect(Object.keys(res).length).eq(0, 'Should return empty object');
        })

        /**
         * Test: promiseAll preserves error details
         * Validates that when a promise rejects with a custom error object,
         * all error properties (message, name, etc.) are preserved through
         * the rejection. This is important for debugging migration failures.
         */
        it('should preserve rejection error details', async () => {
            // Create a custom error with specific properties
            const customError = new Error('Custom error message');
            customError.name = 'CustomError';
            const map = {
                failing: Promise.reject(customError)
            }

            // Verify the error details are preserved when caught
            try {
                await Utils.promiseAll(map);
                expect.fail('Should have thrown');
            } catch (e: any) {
                expect(e.message).to.include('Custom error message');
            }
        })
    })

    describe('parseRunnable()', () => {

        /**
         * Test: parseRunnable successfully parses valid migration scripts
         * Validates that Utils.parseRunnable can load and instantiate migration script classes
         * from TypeScript files. Tests both single-export and multiple-export scenarios.
         * This is essential for the migration system to dynamically load migration scripts.
         */
        it('should successfully parse valid migration scripts', async () => {
            // Parse a migration script with a single valid export
            const res = await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_valid.ts'), new SilentLogger());

            // Verify the parsed script has the required up() function and can be executed
            expect(res).not.undefined
            expect(typeof res.up === 'function').is.true
            expect(await res.up({ checkConnection: async () => true } as any, {} as IMigrationInfo, {} as IDatabaseMigrationHandler)).eq('result string')

            // Parse a migration script with multiple exports (should still find the valid one)
            const res2 = await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_valid-multiple-exports.ts'), new SilentLogger());

            // Verify the parsed script works correctly even with multiple exports
            expect(res2).not.undefined
            expect(typeof res2.up === 'function').is.true
            expect(await res2.up({ checkConnection: async () => true } as any, {} as IMigrationInfo, {} as IDatabaseMigrationHandler)).eq('result string')
        })

        /**
         * Test: parseRunnable uses default logger when not provided
         * Covers the default parameter branch (line 80) where no logger is passed.
         * Validates that parseRunnable can work without explicit logger parameter,
         * falling back to ConsoleLogger.
         */
        it('should use default logger when not provided', async () => {
            // Parse without providing logger parameter (uses default ConsoleLogger)
            const res = await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_valid.ts'));

            // Verify the script was parsed successfully with default logger
            expect(res).not.undefined
            expect(typeof res.up === 'function').is.true
            expect(await res.up({ checkConnection: async () => true } as any, {} as IMigrationInfo, {} as IDatabaseMigrationHandler)).eq('result string')
        })

        /**
         * Test: parseRunnable handles scripts with no executable content
         * Validates error handling when a migration script file exists but doesn't
         * contain any class with an up() method. This prevents silent failures when
         * developers forget to export their migration class.
         */
        it('should throw error for scripts with no executable content', async () => {
            // Attempt to parse a script with no executable class
            try {
                await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_invalid.ts'), new SilentLogger());
                expect.fail('Should have thrown');
            } catch (e: any) {
                // Verify the error provides a clear, actionable message
                expect(e.message).to.eq("V202311062345_invalid.ts: Cannot parse migration script: no executable content found");
                expect(e).to.be.instanceOf(Error);
            }
        })

        /**
         * Test: parseRunnable handles scripts with multiple executable instances
         * Validates error handling when a migration script contains multiple classes
         * with up() methods. This prevents ambiguity about which migration to run.
         */
        it('should throw error for scripts with multiple executable instances', async () => {
            // Attempt to parse a script with multiple executable classes
            try {
                await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_invalid-multiple-exports.ts'), new SilentLogger());
                expect.fail('Should have thrown');
            } catch (e: any) {
                // Verify the error indicates the ambiguity problem
                expect(e.message).to.eq("V202311062345_invalid-multiple-exports.ts: Cannot parse migration script: multiple executable instances were found");
                expect(e).to.be.instanceOf(Error);
            }
        })

        /**
         * Test: parseRunnable handles scripts with syntax/parse errors
         * Validates error handling when a migration script has TypeScript syntax errors
         * or other parsing issues. The error message should include details about
         * what went wrong to help developers debug.
         */
        it('should throw error for scripts with parse errors', async () => {
            // Attempt to parse a script with syntax errors
            try {
                await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_invalid-parse-error.ts'), new SilentLogger());
                expect.fail('Should have thrown');
            } catch (e: any) {
                // Verify the error includes parse error details
                expect(e.message).to.eq("V202311062345_invalid-parse-error.ts: Cannot parse migration script: TypeError: clazz is not a constructor");
                expect(e).to.be.instanceOf(Error);
            }
        })
    })
})
