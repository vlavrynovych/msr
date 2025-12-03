import { IMigrationHooks } from "../interface/IMigrationHooks";
import { IDB } from "../interface/dao";
import { MigrationScript } from "../model/MigrationScript";
import { IMigrationResult } from "../interface/IMigrationResult";

/**
 * Composite hook implementation that forwards calls to multiple hooks.
 *
 * CompositeHooks implements the [Composite Pattern](https://en.wikipedia.org/wiki/Composite_pattern)
 * to execute multiple hook implementations simultaneously. This allows combining different
 * behaviors like notifications, metrics, logging, and custom validation in a single migration run.
 *
 * All registered hooks are called sequentially in the order they were added.
 * If any hook throws an error, subsequent hooks in the chain will not be called.
 *
 *
 * @template DB - Database interface type
 * @example
 * ```typescript
 * // Combine multiple hooks
 * const hooks = new CompositeHooks<DB>([
 *     new SlackNotificationHooks(webhookUrl),
 *     new MetricsCollectionHooks(),
 *     new CustomLoggingHooks()
 * ]);
 *
 * const executor = new MigrationScriptExecutor<DB>(handler, { hooks });
 * await executor.migrate();
 * ```
 *
 *
 * @template DB - Database interface type
 * @example
 * ```typescript
 * // Add hooks dynamically
 * const hooks = new CompositeHooks<DB>();
 * hooks.addHook(new SlackNotificationHooks(webhookUrl));
 *
 * if (process.env.NODE_ENV === 'production') {
 *     hooks.addHook(new DatadogMetricsHooks());
 * }
 * ```
 *
 *
 * @template DB - Database interface type
 * @example
 * ```typescript
 * // Nested composites
 * const notificationHooks = new CompositeHooks<DB>([
 *     new SlackHooks(),
 *     new EmailHooks()
 * ]);
 *
 * const monitoringHooks = new CompositeHooks<DB>([
 *     new DatadogHooks(),
 *     new NewRelicHooks()
 * ]);
 *
 * const allHooks = new CompositeHooks<DB>([
 *     notificationHooks,
 *     monitoringHooks
 * ]);
 * ```
 */
export class CompositeHooks<DB extends IDB> implements IMigrationHooks<DB> {

    /**
     * Array of hook instances that will receive lifecycle events.
     */
    private readonly hooks: IMigrationHooks<DB>[];

    /**
     * Creates a new CompositeHooks instance.
     *
     * @param hooks - Optional array of hook instances to forward events to.
     *                Hooks can also be added later via addHook().
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * // Create with hooks
     * const composite = new CompositeHooks<DB>([
     *     new SlackHooks(),
     *     new MetricsHooks()
     * ]);
     * ```
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * // Create empty, add hooks later
     * const composite = new CompositeHooks<DB>();
     * composite.addHook(new SlackHooks());
     * ```
     */
    constructor(hooks: IMigrationHooks<DB>[] = []) {
        this.hooks = [...hooks];
    }

    /**
     * Add a hook to the composite.
     *
     * The hook will start receiving all subsequent lifecycle events.
     *
     * @param hook - Hook instance to add
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const composite = new CompositeHooks<DB>([new SlackHooks()]);
     * composite.addHook(new MetricsHooks());
     * // Now forwards to both Slack and Metrics hooks
     * ```
     */
    public addHook(hook: IMigrationHooks<DB>): void {
        this.hooks.push(hook);
    }

    /**
     * Remove a hook from the composite.
     *
     * The hook will stop receiving lifecycle events. Useful for dynamically
     * enabling/disabling specific hook behaviors.
     *
     * @param hook - Hook instance to remove
     * @returns true if hook was found and removed, false otherwise
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const metricsHook = new MetricsHooks();
     * const composite = new CompositeHooks<DB>([
     *     new SlackHooks(),
     *     metricsHook
     * ]);
     *
     * // Later, disable metrics collection
     * composite.removeHook(metricsHook);
     * ```
     */
    public removeHook(hook: IMigrationHooks<DB>): boolean {
        const index = this.hooks.indexOf(hook);
        if (index !== -1) {
            this.hooks.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get all registered hooks.
     *
     * Returns a copy of the hooks array to prevent external modification.
     *
     * @returns Array of registered hook instances
     *
 *
 * @template DB - Database interface type
     * @example
     * ```typescript
     * const composite = new CompositeHooks<DB>([
     *     new SlackHooks(),
     *     new MetricsHooks()
     * ]);
     *
     * console.log(`Using ${composite.getHooks().length} hooks`);
     * // Output: Using 2 hooks
     * ```
     */
    public getHooks(): IMigrationHooks<DB>[] {
        return [...this.hooks];
    }

    /**
     * Called at the start of the migration process.
     * Forwards to all registered hooks.
     */
    async onStart(totalScripts: number, pendingScripts: number): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onStart?.(totalScripts, pendingScripts);
        }
    }

    /**
     * Called before creating a database backup.
     * Forwards to all registered hooks.
     */
    async onBeforeBackup(): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onBeforeBackup?.();
        }
    }

    /**
     * Called after creating a database backup.
     * Forwards to all registered hooks.
     */
    async onAfterBackup(backupPath: string): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onAfterBackup?.(backupPath);
        }
    }

    /**
     * Called before executing a migration script.
     * Forwards to all registered hooks.
     */
    async onBeforeMigrate(script: MigrationScript<DB>): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onBeforeMigrate?.(script);
        }
    }

    /**
     * Called after successfully executing a migration script.
     * Forwards to all registered hooks.
     */
    async onAfterMigrate(script: MigrationScript<DB>, result: string): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onAfterMigrate?.(script, result);
        }
    }

    /**
     * Called when a migration script fails.
     * Forwards to all registered hooks.
     *
     * Note: Errors thrown in hooks are propagated and will prevent
     * subsequent hooks from being called.
     */
    async onMigrationError(script: MigrationScript<DB>, error: Error): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onMigrationError?.(script, error);
        }
    }

    /**
     * Called before restoring from backup.
     * Forwards to all registered hooks.
     */
    async onBeforeRestore(): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onBeforeRestore?.();
        }
    }

    /**
     * Called after restoring from backup.
     * Forwards to all registered hooks.
     */
    async onAfterRestore(): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onAfterRestore?.();
        }
    }

    /**
     * Called when all migrations complete successfully.
     * Forwards to all registered hooks.
     */
    async onComplete(result: IMigrationResult<DB>): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onComplete?.(result);
        }
    }

    /**
     * Called when the migration process fails.
     * Forwards to all registered hooks.
     *
     * Note: Errors thrown in hooks are propagated and will prevent
     * subsequent hooks from being called.
     */
    async onError(error: Error): Promise<void> {
        for (const hook of this.hooks) {
            await hook.onError?.(error);
        }
    }
}
