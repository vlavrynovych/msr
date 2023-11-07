import {IDB, IMigrationInfo, IRunnableScript, IRunner} from "../../../src";

export class TestScript implements IRunnableScript {
    async up(db: IDB, info: IMigrationInfo, r:IRunner): Promise<string> {
        return 'result string'
    }

}

export class A {
    test() {
        return 1
    }
}