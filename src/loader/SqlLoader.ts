import fs from 'node:fs';
import {IMigrationScriptLoader} from '../interface/loader/IMigrationScriptLoader';
import {IRunnableScript} from '../interface/IRunnableScript';
import {MigrationScript} from '../model/MigrationScript';
import {IDB, ISqlDB} from '../interface/dao/IDB';
import {IMigrationInfo} from '../interface/IMigrationInfo';
import {IDatabaseMigrationHandler} from '../interface/IDatabaseMigrationHandler';
import {ILogger} from '../interface/ILogger';
import {ConsoleLogger} from '../logger/ConsoleLogger';

/**
 * Loader for SQL migration files (golang-migrate style).
 *
 * Supports paired `.up.sql` and `.down.sql` files:
 * - `V202501220100_create_users.up.sql` (required)
 * - `V202501220100_create_users.down.sql` (optional)
 *
 * The entire SQL file content is executed as a single statement via `db.query()`.
 *
 * @example
 * ```typescript
 * const loader = new SqlLoader();
 * const script = new MigrationScript('V123_create.up.sql', '/path/to/file', 123);
 * const runnable = await loader.load(script);
 * await runnable.up(db, info, handler);
 * ```
 */
export class SqlLoader implements IMigrationScriptLoader {
    constructor(private readonly logger: ILogger = new ConsoleLogger()) {}

    /**
     * Check if this loader can handle SQL up files.
     *
     * Only .up.sql files are discovered; .down.sql files are found automatically.
     *
     * @param filePath - Path to the migration file
     * @returns true if file has .up.sql extension
     */
    canHandle(filePath: string): boolean {
        return /\.up\.sql$/i.test(filePath);
    }

    /**
     * Load SQL migration file and return IRunnableScript wrapper.
     *
     * This method:
     * 1. Reads .up.sql file content
     * 2. Looks for matching .down.sql file
     * 3. Creates SqlScript wrapper that executes SQL via db.query()
     *
     * @param script - Migration script to load
     * @returns SqlScript instance wrapping SQL content
     * @throws Error if .up.sql file cannot be read
     */
    async load(script: MigrationScript): Promise<IRunnableScript> {
        // Read .up.sql file content
        if (!fs.existsSync(script.filepath)) {
            throw new Error(`${script.name}: SQL file not found: ${script.filepath}`);
        }

        const upContent = fs.readFileSync(script.filepath, 'utf8').trim();

        // Find matching .down.sql file
        const downPath = this.getDownFilePath(script.filepath);
        const downContent = fs.existsSync(downPath)
            ? fs.readFileSync(downPath, 'utf8').trim()
            : null;

        if (downContent) {
            this.logger.debug(`${script.name}: Found rollback SQL file: ${downPath}`);
        }

        // Create IRunnableScript wrapper
        return new SqlScript(upContent, downContent, script.name, this.logger);
    }

    /**
     * Get loader name for logging and debugging.
     *
     * @returns 'SqlLoader'
     */
    getName(): string {
        return 'SqlLoader';
    }

    /**
     * Convert .up.sql path to .down.sql path.
     *
     * @param upFilePath - Path to .up.sql file
     * @returns Path to corresponding .down.sql file
     *
     * @example
     * ```typescript
     * getDownFilePath('/path/V123_create.up.sql')
     * // Returns: '/path/V123_create.down.sql'
     * ```
     */
    private getDownFilePath(upFilePath: string): string {
        return upFilePath.replace(/\.up\.sql$/i, '.down.sql');
    }
}

/**
 * IRunnableScript wrapper for SQL migration content.
 *
 * Executes SQL via the database handler's `db.query()` method.
 * The entire file content is passed as a single statement.
 *
 * @internal
 */
class SqlScript implements IRunnableScript {
    constructor(
        private readonly upSql: string,
        private readonly downSql: string | null,
        private readonly scriptName: string,
        private readonly logger: ILogger
    ) {}

    /**
     * Execute forward migration SQL.
     *
     * @param db - Database connection (must implement ISqlDB with query() method)
     * @param info - Migration info
     * @param handler - Database migration handler
     * @returns Success message with line count
     * @throws Error if SQL execution fails or db doesn't implement ISqlDB
     */
    async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
        if (!this.upSql) {
            throw new Error(`${this.scriptName}: Empty up() SQL content`);
        }

        // Type guard: ensure db implements ISqlDB interface
        if (!this.isSqlDB(db)) {
            throw new Error(
                `${this.scriptName}: SQL migrations require database handler that implements ISqlDB interface.\n` +
                `Handler: ${handler.getName()}\n` +
                `Either:\n` +
                `  1. Implement ISqlDB interface with query(sql: string) method\n` +
                `  2. Use TypeScript migrations for this database\n` +
                `  3. Implement a custom loader for your SQL dialect\n\n` +
                `Example:\n` +
                `  import { ISqlDB } from '@migration-script-runner/core';\n` +
                `  class MyDB implements ISqlDB {\n` +
                `    async query(sql: string): Promise<unknown> { /* ... */ }\n` +
                `  }`
            );
        }

        // Execute SQL content as single query
        try {
            await db.query(this.upSql);
            const lineCount = this.upSql.split('\n').length;
            return `Executed SQL migration (${lineCount} lines)`;
        } catch (error) {
            const sqlPreview = this.upSql.length > 200
                ? this.upSql.substring(0, 200) + '...'
                : this.upSql;

            throw new Error(
                `${this.scriptName}: SQL migration failed\n` +
                `Error: ${(error as Error).message}\n` +
                `SQL Preview:\n${sqlPreview}`
            );
        }
    }

    /**
     * Execute rollback migration SQL.
     *
     * @param db - Database connection (must implement ISqlDB with query() method)
     * @param info - Migration info
     * @param handler - Database migration handler
     * @returns Success message with line count
     * @throws Error if .down.sql file not found or SQL execution fails
     */
    async down(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
        if (!this.downSql) {
            const downPath = this.scriptName.replace('.up.sql', '.down.sql');
            throw new Error(
                `${this.scriptName}: No down() SQL file found.\n` +
                `Create ${downPath} for rollback support.\n` +
                `Or use RollbackStrategy.BACKUP to rely on backup/restore.`
            );
        }

        // Type guard: ensure db implements ISqlDB interface
        if (!this.isSqlDB(db)) {
            throw new Error(
                `${this.scriptName}: SQL migrations require database handler that implements ISqlDB interface.\n` +
                `Handler: ${handler.getName()}\n` +
                `Implement ISqlDB interface with query(sql: string) method.`
            );
        }

        // Execute rollback SQL
        try {
            await db.query(this.downSql);
            const lineCount = this.downSql.split('\n').length;
            return `Rolled back SQL migration (${lineCount} lines)`;
        } catch (error) {
            const sqlPreview = this.downSql.length > 200
                ? this.downSql.substring(0, 200) + '...'
                : this.downSql;

            throw new Error(
                `${this.scriptName}: SQL rollback failed\n` +
                `Error: ${(error as Error).message}\n` +
                `SQL Preview:\n${sqlPreview}`
            );
        }
    }

    /**
     * Type guard to check if db implements ISqlDB interface.
     *
     * @param db - Database connection to check
     * @returns true if db has query() method (implements ISqlDB)
     */
    private isSqlDB(db: IDB): db is ISqlDB {
        return typeof (db as ISqlDB).query === 'function';
    }
}
