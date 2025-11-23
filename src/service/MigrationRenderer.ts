import {version} from '../../package.json'

import {IMigrationInfo, IDatabaseMigrationHandler, IScripts, MigrationScript, ILogger, IMigrationRenderer, IRenderStrategy, Config} from "../index";
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
     * @param config - Configuration for migrations
     * @param logger - Logger instance (defaults to ConsoleLogger)
     * @param strategy - Rendering strategy (defaults to AsciiTableRenderStrategy)
     */
    constructor(
        private handler: IDatabaseMigrationHandler,
        private config: Config,
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
     * Uses config.displayLimit to determine how many migrations to show.
     *
     * @param scripts - Collection of migration scripts with execution history
     */
    public drawMigrated(scripts: IScripts): void {
        this.strategy.renderMigrated(scripts, this.config);
    }

    /**
     * Draw pending migrations to be executed.
     *
     * Delegates to the rendering strategy.
     *
     * @param scripts - Array of pending migration scripts
     */
    public drawPending(scripts: MigrationScript[]): void {
        this.strategy.renderPending(scripts);
    }

    /**
     * Draw ignored migrations.
     *
     * Delegates to the rendering strategy.
     *
     * @param scripts - Array of ignored migration scripts
     */
    public drawIgnored(scripts: MigrationScript[]): void {
        this.strategy.renderIgnored(scripts);
    }

    /**
     * Draw migrations that were executed in the current run.
     *
     * Delegates to the rendering strategy.
     *
     * @param scripts - Array of executed migration information
     */
    public drawExecuted(scripts: IMigrationInfo[]): void {
        this.strategy.renderExecuted(scripts);
    }
}