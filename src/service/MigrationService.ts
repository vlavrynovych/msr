import fs from "fs";
import {parseInt} from "lodash";

import {IMigrationService} from "../interface";
import {Config, MigrationScript} from "../model";

export class MigrationService implements IMigrationService {

    public async readMigrationScripts(cfg: Config): Promise<MigrationScript[]> {
        const folder = cfg.folder;
        const pattern = cfg.filePattern;

        const files:string[] = fs.readdirSync(folder)
            .filter(f => !f.startsWith('.')) // ignores hidden files

        if(!files.length) {
            console.warn(`Migration scripts folder is empty. Please check your configuration.\r\n${folder}`)
        }
        return files
            .filter(name => pattern.test(name))
            .map(name => {
                const execArray: RegExpExecArray | null = pattern.exec(name);
                if(execArray == null) throw new Error("Wrong file name format")
                const timestamp = parseInt(execArray[1]);
                return new MigrationScript(name, `${folder}/${name}`, timestamp);
            })
    }
}