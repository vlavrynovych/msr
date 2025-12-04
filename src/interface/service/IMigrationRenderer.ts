import {IScripts} from "../IScripts";
import {MigrationScript} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";
import {IDB} from "../dao";

/**
 * Interface for rendering migration information.
 *
 * Provides methods for displaying migration status, executed migrations,
 * pending migrations, and other migration-related information in various
 * output formats (ASCII tables, JSON, silent, etc.) depending on the
 * configured rendering strategy.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 */
export interface IMigrationRenderer<DB extends IDB> {
    /**
     * Draw ASCII art banner with application name and version.
     *
     * Displays a figlet-style banner at the start of migration execution.
     */
    drawFiglet(): void;

    /**
     * Draw already executed migrations.
     *
     * Shows all migrations that have been previously applied to the database,
     * including their execution time, duration, and status.
     * Uses config.displayLimit to determine how many migrations to show.
     *
     * @param scripts - Collection of migration scripts with execution history (typed with generic DB parameter in v0.6.0)
     */
    drawMigrated(scripts: IScripts<DB>): void;

    /**
     * Draw pending migrations to be executed.
     *
     * Shows migrations that haven't been applied yet and are queued for execution.
     *
     * @param scripts - Array of pending migration scripts (typed with generic DB parameter in v0.6.0)
     */
    drawPending(scripts: MigrationScript<DB>[]): void;

    /**
     * Draw ignored migrations.
     *
     * Shows migrations that were skipped because they are older than
     * the last executed migration or don't match the execution criteria.
     *
     * @param scripts - Array of ignored migration scripts (typed with generic DB parameter in v0.6.0)
     */
    drawIgnored(scripts: MigrationScript<DB>[]): void;

    /**
     * Draw migrations that were executed in the current run.
     *
     * Shows summary of migrations that were just executed, including
     * their duration and result status.
     *
     * @param scripts - Array of executed migration information
     */
    drawExecuted(scripts: IMigrationInfo[]): void;
}
