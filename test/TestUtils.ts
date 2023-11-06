import {MigrationScript} from "../src";

export class TestUtils {
    static prepareMigration(file:string) {
        return new MigrationScript(file,`${process.cwd()}/test/resources/migrations/${file}`, 0)
    }
}