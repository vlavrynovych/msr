export interface IBackupService {
    backup(): Promise<void>
    restore(): Promise<void>
    deleteBackup():void
}