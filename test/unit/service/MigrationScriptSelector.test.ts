import { expect } from 'chai';
import { IDB, MigrationScript, MigrationScriptSelector } from "../../../src";

describe('MigrationScriptSelector', () => {
    let selector: MigrationScriptSelector<IDB>;

    beforeEach(() => {
        selector = new MigrationScriptSelector<IDB>();
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
            const migratedScripts: MigrationScript<IDB>[] = [];

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
            const allScripts: MigrationScript<IDB>[] = [];

            const result = selector.getPending(migratedScripts, allScripts);

            expect(result).to.be.an('array').that.is.empty;
        });
    });

    describe('getIgnored()', () => {

        /**
         * Test: getIgnored returns empty array when no migrations executed
         * Validates that when starting with an empty database, getIgnored
         * returns an empty array since there are no migrations to ignore yet.
         * All scripts would be in the pending list instead.
         */
        it('should return empty array when no migrations have been executed', () => {
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];
            const migratedScripts: MigrationScript<IDB>[] = [];

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
            const allScripts: MigrationScript<IDB>[] = [];

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
                createScript(7, 'migration7'), // pending
                createScript(9, 'migration9')  // pending
            ];

            const pending = selector.getPending(migratedScripts, allScripts);
            const ignored = selector.getIgnored(migratedScripts, allScripts);

            // Verify pending
            expect(pending).to.have.lengthOf(2);
            expect(pending.map(s => s.timestamp)).to.deep.equal([7, 9]);

            // Verify ignored
            expect(ignored).to.have.lengthOf(2);
            expect(ignored.map(s => s.timestamp)).to.deep.equal([1, 2]);

            // Verify no overlap
            const pendingTimestamps = new Set(pending.map(s => s.timestamp));
            const ignoredTimestamps = new Set(ignored.map(s => s.timestamp));
            const intersection = [...pendingTimestamps].filter(t => ignoredTimestamps.has(t));
            expect(intersection).to.be.empty;
        });
    });

    describe('getPendingUpTo()', () => {

        /**
         * Test: getPendingUpTo returns migrations up to target version
         * Validates that when migrating to a specific version, only migrations
         * with timestamps <= targetVersion are returned, sorted chronologically.
         */
        it('should return pending migrations up to target version', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3'),
                createScript(4, 'migration4'),
                createScript(5, 'migration5')
            ];

            // Migrate up to version 4
            const result = selector.getPendingUpTo(migratedScripts, allScripts, 4);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(3);
            expect(result[1].timestamp).to.equal(4);
        });

        /**
         * Test: getPendingUpTo returns empty array when target already reached
         * Validates that when the target version has already been migrated,
         * getPendingUpTo returns an empty array.
         */
        it('should return empty array when target version already migrated', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3'),
                createScript(4, 'migration4')
            ];

            // Target version 2 is already migrated
            const result = selector.getPendingUpTo(migratedScripts, allScripts, 2);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getPendingUpTo returns all pending when target is beyond all
         * Validates that when the target version is higher than all available
         * migrations, all pending migrations are returned.
         */
        it('should return all pending migrations when target is beyond all scripts', () => {
            const migratedScripts = [
                createScript(1, 'migration1')
            ];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            // Target version 100 is beyond all scripts
            const result = selector.getPendingUpTo(migratedScripts, allScripts, 100);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(2);
            expect(result[1].timestamp).to.equal(3);
        });

        /**
         * Test: getPendingUpTo returns scripts in chronological order
         * Validates that migrations are sorted by timestamp in ascending order
         * for proper execution sequence.
         */
        it('should return migrations in chronological order', () => {
            const migratedScripts: MigrationScript<IDB>[] = [];
            const allScripts = [
                createScript(5, 'migration5'),
                createScript(1, 'migration1'),
                createScript(3, 'migration3'),
                createScript(2, 'migration2')
            ];

            const result = selector.getPendingUpTo(migratedScripts, allScripts, 4);

            expect(result).to.have.lengthOf(3);
            expect(result[0].timestamp).to.equal(1);
            expect(result[1].timestamp).to.equal(2);
            expect(result[2].timestamp).to.equal(3);
        });

        /**
         * Test: getPendingUpTo handles empty database
         * Validates that when no migrations have been executed, getPendingUpTo
         * correctly returns migrations up to the target version.
         */
        it('should handle empty migrated scripts', () => {
            const migratedScripts: MigrationScript<IDB>[] = [];
            const allScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            const result = selector.getPendingUpTo(migratedScripts, allScripts, 2);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(1);
            expect(result[1].timestamp).to.equal(2);
        });
    });

    describe('getMigratedDownTo()', () => {

        /**
         * Test: getMigratedDownTo returns migrations to roll back
         * Validates that migrations newer than the target version are returned
         * in reverse chronological order for proper rollback.
         */
        it('should return migrations to roll back in reverse order', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3'),
                createScript(4, 'migration4'),
                createScript(5, 'migration5')
            ];

            // Roll back to version 2
            const result = selector.getMigratedDownTo(migratedScripts, 2);

            expect(result).to.have.lengthOf(3);
            expect(result[0].timestamp).to.equal(5); // Newest first
            expect(result[1].timestamp).to.equal(4);
            expect(result[2].timestamp).to.equal(3);
        });

        /**
         * Test: getMigratedDownTo returns empty array when target is current
         * Validates that when the target version matches the newest migration,
         * no rollback is needed and an empty array is returned.
         */
        it('should return empty array when target is latest version', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            // Target version 3 is the latest
            const result = selector.getMigratedDownTo(migratedScripts, 3);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getMigratedDownTo handles rolling back to version 0
         * Validates that rolling back to version 0 returns all migrations
         * in reverse order, effectively undoing all migrations.
         */
        it('should return all migrations when rolling back to version 0', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            // Roll back everything
            const result = selector.getMigratedDownTo(migratedScripts, 0);

            expect(result).to.have.lengthOf(3);
            expect(result[0].timestamp).to.equal(3);
            expect(result[1].timestamp).to.equal(2);
            expect(result[2].timestamp).to.equal(1);
        });

        /**
         * Test: getMigratedDownTo handles empty migrated scripts
         * Edge case: when no migrations have been executed, there's nothing
         * to roll back, so an empty array should be returned.
         */
        it('should handle empty migrated scripts', () => {
            const migratedScripts: MigrationScript<IDB>[] = [];

            const result = selector.getMigratedDownTo(migratedScripts, 5);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getMigratedDownTo handles target beyond all migrations
         * Validates that when the target version is higher than all executed
         * migrations, no rollback is needed.
         */
        it('should return empty array when target is beyond all migrations', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2')
            ];

            // Target version 100 is beyond all migrations
            const result = selector.getMigratedDownTo(migratedScripts, 100);

            expect(result).to.be.an('array').that.is.empty;
        });
    });

    describe('getMigratedInRange()', () => {

        /**
         * Test: getMigratedInRange returns migrations within version range
         * Validates that only migrations between fromVersion (exclusive) and
         * toVersion (inclusive) are returned in reverse chronological order.
         */
        it('should return migrations within specified range', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3'),
                createScript(4, 'migration4'),
                createScript(5, 'migration5')
            ];

            // Get migrations between version 2 and 4 (exclusive 2, inclusive 4)
            const result = selector.getMigratedInRange(migratedScripts, 2, 4);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(4); // Reverse order
            expect(result[1].timestamp).to.equal(3);
        });

        /**
         * Test: getMigratedInRange excludes fromVersion
         * Validates that the fromVersion is excluded from the range (exclusive).
         */
        it('should exclude fromVersion from range', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            // Range from 1 to 2 - should only include 2 (1 is excluded)
            const result = selector.getMigratedInRange(migratedScripts, 1, 2);

            expect(result).to.have.lengthOf(1);
            expect(result[0].timestamp).to.equal(2);
        });

        /**
         * Test: getMigratedInRange includes toVersion
         * Validates that the toVersion is included in the range (inclusive).
         */
        it('should include toVersion in range', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            // Range from 1 to 3 - should include 3
            const result = selector.getMigratedInRange(migratedScripts, 1, 3);

            expect(result).to.have.lengthOf(2);
            expect(result[0].timestamp).to.equal(3);
            expect(result[1].timestamp).to.equal(2);
        });

        /**
         * Test: getMigratedInRange returns empty array when no migrations in range
         * Validates that when no migrations fall within the specified range,
         * an empty array is returned.
         */
        it('should return empty array when no migrations in range', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(5, 'migration5')
            ];

            // Range from 5 to 10 - no migrations in this range
            const result = selector.getMigratedInRange(migratedScripts, 5, 10);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getMigratedInRange handles reverse range (fromVersion > toVersion)
         * Edge case: when fromVersion is greater than toVersion, the range is
         * invalid and should return an empty array.
         */
        it('should return empty array for invalid range (from > to)', () => {
            const migratedScripts = [
                createScript(1, 'migration1'),
                createScript(2, 'migration2'),
                createScript(3, 'migration3')
            ];

            // Invalid range: from 3 to 1
            const result = selector.getMigratedInRange(migratedScripts, 3, 1);

            expect(result).to.be.an('array').that.is.empty;
        });

        /**
         * Test: getMigratedInRange returns migrations in reverse chronological order
         * Validates that migrations are sorted newest-first for proper rollback.
         */
        it('should return migrations in reverse chronological order', () => {
            const migratedScripts = [
                createScript(2, 'migration2'),
                createScript(5, 'migration5'),
                createScript(3, 'migration3'),
                createScript(4, 'migration4')
            ];

            // Get migrations from 1 to 5
            const result = selector.getMigratedInRange(migratedScripts, 1, 5);

            expect(result).to.have.lengthOf(4);
            expect(result[0].timestamp).to.equal(5);
            expect(result[1].timestamp).to.equal(4);
            expect(result[2].timestamp).to.equal(3);
            expect(result[3].timestamp).to.equal(2);
        });

        /**
         * Test: getMigratedInRange handles empty migrated scripts
         * Edge case: when no migrations have been executed, there's nothing
         * in any range, so an empty array should be returned.
         */
        it('should handle empty migrated scripts', () => {
            const migratedScripts: MigrationScript<IDB>[] = [];

            const result = selector.getMigratedInRange(migratedScripts, 1, 5);

            expect(result).to.be.an('array').that.is.empty;
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
function createScript(timestamp: number, name: string): MigrationScript<IDB> {
    const filename = `V${timestamp}_${name}.ts`;
    const script = new MigrationScript<IDB>(filename, `/fake/path/${filename}`, timestamp);
    return script;
}
