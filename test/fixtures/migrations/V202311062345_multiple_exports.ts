import {IDB, IDatabaseMigrationHandler, IMigrationInfo} from "../../../src";

export class FirstMigration {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<IDB>): Promise<string> {
        return 'First migration';
    }
}

export class SecondMigration {
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler<IDB>): Promise<string> {
        return 'Second migration';
    }
}

export default FirstMigration;
