import {ExecutableScript} from "./ExecutableScript";

export class MigrationScriptInfo extends ExecutableScript{

    constructor(name: string, filepath: string, timestamp: number | null) {
        super(name, filepath, timestamp);
    }
}