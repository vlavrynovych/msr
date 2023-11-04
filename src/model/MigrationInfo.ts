export class MigrationInfo {
    name!:string
    timestamp!:number
    startedAt:number = Date.now()
    finishedAt!:number
    username!:string
    result?:string
}