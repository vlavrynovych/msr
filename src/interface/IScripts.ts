import {MigrationScript} from "../model";

export interface IScripts {
    all: MigrationScript[]
    migrated: MigrationScript[]
    todo: MigrationScript[]
    executed: MigrationScript[]
}