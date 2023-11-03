import {IMigrationScript} from "../interface";

export class ExecutableScript {
    public readonly name!:string;
    public readonly filepath!:string;
    public readonly timestamp!: null | number;
    public script: IMigrationScript | undefined;

    constructor(name: string,
                filepath: string,
                timestamp: number | null) {
        this.name = name;
        this.filepath = filepath;
        this.timestamp = timestamp;
        this.initMigrationScript()
    }

    initMigrationScript():void {
        const exports = require(this.filepath);

        let propCounter = 0;
        for(let prop in exports) {
            let clazz = exports[prop];
            try {
                let instance = new clazz();
                // if instance has up method
                if(instance.up) {
                    this.script = instance as IMigrationScript;
                }
            } catch (e) {
                //TODO: handle
            }
            propCounter++;
        }
    }
}