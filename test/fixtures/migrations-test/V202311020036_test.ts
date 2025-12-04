import {IDB, IMigrationInfo, IRunnableScript, IDatabaseMigrationHandler} from "../../../src";

export class DummyScript implements IRunnableScript<IDB> {
    async up(db: IDB, info: IMigrationInfo, r: IDatabaseMigrationHandler<IDB>): Promise<string> {
        // Migration execution - info available in 'info' parameter
        return 'Yo!'
    }

}