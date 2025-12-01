import { MigrationScript } from "../model/MigrationScript";

/**
 * Lifecycle hooks for individual migration script execution.
 *
 * Provides extension points for tracking and controlling individual migration
 * script execution:
 * - Before a script's up() method is called
 * - After a script completes successfully
 * - When a script fails
 *
 * These hooks operate at the individual script level. All methods are optional.
 *
 * **New in v0.5.0**
 *
 * @example
 * ```typescript
 * import { IMigrationScriptHooks, MigrationScript } from '@migration-script-runner/core';
 *
 * class MetricsHooks implements IMigrationScriptHooks {
 *   async onBeforeMigrate(script: MigrationScript): Promise<void> {
 *     console.log(`Executing: ${script.name}`);
 *     metrics.increment('migration.started');
 *   }
 *
 *   async onAfterMigrate(script: MigrationScript, result: string): Promise<void> {
 *     const duration = script.finishedAt! - script.startedAt!;
 *     metrics.timing('migration.duration', duration, {
 *       script: script.name
 *     });
 *   }
 *
 *   async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
 *     metrics.increment('migration.error', {
 *       script: script.name,
 *       error: error.message
 *     });
 *   }
 * }
 * ```
 */
export interface IMigrationScriptHooks {
    /**
     * Called before executing a migration script.
     *
     * Invoked immediately before script.up() is called. Useful for
     * validation, logging, or preparing script execution environment.
     *
     * @param script - Migration script about to be executed
     *
     * @example
     * ```typescript
     * async onBeforeMigrate(script: MigrationScript): Promise<void> {
     *     console.log(`Executing: ${script.name}`);
     *     metrics.increment('migration.started');
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Dry-run mode
     * async onBeforeMigrate(script: MigrationScript): Promise<void> {
     *     console.log(`[DRY RUN] Would execute: ${script.name}`);
     *     throw new Error('DRY_RUN_MODE'); // Skip execution
     * }
     * ```
     */
    onBeforeMigrate?(script: MigrationScript): Promise<void>;

    /**
     * Called after successfully executing a migration script.
     *
     * Invoked after script.up() completes successfully and script is saved
     * to schema version table. Useful for metrics, logging, or notifications.
     *
     * @param script - Migration script that was executed (includes timing info)
     * @param result - Result returned by script.up()
     *
     * @example
     * ```typescript
     * async onAfterMigrate(script: MigrationScript, result: string): Promise<void> {
     *     const duration = script.finishedAt! - script.startedAt!;
     *     console.log(`Completed ${script.name} in ${duration}ms: ${result}`);
     *     metrics.timing('migration.duration', duration);
     * }
     * ```
     */
    onAfterMigrate?(script: MigrationScript, result: string): Promise<void>;

    /**
     * Called when a migration script fails.
     *
     * Invoked when script.up() throws an error. Called before backup restoration
     * begins. Useful for error logging, notifications, or custom error handling.
     *
     * Note: This hook should not throw errors as it's called during error handling.
     *
     * @param script - Migration script that failed
     * @param error - Error thrown by the script
     *
     * @example
     * ```typescript
     * async onMigrationError(script: MigrationScript, error: Error): Promise<void> {
     *     console.error(`Failed: ${script.name}`, error);
     *     metrics.increment('migration.error');
     *     await notifySlack(`Migration failed: ${script.name} - ${error.message}`);
     * }
     * ```
     */
    onMigrationError?(script: MigrationScript, error: Error): Promise<void>;
}
