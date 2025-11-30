/**
 * Test fixture that throws a non-Error object during construction.
 * This is used to test error handling when exceptions are not Error instances.
 */

// This will throw a string (not an Error) when trying to instantiate
export class ThrowsString {
    constructor() {
        throw 'This is a string exception, not an Error object';
    }

    async up() {
        return 'This should never execute';
    }
}
