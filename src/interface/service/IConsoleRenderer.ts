import {IScripts} from "../IScripts";
import {MigrationScript} from "../../model";
import {IMigrationInfo} from "../IMigrationInfo";

/**
 * Interface for rendering migration information to the console.
 *
 * Provides methods for displaying migration status, executed migrations,
 * pending migrations, and other migration-related information in a
 * formatted, user-friendly way.
 */
export interface IConsoleRenderer {
    /**
     * Draw ASCII art banner with application name and version.
     *
     * Displays a figlet-style banner at the start of migration execution.
     */
    drawFiglet(): void;

    /**
     * Draw table of already executed migrations.
     *
     * Shows all migrations that have been previously applied to the database,
     * including their execution time, duration, and status.
     *
     * @param scripts - Collection of migration scripts with execution history
     * @param number - Optional limit on number of migrations to display (0 = all)
     */
    drawMigrated(scripts: IScripts, number?: number): void;

    /**
     * Draw table of pending migrations to be executed.
     *
     * Shows migrations that haven't been applied yet and are queued for execution.
     *
     * @param scripts - Array of pending migration scripts
     */
    drawTodoTable(scripts: MigrationScript[]): void;

    /**
     * Draw table of ignored migrations.
     *
     * Shows migrations that were skipped because they are older than
     * the last executed migration or don't match the execution criteria.
     *
     * @param scripts - Array of ignored migration scripts
     */
    drawIgnoredTable(scripts: MigrationScript[]): void;

    /**
     * Draw table of migrations that were executed in the current run.
     *
     * Shows summary of migrations that were just executed, including
     * their duration and result status.
     *
     * @param scripts - Array of executed migration information
     */
    drawExecutedTable(scripts: IMigrationInfo[]): void;
}
