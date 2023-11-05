import {MigrationScript} from "../model";
import {IRunner} from "../interface";
import {IMigrationInfo} from "../interface";

export class SchemaVersionService {
    constructor(private msr: IRunner) {}

    public async init():Promise<void> {
        if(await this.isInitialized()) {
            await this.validate();
            return;
        }
        await this.createSchemaVersionTable();
    }

    public async register(details:IMigrationInfo):Promise<any> {
        return this.msr.register(details);
    }

    public async getAllMigratedScripts():Promise<MigrationScript[]> {
        return this.msr.getAll();
    }

    private async isInitialized():Promise<boolean> {
        return this.msr.isInitialized(this.msr.cfg.tableName);
    }

    private async createSchemaVersionTable():Promise<boolean> {
        await this.msr.createTable(this.msr.cfg.tableName);
        return await this.validate();
    }

    private async validate():Promise<boolean> {
        return this.msr.validateTable(this.msr.cfg.tableName);
    }
}