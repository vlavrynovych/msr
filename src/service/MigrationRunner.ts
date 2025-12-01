import _ from 'lodash';
import * as os from 'os';
import {MigrationScript} from "../model/MigrationScript";
import {ISchemaVersionService} from "../interface/service/ISchemaVersionService";
import {ILogger} from "../interface/ILogger";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {Config} from "../model/Config";
import {ChecksumService} from "./ChecksumService";
import {ITransactionManager} from "../interface/service/ITransactionManager";
import {TransactionMode} from "../model/TransactionMode";
import {ITransactionHooks} from "../interface/ITransactionHooks";
import {ITransactionContext} from "../interface/service/ITransactionContext";
import {v4 as uuidv4} from 'uuid';

/**
 * Service for executing migration scripts with transaction support.
 *
 * Responsible for running migration scripts in sequential order, tracking
 * execution metadata (timing, username), and saving results to the schema
 * version table. Supports three transaction modes:
 *
 * - **PER_MIGRATION**: Each migration executes in its own transaction (default)
 * - **PER_BATCH**: All migrations execute in a single transaction
 * - **NONE**: No automatic transaction management
 *
 * **New in v0.5.0:** Transaction support with configurable modes
 *
 * @example
 * ```typescript
 * // Basic usage without transactions
 * const runner = new MigrationRunner(handler, schemaVersionService, config, logger);
 * const executed = await runner.execute(todoScripts);
 *
 * // With transaction manager (PER_MIGRATION mode)
 * const runner = new MigrationRunner(
 *   handler,
 *   schemaVersionService,
 *   config,
 *   logger,
 *   transactionManager,
 *   hooks
 * );
 * const executed = await runner.execute(todoScripts);
 * ```
 */
export class MigrationRunner {

    /**
     * Creates a new MigrationRunner instance.
     *
     * @param handler - Database migration handler for accessing the database
     * @param schemaVersionService - Service for saving migration metadata
     * @param config - Configuration including transaction settings
     * @param logger - Logger for execution messages (optional)
     * @param transactionManager - Transaction manager for automatic transaction handling (optional)
     * @param hooks - Transaction lifecycle hooks (optional)
     *
     * @example
     * ```typescript
     * // Without transactions
     * const runner = new MigrationRunner(handler, schemaVersionService, config, logger);
     *
     * // With transactions
     * const runner = new MigrationRunner(
     *   handler,
     *   schemaVersionService,
     *   config,
     *   logger,
     *   new DefaultTransactionManager(db, config.transaction, logger),
     *   new CompositeHooks([new ExecutionSummaryHook()])
     * );
     * ```
     */
    constructor(
        private readonly handler: IDatabaseMigrationHandler,
        private readonly schemaVersionService: ISchemaVersionService,
        private readonly config: Config,
        private readonly logger?: ILogger,
        private readonly transactionManager?: ITransactionManager,
        private readonly hooks?: ITransactionHooks
    ) {}

    /**
     * Execute migration scripts sequentially in chronological order.
     *
     * Runs each migration one at a time, ensuring migrations execute in the correct order
     * based on their timestamps. Records the current username and execution timestamps
     * for each migration.
     *
     * **Transaction Modes:**
     * - **PER_MIGRATION**: Each migration runs in its own transaction (default)
     * - **PER_BATCH**: All migrations run in a single transaction
     * - **NONE**: No automatic transaction handling
     *
     * @param scripts - Array of migration scripts to execute
     * @returns Array of executed migrations with results and timing information
     *
     * @throws {Error} If any migration fails, execution stops and the error is propagated
     *
     * @example
     * ```typescript
     * const runner = new MigrationRunner(handler, schemaVersionService, config, logger);
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

        // Determine transaction mode
        const mode = this.config.transaction.mode;

        // PER_BATCH: Wrap all migrations in single transaction
        if (mode === TransactionMode.PER_BATCH && this.transactionManager) {
            return await this.executeInTransaction(scripts, username, executed);
        }

        // PER_MIGRATION or NONE: Execute migrations one by one
        // (PER_MIGRATION wrapping happens in executeOne)
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
     * Execute all migrations in a single transaction (PER_BATCH mode).
     *
     * @param scripts - Array of migration scripts to execute
     * @param username - Username executing the migrations
     * @param executed - Array to store executed migrations
     * @returns Array of executed migrations with results
     *
     * @throws {Error} If any migration fails or transaction commit fails
     */
    private async executeInTransaction(
        scripts: MigrationScript[],
        username: string,
        executed: MigrationScript[]
    ): Promise<MigrationScript[]> {
        const context = this.createTransactionContext(scripts);

        try {
            // Begin transaction
            await this.hooks?.beforeTransactionBegin?.(context);
            await this.transactionManager!.begin();
            await this.hooks?.afterTransactionBegin?.(context);

            // Execute all migrations
            const tasks = _.orderBy(scripts, ['timestamp'], ['asc'])
                .map((s: MigrationScript) => {
                    s.username = username;
                    return async () => {
                        executed.push(await this.executeOneWithoutTransaction(s));
                    }
                });

            await tasks.reduce(async (promise, nextTask) => {
                await promise;
                return nextTask();
            }, Promise.resolve());

            // In dry run mode, always rollback instead of commit
            if (this.config.dryRun) {
                this.logger?.debug(`Dry run: Rolling back batch transaction (${scripts.length} migrations)`);
                await this.transactionManager!.rollback();
                await this.hooks?.afterRollback?.(context);
            } else {
                // Normal mode: Commit transaction with retry logic
                await this.commitWithRetry(context);
            }

            return executed;
        } catch (error) {
            // Rollback on failure
            await this.rollbackTransaction(context, error as Error);
            throw error;
        }
    }

    /**
     * Commit transaction with automatic retry and hook integration.
     *
     * @param context - Transaction context for hooks
     * @throws {Error} If commit fails after all retries
     */
    private async commitWithRetry(context: ITransactionContext): Promise<void> {
        const maxRetries = this.config.transaction.retries ?? 3;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            context.attempt = attempt;

            try {
                await this.hooks?.beforeCommit?.(context);
                await this.transactionManager!.commit();
                await this.hooks?.afterCommit?.(context);
                return; // Success!
            } catch (error) {
                if (attempt < maxRetries) {
                    await this.hooks?.onCommitRetry?.(context, attempt, error as Error);
                    // Retry is handled by DefaultTransactionManager
                } else {
                    // Final attempt failed
                    throw error;
                }
            }
        }
    }

    /**
     * Rollback transaction and call hooks.
     *
     * @param context - Transaction context for hooks
     * @param reason - The error that triggered rollback
     */
    private async rollbackTransaction(context: ITransactionContext, reason: Error): Promise<void> {
        try {
            await this.hooks?.beforeRollback?.(context, reason);
            await this.transactionManager!.rollback();
            await this.hooks?.afterRollback?.(context);
        } catch (rollbackError) {
            this.logger?.error(`Rollback failed: ${(rollbackError as Error).message}`);
            throw rollbackError;
        }
    }

    /**
     * Create transaction context for hooks.
     *
     * @param scripts - Migration scripts being executed
     * @returns Transaction context object
     */
    private createTransactionContext(scripts: MigrationScript[]): ITransactionContext {
        return {
            transactionId: uuidv4(),
            mode: this.config.transaction.mode,
            isolation: this.config.transaction.isolation,
            migrations: scripts,
            startTime: Date.now(),
            attempt: 1,
            metadata: {}
        };
    }

    /**
     * Execute a single migration script and save its result.
     *
     * Runs the migration's `up()` method, records execution timing, saves the
     * migration metadata to the schema version table, and returns the completed
     * migration with all metadata populated.
     *
     * **In PER_MIGRATION mode:** Wraps execution in a transaction with automatic
     * commit retry and rollback on failure.
     *
     * @param script - Migration script to execute
     * @returns The executed migration with result and timing information
     *
     * @throws {Error} If the migration's up() method throws an error
     *
     * @example
     * ```typescript
     * const runner = new MigrationRunner(handler, schemaVersionService, config, logger);
     * const script = new MigrationScript('V123_example.ts', 123);
     *
     * const result = await runner.executeOne(script);
     * console.log(`Executed in ${result.finishedAt - result.startedAt}ms`);
     * ```
     */
    async executeOne(script: MigrationScript): Promise<MigrationScript> {
        const mode = this.config.transaction.mode;

        // PER_MIGRATION: Wrap in transaction
        if (mode === TransactionMode.PER_MIGRATION && this.transactionManager) {
            return await this.executeOneInTransaction(script);
        }

        // NONE or no transaction manager: Execute without transaction
        return await this.executeOneWithoutTransaction(script);
    }

    /**
     * Execute a single migration in its own transaction (PER_MIGRATION mode).
     *
     * @param script - Migration script to execute
     * @returns The executed migration with result and timing information
     *
     * @throws {Error} If migration fails or transaction commit fails
     */
    private async executeOneInTransaction(script: MigrationScript): Promise<MigrationScript> {
        const context = this.createTransactionContext([script]);

        try {
            // Begin transaction
            await this.hooks?.beforeTransactionBegin?.(context);
            await this.transactionManager!.begin();
            await this.hooks?.afterTransactionBegin?.(context);

            // Execute migration
            const executed = await this.executeOneWithoutTransaction(script);

            // In dry run mode, always rollback instead of commit
            if (this.config.dryRun) {
                this.logger?.debug(`Dry run: Rolling back transaction for ${script.name}`);
                await this.transactionManager!.rollback();
                await this.hooks?.afterRollback?.(context);
            } else {
                // Normal mode: Commit transaction with retry logic
                await this.commitWithRetry(context);
            }

            return executed;
        } catch (error) {
            // Rollback on failure
            await this.rollbackTransaction(context, error as Error);
            throw error;
        }
    }

    /**
     * Execute a single migration without transaction wrapping.
     *
     * Used internally by PER_BATCH mode and NONE mode.
     *
     * @param script - Migration script to execute
     * @returns The executed migration with result and timing information
     *
     * @throws {Error} If the migration's up() method throws an error
     */
    private async executeOneWithoutTransaction(script: MigrationScript): Promise<MigrationScript> {
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
