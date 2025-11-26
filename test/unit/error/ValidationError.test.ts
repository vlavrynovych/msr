import { expect } from 'chai';
import { ValidationError, ValidationIssueType, IValidationResult } from '../../../src';

describe('ValidationError', () => {
    describe('errorCount', () => {
        /**
         * Test: errorCount getter counts all errors across multiple validation results
         * Validates that the errorCount property correctly sums up ERROR-type issues
         * from all validation results, ignoring WARNING-type issues.
         */
        it('should count total errors across all validation results', () => {
            const results: IValidationResult[] = [
                {
                    valid: false,
                    issues: [
                        { type: ValidationIssueType.ERROR, code: 'E1', message: 'Error 1' },
                        { type: ValidationIssueType.ERROR, code: 'E2', message: 'Error 2' },
                        { type: ValidationIssueType.WARNING, code: 'W1', message: 'Warning 1' }
                    ],
                    script: {} as any
                },
                {
                    valid: false,
                    issues: [
                        { type: ValidationIssueType.ERROR, code: 'E3', message: 'Error 3' }
                    ],
                    script: {} as any
                }
            ];

            const error = new ValidationError('Validation failed', results);

            expect(error.errorCount).to.equal(3);
        });

        /**
         * Test: errorCount returns 0 when validation results contain only warnings
         * Validates that errorCount correctly returns 0 when all issues are
         * WARNING-type, ensuring proper distinction between errors and warnings.
         */
        it('should return 0 when no errors exist', () => {
            const results: IValidationResult[] = [
                {
                    valid: true,
                    issues: [
                        { type: ValidationIssueType.WARNING, code: 'W1', message: 'Warning 1' }
                    ],
                    script: {} as any
                }
            ];

            const error = new ValidationError('Validation warnings', results);

            expect(error.errorCount).to.equal(0);
        });
    });

    describe('warningCount', () => {
        /**
         * Test: warningCount getter counts all warnings across multiple validation results
         * Validates that the warningCount property correctly sums up WARNING-type issues
         * from all validation results, ignoring ERROR-type issues.
         */
        it('should count total warnings across all validation results', () => {
            const results: IValidationResult[] = [
                {
                    valid: true,
                    issues: [
                        { type: ValidationIssueType.WARNING, code: 'W1', message: 'Warning 1' },
                        { type: ValidationIssueType.WARNING, code: 'W2', message: 'Warning 2' },
                        { type: ValidationIssueType.ERROR, code: 'E1', message: 'Error 1' }
                    ],
                    script: {} as any
                },
                {
                    valid: true,
                    issues: [
                        { type: ValidationIssueType.WARNING, code: 'W3', message: 'Warning 3' }
                    ],
                    script: {} as any
                }
            ];

            const error = new ValidationError('Validation issues', results);

            expect(error.warningCount).to.equal(3);
        });

        /**
         * Test: warningCount returns 0 when validation results contain only errors
         * Validates that warningCount correctly returns 0 when all issues are
         * ERROR-type, ensuring proper distinction between warnings and errors.
         */
        it('should return 0 when no warnings exist', () => {
            const results: IValidationResult[] = [
                {
                    valid: false,
                    issues: [
                        { type: ValidationIssueType.ERROR, code: 'E1', message: 'Error 1' }
                    ],
                    script: {} as any
                }
            ];

            const error = new ValidationError('Validation failed', results);

            expect(error.warningCount).to.equal(0);
        });
    });

    describe('constructor', () => {
        /**
         * Test: Constructor sets name property to 'ValidationError'
         * Validates that the error name is correctly set for identification
         * and error handling purposes.
         */
        it('should set name property to ValidationError', () => {
            const results: IValidationResult[] = [];
            const error = new ValidationError('Test message', results);

            expect(error.name).to.equal('ValidationError');
        });

        /**
         * Test: Constructor sets message property
         * Validates that the error message is correctly stored and accessible
         * for error reporting and debugging.
         */
        it('should set message property', () => {
            const results: IValidationResult[] = [];
            const error = new ValidationError('Test message', results);

            expect(error.message).to.equal('Test message');
        });

        /**
         * Test: Constructor stores validation results
         * Validates that the validationResults property is correctly set,
         * allowing access to detailed validation information for error handling.
         */
        it('should store validation results', () => {
            const results: IValidationResult[] = [
                {
                    valid: false,
                    issues: [{ type: ValidationIssueType.ERROR, code: 'E1', message: 'Error' }],
                    script: {} as any
                }
            ];
            const error = new ValidationError('Test', results);

            expect(error.validationResults).to.equal(results);
        });

        /**
         * Test: ValidationError extends Error class
         * Validates that ValidationError properly extends the Error class,
         * enabling standard error handling patterns (try-catch, instanceof checks).
         */
        it('should be an instance of Error', () => {
            const results: IValidationResult[] = [];
            const error = new ValidationError('Test', results);

            expect(error).to.be.instanceOf(Error);
        });
    });
});
