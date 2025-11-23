import {MigrationScript} from "../model";

/**
 * Represents the complete state of migrations in the system.
 *
 * @property all - All migration scripts found in the filesystem
 * @property migrated - Previously executed migrations from database history
 * @property pending - Migrations waiting to be executed (newer than last executed)
 * @property ignored - Migrations skipped because they're older than the last executed
 * @property executed - Migrations executed during the current run
 */
export interface IScripts {
    all: MigrationScript[]
    migrated: MigrationScript[]
    pending: MigrationScript[]
    ignored: MigrationScript[]
    executed: MigrationScript[]
}