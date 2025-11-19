import { expect } from 'chai';
import {IMigrationInfo, IDatabaseMigrationHandler, Utils} from "../../src";
import {TestUtils} from "../TestUtils";

describe('Utils', () => {

    it('promiseAll: check keys', async () => {
        // when
        const map = {
            a: Promise.resolve(1),
            b: Promise.resolve(2),
        }

        // and
        const res:any = await Utils.promiseAll(map);

        // then
        expect(res.a === 1, 'Should have key "a" with 1 as value').is.true
        expect(res.b === 2, 'Should have key "b" with 2 as value').is.true
        expect(res.c, 'key "c" should be undefined').is.undefined
    })

    it('promiseAll: check types', async () => {
        // having: custom type
        type T = {a:1, b:2};
        // when
        const map = {
            num: Promise.resolve(1),
            str: Promise.resolve('str'),
            bool: Promise.resolve(true),
            arr: Promise.resolve([]),
            undef: Promise.resolve(),
            custom: Promise.resolve({b:2} as T),
        }

        // and
        const res = await Utils.promiseAll(map);

        // then
        expect(typeof res.num).eq('number', 'Should have number type')
        expect(typeof res.str).eq('string', 'Should have string type')
        expect(typeof res.bool).eq('boolean', 'Should have boolean type')
        expect(typeof res.arr).eq('object', 'Should have boolean type')
        expect(res.arr instanceof Array, 'Should be an array').is.true
        expect(res.undef, 'Should be undefined').is.undefined

        expect(typeof res.custom).eq('object', 'Should have number type')
        expect(res.custom.a, 'Field a of custom type T should be undefined').is.undefined
        expect(res.custom.b).eq(2, 'Field b of custom type T should have 2 as a value')
    })

    it('parseRunnable: valid', async () => {
        // when
        const res = await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_valid.ts'));

        // then
        expect(res).not.undefined
        expect(typeof res.up === 'function').is.true
        expect(await res.up({}, {} as IMigrationInfo, {} as IDatabaseMigrationHandler)).eq('result string')

        // when
        const res2 = await Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_valid-multiple-exports.ts'));

        // then
        expect(res2).not.undefined
        expect(typeof res2.up === 'function').is.true
        expect(await res2.up({}, {} as IMigrationInfo, {} as IDatabaseMigrationHandler)).eq('result string')
    })

    it('parseRunnable: invalid - no executable content', async () => {
        await expect(Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_invalid.ts')))
            .to.be.rejectedWith("V202311062345_invalid.ts: Cannot parse migration script: no executable content found");
    })

    it('parseRunnable: invalid - multiple executable instances', async () => {
        await expect(Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_invalid-multiple-exports.ts')))
            .to.be.rejectedWith("V202311062345_invalid-multiple-exports.ts: Cannot parse migration script: multiple executable instances were found");
    })

    it('parseRunnable: invalid - parse error', async () => {
        await expect(Utils.parseRunnable(TestUtils.prepareMigration('V202311062345_invalid-parse-error.ts')))
            .to.be.rejectedWith("V202311062345_invalid-parse-error.ts: Cannot parse migration script: TypeError: clazz is not a constructor");
    })

    it('promiseAll: should handle single rejected promise', async () => {
        // when: one promise rejects
        const map = {
            a: Promise.resolve(1),
            b: Promise.reject(new Error('Promise B failed')),
            c: Promise.resolve(3)
        }

        // then: should reject with the error
        await expect(Utils.promiseAll(map)).to.be.rejectedWith('Promise B failed');
    })

    it('promiseAll: should handle multiple rejected promises', async () => {
        // when: multiple promises reject
        const map = {
            a: Promise.reject(new Error('Promise A failed')),
            b: Promise.reject(new Error('Promise B failed')),
            c: Promise.resolve(3)
        }

        // then: should reject with first error (Promise.all behavior)
        await expect(Utils.promiseAll(map)).to.be.rejected;
    })

    it('promiseAll: should handle all promises rejected', async () => {
        // when: all promises reject
        const map = {
            a: Promise.reject(new Error('Error A')),
            b: Promise.reject(new Error('Error B'))
        }

        // then: should reject
        await expect(Utils.promiseAll(map)).to.be.rejected;
    })

    it('promiseAll: should handle empty object', async () => {
        // when: empty map
        const map = {}

        // and
        const res = await Utils.promiseAll(map);

        // then: should return empty object
        expect(Object.keys(res).length).eq(0, 'Should return empty object');
    })

    it('promiseAll: should preserve rejection error details', async () => {
        // when: promise rejects with specific error
        const customError = new Error('Custom error message');
        customError.name = 'CustomError';
        const map = {
            failing: Promise.reject(customError)
        }

        // then: should preserve error details
        try {
            await Utils.promiseAll(map);
            expect.fail('Should have thrown');
        } catch (e: any) {
            expect(e.message).to.include('Custom error message');
        }
    })
})