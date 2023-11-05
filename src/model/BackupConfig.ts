export class BackupConfig {
    timestamp:boolean = true;
    deleteBackup:boolean = true;
    folder:string = 'backups'

    prefix:string = 'backup';
    custom:string = '';
    suffix:string = '';

    timestampFormat:string = 'YYYY-MM-DD-HH-mm-ss';
    extension:string = 'bkp';
}