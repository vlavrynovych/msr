export interface IBackupService {
    backup(): Promise<string>
    restore(): Promise<void>
    deleteBackup():void
}