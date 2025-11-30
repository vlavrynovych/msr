import {IRunnableScript, IDB, IMigrationInfo, IDatabaseMigrationHandler} from "../../../src/interface";

export default class SecondMigration implements IRunnableScript {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
        return "Second migration with duplicate timestamp";
    }
}
