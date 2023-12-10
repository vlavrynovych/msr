import {MigrationScript} from "../src";
import {TestConfig} from "./TestConfig";

// inits chai-spies
import * as chai from "chai";
import spies from 'chai-spies';
chai.use(spies);

// inits chai-as-promised
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

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