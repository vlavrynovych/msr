import {IDB, IMigrationInfo, IRunnableScript, IRunner} from "../src";

export class DummyScript implements IRunnableScript {
    async up(db: IDB, info: IMigrationInfo, r:IRunner): Promise<string> {
        console.log(info);
        return 'Yo!'
    }

}