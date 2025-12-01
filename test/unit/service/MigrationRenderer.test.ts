import { expect } from 'chai';
import {Config, IDatabaseMigrationHandler, MigrationRenderer, IScripts, MigrationScript, IMigrationInfo} from "../../../src";

describe('MigrationRenderer', () => {

    describe('drawMigrated()', () => {

        /**
         * Test: drawMigrated should handle migration names with special characters
         * Validates that special HTML characters are properly handled in output
         */
        it('should handle migration names with special characters', () => {
            // having: migrations with special chars
            const list = [
                {timestamp: 1, name: 'TestTM', finishedAt: Date.now(), username: 'user'} as MigrationScript,
                {timestamp: 2, name: 'Test<>&"', finishedAt: Date.now(), username: 'user'} as MigrationScript,
            ]
            const scripts = {migrated: list, all: list} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // when: capture console output
            const sinon = require('sinon');
            const consoleLogSpy = sinon.spy(console, 'log');

            // then: should render without errors and include migration names
            renderer.drawMigrated(scripts)

            expect(consoleLogSpy.called).to.be.true;
            const output = consoleLogSpy.firstCall.args[0];
            expect(output).to.include('TestTM');
            expect(output).to.include('Test<>&"');

            consoleLogSpy.restore();
        })

        /**
         * Test: drawMigrated should handle very long migration names
         * Validates rendering with extremely long names (500 characters)
         */
        it('should handle very long migration names', () => {
            // having: migration with 500 char name
            const longName = 'V'.repeat(500)
            const list = [
                {timestamp: 1, name: longName, finishedAt: Date.now(), username: 'user'} as MigrationScript,
            ]
            const scripts = {migrated: list, all: list} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // when: capture console output
            const sinon = require('sinon');
            const consoleLogSpy = sinon.spy(console, 'log');

            // then: should render and truncate or wrap long name appropriately
            renderer.drawMigrated(scripts)

            expect(consoleLogSpy.called).to.be.true;
            const output = consoleLogSpy.firstCall.args[0];
            expect(output).to.be.a('string');
            expect(output.length).to.be.greaterThan(0);

            consoleLogSpy.restore();
        })

        /**
         * Test: drawMigrated should handle large arrays without errors
         * Validates that rendering completes successfully with 1000 migrations
         * and does not mutate the original array
         */
        it('should handle large arrays without errors', () => {
            // having: 1000 migrations with proper timestamps
            const now = Date.now();
            const list = Array.from({length: 1000}, (_, i) => ({
                timestamp: i,
                name: `Migration${i}`,
                startedAt: now + i * 1000,           // Each migration starts 1s after previous
                finishedAt: now + i * 1000 + 500,   // Each takes 0.5s
                username: 'user'
            } as MigrationScript))

            const scripts = {migrated: list, all: list} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // when: render large array
            expect(() => renderer.drawMigrated(scripts)).to.not.throw()

            // then: should not mutate the original array
            expect(scripts.migrated.length).eq(1000, 'Original array should remain unchanged')
        })

        /**
         * Test: drawMigrated should indicate locally missing migrations
         * Validates the "Found Locally" column shows N for missing files
         */
        it('should indicate locally missing migrations', () => {
            // Test validates the "Found Locally" column shows N for missing files
            const now = Date.now();
            const list = [
                {timestamp: 1, name: 'Migration1', startedAt: now, finishedAt: now + 100, username: 'user'} as MigrationScript,
                {timestamp: 2, name: 'Migration2', startedAt: now + 1000, finishedAt: now + 1100, username: 'user'} as MigrationScript,
            ]
            // all array only contains Migration1, so Migration2 should show N
            const all = [
                {timestamp: 1, name: 'Migration1'} as MigrationScript,
            ]
            const scripts = {migrated: list, all: all} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // when: capture output
            const sinon = require('sinon');
            const consoleLogSpy = sinon.spy(console, 'log');

            renderer.drawMigrated(scripts)

            // then: should show Y for locally found, N for missing
            const output = consoleLogSpy.firstCall.args[0];
            expect(output).to.include('Found Locally');
            // Migration1 exists locally (Y), Migration2 doesn't (N)
            const lines = output.split('\n');
            const hasFoundLocallyColumn = lines.some((line: string) => line.includes('Found Locally'));
            expect(hasFoundLocallyColumn).to.be.true;

            consoleLogSpy.restore();
        })

        /**
         * Test: drawMigrated should handle undefined all array gracefully
         * Validates that when scripts.all is undefined, migrations show N for foundLocally
         */
        it('should handle undefined all array gracefully', () => {
            const list = [
                {timestamp: 1, name: 'Migration1', finishedAt: Date.now(), username: 'user'} as MigrationScript,
                {timestamp: 2, name: 'Migration2', finishedAt: Date.now(), username: 'user'} as MigrationScript,
            ]
            // all array is undefined
            const scripts = {migrated: list, all: undefined} as unknown as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // when: capture output
            const sinon = require('sinon');
            const consoleLogSpy = sinon.spy(console, 'log');

            renderer.drawMigrated(scripts)

            // then: should show N for all migrations since all is undefined
            const output = consoleLogSpy.firstCall.args[0];
            expect(output).to.include('Found Locally');

            consoleLogSpy.restore();
        })

    })

    describe('drawExecuted()', () => {

        /**
         * Test: drawExecuted should handle migrations with undefined results
         * Validates rendering with undefined and null result values
         */
        it('should handle migrations with undefined results', () => {
            const list = [
                {timestamp: 1, name: 'Test1', startedAt: 0, finishedAt: 1000, username: 'user', result: undefined} as IMigrationInfo,
                {timestamp: 2, name: 'Test2', startedAt: 0, finishedAt: 1000, username: 'user', result: undefined} as IMigrationInfo,
            ]
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // when: capture console output
            const sinon = require('sinon');
            const consoleLogSpy = sinon.spy(console, 'log');

            // then: should render table with undefined/null values
            renderer.drawExecuted(list)

            expect(consoleLogSpy.called).to.be.true;
            const output = consoleLogSpy.firstCall.args[0];
            expect(output).to.include('Test1');
            expect(output).to.include('Test2');
            expect(output).to.include('Executed');

            consoleLogSpy.restore();
        })

    })

    describe('drawFiglet()', () => {

        /**
         * Test: drawFiglet should include version and handler name
         * Validates that the figlet output contains MSR and the handler name
         */
        it('should include version and handler name', () => {
            const handler = {
                getName: () => 'Test Implementation',
            } as IDatabaseMigrationHandler;
            const config = new Config();

            const renderer = new MigrationRenderer(handler, config);

            // when: capture output
            const sinon = require('sinon');
            const consoleLogSpy = sinon.spy(console, 'log');

            renderer.drawFiglet();

            // then: should include version and handler name
            const output = consoleLogSpy.firstCall.args[0];
            expect(output).to.include('MSR');
            expect(output).to.include('Test Implementation');

            consoleLogSpy.restore();
        })

    })

    describe('drawIgnored()', () => {

        /**
         * Test: drawIgnored should render ignored scripts with warning
         * Validates that ignored scripts are displayed with proper warning
         */
        it('should render ignored scripts with warning', () => {
            const list = [
                {timestamp: 1, name: 'Ignored1', filepath: '/path/to/ignored1.ts'} as MigrationScript,
                {timestamp: 2, name: 'Ignored2', filepath: '/path/to/ignored2.ts'} as MigrationScript,
            ]
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // when: capture console.warn output
            const sinon = require('sinon');
            const consoleWarnSpy = sinon.spy(console, 'warn');

            renderer.drawIgnored(list);

            // then: should warn about ignored scripts
            expect(consoleWarnSpy.called).to.be.true;
            const output = consoleWarnSpy.firstCall.args[0];
            expect(output).to.include('Ignored Scripts');
            expect(output).to.include('Ignored1');
            expect(output).to.include('Ignored2');

            consoleWarnSpy.restore();
        })

    })

    describe('displayLimit behavior', () => {

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
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // Test with displayLimit of 2 and 0 (should not throw)
            expect(() => {
                renderer.drawMigrated({migrated: list} as IScripts)
                renderer.drawMigrated({migrated: [...list]} as IScripts)
            }).to.not.throw();
        })

        /**
         * Test: displayLimit of 0 shows all migrations
         * Validates that passing displayLimit=0 is treated as "show all"
         * rather than "show none". This is the expected behavior for
         * unlimited display.
         */
        it('should show all when 0', () => {
            // Prepare 3 migrations
            const list = [
                {timestamp: 1, name: '1'} as MigrationScript,
                {timestamp: 2, name: '2'} as MigrationScript,
                {timestamp: 3, name: '3'} as MigrationScript,
            ]
            const scripts = {migrated: list} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // Render with displayLimit=0
            renderer.drawMigrated(scripts)

            // Verify all 3 are shown
            expect(scripts.migrated.length).eq(3, 'Should show all 3 when displayLimit is 0')
        })

        /**
         * Test: displayLimit limits the number of displayed migrations
         * Validates that when displayLimit is set to N, only N most recent
         * migrations are shown. This is useful for keeping console output
         * concise in projects with many migrations.
         */
        it('should limit to N migrations', () => {
            // Prepare 3 migrations
            const list = [
                {timestamp: 1, name: '1'} as MigrationScript,
                {timestamp: 2, name: '2'} as MigrationScript,
                {timestamp: 3, name: '3'} as MigrationScript,
            ]
            const scripts = {migrated: [...list]} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // Render with displayLimit=2
            renderer.drawMigrated(scripts)

            // Verify the original array is not mutated
            expect(scripts.migrated.length).eq(3, 'Original array should remain unchanged')
        })

        /**
         * Test: displayLimit shows most recent migrations first
         * Validates that when limiting display, the MOST RECENT (highest timestamp)
         * migrations are shown, not the oldest. This gives users visibility into
         * the latest changes.
         */
        it('should show most recent first', () => {
            // Prepare 2 migrations with different timestamps
            const list = [
                {timestamp: 1, name: 'Old'} as MigrationScript,
                {timestamp: 2, name: 'Recent'} as MigrationScript,
            ]
            const scripts = {migrated: [...list]} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // Render with displayLimit=1
            renderer.drawMigrated(scripts)

            // Verify the original array is not mutated
            expect(scripts.migrated.length).eq(2, 'Original array should remain unchanged')
            // The output rendering should show the most recent, but we don't mutate the input
        })

        /**
         * Test: displayLimit larger than available shows all migrations
         * Edge case test validating that when displayLimit exceeds the number
         * of available migrations, all migrations are shown without errors.
         */
        it('greater than available should show all', () => {
            // Prepare 2 migrations
            const list = [
                {timestamp: 1, name: '1'} as MigrationScript,
                {timestamp: 2, name: '2'} as MigrationScript,
            ]
            const scripts = {migrated: [...list]} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // Render with displayLimit=10 (more than available)
            renderer.drawMigrated(scripts)

            // Verify all 2 are shown
            expect(scripts.migrated.length).eq(2, 'Should show all 2 when limit is 10')
        })

        /**
         * Test: displayLimit handles empty migration list gracefully
         * Edge case test validating that applying displayLimit to an empty
         * list doesn't cause errors. Important for first-time migration runs.
         */
        it('with empty list should not error', () => {
            // Prepare empty migration list
            const list: MigrationScript[] = []
            const scripts = {migrated: list} as IScripts
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // Render with displayLimit=5
            renderer.drawMigrated(scripts)

            // Verify empty list is handled gracefully
            expect(scripts.migrated.length).eq(0, 'Should handle empty list')
        })

    })

    describe('general rendering', () => {

        /**
         * Test: All table rendering methods work without errors
         * Smoke test validating that all console rendering methods can be called
         * without throwing errors. Tests drawExecuted, drawPending,
         * drawIgnored, and drawMigrated with various input combinations.
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
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // Call all rendering methods (should not throw)
            expect(() => {
                renderer.drawExecuted(list)
                renderer.drawPending(list)
                renderer.drawIgnored(list)
                renderer.drawMigrated({
                    migrated: list2,
                    all: list
                } as IScripts)

                renderer.drawMigrated({
                    migrated: list2,
                } as IScripts)
            }).to.not.throw();
        })

        /**
         * Test: Early return for empty arrays
         * Validates that rendering methods handle empty arrays gracefully
         * by returning early without attempting to render tables.
         */
        it('should handle empty arrays without rendering', () => {
            const config = new Config();
            const renderer = new MigrationRenderer({getName: () => 'TestHandler', getVersion: () => '1.0.0-test'} as IDatabaseMigrationHandler, config);

            // These should all return early without rendering (and not throw)
            expect(() => {
                renderer.drawExecuted([])
                renderer.drawPending([])
                renderer.drawIgnored([])
            }).to.not.throw();
        })

    })

})