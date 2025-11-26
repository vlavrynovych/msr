import _ from 'lodash';
import * as os from 'os';
import {MigrationScript} from "../model/MigrationScript";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {ILogger} from "../interface/ILogger";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {Config} from "../model/Config";
import {ChecksumService} from "./ChecksumService";

/**
 * Service for executing migration scripts.
 *
 * Responsible for running migration scripts in sequential order, tracking
 * execution metadata (timing, username), and saving results to the schema
 * version table.
 *
 * @example
 * ```typescript
 * const runner = new MigrationRunner(handler, schemaVersionService, logger);
 * const executed = await runner.execute(todoScripts);
 * console.log(`Executed ${executed.length} migrations`);
 * ```
 */
export class MigrationRunner {

    /**
     * Creates a new MigrationRunner instance.
     *
     * @param handler - Database migration handler for accessing the database
     * @param schemaVersionService - Service for saving migration metadata
     * @param config - Configuration for checksum calculation
     * @param logger - Logger for execution messages (optional)
     *
     * @example
     * ```typescript
     * const runner = new MigrationRunner(
     *     handler,
     *     schemaVersionService,
     *     config,
     *     new ConsoleLogger()
     * );
     * ```
     */
    constructor(
        private handler: IDatabaseMigrationHandler,
        private schemaVersionService: ISchemaVersionService,
        private config: Config,
        private logger?: ILogger
    ) {}

    /**
     * Execute migration scripts sequentially in chronological order.
     *
     * Runs each migration one at a time, ensuring migrations execute in the correct order
     * based on their timestamps. Records the current username and execution timestamps
     * for each migration.
     *
     * @param scripts - Array of migration scripts to execute
     * @returns Array of executed migrations with results and timing information
     *
     * @throws {Error} If any migration fails, execution stops and the error is propagated
     *
     * @example
     * ```typescript
     * const runner = new MigrationRunner(handler, schemaVersionService);
     * const scripts = [script1, script2, script3];
     *
     * try {
     *   const executed = await runner.execute(scripts);
     *   console.log(`Successfully executed ${executed.length} migrations`);
     * } catch (error) {
     *   console.error('Migration failed:', error);
     * }
     * ```
     */
    async execute(scripts: MigrationScript[]): Promise<MigrationScript[]> {
        scripts = _.orderBy(scripts, ['timestamp'], ['asc']);
        const executed: MigrationScript[] = [];
        const username: string = os.userInfo().username;

        // prepares queue of migration tasks
        const tasks = _.orderBy(scripts, ['timestamp'], ['asc'])
            .map((s: MigrationScript) => {
                s.username = username;
                return async () => {
                    executed.push(await this.executeOne(s));
                }
            });

        // runs migrations sequentially
        await tasks.reduce(async (promise, nextTask) => {
            await promise;
            return nextTask();
        }, Promise.resolve());

        return executed;
    }

    /**
     * Execute a single migration script and save its result.
     *
     * Runs the migration's `up()` method, records execution timing, saves the
     * migration metadata to the schema version table, and returns the completed
     * migration with all metadata populated.
     *
     * @param script - Migration script to execute
     * @returns The executed migration with result and timing information
     *
     * @throws {Error} If the migration's up() method throws an error
     *
     * @example
     * ```typescript
     * const runner = new MigrationRunner(handler, schemaVersionService);
     * const script = new MigrationScript('V123_example.ts', 123);
     *
     * const result = await runner.executeOne(script);
     * console.log(`Executed in ${result.finishedAt - result.startedAt}ms`);
     * ```
     */
    async executeOne(script: MigrationScript): Promise<MigrationScript> {
        this.logger?.log(`${script.name}: processing...`);

        script.startedAt = Date.now();
        script.result = await script.script.up(this.handler.db, script, this.handler);
        script.finishedAt = Date.now();

        // Calculate and store checksum for integrity tracking
        this.calculateChecksum(script);

        await this.schemaVersionService.save(script);
        return script;
    }

    /**
     * Calculate and store checksum for migration script file.
     *
     * Checksums are always calculated and stored to enable integrity
     * validation. If checksum calculation fails, a warning is logged
     * and execution continues.
     *
     * @param script - Migration script to calculate checksum for
     */
    private calculateChecksum(script: MigrationScript): void {
        try {
            script.checksum = ChecksumService.calculateChecksum(
                script.filepath,
                this.config.checksumAlgorithm
            );
        } catch (error) {
            this.logger?.warn(`Warning: Could not calculate checksum for ${script.name}: ${(error as Error).message}`);
        }
    }
}
