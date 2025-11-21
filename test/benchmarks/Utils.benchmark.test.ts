import { expect } from 'chai';
import { Utils } from '../../src';

/**
 * Performance Benchmark Tests for Utils
 *
 * These tests measure utility function performance to ensure
 * core operations remain fast across code changes.
 */
describe('Utils Performance Benchmarks', () => {

    /**
     * Benchmark: promiseAll with small object performance
     *
     * Tests Utils.promiseAll with a small number of promises (10).
     * This is the typical use case in the migration system.
     *
     * Performance target: < 10ms
     */
    it('should resolve 10 promises in < 10ms', async () => {
        // Create map with 10 fast-resolving promises
        const map: { [key: string]: Promise<number> } = {};
        for (let i = 0; i < 10; i++) {
            map[`key${i}`] = Promise.resolve(i);
        }

        // Warm up
        await Utils.promiseAll(map);

        // Measure
        const start = Date.now();
        await Utils.promiseAll(map);
        const duration = Date.now() - start;

        expect(duration).to.be.lessThan(10,
            `promiseAll with 10 promises took ${duration}ms, expected < 10ms.`);
    });

    /**
     * Benchmark: promiseAll with moderate object performance
     *
     * Tests Utils.promiseAll with a moderate number of promises (100).
     * This tests scalability for projects with many migrations.
     *
     * Performance target: < 50ms
     */
    it('should resolve 100 promises in < 50ms', async () => {
        // Create map with 100 fast-resolving promises
        const map: { [key: string]: Promise<number> } = {};
        for (let i = 0; i < 100; i++) {
            map[`key${i}`] = Promise.resolve(i);
        }

        // Measure
        const start = Date.now();
        await Utils.promiseAll(map);
        const duration = Date.now() - start;

        expect(duration).to.be.lessThan(50,
            `promiseAll with 100 promises took ${duration}ms, expected < 50ms.`);
    });

    /**
     * Benchmark: promiseAll with large object performance
     *
     * Stress test with 1000 promises to ensure the implementation
     * doesn't have O(n²) or worse complexity.
     *
     * Performance target: < 200ms
     */
    it('should resolve 1000 promises in < 200ms', async () => {
        // Create map with 1000 fast-resolving promises
        const map: { [key: string]: Promise<number> } = {};
        for (let i = 0; i < 1000; i++) {
            map[`key${i}`] = Promise.resolve(i);
        }

        // Measure
        const start = Date.now();
        await Utils.promiseAll(map);
        const duration = Date.now() - start;

        expect(duration).to.be.lessThan(200,
            `promiseAll with 1000 promises took ${duration}ms, expected < 200ms. ` +
            'This may indicate O(n²) complexity or worse.');
    });

    /**
     * Benchmark: promiseAll maintains linear time complexity
     *
     * Validates that promiseAll scales linearly (O(n)) with the number
     * of promises. Compares time for 100 vs 1000 promises - should be
     * roughly 10x difference, not more.
     */
    it('should scale linearly with number of promises', async () => {
        // Test with 100 promises
        const map100: { [key: string]: Promise<number> } = {};
        for (let i = 0; i < 100; i++) {
            map100[`key${i}`] = Promise.resolve(i);
        }

        const start100 = Date.now();
        await Utils.promiseAll(map100);
        const duration100 = Date.now() - start100;

        // Test with 1000 promises
        const map1000: { [key: string]: Promise<number> } = {};
        for (let i = 0; i < 1000; i++) {
            map1000[`key${i}`] = Promise.resolve(i);
        }

        const start1000 = Date.now();
        await Utils.promiseAll(map1000);
        const duration1000 = Date.now() - start1000;

        // Calculate scaling factor (should be close to 10x, not 100x)
        const scalingFactor = duration1000 / Math.max(duration100, 1);

        // Allow up to 20x scaling (generous for timing variability)
        // If it's > 20x, likely indicates O(n²) or worse complexity
        expect(scalingFactor).to.be.lessThan(20,
            `Scaling factor is ${scalingFactor}x (100: ${duration100}ms, 1000: ${duration1000}ms). ` +
            'Expected roughly linear scaling (~10x), got worse than O(n log n).');
    });
});
