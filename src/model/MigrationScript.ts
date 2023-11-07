import {IMigrationInfo, IRunnableScript} from "../interface";
import {Utils} from "../service";

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
    }

    async init():Promise<void> {
        this.script = await Utils.parseRunnable(this)
    }
}