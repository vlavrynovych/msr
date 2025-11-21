import { expect } from 'chai';
import { MigrationService } from '../../src';
import { TestUtils } from '../helpers';

/**
 * Performance Benchmark Tests for MigrationService
 *
 * These tests measure the performance of migration-related operations to
 * detect performance regressions. If these tests start failing, it indicates
 * that recent changes have negatively impacted performance.
 *
 * Note: Benchmark thresholds are conservative to account for CI/CD variability.
 */
describe('MigrationService Performance Benchmarks', () => {

    /**
     * Benchmark: Migration script scanning performance
     *
     * Tests how quickly the MigrationService can scan a directory and load
     * migration metadata (without executing the migrations). This operation
     * happens on every migration run, so it should be fast.
     *
     * Performance target: < 100ms for small directories (< 10 files)
     *
     * Why this matters:
     * - Developers run migrations frequently during development
     * - Slow scanning impacts developer experience
     * - CI/CD pipelines may run migrations on every build
     */
    it('should scan migration directory in < 100ms', async () => {
        const ms = new MigrationService();
        const config = TestUtils.getConfig();

        // Warm up (first run may include JIT compilation, module loading, etc.)
        await ms.readMigrationScripts(config);

        // Measure actual performance
        const start = Date.now();
        await ms.readMigrationScripts(config);
        const duration = Date.now() - start;

        // Verify performance meets threshold
        expect(duration).to.be.lessThan(100,
            `Migration scanning took ${duration}ms, expected < 100ms. ` +
            'This may indicate a performance regression.');
    });

    /**
     * Benchmark: Empty directory scanning performance
     *
     * Tests performance when scanning an empty migrations directory.
     * This should be extremely fast since there are no files to process.
     *
     * Performance target: < 50ms
     */
    it('should scan empty directory in < 50ms', async () => {
        const ms = new MigrationService();
        const config = TestUtils.getConfig(TestUtils.EMPTY_FOLDER);

        // Warm up
        await ms.readMigrationScripts(config);

        // Measure
        const start = Date.now();
        await ms.readMigrationScripts(config);
        const duration = Date.now() - start;

        expect(duration).to.be.lessThan(50,
            `Empty directory scan took ${duration}ms, expected < 50ms.`);
    });

    /**
     * Benchmark: Repeated scanning performance (caching test)
     *
     * Tests that repeated scans of the same directory maintain consistent
     * performance. If performance degrades on subsequent scans, it may
     * indicate a memory leak or resource accumulation.
     *
     * Performance target: All scans should be within 2x of first scan
     */
    it('should maintain consistent performance across multiple scans', async () => {
        const ms = new MigrationService();
        const config = TestUtils.getConfig();
        const durations: number[] = [];

        // Run 10 scans and record durations
        for (let i = 0; i < 10; i++) {
            const start = Date.now();
            await ms.readMigrationScripts(config);
            const duration = Date.now() - start;
            durations.push(duration);
        }

        // Calculate average and check for performance degradation
        const average = durations.reduce((a, b) => a + b, 0) / durations.length;
        const maxDuration = Math.max(...durations);

        // If operations are so fast that all durations are 0, that's good!
        if (average === 0 && maxDuration === 0) {
            expect(true).to.be.true; // Operations are extremely fast
            return;
        }

        // Max duration should not be more than 2x average (allow min of 1ms)
        const threshold = Math.max(average * 2, 1);
        expect(maxDuration).to.be.lessThan(threshold,
            `Performance degraded: max=${maxDuration}ms, avg=${average}ms. ` +
            'This may indicate a memory leak or resource accumulation.');
    });
});
