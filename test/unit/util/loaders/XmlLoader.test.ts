import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { XmlLoader } from '../../../../src/util/loaders/XmlLoader';

describe('XmlLoader', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders');
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

    describe('supportedExtensions', () => {
        /**
         * Test: Supported extensions property
         * Validates that the loader declares correct supported extensions.
         */
        it('should support .xml extension', () => {
            expect(loader.supportedExtensions).to.deep.equal(['.xml']);
        });
    });

    describe('canLoad', () => {
        /**
         * Test: Can load .xml files
         * Validates that the loader identifies .xml files as loadable.
         */
        it('should return true for .xml files', () => {
            expect(loader.canLoad('config.xml')).to.be.true;
            expect(loader.canLoad('/path/to/config.xml')).to.be.true;
        });

        /**
         * Test: Case-insensitive extension matching
         * Validates that extension matching works regardless of case.
         */
        it('should match extensions case-insensitively', () => {
            expect(loader.canLoad('config.XML')).to.be.true;
            expect(loader.canLoad('config.Xml')).to.be.true;
            expect(loader.canLoad('config.XmL')).to.be.true;
        });

        /**
         * Test: Cannot load unsupported file types
         * Validates that the loader rejects unsupported file types.
         */
        it('should return false for unsupported file types', () => {
            expect(loader.canLoad('config.json')).to.be.false;
            expect(loader.canLoad('config.yaml')).to.be.false;
            expect(loader.canLoad('config.toml')).to.be.false;
            expect(loader.canLoad('config.txt')).to.be.false;
        });
    });

    describe('isAvailable', () => {
        /**
         * Test: Check if fast-xml-parser is available
         * Validates the isAvailable method returns correct status.
         * Note: This test's result depends on whether fast-xml-parser is installed.
         */
        it('should return boolean indicating fast-xml-parser availability', () => {
            const available = loader.isAvailable();

            expect(available).to.be.a('boolean');
        });
    });

    // Only run load tests if fast-xml-parser is available
    (function() {
        const testLoader = new XmlLoader();
        if (!testLoader.isAvailable()) {
            describe('load - fast-xml-parser not available', () => {
                /**
                 * Test: Throw helpful error when fast-xml-parser is not installed
                 * Validates that the error message includes installation instructions.
                 */
                it('should throw helpful error when fast-xml-parser is not installed', () => {
                    const testFile = path.join(testDir, 'test.xml');

                    fs.writeFileSync(testFile, '<msr><folder>./migrations</folder></msr>');

                    try {
                        loader.load(testFile);
                        expect.fail('Should have thrown an error');
                    } catch (error) {
                        expect(error).to.be.instanceOf(Error);
                        const message = (error as Error).message;
                        expect(message).to.include('fast-xml-parser is not installed');
                        expect(message).to.include('npm install fast-xml-parser');
                        expect(message).to.include(testFile);
                    }
                });
            });
            return;
        }

        describe('load - basic XML', () => {
            /**
             * Test: Load simple XML file with msr root
             * Validates that basic XML files are correctly parsed and unwrapped.
             */
            it('should load simple XML file with msr root', () => {
                const testFile = path.join(testDir, 'simple.xml');
                const xmlContent = `
<msr>
  <folder>./migrations</folder>
  <tableName>schema_version</tableName>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Load XML with custom root element
             * Validates that non-msr root elements are unwrapped correctly.
             */
            it('should unwrap custom root element', () => {
                const testFile = path.join(testDir, 'custom-root.xml');
                const xmlContent = `
<config>
  <folder>./migrations</folder>
  <tableName>schema_version</tableName>
</config>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Load XML with mixed data types
             * Validates that XML values are correctly parsed to appropriate types.
             */
            it('should parse XML values to correct types', () => {
                const testFile = path.join(testDir, 'types.xml');
                const xmlContent = `
<msr>
  <stringValue>hello</stringValue>
  <numberValue>42</numberValue>
  <floatValue>3.14</floatValue>
  <booleanTrue>true</booleanTrue>
  <booleanFalse>false</booleanFalse>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.stringValue).to.equal('hello');
                expect(result.numberValue).to.equal(42);
                expect(result.floatValue).to.equal(3.14);
                expect(result.booleanTrue).to.be.true;
                expect(result.booleanFalse).to.be.false;
            });
        });

        describe('load - nested XML', () => {
            /**
             * Test: Load XML with nested elements
             * Validates that nested XML elements become nested objects.
             */
            it('should load XML with nested elements', () => {
                const testFile = path.join(testDir, 'nested.xml');
                const xmlContent = `
<msr>
  <folder>./migrations</folder>
  <transaction>
    <mode>PER_MIGRATION</mode>
    <retries>3</retries>
  </transaction>
  <backup>
    <enabled>true</enabled>
    <folder>./backups</folder>
  </backup>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.transaction).to.deep.equal({
                    mode: 'PER_MIGRATION',
                    retries: 3
                });
                expect(result.backup).to.deep.equal({
                    enabled: true,
                    folder: './backups'
                });
            });

            /**
             * Test: Load XML with deeply nested elements
             * Validates that multiple levels of nesting work correctly.
             */
            it('should load XML with deeply nested elements', () => {
                const testFile = path.join(testDir, 'deeply-nested.xml');
                const xmlContent = `
<msr>
  <database>
    <host>localhost</host>
    <pool>
      <min>2</min>
      <max>10</max>
      <options>
        <timeout>30</timeout>
      </options>
    </pool>
  </database>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.database.host).to.equal('localhost');
                expect(result.database.pool.min).to.equal(2);
                expect(result.database.pool.max).to.equal(10);
                expect(result.database.pool.options.timeout).to.equal(30);
            });
        });

        describe('load - XML with arrays', () => {
            /**
             * Test: Load XML with repeated elements (arrays)
             * Validates that repeated XML elements become arrays.
             */
            it('should convert repeated elements to arrays', () => {
                const testFile = path.join(testDir, 'arrays.xml');
                const xmlContent = `
<msr>
  <filePatterns>*.up.sql</filePatterns>
  <filePatterns>*.down.sql</filePatterns>
  <tag>migration</tag>
  <tag>database</tag>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.filePatterns).to.deep.equal(['*.up.sql', '*.down.sql']);
                expect(result.tag).to.deep.equal(['migration', 'database']);
            });

            /**
             * Test: Load XML with array of complex objects
             * Validates that repeated complex elements become array of objects.
             */
            it('should convert repeated complex elements to array of objects', () => {
                const testFile = path.join(testDir, 'array-objects.xml');
                const xmlContent = `
<msr>
  <server>
    <name>primary</name>
    <host>localhost</host>
    <port>5432</port>
  </server>
  <server>
    <name>secondary</name>
    <host>backup-host</host>
    <port>5433</port>
  </server>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.server).to.be.an('array');
                expect(result.server).to.have.lengthOf(2);
                expect(result.server[0]).to.deep.equal({
                    name: 'primary',
                    host: 'localhost',
                    port: 5432
                });
                expect(result.server[1]).to.deep.equal({
                    name: 'secondary',
                    host: 'backup-host',
                    port: 5433
                });
            });
        });

        describe('load - XML attributes', () => {
            /**
             * Test: Load XML with attributes
             * Validates that XML attributes are accessible with @_ prefix.
             */
            it('should load XML attributes with @_ prefix', () => {
                const testFile = path.join(testDir, 'attributes.xml');
                const xmlContent = `
<msr version="1.0" environment="production">
  <folder path="./migrations">migrations</folder>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                // Note: parseAttributeValue: true converts numeric strings to numbers
                expect(result['@_version']).to.equal(1.0);
                expect(result['@_environment']).to.equal('production');
                expect(result.folder['@_path']).to.equal('./migrations');
            });

            /**
             * Test: Parse attribute values to correct types
             * Validates that attribute values are parsed like element values.
             */
            it('should parse attribute values to correct types', () => {
                const testFile = path.join(testDir, 'attribute-types.xml');
                const xmlContent = `
<msr enabled="true" retries="3" timeout="5.5">
  <folder>./migrations</folder>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result['@_enabled']).to.be.true;
                expect(result['@_retries']).to.equal(3);
                expect(result['@_timeout']).to.equal(5.5);
            });
        });

        describe('load - XML features', () => {
            /**
             * Test: Load XML with comments
             * Validates that XML comments are ignored during parsing.
             */
            it('should ignore XML comments', () => {
                const testFile = path.join(testDir, 'comments.xml');
                const xmlContent = `
<msr>
  <!-- This is a comment -->
  <folder>./migrations</folder>
  <!-- Another comment -->
  <tableName>schema_version</tableName>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Load XML with CDATA sections
             * Validates that CDATA content is correctly extracted.
             */
            it('should handle CDATA sections', () => {
                const testFile = path.join(testDir, 'cdata.xml');
                const xmlContent = `
<msr>
  <description><![CDATA[This is <special> content with & symbols]]></description>
  <folder>./migrations</folder>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.description).to.include('This is <special> content');
                expect(result.description).to.include('& symbols');
            });

            /**
             * Test: Load XML with namespaces
             * Validates that namespace prefixes are removed.
             */
            it('should remove namespace prefixes', () => {
                const testFile = path.join(testDir, 'namespaces.xml');
                const xmlContent = `
<msr:config xmlns:msr="http://example.com/msr">
  <msr:folder>./migrations</msr:folder>
  <msr:tableName>schema_version</msr:tableName>
</msr:config>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });

            /**
             * Test: Trim whitespace from values
             * Validates that leading/trailing whitespace is removed.
             */
            it('should trim whitespace from element values', () => {
                const testFile = path.join(testDir, 'whitespace.xml');
                const xmlContent = `
<msr>
  <folder>
    ./migrations
  </folder>
  <tableName>   schema_version   </tableName>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<any>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });
        });

        describe('load - Error handling', () => {
            /**
             * Test: Throw error for non-existent file
             * Validates that loading a missing file throws an error.
             */
            it('should throw error for non-existent file', () => {
                const testFile = path.join(testDir, 'non-existent.xml');

                expect(() => loader.load(testFile)).to.throw(Error);
            });

            /**
             * Test: Handle lenient parsing of XML
             * Note: fast-xml-parser v5 auto-corrects most malformed XML
             */
            it('should handle lenient parsing of malformed XML', () => {
                const testFile = path.join(testDir, 'lenient.xml');

                fs.writeFileSync(testFile, '<msr><folder>./migrations</msr>'); // Mismatched tags

                // fast-xml-parser v5 auto-corrects this, so it should succeed
                const result = loader.load<any>(testFile);
                expect(result).to.be.an('object');
                expect(result.folder).to.equal('./migrations');
            });

            /**
             * Test: Handle lenient parsing with mismatched tags
             * Note: fast-xml-parser v5 is very lenient and auto-corrects issues
             */
            it('should handle XML with mismatched tags leniently', () => {
                const testFile = path.join(testDir, 'error-test.xml');

                fs.writeFileSync(testFile, '<bad><xml>content</bad>');

                // fast-xml-parser v5 auto-corrects this
                const result = loader.load<any>(testFile);
                expect(result).to.be.an('object');
            });

            /**
             * Test: Handle empty XML file
             * Note: fast-xml-parser v5 returns empty object for empty content
             */
            it('should return empty object for empty XML file', () => {
                const testFile = path.join(testDir, 'empty.xml');

                fs.writeFileSync(testFile, '');

                // fast-xml-parser v5 returns {} for empty content
                const result = loader.load<any>(testFile);
                expect(result).to.be.an('object');
                expect(Object.keys(result)).to.have.lengthOf(0);
            });

            /**
             * Test: Throw error for XML with only null/undefined
             * Validates handling of edge case XML content.
             */
            it('should throw error for XML that parses to null/undefined', () => {
                const testFile = path.join(testDir, 'null-result.xml');

                // This is a bit contrived, but tests the null check
                fs.writeFileSync(testFile, '<?xml version="1.0"?>');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                }
            });
        });

        describe('load - Path resolution', () => {
            /**
             * Test: Load file with relative path
             * Validates that relative paths are correctly resolved.
             */
            it('should resolve relative paths', () => {
                const testFile = path.join(testDir, 'relative.xml');
                const xmlContent = '<msr><folder>./migrations</folder></msr>';

                fs.writeFileSync(testFile, xmlContent);

                const relativePath = path.relative(process.cwd(), testFile);
                const result = loader.load<any>(relativePath);

                expect(result.folder).to.equal('./migrations');
            });

            /**
             * Test: Load file with absolute path
             * Validates that absolute paths work correctly.
             */
            it('should handle absolute paths', () => {
                const testFile = path.join(testDir, 'absolute.xml');
                const xmlContent = '<msr><folder>./migrations</folder></msr>';

                fs.writeFileSync(testFile, xmlContent);

                const absolutePath = path.resolve(testFile);
                const result = loader.load<any>(absolutePath);

                expect(result.folder).to.equal('./migrations');
            });
        });

        describe('load - Type safety', () => {
            /**
             * Test: Generic type parameter
             * Validates that the loader supports TypeScript generics.
             */
            it('should support generic type parameter', () => {
                const testFile = path.join(testDir, 'typed.xml');

                interface TestConfig {
                    folder: string;
                    tableName: string;
                }

                const xmlContent = `
<msr>
  <folder>./migrations</folder>
  <tableName>schema_version</tableName>
</msr>
                `.trim();

                fs.writeFileSync(testFile, xmlContent);

                const result = loader.load<TestConfig>(testFile);

                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('schema_version');
            });
        });
    })();
});
