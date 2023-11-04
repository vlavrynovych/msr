import {IDAO, IMigrationScript} from "../src";

export class DummyScript implements IMigrationScript {
    up(dao: IDAO, info: any): Promise<any> {
        console.log(info);
        return Promise.resolve("Yahoo!");
    }

}