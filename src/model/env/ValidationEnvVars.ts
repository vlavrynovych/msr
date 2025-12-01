/**
 * Environment variables for migration validation settings.
 *
 * Control how strictly MSR validates migrations before execution,
 * helping catch potential issues early.
 *
 * @example
 * ```typescript
 * // Enable validation before running migrations
 * process.env[ValidationEnvVars.MSR_VALIDATE_BEFORE_RUN] = 'true';
 *
 * // Treat validation warnings as errors
 * process.env[ValidationEnvVars.MSR_STRICT_VALIDATION] = 'true';
 * ```
 */
export enum ValidationEnvVars {
    /**
     * Validate migrations before execution.
     * @default true
     */
    MSR_VALIDATE_BEFORE_RUN = 'MSR_VALIDATE_BEFORE_RUN',

    /**
     * Treat validation warnings as errors.
     * @default false
     */
    MSR_STRICT_VALIDATION = 'MSR_STRICT_VALIDATION',
}
