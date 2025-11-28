export interface IBackupService {
    backup(): Promise<string>
    restore(backupPath?: string): Promise<void>
    deleteBackup():void
}