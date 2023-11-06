import {MigrationScript} from "../model";
import {IRunner, IMigrationInfo} from "../interface";

export class SchemaVersionService {
    constructor(private runner: IRunner) {}

    public async init():Promise<void> {
        const table = this.runner.cfg.tableName;
        const init = await this.runner.isInitialized(table);
        if(!init) {
            const created = await this.runner.createTable(table);
            if(!created) throw new Error("Cannot create table")
        }
        const isValid = await this.runner.validateTable(table);
        if(!isValid) throw new Error("Schema version table is invalid")
    }

    public async register(details:IMigrationInfo):Promise<any> {
        return this.runner.register(details);
    }

    public async getAllMigratedScripts():Promise<MigrationScript[]> {
        return await this.runner.getAll();
    }
}