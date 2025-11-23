import moment from "moment";

import {IRenderStrategy, IScripts, IMigrationInfo, ILogger, IDatabaseMigrationHandler} from "../../interface";
import {MigrationScript} from "../../model";
import {ConsoleLogger} from "../../logger";

/**
 * JSON rendering strategy for structured output.
 *
 * Renders migration information as JSON, making it suitable for:
 * - CI/CD pipelines
 * - Programmatic consumption
 * - Logging systems
 * - API responses
 * - Integration with other tools
 *
 * Output can be prettified (indented) or compact (single line).
 *
 * @example
 * ```typescript
 * // Pretty JSON for human reading
 * const strategy = new JsonRenderStrategy(true);
 *
 * // Compact JSON for logging systems
 * const strategy = new JsonRenderStrategy(false);
 * ```
 */
export class JsonRenderStrategy implements IRenderStrategy {
    /**
     * Creates a new JsonRenderStrategy.
     *
     * @param pretty - Whether to format JSON with indentation (default: true)
     * @param logger - Logger instance for outputting JSON (defaults to ConsoleLogger)
     */
    constructor(
        private pretty: boolean = true,
        private logger: ILogger = new ConsoleLogger()
    ) {}

    /**
     * Render the list of previously executed migrations as JSON.
     *
     * Output format:
     * ```json
     * {
     *   "migrated": [
     *     {
     *       "timestamp": 202501220100,
     *       "name": "V202501220100_initial.ts",
     *       "executed": "2025-01-22T10:00:00Z",
     *       "executedAgo": "2 hours ago",
     *       "duration": 2.5,
     *       "username": "developer",
     *       "foundLocally": true
     *     }
     *   ]
     * }
     * ```
     *
     * @param scripts - Collection of migration scripts with execution history
     * @param handler - Database handler for accessing configuration
     * @param limit - Optional limit on number of migrations to display (0 = all)
     */
    renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit = 0): void {
        if (!scripts.migrated.length) return;

        let migrated = scripts.migrated;
        if (limit > 0) {
            migrated = migrated
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
        }

        const output = {
            migrated: migrated.map(m => ({
                timestamp: m.timestamp,
                name: m.name,
                executed: moment(m.finishedAt).toISOString(),
                executedAgo: moment(m.finishedAt).fromNow(),
                duration: moment.duration(moment(m.finishedAt).diff(moment(m.startedAt))).asSeconds(),
                username: m.username,
                foundLocally: (scripts.all || []).some(s => s.timestamp === m.timestamp)
            }))
        };

        this.logger.log(JSON.stringify(output, null, this.pretty ? 2 : 0));
    }

    /**
     * Render the list of pending migrations as JSON.
     *
     * Output format:
     * ```json
     * {
     *   "todo": [
     *     {
     *       "timestamp": 202501220100,
     *       "name": "V202501220100_initial.ts",
     *       "path": "/path/to/V202501220100_initial.ts"
     *     }
     *   ]
     * }
     * ```
     *
     * @param scripts - Array of pending migration scripts
     */
    renderTodo(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const output = {
            todo: scripts.map(s => ({
                timestamp: s.timestamp,
                name: s.name,
                path: s.filepath
            }))
        };

        this.logger.log(JSON.stringify(output, null, this.pretty ? 2 : 0));
    }

    /**
     * Render the list of executed migrations as JSON.
     *
     * Output format:
     * ```json
     * {
     *   "executed": [
     *     {
     *       "timestamp": 202501220100,
     *       "name": "V202501220100_initial.ts",
     *       "duration": 2.5,
     *       "result": "Migration completed successfully"
     *     }
     *   ]
     * }
     * ```
     *
     * @param scripts - Array of executed migration information
     */
    renderExecuted(scripts: IMigrationInfo[]): void {
        if (!scripts.length) return;

        const output = {
            executed: scripts.map(m => ({
                timestamp: m.timestamp,
                name: m.name,
                duration: moment.duration(moment(m.finishedAt).diff(moment(m.startedAt))).asSeconds(),
                result: m.result
            }))
        };

        this.logger.log(JSON.stringify(output, null, this.pretty ? 2 : 0));
    }

    /**
     * Render the list of ignored migrations as JSON.
     *
     * Output format:
     * ```json
     * {
     *   "ignored": [
     *     {
     *       "timestamp": 202501220100,
     *       "name": "V202501220100_old.ts",
     *       "path": "/path/to/V202501220100_old.ts"
     *     }
     *   ]
     * }
     * ```
     *
     * @param scripts - Array of ignored migration scripts
     */
    renderIgnored(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const output = {
            ignored: scripts.map(s => ({
                timestamp: s.timestamp,
                name: s.name,
                path: s.filepath
            }))
        };

        this.logger.warn(JSON.stringify(output, null, this.pretty ? 2 : 0));
    }

    /**
     * Render banner information as JSON.
     *
     * Output format:
     * ```json
     * {
     *   "banner": {
     *     "application": "Migration Script Runner",
     *     "version": "v0.3.0",
     *     "handler": "PostgreSQL Handler"
     *   }
     * }
     * ```
     *
     * @param version - Application version string
     * @param handlerName - Name of the database handler being used
     */
    renderBanner(version: string, handlerName: string): void {
        const output = {
            banner: {
                application: "Migration Script Runner",
                version: `v.${version}`,
                handler: handlerName
            }
        };

        this.logger.log(JSON.stringify(output, null, this.pretty ? 2 : 0));
    }
}
