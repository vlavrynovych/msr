import {IRenderStrategy, IScripts, IMigrationInfo} from "../../interface";
import {MigrationScript, Config} from "../../model";

/**
 * Silent rendering strategy that produces no output.
 *
 * This strategy suppresses all rendering output, making it ideal for:
 * - Unit testing (prevents console clutter)
 * - Library usage (when output is unwanted)
 * - Background/automated processes
 * - Headless environments
 * - When using custom logging/monitoring systems
 *
 * All methods are no-ops, ensuring zero visual output.
 *
 * @example
 * ```typescript
 * // Use in tests
 * const strategy = new SilentRenderStrategy();
 * const renderer = new MigrationRenderer(handler, logger, strategy);
 *
 * // No output will be produced
 * renderer.drawMigrated(scripts);
 * renderer.drawPending(pending);
 * ```
 */
export class SilentRenderStrategy implements IRenderStrategy {
    /**
     * No-op: Produces no output for migrated scripts.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    renderMigrated(scripts: IScripts, config: Config): void {
        // Intentionally empty - silent strategy
    }

    /**
     * No-op: Produces no output for pending migrations.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    renderPending(scripts: MigrationScript[]): void {
        // Intentionally empty - silent strategy
    }

    /**
     * No-op: Produces no output for executed migrations.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    renderExecuted(scripts: IMigrationInfo[]): void {
        // Intentionally empty - silent strategy
    }

    /**
     * No-op: Produces no output for ignored migrations.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    renderIgnored(scripts: MigrationScript[]): void {
        // Intentionally empty - silent strategy
    }

    /**
     * No-op: Produces no banner output.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    renderBanner(version: string, handlerName: string): void {
        // Intentionally empty - silent strategy
    }
}
