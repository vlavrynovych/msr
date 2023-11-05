import { expect } from 'chai';
import {Utils} from "../../src";

describe('Utils.promiseAll', () => {


    it('check keys', async () => {
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

    it('check types', async () => {
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
})