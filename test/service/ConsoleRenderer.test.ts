import { expect } from 'chai';
import {Config, ConsoleRenderer, IMigrationInfo, IDatabaseMigrationHandler, IScripts, MigrationScript} from "../../src";

describe('ConsoleRenderer.getDuration', () => {

    it('check valid numbers', () => {
        // when
        const res = ConsoleRenderer.getDuration({
            startedAt: 1577829600000,   // 01/01/2020
            finishedAt: 1577916000000   // 01/02/2020
        } as IMigrationInfo);

        // then
        expect(res).eq("86400s", 'Should be 1 day in second = 86400s')
    })

    it('check precision', () => {
        const res = ConsoleRenderer.getDuration({startedAt: 200, finishedAt: 1000} as IMigrationInfo);
        expect(res).eq("0.8s", '1s - 0.2s = 0.8s')

        const res2 = ConsoleRenderer.getDuration({startedAt: 20, finishedAt: 1000} as IMigrationInfo);
        expect(res2).eq("0.98s", '1s - 0.02s = 0.98s')

        const res3 = ConsoleRenderer.getDuration({startedAt: 2, finishedAt: 1000} as IMigrationInfo);
        expect(res3).eq("0.998s", '1s - 0.002s = 0.998s')
    })

    it('check rounding', () => {
        // when
        const res = ConsoleRenderer.getDuration({startedAt: 0.2, finishedAt: 1000} as IMigrationInfo);

        // then
        expect(res).eq("1s", 'The difference is not noticeable, should stay as 1 second')
    })

    it('check for negative number', () => {
        // when
        const res = ConsoleRenderer.getDuration({startedAt: 4000, finishedAt: 1000} as IMigrationInfo);

        // then
        expect(res).eq("-3s", 'Should be negative = -3s')
    })

    it('check if zero', () => {
        // when
        const res = ConsoleRenderer.getDuration({startedAt: 0, finishedAt: 0} as IMigrationInfo);

        // then
        expect(res).eq("0s", '0s - 0s = 0s')
    })

    it('check weird numbers: should be stable', () => {
        // when
        const res = ConsoleRenderer.getDuration({startedAt: -2000, finishedAt: 1000} as IMigrationInfo);

        // then
        expect(res).eq("3s", 'It is weird but should be 3s')

        // when
        const res2 = ConsoleRenderer.getDuration({startedAt: 3000, finishedAt: -2000} as IMigrationInfo);

        // then
        expect(res2).eq("-5s", 'It is weird but should be -5s')
    })


    it('render tables', () => {
        // having
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
        ]

        const list2 = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]

        // when
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // then
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

    it('render tables with displayLimit', () => {
        // having
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]

        // when
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // then
        cr.drawMigrated({migrated: list} as IScripts, 2)
        cr.drawMigrated({migrated: [...list]} as IScripts, 0)
    })

    it('displayLimit should show all when 0', () => {
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]
        const scripts = {migrated: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)
        cr.drawMigrated(scripts, 0)
        expect(scripts.migrated.length).eq(3, 'Should show all 3 when displayLimit is 0')
    })

    it('displayLimit should limit to N migrations', () => {
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
            {timestamp: 3, name: '3'} as MigrationScript,
        ]
        const scripts = {migrated: [...list]} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)
        cr.drawMigrated(scripts, 2)
        expect(scripts.migrated.length).eq(2, 'Should show only 2 when displayLimit is 2')
    })

    it('displayLimit should show most recent first', () => {
        const list = [
            {timestamp: 1, name: 'Old'} as MigrationScript,
            {timestamp: 2, name: 'Recent'} as MigrationScript,
        ]
        const scripts = {migrated: [...list]} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)
        cr.drawMigrated(scripts, 1)
        expect(scripts.migrated.length).eq(1, 'Should show only 1')
        expect(scripts.migrated[0].name).eq('Recent', 'Should show most recent')
    })

    it('displayLimit greater than available should show all', () => {
        const list = [
            {timestamp: 1, name: '1'} as MigrationScript,
            {timestamp: 2, name: '2'} as MigrationScript,
        ]
        const scripts = {migrated: [...list]} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)
        cr.drawMigrated(scripts, 10)
        expect(scripts.migrated.length).eq(2, 'Should show all 2 when limit is 10')
    })

    it('displayLimit with empty list should not error', () => {
        const list: MigrationScript[] = []
        const scripts = {migrated: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)
        cr.drawMigrated(scripts, 5)
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

        // then: should not throw
        cr.drawMigrated(scripts)
    })

    it('drawMigrated: should handle very long migration names', () => {
        // having: migration with 500 char name
        const longName = 'V'.repeat(500)
        const list = [
            {timestamp: 1, name: longName, finishedAt: Date.now(), username: 'user'} as MigrationScript,
        ]
        const scripts = {migrated: list, all: list} as IScripts
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // then: should not throw
        cr.drawMigrated(scripts)
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
            {timestamp: 1, name: 'Test1', result: undefined} as IMigrationInfo,
            {timestamp: 2, name: 'Test2', result: null} as any,
        ]
        const cr = new ConsoleRenderer({cfg: new Config()} as IDatabaseMigrationHandler)

        // then: should not throw
        cr.drawExecutedTable(list)
    })
})