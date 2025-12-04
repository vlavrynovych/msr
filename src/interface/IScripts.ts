import {MigrationScript} from "../model";
import {IDB} from "./dao";

/**
 * Represents the complete state of migrations in the system.
 *
 * **Generic Type Parameters (v0.6.0 - BREAKING CHANGE):**
 * - `DB` - Your specific database interface extending IDB (REQUIRED)
 *
 * @template DB - Database interface type
 *
 * @property all - All migration scripts found in the filesystem
 * @property migrated - Previously executed migrations from database history
 * @property pending - Migrations waiting to be executed (newer than last executed)
 * @property ignored - Migrations skipped because they're older than the last executed
 * @property executed - Migrations executed during the current run
 */
export interface IScripts<DB extends IDB> {
    all: MigrationScript<DB>[]
    migrated: MigrationScript<DB>[]
    pending: MigrationScript<DB>[]
    ignored: MigrationScript<DB>[]
    executed: MigrationScript<DB>[]
}