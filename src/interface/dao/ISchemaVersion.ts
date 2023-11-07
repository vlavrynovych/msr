export interface ISchemaVersion {
    isInitialized(tableName: string):Promise<boolean>
    createTable(tableName:string): Promise<boolean>
    validateTable(tableName: string): Promise<boolean>
}