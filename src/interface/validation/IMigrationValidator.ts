import {IValidationResult} from "./IValidationResult";
import {MigrationScript} from "../../model";
import {Config} from "../../model";

/**
 * Interface for custom migration validators.
 *
 * Implement this interface to add project-specific validation rules
 * beyond the built-in structural and interface validation.
 *
 * @example
 * ```typescript
 * import { ValidationIssueType } from '@migration-script-runner/core';
 *
 * // Validate class naming convention
 * class NamingConventionValidator implements IMigrationValidator {
 *   async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
 *     const className = script.script.constructor.name;
 *     const expectedName = this.toClassName(script.name);
 *
 *     if (className !== expectedName) {
 *       return {
 *         valid: false,
 *         issues: [{
 *           type: ValidationIssueType.ERROR,
 *           code: 'INVALID_CLASS_NAME',
 *           message: `Class name '${className}' doesn't match expected '${expectedName}'`,
 *           details: 'Class name should be PascalCase version of filename'
 *         }],
 *         script
 *       };
 *     }
 *
 *     return { valid: true, issues: [], script };
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * import { ValidationIssueType } from '@migration-script-runner/core';
 *
 * // Validate required JSDoc comments
 * class DocumentationValidator implements IMigrationValidator {
 *   async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
 *     const source = fs.readFileSync(script.filepath, 'utf8');
 *     const hasJsDoc = source.includes('/**');
 *
 *     if (!hasJsDoc) {
 *       return {
 *         valid: true,  // Warning only, not blocking
 *         issues: [{
 *           type: ValidationIssueType.WARNING,
 *           code: 'MISSING_DOCUMENTATION',
 *           message: 'Migration script is missing JSDoc comments',
 *           details: 'Add documentation describing what this migration does'
 *         }],
 *         script
 *       };
 *     }
 *
 *     return { valid: true, issues: [], script };
 *   }
 * }
 * ```
 */
export interface IMigrationValidator {
    /**
     * Validate a migration script according to custom rules.
     *
     * This method is called after built-in validation passes.
     * Return errors for blocking issues, warnings for non-blocking issues.
     *
     * @param script - Migration script to validate (already loaded and initialized)
     * @param config - Migration configuration (for context-aware validation)
     *
     * @returns Validation result with errors and/or warnings
     *
     * @throws Should not throw - return errors in the result instead
     */
    validate(script: MigrationScript, config: Config): Promise<IValidationResult>;
}
