import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from "../../../../src";

export default class implements IRunnableScript {
    async up(
        db: IDB,
        info: IMigrationInfo,
        handler: IDatabaseMigrationHandler
    ): Promise<string> {
        // Create sessions table
        return 'Sessions table created';
    }
}
