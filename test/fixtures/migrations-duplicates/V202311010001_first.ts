import {IRunnableScript, IDB, IMigrationInfo, IDatabaseMigrationHandler} from "../../../src/interface";

export default class FirstMigration implements IRunnableScript<IDB> {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<IDB>): Promise<string> {
        return "First migration with duplicate timestamp";
    }
}
