export interface IBackupService {
    backup(): Promise<any>
    restore(): Promise<any>
    deleteBackup():void
}