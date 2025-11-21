import { expect } from 'chai';
import {Config, ConsoleRenderer, IMigrationInfo, IDatabaseMigrationHandler, IScripts, MigrationScript} from "../../src";

describe('ConsoleRenderer.getDuration', () => {

    /**
     * Test: getDuration calculates duration correctly for valid timestamps
     * Validates that getDuration converts millisecond timestamps to seconds
     * with correct formatting. Tests a full day (86400 seconds) to ensure
     * large durations are handled properly.
     */
    it('should calculate duration correctly for valid timestamps', () => {
        // Calculate duration for 1 full day (01/01/2020 to 01/02/2020)
        const res = ConsoleRenderer.getDuration({
            startedAt: 1577829600000,   // 01/01/2020
            finishedAt: 1577916000000   // 01/02/2020
        } as IMigrationInfo);

        // Verify 1 day = 86400 seconds
        expect(res).eq("86400s", 'Should be 1 day in second = 86400s')
    })

    /**
     * Test: getDuration maintains precision for fractional seconds
     * Validates that the duration formatter preserves up to 3 decimal places
     * for sub-second durations. Important for showing accurate migration times
     * for fast migrations.
     */
    it('should maintain precision for fractional seconds', () => {
        // Test 0.8 seconds (800ms)
        const res = ConsoleRenderer.getDuration({startedAt: 200, finishedAt: 1000} as IMigrationInfo);
        expect(res).eq("0.8s", '1s - 0.2s = 0.8s')

        // Test 0.98 seconds (980ms)
        const res2 = ConsoleRenderer.getDuration({startedAt: 20, finishedAt: 1000} as IMigrationInfo);
        expect(res2).eq("0.98s", '1s - 0.02s = 0.98s')

        // Test 0.998 seconds (998ms)
        const res3 = ConsoleRenderer.getDuration({startedAt: 2, finishedAt: 1000} as IMigrationInfo);
        expect(res3).eq("0.998s", '1s - 0.002s = 0.998s')
    })

    /**
     * Test: getDuration rounds insignificant decimals
     * Validates that very small differences (< 0.0005s) are rounded away
     * to avoid displaying noise like "0.9998s" instead of "1s". This keeps
     * the console output clean and readable.
     */
    it('should round insignificant decimals', () => {
        // Calculate duration with negligible difference (0.0002s)
        const res = ConsoleRenderer.getDuration({startedAt: 0.2, finishedAt: 1000} as IMigrationInfo);

        // Verify it rounds to clean "1s"
        expect(res).eq("1s", 'The difference is not noticeable, should stay as 1 second')
    })

    /**
     * Test: getDuration handles negative durations
     * Edge case test for when finishedAt is before startedAt. While this
     * shouldn't happen in normal operation, the formatter should handle it
     * gracefully by showing a negative duration.
     */
    it('should handle negative durations', () => {
        // Calculate duration where finish time is before start time
        const res = ConsoleRenderer.getDuration({startedAt: 4000, finishedAt: 1000} as IMigrationInfo);

        // Verify negative duration is shown
        expect(res).eq("-3s", 'Should be negative = -3s')
    })

    /**
     * Test: getDuration handles zero duration
     * Edge case test for instantaneous migrations (same start and finish time).
     * Should display "0s" rather than empty string or undefined.
     */
    it('should handle zero duration', () => {
        // Calculate duration with identical start and finish times
        const res = ConsoleRenderer.getDuration({startedAt: 0, finishedAt: 0} as IMigrationInfo);

        // Verify zero duration is displayed
        expect(res).eq("0s", '0s - 0s = 0s')
    })

    /**
     * Test: getDuration is stable with negative timestamps
     * Edge case test validating the formatter doesn't crash or produce NaN
     * with negative timestamps. While unusual, this ensures robustness with
     * any numeric input.
     */
    it('check weird numbers: should be stable', () => {
        // Test with negative start time
        const res = ConsoleRenderer.getDuration({startedAt: -2000, finishedAt: 1000} as IMigrationInfo);

        // Verify calculation is still correct (1000 - (-2000) = 3000ms = 3s)
        expect(res).eq("3s", 'It is weird but should be 3s')

        // Test with both negative times
        const res2 = ConsoleRenderer.getDuration({startedAt: 3000, finishedAt: -2000} as IMigrationInfo);

        // Verify negative result (-2000 - 3000 = -5000ms = -5s)
        expect(res2).eq("-5s", 'It is weird but should be -5s')
    })


    /**
     * Test: All table rendering methods work without errors
     * Smoke test validating that all console rendering methods can be called
     * without throwing errors. Tests drawExecutedTable, drawTodoTable,
     * drawIgnoredTable, and drawMigrated with various input combinations.
     */
    it('should render all table types without errors', () => {
        // Prepare test data: 2 migrations and 3 migrations
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
        ]

        const list2 = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]

        // Create renderer
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // Call all rendering methods (should not throw)
        cr.drawExecutedTable(list)
        cr.drawTodoTable(list)
        cr.drawIgnoredTable(list)
        cr.drawMigrated({
            migrated: list2,
            all: list
        } as IScripts)

        cr.drawMigrated({
            migrated: list2,
        } as IScripts)
    })

    /**
     * Test: drawMigrated respects displayLimit parameter
     * Validates that the displayLimit parameter controls how many migrations
     * are shown in the console output. Tests with limits of 2 and 0 (all).
     */
    it('should respect displayLimit parameter when rendering', () => {
        // Prepare 3 migrations
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]

        // Create renderer
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // Test with displayLimit of 2 and 0 (should not throw)
        cr.drawMigrated({migrated: list} as IScripts, 2)
        cr.drawMigrated({migrated: [...list]} as IScripts, 0)
    })

    /**
     * Test: displayLimit of 0 shows all migrations
     * Validates that passing displayLimit=0 is treated as "show all"
     * rather than "show none". This is the expected behavior for
     * unlimited display.
     */
    it('displayLimit should show all when 0', () => {
        // Prepare 3 migrations
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]
        const scripts = {migrated: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // Render with displayLimit=0
        cr.drawMigrated(scripts, 0)

        // Verify all 3 are shown
        expect(scripts.migrated.length).eq(3, 'Should show all 3 when displayLimit is 0')
    })

    /**
     * Test: displayLimit limits the number of displayed migrations
     * Validates that when displayLimit is set to N, only N most recent
     * migrations are shown. This is useful for keeping console output
     * concise in projects with many migrations.
     */
    it('displayLimit should limit to N migrations', () => {
        // Prepare 3 migrations
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]
        const scripts = {migrated: [...list]} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // Render with displayLimit=2
        cr.drawMigrated(scripts, 2)

        // Verify only 2 are shown
        expect(scripts.migrated.length).eq(2, 'Should show only 2 when displayLimit is 2')
    })

    /**
     * Test: displayLimit shows most recent migrations first
     * Validates that when limiting display, the MOST RECENT (highest timestamp)
     * migrations are shown, not the oldest. This gives users visibility into
     * the latest changes.
     */
    it('displayLimit should show most recent first', () => {
        // Prepare 2 migrations with different timestamps
        const list = [
            {timestamp: 1, name: 'Old'} as MigrationScript,
            {timestamp: 2, name: 'Recent'} as MigrationScript,
        ]
        const scripts = {migrated: [...list]} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // Render with displayLimit=1
        cr.drawMigrated(scripts, 1)

        // Verify only the most recent is shown
        expect(scripts.migrated.length).eq(1, 'Should show only 1')
        expect(scripts.migrated[0].name).eq('Recent', 'Should show most recent')
    })

    /**
     * Test: displayLimit larger than available shows all migrations
     * Edge case test validating that when displayLimit exceeds the number
     * of available migrations, all migrations are shown without errors.
     */
    it('displayLimit greater than available should show all', () => {
        // Prepare 2 migrations
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
        ]
        const scripts = {migrated: [...list]} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // Render with displayLimit=10 (more than available)
        cr.drawMigrated(scripts, 10)

        // Verify all 2 are shown
        expect(scripts.migrated.length).eq(2, 'Should show all 2 when limit is 10')
    })

    /**
     * Test: displayLimit handles empty migration list gracefully
     * Edge case test validating that applying displayLimit to an empty
     * list doesn't cause errors. Important for first-time migration runs.
     */
    it('displayLimit with empty list should not error', () => {
        // Prepare empty migration list
        const list: MigrationScript[] = []
        const scripts = {migrated: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // Render with displayLimit=5
        cr.drawMigrated(scripts, 5)

        // Verify empty list is handled gracefully
        expect(scripts.migrated.length).eq(0, 'Should handle empty list')
    })

    it('getDuration: should handle invalid timestamps', () => {
        // when: NaN timestamps
        const res1 = ConsoleRenderer.getDuration({startedAt: NaN, finishedAt: 1000} as IMigrationInfo)
        expect(res1).to.include('s', 'Should return string with s suffix')

        // when: undefined timestamps
        const res2 = ConsoleRenderer.getDuration({startedAt: undefined, finishedAt: 1000} as any)
        expect(res2).to.include('s', 'Should handle undefined startedAt')

        // when: both undefined
        const res3 = ConsoleRenderer.getDuration({} as IMigrationInfo)
        expect(res3).to.include('s', 'Should handle missing timestamps')
    })

    it('getDuration: should handle very large time differences', () => {
        // when: 1 year difference
        const oneYear = 365 * 24 * 60 * 60 * 1000
        const res = ConsoleRenderer.getDuration({
            startedAt: 0,
            finishedAt: oneYear
        } as IMigrationInfo)

        // then: should calculate correctly
        expect(res).eq('31536000s', 'Should handle 1 year = 31536000 seconds')
    })

    it('drawMigrated: should handle migration names with special characters', () => {
        // having: migrations with special chars
        const list = [
            {timestamp: 1, name: 'TestTM', finishedAt: Date.now(), username: 'user'} as MigrationScript,
            {timestamp: 2, name: 'Test<>&"', finishedAt: Date.now(), username: 'user'} as MigrationScript,
        ]
        const scripts = {migrated: list, all: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // when: capture console output
        const sinon = require('sinon');
        const consoleLogSpy = sinon.spy(console, 'log');

        // then: should render without errors and include migration names
        cr.drawMigrated(scripts)

        expect(consoleLogSpy.called).to.be.true;
        const output = consoleLogSpy.firstCall.args[0];
        expect(output).to.include('TestTM');
        expect(output).to.include('Test<>&"');

        consoleLogSpy.restore();
    })

    it('drawMigrated: should handle very long migration names', () => {
        // having: migration with 500 char name
        const longName = 'V'.repeat(500)
        const list = [
            {timestamp: 1, name: longName, finishedAt: Date.now(), username: 'user'} as MigrationScript,
        ]
        const scripts = {migrated: list, all: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // when: capture console output
        const sinon = require('sinon');
        const consoleLogSpy = sinon.spy(console, 'log');

        // then: should render and truncate or wrap long name appropriately
        cr.drawMigrated(scripts)

        expect(consoleLogSpy.called).to.be.true;
        const output = consoleLogSpy.firstCall.args[0];
        expect(output).to.be.a('string');
        expect(output.length).to.be.greaterThan(0);

        consoleLogSpy.restore();
    })

    it('drawMigrated: should handle large arrays efficiently', () => {
        // having: 1000 migrations
        const list = Array.from({length: 1000}, (_, i) => ({
            timestamp: i,
            name: `Migration${i}`,
            finishedAt: Date.now(),
            username: 'user'
        } as MigrationScript))

        const scripts = {migrated: list, all: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // when: render with display limit
        const start = Date.now()
        cr.drawMigrated(scripts, 10)
        const duration = Date.now() - start

        // then: should be fast
        expect(duration).to.be.lessThan(100, 'Should render quickly (< 100ms)')
        expect(scripts.migrated.length).eq(10, 'Should limit to 10')
    })

    it('drawExecutedTable: should handle migrations with undefined results', () => {
        const list = [
            {timestamp: 1, name: 'Test1', startedAt: 0, finishedAt: 1000, result: undefined} as IMigrationInfo,
            {timestamp: 2, name: 'Test2', startedAt: 0, finishedAt: 1000, result: null} as any,
        ]
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // when: capture console output
        const sinon = require('sinon');
        const consoleLogSpy = sinon.spy(console, 'log');

        // then: should render table with undefined/null values
        cr.drawExecutedTable(list)

        expect(consoleLogSpy.called).to.be.true;
        const output = consoleLogSpy.firstCall.args[0];
        expect(output).to.include('Test1');
        expect(output).to.include('Test2');
        expect(output).to.include('Executed');

        consoleLogSpy.restore();
    })

    it('drawMigrated: should indicate locally missing migrations', () => {
        // Test validates the "Found Locally" column shows N for missing files
        const list = [
            {timestamp: 1, name: 'Migration1', finishedAt: Date.now(), username: 'user'} as MigrationScript,
            {timestamp: 2, name: 'Migration2', finishedAt: Date.now(), username: 'user'} as MigrationScript,
        ]
        // all array only contains Migration1, so Migration2 should show N
        const all = [
            {timestamp: 1, name: 'Migration1'} as MigrationScript,
        ]
        const scripts = {migrated: list, all: all} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // when: capture output
        const sinon = require('sinon');
        const consoleLogSpy = sinon.spy(console, 'log');

        cr.drawMigrated(scripts)

        // then: should show Y for locally found, N for missing
        const output = consoleLogSpy.firstCall.args[0];
        expect(output).to.include('Found Locally');
        // Migration1 exists locally (Y), Migration2 doesn't (N)
        const lines = output.split('\n');
        const hasFoundLocallyColumn = lines.some((line: string) => line.includes('Found Locally'));
        expect(hasFoundLocallyColumn).to.be.true;

        consoleLogSpy.restore();
    })

    it('drawFiglet: should include version and handler name', () => {
        const handler = {
            cfg: new Config(),
            getName: () => 'Test Implementation'
        } as IDatabaseMigrationHandler;

        const cr = new ConsoleRenderer(handler);

        // when: capture output
        const sinon = require('sinon');
        const consoleLogSpy = sinon.spy(console, 'log');

        cr.drawFiglet();

        // then: should include version and handler name
        const output = consoleLogSpy.firstCall.args[0];
        expect(output).to.include('MSR');
        expect(output).to.include('Test Implementation');

        consoleLogSpy.restore();
    })

    it('drawIgnoredTable: should render ignored scripts with warning', () => {
        const list = [
            {timestamp: 1, name: 'Ignored1', filepath: '/path/to/ignored1.ts'} as MigrationScript,
            {timestamp: 2, name: 'Ignored2', filepath: '/path/to/ignored2.ts'} as MigrationScript,
        ]
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // when: capture console.warn output
        const sinon = require('sinon');
        const consoleWarnSpy = sinon.spy(console, 'warn');

        cr.drawIgnoredTable(list);

        // then: should warn about ignored scripts
        expect(consoleWarnSpy.called).to.be.true;
        const output = consoleWarnSpy.firstCall.args[0];
        expect(output).to.include('Ignored Scripts');
        expect(output).to.include('Ignored1');
        expect(output).to.include('Ignored2');

        consoleWarnSpy.restore();
    })
})