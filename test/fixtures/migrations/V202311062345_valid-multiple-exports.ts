import {IDB, IMigrationInfo, IRunnableScript, IDatabaseMigrationHandler} from "../../../src";

export class TestScript implements IRunnableScript<IDB> {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<IDB>): Promise<string> {
        return 'result string'
    }

}

export class A {
    test() {
        return 1
    }
}