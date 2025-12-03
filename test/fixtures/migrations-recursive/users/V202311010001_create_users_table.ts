import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from "../../../../src";

export default class implements IRunnableScript<IDB> {
    async up(
        db: IDB,
        info: IMigrationInfo,
        handler: IDatabaseMigrationHandler<IDB>
    ): Promise<string> {
        // Create users table
        return 'Users table created';
    }
}
