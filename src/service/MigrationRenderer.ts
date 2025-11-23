import {version} from '../../package.json'

import {IMigrationInfo, IDatabaseMigrationHandler, IScripts, MigrationScript, ILogger, IMigrationRenderer, IRenderStrategy} from "../index";
import {ConsoleLogger} from "../logger";
import {AsciiTableRenderStrategy} from "./render/AsciiTableRenderStrategy";

/**
 * Migration renderer that delegates rendering to a pluggable strategy.
 *
 * Uses the Strategy Pattern to support multiple output formats:
 * - ASCII tables (default via {@link AsciiTableRenderStrategy})
 * - JSON ({@link JsonRenderStrategy})
 * - Silent ({@link SilentRenderStrategy})
 * - Custom strategies
 *
 * This design allows:
 * - Easy testing with silent/mock strategies
 * - Multiple output formats without modifying core logic
 * - Library-friendly usage (suppress output)
 * - CI/CD integration (structured output)
 *
 * @example
 * ```typescript
 * // Default ASCII table output
 * const renderer = new MigrationRenderer(handler);
 *
 * // JSON output for CI/CD
 * const renderer = new MigrationRenderer(handler, logger, new JsonRenderStrategy());
 *
 * // Silent output for testing
 * const renderer = new MigrationRenderer(handler, logger, new SilentRenderStrategy());
 * ```
 */
export class MigrationRenderer implements IMigrationRenderer {
    /**
     * Creates a new MigrationRenderer.
     *
     * @param handler - Database migration handler
     * @param logger - Logger instance (defaults to ConsoleLogger)
     * @param strategy - Rendering strategy (defaults to AsciiTableRenderStrategy)
     */
    constructor(
        private handler: IDatabaseMigrationHandler,
        private logger: ILogger = new ConsoleLogger(),
        private strategy: IRenderStrategy = new AsciiTableRenderStrategy(logger)
    ) {}

    /**
     * Draw ASCII art banner with application name and version.
     *
     * Delegates to the rendering strategy.
     */
    public drawFiglet(): void {
        this.strategy.renderBanner(version, this.handler.getName());
    }

    /**
     * Draw table of already executed migrations.
     *
     * Delegates to the rendering strategy.
     *
     * @param scripts - Collection of migration scripts with execution history
     * @param number - Optional limit on number of migrations to display (0 = all)
     */
    public drawMigrated(scripts: IScripts, number = 0): void {
        this.strategy.renderMigrated(scripts, this.handler, number);
    }

    /**
     * Draw table of pending migrations to be executed.
     *
     * Delegates to the rendering strategy.
     *
     * @param scripts - Array of pending migration scripts
     */
    public drawTodoTable(scripts: MigrationScript[]): void {
        this.strategy.renderTodo(scripts);
    }

    /**
     * Draw table of ignored migrations.
     *
     * Delegates to the rendering strategy.
     *
     * @param scripts - Array of ignored migration scripts
     */
    public drawIgnoredTable(scripts: MigrationScript[]): void {
        this.strategy.renderIgnored(scripts);
    }

    /**
     * Draw table of migrations that were executed in the current run.
     *
     * Delegates to the rendering strategy.
     *
     * @param scripts - Array of executed migration information
     */
    public drawExecutedTable(scripts: IMigrationInfo[]): void {
        this.strategy.renderExecuted(scripts);
    }
}