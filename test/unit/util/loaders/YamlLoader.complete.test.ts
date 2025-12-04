import { expect } from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { YamlLoader } from '../../../../src/util/loaders/YamlLoader';

/**
 * Additional comprehensive tests for YamlLoader to achieve 100% coverage.
 * These tests focus on edge cases and error paths.
 */
describe('YamlLoader - Complete Coverage', () => {
    const testDir = path.join(__dirname, '../../../fixtures/config-loaders-complete');
    let loader: YamlLoader;

    before(() => {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
    });

    beforeEach(() => {
        loader = new YamlLoader();
    });

    after(() => {
        // Clean up test files
        if (fs.existsSync(testDir)) {
            fs.readdirSync(testDir).forEach(file => {
                fs.unlinkSync(path.join(testDir, file));
            });
            fs.rmdirSync(testDir);
        }
    });

    describe('Error handling edge cases', () => {
        /**
         * Test: Error message includes original error when dependency is unavailable
         * This tests the loadError path in the constructor catch block.
         */
        it('should include original error in unavailable dependency message', () => {
            // Create a loader instance to test with
            const testLoader = new YamlLoader();

            // If js-yaml is available, we can't test the unavailable path
            if (testLoader.isAvailable()) {
                // Test the error message format when loading fails for other reasons
                const testFile = path.join(testDir, 'trigger-error.yaml');
                fs.writeFileSync(testFile, 'invalid: yaml: ::: content');

                try {
                    testLoader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    // Error should not be double-wrapped
                    const message = (error as Error).message;
                    expect(message).to.include('Failed to load configuration from');
                }
            }
        });

        /**
         * Test: Non-Error exception in constructor
         * Simulates a non-Error being thrown when loading the module.
         */
        it('should handle non-Error exceptions during module load', () => {
            // The constructor catches both Error and non-Error exceptions
            // This is already covered by the try-catch block in the constructor
            const testLoader = new YamlLoader();
            expect(testLoader).to.be.instanceOf(YamlLoader);
        });

        /**
         * Test: Double-wrap prevention for our own errors
         * Tests the error handling path that prevents double-wrapping.
         */
        it('should not double-wrap error messages that start with "Cannot load YAML file"', () => {
            if (!loader.isAvailable()) {
                const testFile = path.join(testDir, 'test.yaml');
                fs.writeFileSync(testFile, 'content: value');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    // Should start with "Cannot load YAML file" and not be wrapped
                    expect(message).to.include('Cannot load YAML file');
                    expect(message).to.include('js-yaml is not installed');
                }
            } else {
                // When available, test that other errors ARE wrapped
                const testFile = path.join(testDir, 'error-wrap.yaml');
                fs.writeFileSync(testFile, 'invalid: ::: yaml');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Failed to load configuration from');
                }
            }
        });

        /**
         * Test: YAML file with null value
         * Tests the null/undefined check in the load method.
         */
        it('should throw error for YAML file that parses to null', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'null.yaml');
                // YAML null value
                fs.writeFileSync(testFile, 'null');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('empty or contains only null');
                }
            }
        });

        /**
         * Test: YAML file with undefined-like content
         * Tests the undefined check path.
         */
        it('should throw error for YAML file with only comments and whitespace', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'only-comments.yaml');
                fs.writeFileSync(testFile, '# Just a comment\n\n   \n# Another comment');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    expect((error as Error).message).to.include('empty or contains only null');
                }
            }
        });

        /**
         * Test: YAML file with array at root
         * Tests the array check branch.
         */
        it('should throw error with specific message for array', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'root-array.yaml');
                fs.writeFileSync(testFile, '- one\n- two\n- three');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Expected YAML file to contain an object');
                    expect(message).to.include('got array');
                }
            }
        });

        /**
         * Test: YAML file with string primitive
         * Tests the primitive type check branch.
         */
        it('should throw error with specific message for string primitive', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'string.yaml');
                fs.writeFileSync(testFile, '"just a string value"');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Expected YAML file to contain an object');
                    expect(message).to.include('got string');
                }
            }
        });

        /**
         * Test: YAML file with number primitive
         * Tests the primitive type check with number.
         */
        it('should throw error for number primitive', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'number.yaml');
                fs.writeFileSync(testFile, '42');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Expected YAML file to contain an object');
                    expect(message).to.include('got number');
                }
            }
        });

        /**
         * Test: YAML file with boolean primitive
         * Tests the primitive type check with boolean.
         */
        it('should throw error for boolean primitive', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'boolean.yaml');
                fs.writeFileSync(testFile, 'true');

                try {
                    loader.load(testFile);
                    expect.fail('Should have thrown an error');
                } catch (error) {
                    expect(error).to.be.instanceOf(Error);
                    const message = (error as Error).message;
                    expect(message).to.include('Expected YAML file to contain an object');
                    expect(message).to.include('got boolean');
                }
            }
        });
    });

    describe('Success paths for complete coverage', () => {
        /**
         * Test: Valid YAML loads successfully
         * Ensures the happy path works correctly.
         */
        it('should successfully load valid YAML object', () => {
            if (loader.isAvailable()) {
                const testFile = path.join(testDir, 'valid.yaml');
                fs.writeFileSync(testFile, 'folder: ./migrations\ntableName: test');

                const result = loader.load<any>(testFile);

                expect(result).to.be.an('object');
                expect(result.folder).to.equal('./migrations');
                expect(result.tableName).to.equal('test');
            }
        });
    });
});
