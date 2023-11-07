export interface IBackup {
    backup(): Promise<string>
    restore(data: string): Promise<string>;
}