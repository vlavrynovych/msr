import {MigrationScript} from "../../src";
import {TestConfig} from "./TestConfig";

// Note: chai plugins are now configured globally in test/setup.ts
// No need to configure them here

export class TestUtils {
    public static EMPTY_FOLDER = `${process.cwd()}/test/fixtures/migrations-empty`
    public static DEFAULT_FOLDER = `${process.cwd()}/test/fixtures/migrations-test`
    public static RECURSIVE_FOLDER = `${process.cwd()}/test/fixtures/migrations-recursive`

    static prepareMigration(file:string) {
        return new MigrationScript(file,`${process.cwd()}/test/fixtures/migrations/${file}`, 0)
    }

    static getConfig(folder?:string):TestConfig {
        return new TestConfig(folder)
    }
}