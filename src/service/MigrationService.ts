import fs from "fs";
import {parseInt} from "lodash";

import {IMigrationService} from "../interface";
import {Config, MigrationScript} from "../model";

export class MigrationService implements IMigrationService {

    constructor(private cfg:Config) {}

    public async readMigrationScripts(): Promise<MigrationScript[]> {
        const files:string[] = fs.readdirSync(this.cfg.folder);
        return files
            .filter(name => this.cfg.filePattern.test(name))
            .map(name => {
                const execArray: RegExpExecArray | null = this.cfg.filePattern.exec(name);
                if(execArray == null) throw new Error("Wrong file name format")
                const timestamp = parseInt(execArray[1]);
                return new MigrationScript(name, `${this.cfg.folder}/${name}`, timestamp);
            })
    }
}