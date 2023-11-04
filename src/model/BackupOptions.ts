export class BackupOptions {
    timestamp:boolean = true;
    deleteBackup:boolean = true;

    prefix:string = 'backup';
    custom:string = '';
    suffix:string = '';

    timestampFormat:string = 'YYYY-MM-DD-HH-mm-ss';
    extension:string = 'bkp';
}