import {MigrationScript} from "../model";
import {IMigrationInfo, ISchemaVersion, ISchemaVersionService} from "../interface";

export class SchemaVersionService<T extends ISchemaVersion> implements ISchemaVersionService{
    constructor(private service: T) {}

    public async init(tableName:string):Promise<void> {
        const init = await this.service.isInitialized(tableName);
        if(!init) {
            const created = await this.service.createTable(tableName);
            if(!created) throw new Error("Cannot create table")
        }
        const isValid = await this.service.validateTable(tableName);
        if(!isValid) throw new Error("Schema version table is invalid")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async save(details:IMigrationInfo):Promise<any> {
        return this.service.migrations.save(details);
    }

    public async getAllMigratedScripts():Promise<MigrationScript[]> {
        return await this.service.migrations.getAll();
    }
}