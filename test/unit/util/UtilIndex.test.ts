import { expect } from 'chai';
import * as UtilIndex from '../../../src/util/index';

/**
 * Tests for src/util/index.ts to ensure all exports are accessible
 * and 100% function coverage is achieved.
 */
describe('Util Index Exports', () => {
    it('should export ConfigLoader', () => {
        expect(UtilIndex.ConfigLoader).to.exist;
        expect(UtilIndex.ConfigLoader).to.be.a('function');
    });

    it('should export ConfigFileLoaderRegistry', () => {
        expect(UtilIndex.ConfigFileLoaderRegistry).to.exist;
        expect(UtilIndex.ConfigFileLoaderRegistry).to.be.a('function');
    });

    it('should export loader classes', () => {
        expect(UtilIndex).to.have.property('JsJsonLoader');
        expect(UtilIndex).to.have.property('YamlLoader');
        expect(UtilIndex).to.have.property('TomlLoader');
        expect(UtilIndex).to.have.property('XmlLoader');
    });
});
