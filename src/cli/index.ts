/**
 * CLI module exports.
 *
 * Provides factory function and utilities for creating CLI programs
 * with migration commands.
 */

export {createCLI, CLIOptions} from './createCLI';
export {CLIFlags, mapFlagsToConfig} from './utils/flagMapper';
export {EXIT_CODES} from './utils/exitCodes';
export {
    addMigrateCommand,
    addListCommand,
    addDownCommand,
    addValidateCommand,
    addBackupCommand
} from './commands';
