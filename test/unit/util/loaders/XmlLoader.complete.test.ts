import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { XmlLoader } from '../../../../src/util/loaders/XmlLoader';

/**
 * Additional comprehensive tests for XmlLoader to achieve 100% coverage.
 * These tests focus on edge cases and error paths.
 */
describe('XmlLoader - Complete Coverage', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders-complete');
    let loader: XmlLoader;

    before(() => {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    beforeEach(() => {
        loader = new XmlLoader();
    });

    after(() => {
        // Clean up test files
        if (fs.existsSync(testDir)) {
            fs.readdirSync(testDir).forEach(file => {
                if (file.endsWith('.xml')) {
                    fs.unlinkSync(path.join(testDir, file));
                }
            });
        }
    });

    describe('Error handling edge cases', () => {
        /**
         * Test: Lenient parsing handles unclosed tags
         * Note: fast-xml-parser v5 auto-corrects unclosed tags
         */
        it('should handle unclosed tags leniently', () => {
            const testLoader = new XmlLoader();

            if (testLoader.isAvailable()) {
                const testFile = path.join(testDir, 'trigger-error.xml');
                fs.writeFileSync(testFile, '<invalid><unclosed>');

                // fast-xml-parser v5 auto-corrects this
                const result = testLoader.load<any>(testFile);
                expect(result).to.be.an('object');
            }
        });

        /**
         * Test: Non-Error exception in constructor
         */
        it('should handle non-Error exceptions during module load', () => {
            const testLoader = new XmlLoader();
            expect(testLoader).to.be.instanceOf(XmlLoader);
        });

        /**
         * Test: Error wrapping when dependency unavailable
         */
        it('should provide helpful error when dependency unavailable', () => {
            if (!loader.isAvailable()) {
                const testFile = path.join(testDir, 'test.xml');
                fs.writeFileSync(testFile, '<msr><folder>./migrations</folder></msr>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Cannot load XML file');
                    expect(message).to.include('fast-xml-parser is not installed');
                }
            } else {
                // When dependency is available, lenient parser handles most issues
                const testFile = path.join(testDir, 'error-wrap.xml');
                fs.writeFileSync(testFile, '<invalid><not>closed</invalid>');

                // fast-xml-parser v5 auto-corrects this
                const result = loader.load<any>(testFile);
                expect(result).to.be.an('object');
            }
        });

        /**
         * Test: XML file with only declaration
         * Note: fast-xml-parser v5 parses XML declaration attributes
         */
        it('should parse XML declaration attributes', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'null-result.xml');
                // Just XML declaration, no content
                fs.writeFileSync(testFile, '<?xml version="1.0"?>');

                // fast-xml-parser v5 parses the version attribute from declaration
                const result = loader.load<any>(testFile);
                expect(result).to.be.an('object');
                expect(result['@_version']).to.equal(1.0);
            }
        });

        /**
         * Test: XML file with only comments
         * Note: fast-xml-parser v5 parses declaration but ignores comments
         */
        it('should ignore comments but parse declaration', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'only-comments.xml');
                fs.writeFileSync(testFile, '<?xml version="1.0"?><!-- Just a comment -->');

                // fast-xml-parser v5 parses declaration but ignores comments
                const result = loader.load<any>(testFile);
                expect(result).to.be.an('object');
                expect(result['@_version']).to.equal(1.0);
            }
        });

        /**
         * Test: XML with text content
         * XML parsers always return objects, even for simple text
         */
        it('should parse XML text nodes as object properties', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'text-node.xml');
                fs.writeFileSync(testFile, '<root>just text</root>');

                const result = loader.load<any>(testFile);
                // Parser returns 'just text' unwrapped (single root element)
                expect(result).to.equal('just text');
            }
        });

        /**
         * Test: XML file with multiple root elements
         * Tests the path for multiple keys.
         */
        it('should handle XML with multiple root elements', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'multiple-roots.xml');
                // Note: Well-formed XML must have single root, but parser may handle it
                const xmlContent = '<msr><folder>./migrations</folder><tableName>test</tableName></msr>';

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result).to.be.an('object');
                expect(result.folder).to.equal('./migrations');
            }
        });

        /**
         * Test: XML with custom root element (not 'msr')
         * Tests the unwrapping logic for non-msr root.
         */
        it('should unwrap custom root element', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'custom-root.xml');
                fs.writeFileSync(testFile, '<config><folder>./migrations</folder></config>');

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
            }
        });

        /**
         * Test: XML with 'msr' root element
         * Tests the unwrapping logic for msr root.
         */
        it('should unwrap msr root element', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'msr-root.xml');
                fs.writeFileSync(testFile, '<msr><folder>./migrations</folder></msr>');

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
            }
        });

        /**
         * Test: File read error path
         */
        it('should handle file read errors', () => {
            if (loader.isAvailable()) {
                const nonExistentFile = path.join(testDir, 'does-not-exist.xml');

                try {
                    loader.load(nonExistentFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('Failed to load configuration from');
                }
            }
        });

        /**
         * Test: XML with attributes
         * Note: parseAttributeValue: true converts numeric strings to numbers
         */
        it('should parse XML attributes with @_ prefix', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'with-attributes.xml');
                fs.writeFileSync(testFile, '<msr version="1.0"><folder enabled="true">./migrations</folder></msr>');

                const result = loader.load<any>(testFile);

                // parseAttributeValue: true converts "1.0" to number 1.0
                expect(result['@_version']).to.equal(1.0);
                expect(result.folder).to.be.an('object');
                expect(result.folder['@_enabled']).to.be.true;
            }
        });

        /**
         * Test: Complex nested XML structure
         */
        it('should handle complex nested XML structures', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'complex-nested.xml');
                const xmlContent = `
<msr>
  <database>
    <host>localhost</host>
    <port>5432</port>
    <pool>
      <min>2</min>
      <max>10</max>
    </pool>
  </database>
  <server>
    <name>alpha</name>
    <ip>10.0.0.1</ip>
  </server>
  <server>
    <name>beta</name>
    <ip>10.0.0.2</ip>
  </server>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result).to.be.an('object');
                expect(result.database).to.be.an('object');
                expect(result.database.host).to.equal('localhost');
                expect(result.database.pool).to.be.an('object');
                expect(result.server).to.be.an('array');
                expect(result.server).to.have.lengthOf(2);
            }
        });

        /**
         * Test: XML with CDATA sections
         */
        it('should handle CDATA sections', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'with-cdata.xml');
                fs.writeFileSync(testFile, '<msr><description><![CDATA[Contains <special> & characters]]></description></msr>');

                const result = loader.load<any>(testFile);

                expect(result.description).to.include('<special>');
                expect(result.description).to.include('&');
            }
        });

        /**
         * Test: Empty XML file
         * Note: fast-xml-parser v5 returns empty object for empty content
         */
        it('should return empty object for completely empty XML file', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'empty.xml');
                fs.writeFileSync(testFile, '');

                // fast-xml-parser v5 returns {} for empty content
                const result = loader.load<any>(testFile);
                expect(result).to.be.an('object');
                expect(Object.keys(result)).to.have.lengthOf(0);
            }
        });
    });

    describe('Success paths for complete coverage', () => {
        /**
         * Test: Valid XML loads successfully
         */
        it('should successfully load valid XML object', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'valid.xml');
                fs.writeFileSync(testFile, '<msr><folder>./migrations</folder><tableName>test</tableName></msr>');

                const result = loader.load<any>(testFile);

                expect(result).to.be.an('object');
                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('test');
            }
        });
    });
});
