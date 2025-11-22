/**
 * Metadata about a migration script execution.
 *
 * Stores information about when a migration was executed, who ran it,
 * how long it took, and what result it returned. This information is
 * saved to the schema version tracking table in the database.
 *
 * @example
 * ```typescript
 * const info: IMigrationInfo = {
 *   name: 'V202501220100_initial_setup.ts',
 *   timestamp: 202501220100,
 *   startedAt: 1737504000000,
 *   finishedAt: 1737504005000,
 *   username: 'developer',
 *   result: 'Tables created successfully'
 * };
 * ```
 */
export class IMigrationInfo {
    /**
     * Filename of the migration script.
     * @example 'V202501220100_initial_setup.ts'
     */
    name!:string

    /**
     * Numeric timestamp extracted from the migration filename.
     * Used for ordering migrations chronologically.
     * @example 202501220100
     */
    timestamp!:number

    /**
     * Unix timestamp (milliseconds) when the migration execution started.
     * @default Date.now()
     */
    startedAt:number = Date.now()

    /**
     * Unix timestamp (milliseconds) when the migration execution finished.
     */
    finishedAt!:number

    /**
     * Username of the person who executed the migration.
     * Typically obtained from os.userInfo().username
     * @example 'developer'
     */
    username!:string

    /**
     * Optional result returned by the migration's up() method.
     * Can be used to store success messages, row counts, or other metadata.
     * @example 'Created 3 tables successfully'
     */
    result?:string
}