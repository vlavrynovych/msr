import moment from "moment";
import figlet from "figlet";
import {AsciiTable3, AlignmentEnum} from 'ascii-table3';
import _ from "lodash";

import {IRenderStrategy, IScripts, IMigrationInfo, ILogger} from "../../interface";
import {MigrationScript, Config} from "../../model";
import {ConsoleLogger} from "../../logger";

/**
 * ASCII table rendering strategy for console output.
 *
 * Renders migration information as formatted ASCII tables, providing a rich,
 * visual output suitable for terminal/CLI usage. This is the default rendering
 * strategy when using MigrationRenderer.
 *
 * Features:
 * - ASCII art banner with application name
 * - Formatted tables with borders and alignment
 * - Human-readable timestamps with relative time ("2 hours ago")
 * - Color-coded warnings for ignored migrations
 *
 * @example
 * ```typescript
 * const strategy = new AsciiTableRenderStrategy(logger);
 * const renderer = new MigrationRenderer(handler, logger, strategy);
 * ```
 */
export class AsciiTableRenderStrategy implements IRenderStrategy {
    /**
     * Creates a new AsciiTableRenderStrategy.
     *
     * @param logger - Logger instance for outputting tables (defaults to ConsoleLogger)
     */
    constructor(private logger: ILogger = new ConsoleLogger()) {}

    /**
     * Render the list of previously executed migrations as an ASCII table.
     *
     * Displays:
     * - Timestamp
     * - Migration name (without version prefix)
     * - Execution date and relative time
     * - Duration
     * - Username
     * - Whether the migration file still exists locally
     *
     * Uses config.displayLimit to determine how many migrations to show.
     *
     * @param scripts - Collection of migration scripts with execution history
     * @param config - Configuration for accessing file pattern and display limit
     */
    renderMigrated(scripts: IScripts, config: Config): void {
        if (!scripts.migrated.length) return;

        let migrated = scripts.migrated;
        const limit = config.displayLimit;
        if (limit > 0) {
            migrated = _
                .chain(migrated)
                .orderBy(['timestamp'], ['desc'])
                .take(limit)
                .value();
        }

        const table = new AsciiTable3('Migrated');
        table.setHeading('Timestamp', 'Name', 'Executed', 'Duration', 'Username', 'Found Locally');
        table.setAlign(4, AlignmentEnum.CENTER);

        migrated.forEach(m => {
            const finished = moment(m.finishedAt);
            const date = finished.format('YYYY/MM/DD HH:mm');
            const ago = finished.fromNow();
            // Try each pattern to remove the timestamp prefix for display
            let name = m.name;
            for (const pattern of config.filePatterns) {
                const cleaned = m.name.replace(pattern, '');
                if (cleaned !== m.name) {
                    name = cleaned;
                    break;
                }
            }
            const found = (scripts.all || []).find(s => s.timestamp === m.timestamp) ? 'Y' : 'N';
            table.addRow(m.timestamp, name, `${date} (${ago})`, AsciiTableRenderStrategy.getDuration(m), m.username, found);
        });

        this.logger.log(table.toString());
    }

    /**
     * Render the list of pending migrations as an ASCII table.
     *
     * Displays:
     * - Timestamp
     * - Migration name
     * - Full file path
     *
     * @param scripts - Array of pending migration scripts
     */
    renderPending(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const table = new AsciiTable3('Pending');
        table.setHeading('Timestamp', 'Name', 'Path');
        scripts.forEach(m => table.addRow(m.timestamp, m.name, m.filepath));
        this.logger.log(table.toString());
    }

    /**
     * Render the list of executed migrations as an ASCII table.
     *
     * Shows migrations that were executed in the current run.
     *
     * Displays:
     * - Timestamp
     * - Migration name
     * - Duration
     * - Result message
     *
     * @param scripts - Array of executed migration information
     */
    renderExecuted(scripts: IMigrationInfo[]): void {
        if (!scripts.length) return;

        const table = new AsciiTable3('Executed');
        table.setHeading('Timestamp', 'Name', 'Duration', 'Result');
        scripts.forEach(m => table.addRow(m.timestamp, m.name, AsciiTableRenderStrategy.getDuration(m), m.result));
        this.logger.log(table.toString());
    }

    /**
     * Render the list of ignored migrations as an ASCII table with warning style.
     *
     * Migrations are ignored when they are older than the last executed migration.
     *
     * Displays:
     * - Timestamp
     * - Migration name
     * - Full file path
     *
     * @param scripts - Array of ignored migration scripts
     */
    renderIgnored(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const table = new AsciiTable3('Ignored Scripts');
        table.setHeading('Timestamp', 'Name', 'Path');
        scripts.forEach(m => table.addRow(m.timestamp, m.name, m.filepath));
        this.logger.warn(table.toString());
    }

    /**
     * Render ASCII art banner with application name and version.
     *
     * Displays a figlet-style banner:
     * ```
     *  __  __ _                 _   _               ____            _       _
     * |  \/  (_) __ _ _ __ __ _| |_(_) ___  _ __   / ___|  ___ _ __(_)_ __ | |_
     * | |\/| | |/ _` | '__/ _` | __| |/ _ \| '_ \  \___ \ / __| '__| | '_ \| __|
     * | |  | | | (_| | | | (_| | |_| | (_) | | | |  ___) | (__| |  | | |_) | |_
     * |_|  |_|_|\__, |_|  \__,_|\__|_|\___/|_| |_| |____/ \___|_|  |_| .__/ \__|
     *           |___/                                                |_| MSR v0.3.0: Handler Name
     * ```
     *
     * @param version - Application version string
     * @param handlerName - Name of the database handler being used
     */
    renderBanner(version: string, handlerName: string): void {
        let text = figlet.textSync("Migration Script Runner");
        text = text.replace('|_|                                     ',
            `|_| MSR v${version}: ${handlerName}`);
        this.logger.log(text);
    }

    /**
     * Calculate and format the duration of a migration execution.
     *
     * @param m - Migration info with start and finish timestamps
     * @returns Duration formatted as "{seconds}s" (e.g., "2.5s", "0.123s")
     *
     * @example
     * ```typescript
     * const duration = AsciiTableRenderStrategy.getDuration(migrationInfo);
     * // Returns: "2.5s"
     * ```
     */
    public static getDuration(m: IMigrationInfo): string {
        const duration = moment.duration(moment(m.finishedAt).diff(moment(m.startedAt))).asSeconds();
        return `${duration}s`;
    }
}
