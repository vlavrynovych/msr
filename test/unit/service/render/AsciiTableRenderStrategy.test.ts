import {expect} from 'chai';
import sinon from 'sinon';
import {AsciiTableRenderStrategy, IScripts, MigrationScript, Config, IMigrationInfo} from "../../../../src";

/**
 * Unit tests for AsciiTableRenderStrategy.
 * Tests ASCII table output formatting for render methods and duration calculations.
 * Note: Most rendering functionality is tested via MigrationRenderer tests.
 * These tests cover specific edge cases like default logger initialization and getDuration.
 */
describe('AsciiTableRenderStrategy', () => {

    let logStub: sinon.SinonStub;

    beforeEach(() => {
        logStub = sinon.stub(console, 'log');
    });

    afterEach(() => {
        logStub.restore();
    });

    describe('getDuration()', () => {

        /**
         * Test: getDuration calculates duration correctly for valid timestamps
         * Validates that getDuration converts millisecond timestamps to seconds
         * with correct formatting. Tests a full day (86400 seconds) to ensure
         * large durations are handled properly.
         */
        it('should calculate duration correctly for valid timestamps', () => {
            // Calculate duration for 1 full day (01/01/2020 to 01/02/2020)
            const res = AsciiTableRenderStrategy.getDuration({
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
            const res = AsciiTableRenderStrategy.getDuration({startedAt: 200, finishedAt: 1000} as IMigrationInfo);
            expect(res).eq("0.8s", '1s - 0.2s = 0.8s')

            // Test 0.98 seconds (980ms)
            const res2 = AsciiTableRenderStrategy.getDuration({startedAt: 20, finishedAt: 1000} as IMigrationInfo);
            expect(res2).eq("0.98s", '1s - 0.02s = 0.98s')

            // Test 0.998 seconds (998ms)
            const res3 = AsciiTableRenderStrategy.getDuration({startedAt: 2, finishedAt: 1000} as IMigrationInfo);
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
            const res = AsciiTableRenderStrategy.getDuration({startedAt: 0.2, finishedAt: 1000} as IMigrationInfo);

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
            const res = AsciiTableRenderStrategy.getDuration({startedAt: 4000, finishedAt: 1000} as IMigrationInfo);

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
            const res = AsciiTableRenderStrategy.getDuration({startedAt: 0, finishedAt: 0} as IMigrationInfo);

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
            const res = AsciiTableRenderStrategy.getDuration({startedAt: -2000, finishedAt: 1000} as IMigrationInfo);

            // Verify calculation is still correct (1000 - (-2000) = 3000ms = 3s)
            expect(res).eq("3s", 'It is weird but should be 3s')

            // Test with both negative times
            const res2 = AsciiTableRenderStrategy.getDuration({startedAt: 3000, finishedAt: -2000} as IMigrationInfo);

            // Verify negative result (-2000 - 3000 = -5000ms = -5s)
            expect(res2).eq("-5s", 'It is weird but should be -5s')
        })

        /**
         * Test: getDuration should handle invalid timestamps
         * Edge case test for NaN, undefined, and missing timestamps
         */
        it('should handle invalid timestamps', () => {
            // when: NaN timestamps
            const res1 = AsciiTableRenderStrategy.getDuration({startedAt: NaN, finishedAt: 1000} as IMigrationInfo)
            expect(res1).to.include('s', 'Should return string with s suffix')

            // when: undefined timestamps
            const res2 = AsciiTableRenderStrategy.getDuration({
                timestamp: 1,
                name: 'test',
                startedAt: 1,
                finishedAt: 1000,
                username: 'test-user'
            } as IMigrationInfo)
            expect(res2).to.include('s', 'Should handle undefined startedAt')

            // when: both undefined
            const res3 = AsciiTableRenderStrategy.getDuration({} as IMigrationInfo)
            expect(res3).to.include('s', 'Should handle missing timestamps')
        })

        /**
         * Test: getDuration should handle very large time differences
         * Validates calculations for extreme time spans (1 year)
         */
        it('should handle very large time differences', () => {
            // when: 1 year difference
            const oneYear = 365 * 24 * 60 * 60 * 1000
            const res = AsciiTableRenderStrategy.getDuration({
                startedAt: 0,
                finishedAt: oneYear
            } as IMigrationInfo)

            // then: should calculate correctly
            expect(res).eq('31536000s', 'Should handle 1 year = 31536000 seconds')
        })

    })

    describe('constructor', () => {
        it('should use default ConsoleLogger when no logger provided', () => {
            const strategy = new AsciiTableRenderStrategy();
            const scripts = {
                migrated: [
                    {
                        timestamp: 202501220100,
                        name: 'V202501220100_test.ts',
                        startedAt: Date.now() - 5000,
                        finishedAt: Date.now(),
                        username: 'developer',
                    } as MigrationScript
                ],
                all: []
            } as unknown as IScripts;
            const config = new Config();

            strategy.renderMigrated(scripts, config);

            // Should have logged to console using default ConsoleLogger
            expect(logStub.called).to.be.true;
            const output = logStub.firstCall.args[0];
            expect(output).to.include('Migrated');
            expect(output).to.include('202501220100');
        });
    });

    describe('renderMigrated with compact mode', () => {
        it('should render with pretty formatting for JSON.stringify', () => {
            const strategy = new AsciiTableRenderStrategy();
            const now = Date.now();
            const scripts = {
                migrated: [
                    {timestamp: 1, name: 'M1', startedAt: now, finishedAt: now, username: 'user'} as MigrationScript,
                ],
                all: []
            } as unknown as IScripts;
            const config = new Config();

            strategy.renderMigrated(scripts, config);

            expect(logStub.called).to.be.true;
        });
    });
});
