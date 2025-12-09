import {ILogger} from "../../interface/ILogger";
import {IMigrationRenderer} from "../../interface/service/IMigrationRenderer";
import {IDB} from "../../interface";

/**
 * Facade for output-related services (logging and rendering).
 *
 * Groups services responsible for displaying information to the user,
 * including logging messages and rendering migration status tables.
 *
 * @template DB - Database interface type
 *
 * @since v0.7.0
 */
export class OutputServices<DB extends IDB> {
    /**
     * Creates a new OutputServices facade.
     *
     * @param logger - Logger for writing messages to console/file
     * @param renderer - Renderer for formatting and displaying migration tables
     */
    constructor(
        public readonly logger: ILogger,
        public readonly renderer: IMigrationRenderer<DB>
    ) {}
}
