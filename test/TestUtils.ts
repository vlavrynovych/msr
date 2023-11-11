import {MigrationScript} from "../src";
import {TestConfig} from "./TestConfig";

export class TestUtils {
    public static EMPTY_FOLDER = `${process.cwd()}/test/resources/migrations-empty`
    public static DEFAULT_FOLDER = `${process.cwd()}/test/resources/migrations-test`

    static prepareMigration(file:string) {
        return new MigrationScript(file,`${process.cwd()}/test/resources/migrations/${file}`, 0)
    }

    static getConfig(folder?:string):TestConfig {
        return new TestConfig(folder)
    }
}