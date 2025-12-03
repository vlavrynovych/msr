import {IScripts} from "../IScripts";
import {MigrationScript, Config} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";
import {IDB} from '../dao';

/**
 * Strategy interface for rendering migration output.
 *
 * Implementations can provide different output formats:
 * - ASCII tables for console ({@link AsciiTableRenderStrategy})
 * - JSON for programmatic use ({@link JsonRenderStrategy})
 * - Silent for testing/library usage ({@link SilentRenderStrategy})
 * - Custom formats (Markdown, HTML, plain text, etc.)
 *
 * This pattern allows:
 * - Multiple output formats without modifying core logic
 * - Easy testing with silent/mock strategies
 * - Library-friendly usage (no unwanted console output)
 * - CI/CD integration with structured formats (JSON)
 *
 * **Generic Type Parameters (v0.6.0):**
 * - `DB` - Your specific database interface extending IDB
 *
 * @template DB - Database interface type
 *
 * @example
 * ```typescript
 * // Use JSON output for CI/CD
 * const strategy = new JsonRenderStrategy(true);
 * const renderer = new MigrationRenderer<DB>(config, logger, strategy);
 *
 * // Use silent output for testing
 * const strategy = new SilentRenderStrategy();
 * const renderer = new MigrationRenderer<DB>(config, logger, strategy);
 *
 * // Use default ASCII table output
 * const renderer = new MigrationRenderer<DB>(config, logger); // Uses AsciiTableRenderStrategy
 * ```
 */
export interface IRenderStrategy<DB extends IDB> {
    /**
     * Render the list of previously executed migrations.
     *
     * Uses config.displayLimit to determine how many migrations to show.
     *
     * @param scripts - Collection of migration scripts with execution history
     * @param config - Configuration for accessing file patterns and display settings
     *
     * @example
     * ```typescript
     * strategy.renderMigrated(scripts, config); // Uses config.displayLimit
     * ```
     */
    renderMigrated(scripts: IScripts<DB>, config: Config): void;

    /**
     * Render the list of migrations pending execution.
     *
     * @param scripts - Array of pending migration scripts
     *
     * @example
     * ```typescript
     * strategy.renderPending([script1, script2, script3]);
     * ```
     */
    renderPending(scripts: MigrationScript<DB>[]): void;

    /**
     * Render the list of migrations that were executed in the current run.
     *
     * @param scripts - Array of executed migration information
     *
     * @example
     * ```typescript
     * strategy.renderExecuted([info1, info2]);
     * ```
     */
    renderExecuted(scripts: IMigrationInfo[]): void;

    /**
     * Render the list of migrations that were ignored/skipped.
     *
     * Migrations are ignored when they are older than the last executed
     * migration or don't match execution criteria.
     *
     * @param scripts - Array of ignored migration scripts
     *
     * @example
     * ```typescript
     * strategy.renderIgnored([oldScript1, oldScript2]);
     * ```
     */
    renderIgnored(scripts: MigrationScript<DB>[]): void;

    /**
     * Render banner/header information.
     *
     * Typically displays application name, version, and handler information
     * at the start of migration execution.
     *
     * @param version - Application version string
     * @param handlerName - Name of the database handler being used
     *
     * @example
     * ```typescript
     * strategy.renderBanner('v0.3.0', 'PostgreSQL Handler');
     * ```
     */
    renderBanner(version: string, handlerName: string): void;
}
