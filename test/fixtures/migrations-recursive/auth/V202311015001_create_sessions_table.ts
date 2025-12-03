import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from "../../../../src";

export default class implements IRunnableScript<IDB> {
    async up(
        db: IDB,
        info: IMigrationInfo,
        handler: IDatabaseMigrationHandler<IDB>
    ): Promise<string> {
        // Create sessions table
        return 'Sessions table created';
    }
}
