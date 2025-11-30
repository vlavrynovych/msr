import {IRunnableScript, IDB, IMigrationInfo, IDatabaseMigrationHandler} from "../../../src/interface";

export default class FirstMigration implements IRunnableScript {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
        return "First migration with duplicate timestamp";
    }
}
