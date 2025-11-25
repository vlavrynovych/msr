import fs from "fs";
import path from "path";
import {parseInt} from "lodash";

import {IMigrationService, ILogger} from "../interface";
import {Config, MigrationScript} from "../model";
import {ConsoleLogger} from "../logger";

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
     * Creates a new MigrationService.
     *
     * @param logger - Logger instance for output (defaults to ConsoleLogger)
     */
    public constructor(
        private logger: ILogger = new ConsoleLogger()
    ) {}

    /**
     * Recursively scan a directory and its sub-directories for files.
     * Hidden files and folders (starting with '.') are automatically ignored.
     *
     * @param dir - Directory path to scan
     *
     * @returns Array of absolute file paths
     */
    private scanDirectoryRecursive(dir: string): string[] {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];

        for (const entry of entries) {
            // Skip hidden files and folders
            if (entry.name.startsWith('.')) {
                continue;
            }

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Recursively scan sub-directories
                files.push(...this.scanDirectoryRecursive(fullPath));
            } else if (entry.isFile()) {
                files.push(fullPath);
            }
        }

        return files;
    }

    /**
     * Scan the migrations directory and load all valid migration scripts.
     *
     * Reads the directory specified in the config, filters files by the configured
     * pattern, and creates MigrationScript objects with parsed timestamps and paths.
     * Hidden files (starting with '.') are automatically ignored.
     *
     * When config.recursive is enabled, scans all sub-directories recursively,
     * allowing you to organize migrations by feature, module, or version while
     * maintaining timestamp-based execution order.
     *
     * @param cfg - Configuration containing folder path, filename pattern, and recursive flag
     *
     * @returns Array of MigrationScript objects, unsorted
     *
     * @throws {Error} If a filename matches the pattern but cannot be parsed
     * @throws {Error} If the migrations folder does not exist or cannot be read
     *
     * @example
     * ```typescript
     * // Single-folder mode (default)
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
     *
     * @example
     * ```typescript
     * // Recursive mode with sub-folders
     * const config = new Config();
     * config.folder = './migrations';
     * config.recursive = true;
     *
     * // Directory structure:
     * // migrations/
     * // ├── users/V202311010001_create_users.ts
     * // └── auth/V202311020001_create_sessions.ts
     *
     * const scripts = await service.readMigrationScripts(config);
     * // Returns migrations from all sub-folders, sorted by timestamp
     * ```
     */
    public async readMigrationScripts(cfg: Config): Promise<MigrationScript[]> {
        const folder = cfg.folder;
        const pattern = cfg.filePattern;

        let files: Array<{ name: string; filePath: string }>;

        if (cfg.recursive) {
            // Recursive mode: scan all sub-directories
            const filePaths = this.scanDirectoryRecursive(folder);
            files = filePaths.map(filePath => ({
                name: path.basename(filePath),
                filePath
            }));
        } else {
            // Single-folder mode: only scan the root folder
            const fileNames = fs.readdirSync(folder);
            files = fileNames
                .filter(name => !name.startsWith('.')) // ignores hidden files
                .map(name => ({
                    name,
                    filePath: path.join(folder, name)
                }));
        }

        if(!files.length) {
            this.logger.warn(`Migration scripts folder is empty. Please check your configuration.\r\n${folder}`)
        }

        return files
            .filter(({ name }) => pattern.test(name))
            .map(({ name, filePath }) => {
                const execArray: RegExpExecArray | null = pattern.exec(name);
                if(execArray == null) throw new Error("Wrong file name format")
                const timestamp = parseInt(execArray[1]);
                return new MigrationScript(name, filePath, timestamp);
            })
    }
}