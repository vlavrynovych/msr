import {IDB, IMigrationInfo, IRunnableScript, IRunner} from "../src";

export class DummyScript implements IRunnableScript {
    async up(dao: IDB, info: IMigrationInfo, msr:IRunner): Promise<any> {
        console.log(info);
        return 'Yo!'
    }

}