import { expect } from 'chai';
import { MigrationScriptSelector, MigrationScript } from "../../../src";

describe('MigrationScriptSelector', () => {
    let selector: MigrationScriptSelector;

    beforeEach(() => {
        selector = new MigrationScriptSelector();
    });

    describe('getPending()', () => {

        /**
         * Test: getPending returns all scripts when database is empty
         * Validates that when no migrations have been executed yet,
         * getPending returns all available migration scripts for execution.
         * This represents the initial migration scenario where everything
         * needs to be executed.
         */
        it('should return all scripts when no migrations have been executed', () => {
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];
            const migratedScripts: MigrationScript[] = [];

            const result = selector.getPending(migratedScripts, allScripts);

            expect(result).to.have.lengthOf(3);
            expect(result).to.deep.equal(allScripts);
        });

        /**
         * Test: getPending returns only scripts newer than last executed migration
         * Validates that getPending correctly filters out already-executed migrations
         * and returns only new scripts that should be executed. This ensures
         * incremental migrations work correctly.
         */
        it('should return only new scripts newer than last migration', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3'),
                createScript(4, 'migration4')
            ];

            const result = selector.getPending(migratedScripts, allScripts);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(3);
            expect(result[1].timestamp).to.equal(4);
        });

        /**
         * Test: getPending excludes scripts older than last executed migration
         * Validates that scripts with timestamps older than the most recent
         * executed migration are ignored. This prevents out-of-order migrations
         * from being executed after newer migrations have already run.
         */
        it('should exclude scripts older than last migration', () => {
            const migratedScripts = [
                createScript(5, 'migration5')
            ];
            const allScripts = [
                createScript(1, 'migration1'), // older - should be ignored
                createScript(3, 'migration3'), // older - should be ignored
                createScript(5, 'migration5'), // already migrated
                createScript(7, 'migration7'), // newer - should be included
                createScript(9, 'migration9')  // newer - should be included
            ];

            const result = selector.getPending(migratedScripts, allScripts);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(7);
            expect(result[1].timestamp).to.equal(9);
        });

        /**
         * Test: getPending returns empty array when all migrations executed
         * Validates that when all available migration scripts have already
         * been executed, getPending returns an empty array. This indicates
         * the database is up to date.
         */
        it('should return empty array when all scripts are already migrated', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            const result = selector.getPending(migratedScripts, allScripts);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getPending handles empty scripts array gracefully
         * Validates that when no migration scripts exist in the migrations
         * folder, getPending returns an empty array without errors. This handles
         * the edge case of an empty migrations directory.
         */
        it('should handle empty all scripts array', () => {
            const migratedScripts = [
                createScript(1, 'migration1')
            ];
            const allScripts: MigrationScript[] = [];

            const result = selector.getPending(migratedScripts, allScripts);

            expect(result).to.be.an('array').that.is.empty;
        });
    });

    describe('getIgnored()', () => {

        /**
         * Test: getIgnored returns empty array when no migrations executed
         * Validates that when starting with an empty database, getIgnored
         * returns an empty array since there are no migrations to ignore yet.
         * All scripts would be in the todo list instead.
         */
        it('should return empty array when no migrations have been executed', () => {
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];
            const migratedScripts: MigrationScript[] = [];

            const result = selector.getIgnored(migratedScripts, allScripts);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getIgnored returns scripts older than last executed migration
         * Validates that getIgnored correctly identifies migration scripts that
         * have timestamps older than the most recent executed migration. These
         * represent out-of-order migrations that will be skipped.
         */
        it('should return scripts older than last migration', () => {
            const migratedScripts = [
                createScript(5, 'migration5')
            ];
            const allScripts = [
                createScript(1, 'migration1'), // older - should be ignored
                createScript(3, 'migration3'), // older - should be ignored
                createScript(5, 'migration5'), // already migrated
                createScript(7, 'migration7')  // newer - not ignored
            ];

            const result = selector.getIgnored(migratedScripts, allScripts);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(1);
            expect(result[1].timestamp).to.equal(3);
        });

        /**
         * Test: getIgnored returns empty array when all scripts are in sequence
         * Validates that when all migration scripts are newer than or equal to
         * the last executed migration, getIgnored returns an empty array. This
         * represents the normal incremental migration scenario.
         */
        it('should return empty array when no scripts are ignored', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3') // newer - not ignored
            ];

            const result = selector.getIgnored(migratedScripts, allScripts);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getIgnored handles scenario where all new scripts are outdated
         * Validates behavior when multiple scripts are discovered that all have
         * timestamps older than the last executed migration. This can happen
         * when scripts are added to an older branch and merged later.
         */
        it('should handle all new scripts being older than last migration', () => {
            const migratedScripts = [
                createScript(10, 'migration10')
            ];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3'),
                createScript(10, 'migration10')
            ];

            const result = selector.getIgnored(migratedScripts, allScripts);

            expect(result).to.have.lengthOf(3);
            expect(result[0].timestamp).to.equal(1);
            expect(result[1].timestamp).to.equal(2);
            expect(result[2].timestamp).to.equal(3);
        });

        /**
         * Test: getIgnored handles empty scripts array gracefully
         * Validates that when no migration scripts exist in the migrations
         * folder, getIgnored returns an empty array without errors. Edge case
         * for empty migrations directory.
         */
        it('should handle empty all scripts array', () => {
            const migratedScripts = [
                createScript(5, 'migration5')
            ];
            const allScripts: MigrationScript[] = [];

            const result = selector.getIgnored(migratedScripts, allScripts);

            expect(result).to.be.an('array').that.is.empty;
        });
    });

    describe('getPending() and getIgnored() together', () => {

        /**
         * Test: getPending and getIgnored partition scripts correctly without overlap
         * Validates that getPending and getIgnored work together to partition all
         * migration scripts into two non-overlapping sets: scripts to execute
         * and scripts to ignore. This ensures the migration system correctly
         * categorizes every script.
         */
        it('should partition scripts correctly', () => {
            const migratedScripts = [
                createScript(5, 'migration5')
            ];
            const allScripts = [
                createScript(1, 'migration1'), // ignored
                createScript(2, 'migration2'), // ignored
                createScript(5, 'migration5'), // migrated
                createScript(7, 'migration7'), // todo
                createScript(9, 'migration9')  // todo
            ];

            const todo = selector.getPending(migratedScripts, allScripts);
            const ignored = selector.getIgnored(migratedScripts, allScripts);

            // Verify todo
            expect(todo).to.have.lengthOf(2);
            expect(todo.map(s => s.timestamp)).to.deep.equal([7, 9]);

            // Verify ignored
            expect(ignored).to.have.lengthOf(2);
            expect(ignored.map(s => s.timestamp)).to.deep.equal([1, 2]);

            // Verify no overlap
            const todoTimestamps = new Set(todo.map(s => s.timestamp));
            const ignoredTimestamps = new Set(ignored.map(s => s.timestamp));
            const intersection = [...todoTimestamps].filter(t => ignoredTimestamps.has(t));
            expect(intersection).to.be.empty;
        });
    });
});

/**
 * Helper function to create a migration script for testing.
 *
 * Creates a minimal MigrationScript instance with the required properties
 * for testing. The script is not fully initialized - the up() method is
 * not set, so tests that need to execute the script should set it manually.
 *
 * @param timestamp - Unix timestamp for the migration (e.g., 202311020036)
 * @param name - Descriptive name for the migration without V prefix (e.g., 'add_users_table')
 * @returns MigrationScript instance with name, filepath, and timestamp set
 *
 * @example
 * const script = createScript(123, 'add_users_table');
 * // Creates script named 'V123_add_users_table.ts' at '/fake/path/V123_add_users_table.ts'
 */
function createScript(timestamp: number, name: string): MigrationScript {
    const filename = `V${timestamp}_${name}.ts`;
    const script = new MigrationScript(filename, `/fake/path/${filename}`, timestamp);
    return script;
}
