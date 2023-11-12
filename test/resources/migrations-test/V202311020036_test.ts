import {IDB, IMigrationInfo, IRunnableScript, IDatabaseMigrationHandler} from "../../../src";

export class DummyScript implements IRunnableScript {
    async up(db: IDB, info: IMigrationInfo, r:IDatabaseMigrationHandler): Promise<string> {
        console.log(info);
        return 'Yo!'
    }

}