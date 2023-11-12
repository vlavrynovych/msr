import {IDB, IMigrationInfo, IRunnableScript, IDatabaseMigrationHandler} from "../../../src";

export class TestScript implements IRunnableScript {
    async up(db: IDB, info: IMigrationInfo, handler:IDatabaseMigrationHandler): Promise<string> {
        return 'result string'
    }

}