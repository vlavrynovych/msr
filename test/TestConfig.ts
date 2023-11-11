import {Config} from "../src";
import {TestUtils} from "./TestUtils";

/**
 * Please use it instead of {@link Config}. Because it overrides standard parameters
 * and points test to the test/resources folder where you can place any file need for the testing
 *
 * Also for your convenience the new instance of this class can be created using {@link TestUtils#getConfig}
 */
export class TestConfig extends Config {

    constructor(folder:string = TestUtils.DEFAULT_FOLDER) {
        super();
        this.folder = folder
    }
}