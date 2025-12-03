import {IRunnableScript, IDB, IMigrationInfo, IDatabaseMigrationHandler} from "../../../src/interface";

export default class SecondMigration implements IRunnableScript<IDB> {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<IDB>): Promise<string> {
        return "Second migration with duplicate timestamp";
    }
}
