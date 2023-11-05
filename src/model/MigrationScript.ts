import {IMigrationInfo, IRunnableScript} from "../interface";

export class MigrationScript extends IMigrationInfo {

    public readonly filepath!:string;
    public script!: IRunnableScript;

    constructor(name: string,
                filepath: string,
                timestamp: number) {
        super();
        this.name = name;
        this.filepath = filepath;
        this.timestamp = timestamp;
        this.initMigrationScript()
    }

    initMigrationScript():void {
        const exports = require(this.filepath);

        for(const prop in exports) {
            const clazz = exports[prop];
            try {
                const instance = new clazz();
                // if instance has up method
                if(instance.up) this.script = instance as IRunnableScript;
            } catch (e) {
                console.error(e);
                throw new Error('Cannot parse migration script!')
            }
        }
    }
}