import {IScripts} from "../IScripts";
import {MigrationScript} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";
import {IDatabaseMigrationHandler} from "../IDatabaseMigrationHandler";

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
 * @example
 * ```typescript
 * // Use JSON output for CI/CD
 * const strategy = new JsonRenderStrategy(true);
 * const renderer = new ConsoleRenderer(handler, logger, strategy);
 *
 * // Use silent output for testing
 * const strategy = new SilentRenderStrategy();
 * const renderer = new ConsoleRenderer(handler, logger, strategy);
 *
 * // Use default console output
 * const renderer = new ConsoleRenderer(handler); // Uses ConsoleRenderStrategy
 * ```
 */
export interface IRenderStrategy {
    /**
     * Render the list of previously executed migrations.
     *
     * @param scripts - Collection of migration scripts with execution history
     * @param handler - Database handler for accessing configuration
     * @param limit - Optional limit on number of migrations to display (0 = all)
     *
     * @example
     * ```typescript
     * strategy.renderMigrated(scripts, handler, 10); // Show last 10 migrations
     * ```
     */
    renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit?: number): void;

    /**
     * Render the list of migrations pending execution.
     *
     * @param scripts - Array of pending migration scripts
     *
     * @example
     * ```typescript
     * strategy.renderTodo([script1, script2, script3]);
     * ```
     */
    renderTodo(scripts: MigrationScript[]): void;

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
    renderIgnored(scripts: MigrationScript[]): void;

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
