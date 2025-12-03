import {IDB, IDatabaseMigrationHandler, IMigrationInfo} from "../../../src";

export default class V202311062345_with_down {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<IDB>): Promise<string> {
        return 'Migration with down executed';
    }

    async down(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<IDB>): Promise<string> {
        return 'Migration with down rolled back';
    }
}
