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

    /**
     * Optional checksum of the migration file contents.
     * Used to detect if a migration file has been modified after execution.
     * The algorithm (MD5, SHA256) is determined by config.checksumAlgorithm.
     * @example 'a3c9f8e2b1d4c7e6f5a8b9c0d1e2f3a4'
     */
    checksum?:string

    /**
     * Indicates whether this migration was executed in dry run mode.
     * When true, the migration was tested but all changes were rolled back.
     * **New in v0.5.0**
     * @default false
     */
    dryRun?:boolean
}