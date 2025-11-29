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
     * Validate that a filename doesn't contain path traversal attempts.
     * Prevents directory traversal attacks by checking for '..' sequences
     * and ensuring the resolved path stays within the base directory.
     *
     * @param fileName - The filename or relative path to validate
     * @param baseDir - The base directory that the file must be within
     *
     * @throws {Error} If the filename attempts directory traversal
     *
     * @example
     * ```typescript
     * // Valid filename
     * validateFileName('V1_init.ts', '/migrations'); // OK
     * validateFileName('users/V1_init.ts', '/migrations'); // OK
     *
     * // Invalid filename (traversal attempt)
     * validateFileName('../../../etc/passwd', '/migrations'); // throws Error
     * validateFileName('..', '/migrations'); // throws Error
     * ```
     */
    private validateFileName(fileName: string, baseDir: string): void {
        // Check for explicit traversal sequences
        if (fileName.includes('..')) {
            throw new Error(
                `Security error: Path traversal detected. ` +
                `Filename '${fileName}' contains '..' which is not allowed`
            );
        }

        // Reject absolute paths
        if (path.isAbsolute(fileName)) {
            throw new Error(
                `Security error: Path traversal detected. ` +
                `Filename '${fileName}' is an absolute path which resolves outside the migrations directory '${baseDir}'`
            );
        }

        // Also validate the resolved path stays within baseDir
        const fullPath = path.join(baseDir, fileName);
        const resolvedPath = path.resolve(fullPath);
        const resolvedBase = path.resolve(baseDir);

        if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
            throw new Error(
                `Security error: Path traversal detected. ` +
                `File path '${fileName}' resolves outside the migrations directory '${baseDir}'`
            );
        }
    }

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

            this.validateFileName(entry.name, dir);
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
     * Check if a beforeMigrate script exists in the migrations folder.
     *
     * Looks for a file with the configured name (default: `beforeMigrate`) with
     * `.ts` or `.js` extension in the root of the migrations folder. This special
     * script executes once before any migrations run, similar to Flyway's beforeMigrate.sql.
     *
     * Perfect for:
     * - Loading production snapshots or test data
     * - Creating database extensions on fresh setups
     * - Environment-specific setup
     * - Pre-migration validation or cleanup
     *
     * @param cfg - Configuration containing folder path and beforeMigrateName
     *
     * @returns Path to beforeMigrate script if it exists, undefined otherwise
     *
     * @example
     * ```typescript
     * const config = new Config();
     * config.folder = './migrations';
     * config.beforeMigrateName = 'beforeMigrate'; // default
     *
     * const beforeMigratePath = await service.getBeforeMigrateScript(config);
     * if (beforeMigratePath) {
     *   console.log(`Found beforeMigrate script: ${beforeMigratePath}`);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Using custom name
     * const config = new Config();
     * config.beforeMigrateName = 'setup';
     * // Will look for setup.ts or setup.js
     *
     * // Disable beforeMigrate
     * config.beforeMigrateName = null;
     * ```
     */
    public async getBeforeMigrateScript(cfg: Config): Promise<string | undefined> {
        // If beforeMigrateName is null, the feature is disabled
        if (cfg.beforeMigrateName === null) {
            return undefined;
        }

        const folder = cfg.folder;
        const possibleNames = [`${cfg.beforeMigrateName}.ts`, `${cfg.beforeMigrateName}.js`];

        for (const name of possibleNames) {
            this.validateFileName(name, folder);
            const filePath = path.join(folder, name);
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        }

        return undefined;
    }

    /**
     * Scan the migrations directory and load all valid migration scripts.
     *
     * Reads the directory specified in the config, filters files by the configured
     * patterns, and creates MigrationScript objects with parsed timestamps and paths.
     * Hidden files (starting with '.') are automatically ignored.
     *
     * Supports multiple file formats via filePatterns array (TypeScript, SQL, etc.).
     * Falls back to single filePattern for backward compatibility.
     *
     * The special beforeMigrate file (configured via `config.beforeMigrateName`) is not
     * included in the results - it's handled separately via getBeforeMigrateScript().
     *
     * When config.recursive is enabled, scans all sub-directories recursively,
     * allowing you to organize migrations by feature, module, or version while
     * maintaining timestamp-based execution order.
     *
     * @param cfg - Configuration containing folder path, filename patterns, and recursive flag
     *
     * @returns Array of MigrationScript objects, unsorted (excludes beforeMigrate.ts)
     *
     * @throws {Error} If a filename matches the pattern but cannot be parsed
     * @throws {Error} If the migrations folder does not exist or cannot be read
     *
     * @example
     * ```typescript
     * // Single file type (backward compatible)
     * const config = new Config();
     * config.folder = './migrations';
     * config.filePattern = /^V(\d+)_(.+)\.ts$/;
     *
     * const scripts = await service.readMigrationScripts(config);
     * // Returns: [
     * //   MigrationScript { name: 'V202501220100_initial.ts', timestamp: 202501220100, ... },
     * //   MigrationScript { name: 'V202501220200_add_users.ts', timestamp: 202501220200, ... }
     * // ]
     * // Note: beforeMigrate.ts is excluded
     * ```
     *
     * @example
     * ```typescript
     * // Multiple file types (TypeScript and SQL)
     * const config = new Config();
     * config.folder = './migrations';
     * config.filePatterns = [
     *   /^V(\d{12})_.*\.ts$/,
     *   /^V(\d{12})_.*\.up\.sql$/
     * ];
     *
     * const scripts = await service.readMigrationScripts(config);
     * // Returns both .ts and .up.sql migrations
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
        const patterns = cfg.filePatterns;

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
                .map(name => {
                    this.validateFileName(name, folder);
                    const filePath = path.join(folder, name);
                    return { name, filePath };
                });
        }

        if(!files.length) {
            this.logger.warn(`Migration scripts folder is empty. Please check your configuration.\r\n${folder}`)
        }

        return files
            .map(({ name, filePath }) => {
                // Find which pattern matches this file
                const matchingPattern = patterns.find(pattern => pattern.test(name));
                if (!matchingPattern) return null; // Skip files that don't match any pattern

                const execArray: RegExpExecArray | null = matchingPattern.exec(name);
                if(execArray == null) throw new Error("Wrong file name format")
                const timestamp = parseInt(execArray[1]);
                return new MigrationScript(name, filePath, timestamp);
            })
            .filter((script): script is MigrationScript => script !== null)
    }
}