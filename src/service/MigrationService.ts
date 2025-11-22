import fs from "fs";
import {parseInt} from "lodash";

import {IMigrationService} from "../interface";
import {Config, MigrationScript} from "../model";

/**
 * Service for discovering and loading migration script files from the filesystem.
 *
 * Scans the configured migrations directory, identifies valid migration files based
 * on the filename pattern, and creates MigrationScript objects for each one.
 *
 * @example
 * ```typescript
 * const service = new MigrationService();
 * const config = new Config();
 * config.folder = './migrations';
 *
 * const scripts = await service.readMigrationScripts(config);
 * console.log(`Found ${scripts.length} migration scripts`);
 * ```
 */
export class MigrationService implements IMigrationService {

    /**
     * Scan the migrations directory and load all valid migration scripts.
     *
     * Reads the directory specified in the config, filters files by the configured
     * pattern, and creates MigrationScript objects with parsed timestamps and paths.
     * Hidden files (starting with '.') are automatically ignored.
     *
     * @param cfg - Configuration containing folder path and filename pattern
     *
     * @returns Array of MigrationScript objects, unsorted
     *
     * @throws {Error} If a filename matches the pattern but cannot be parsed
     * @throws {Error} If the migrations folder does not exist or cannot be read
     *
     * @example
     * ```typescript
     * const config = new Config();
     * config.folder = './migrations';
     * config.filePattern = /^V(\d+)_(.+)\.ts$/;
     *
     * const scripts = await service.readMigrationScripts(config);
     * // Returns: [
     * //   MigrationScript { name: 'V202501220100_initial.ts', timestamp: 202501220100, ... },
     * //   MigrationScript { name: 'V202501220200_add_users.ts', timestamp: 202501220200, ... }
     * // ]
     * ```
     */
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