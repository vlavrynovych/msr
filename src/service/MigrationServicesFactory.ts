import {IMigrationExecutorDependencies} from "../interface/IMigrationExecutorDependencies";
import {IDB} from "../interface";
import {Config} from "../model";
import {IDatabaseMigrationHandler} from "../interface/IDatabaseMigrationHandler";
import {ILogger} from "../interface/ILogger";
import {IMigrationHooks} from "../interface/IMigrationHooks";
import {ILoaderRegistry} from "../interface/loader/ILoaderRegistry";
import {CoreServices} from "./facade/CoreServices";
import {ExecutionServices} from "./facade/ExecutionServices";
import {OutputServices} from "./facade/OutputServices";
import {OrchestrationServices} from "./facade/OrchestrationServices";
import {ConfigLoader} from "../util/ConfigLoader";
import {ConsoleLogger} from "../logger";
import {LevelAwareLogger} from "../logger/LevelAwareLogger";
import {MetricsCollectorHook} from "../hooks/MetricsCollectorHook";
import {ExecutionSummaryHook} from "../hooks/ExecutionSummaryHook";
import {CompositeHooks} from "../hooks/CompositeHooks";
import {LoaderRegistry} from "../loader/LoaderRegistry";
import {BackupService} from "./BackupService";
import {SchemaVersionService} from "./SchemaVersionService";
import {ISchemaVersion} from "../interface/dao/ISchemaVersion";
import {MigrationRenderer} from "./MigrationRenderer";
import {MigrationService} from "./MigrationService";
import {MigrationScriptSelector} from "./MigrationScriptSelector";
import {MigrationScanner} from "./MigrationScanner";
import {MigrationValidationService} from "./MigrationValidationService";
import {RollbackService} from "./RollbackService";
import {ITransactionManager} from "../interface/service/ITransactionManager";
import {TransactionMode} from "../model/TransactionMode";
import {isImperativeTransactional, isCallbackTransactional} from "../interface/dao/ITransactionalDB";
import {DefaultTransactionManager} from "./DefaultTransactionManager";
import {CallbackTransactionManager} from "./CallbackTransactionManager";
import {MigrationRunner} from "./MigrationRunner";
import {MigrationErrorHandler} from "./MigrationErrorHandler";
import {MigrationRollbackManager} from "./MigrationRollbackManager";
import {MigrationHookExecutor} from "./MigrationHookExecutor";
import {MigrationValidationOrchestrator} from "./MigrationValidationOrchestrator";
import {MigrationReportingOrchestrator} from "./MigrationReportingOrchestrator";
import {MigrationWorkflowOrchestrator} from "./MigrationWorkflowOrchestrator";

/**
 * Result of creating migration services via factory.
 *
 * Contains all initialized service facades and infrastructure components
 * needed by MigrationScriptExecutor.
 *
 * @template DB - Database interface type
 *
 * @since v0.7.0
 */
export interface MigrationServicesFacades<DB extends IDB> {
    /** Loaded configuration */
    config: Config;

    /** Database migration handler */
    handler: IDatabaseMigrationHandler<DB>;

    /** Core business logic services */
    core: CoreServices<DB>;

    /** Migration execution services */
    execution: ExecutionServices<DB>;

    /** Output services (logging and rendering) */
    output: OutputServices<DB>;

    /** Orchestration services */
    orchestration: OrchestrationServices<DB>;

    /** Loader registry for migration files */
    loaderRegistry: ILoaderRegistry<DB>;

    /** Optional lifecycle hooks */
    hooks?: IMigrationHooks<DB>;
}

/**
 * Factory function for creating all migration services.
 *
 * Extracts all initialization logic from MigrationScriptExecutor constructor
 * into a separate factory function for better separation of concerns.
 *
 * @template DB - Database interface type
 * @param dependencies - Service dependencies from user
 * @returns Initialized service facades and infrastructure
 *
 * @since v0.7.0
 */
export function createMigrationServices<DB extends IDB>(
    dependencies: IMigrationExecutorDependencies<DB>
): MigrationServicesFacades<DB> {

    const handler = dependencies.handler;

    // Load configuration
    const configLoader = dependencies.configLoader ?? new ConfigLoader();
    const config = dependencies.config ?? configLoader.load();

    // Create logger
    const baseLogger = dependencies.logger ?? new ConsoleLogger();
    const logger = new LevelAwareLogger(baseLogger, config.logLevel);

    // Setup hooks
    const hooks = createHooksComposite(dependencies, config, logger, handler);

    // Create loader registry
    const loaderRegistry = dependencies.loaderRegistry ?? LoaderRegistry.createDefault(logger);

    // Build service facades
    const core = createCoreServices(dependencies, handler, config, logger, hooks);
    const execution = createExecutionServices(handler, core, config, logger, hooks);
    const output = createOutputServices(dependencies, handler, config, logger);
    const orchestration = createOrchestrationServices(
        handler, core, execution, output, config, logger, loaderRegistry, hooks
    );

    return {
        config,
        handler,
        core,
        execution,
        output,
        orchestration,
        loaderRegistry,
        hooks
    };
}

/**
 * Create composite hooks from dependencies.
 *
 * Combines metrics collectors, user hooks, and execution summary hook
 * into a single CompositeHooks instance.
 *
 * @private
 */
function createHooksComposite<DB extends IDB>(
    dependencies: IMigrationExecutorDependencies<DB>,
    config: Config,
    logger: ILogger,
    handler: IDatabaseMigrationHandler<DB>
): IMigrationHooks<DB> | undefined {
    const hooks: IMigrationHooks<DB>[] = [];

    // Add MetricsCollectorHook if collectors provided (v0.6.0)
    if (dependencies.metricsCollectors && dependencies.metricsCollectors.length > 0) {
        hooks.push(new MetricsCollectorHook(dependencies.metricsCollectors, logger));
    }

    // Add user-provided hooks
    if (dependencies.hooks) {
        hooks.push(dependencies.hooks);
    }

    // Add execution summary hook if logging enabled
    if (config.logging.enabled) {
        hooks.push(new ExecutionSummaryHook<DB>(config, logger, handler));
    }

    // Combine all hooks or use undefined
    return hooks.length > 0 ? new CompositeHooks<DB>(hooks) : undefined;
}

/**
 * Create core business logic services.
 *
 * @private
 */
function createCoreServices<DB extends IDB>(
    dependencies: IMigrationExecutorDependencies<DB>,
    handler: IDatabaseMigrationHandler<DB>,
    config: Config,
    logger: ILogger,
    hooks?: IMigrationHooks<DB>
): CoreServices<DB> {
    // Create backup service
    const backup = dependencies.backupService
        ?? new BackupService<DB>(handler, config, logger);

    // Create schema version service
    const schemaVersion = dependencies.schemaVersionService
        ?? new SchemaVersionService<DB, ISchemaVersion<DB>>(handler.schemaVersion);

    // Create migration service
    const migration = dependencies.migrationService
        ?? new MigrationService<DB>(logger);

    // Create selector (always new instance)
    const selector = new MigrationScriptSelector<DB>();

    // Create scanner
    const scanner = dependencies.migrationScanner
        ?? new MigrationScanner<DB>(migration, schemaVersion, selector, config);

    // Create validation service
    const validation = dependencies.validationService
        ?? new MigrationValidationService<DB>(logger, config.customValidators);

    // Create rollback service
    const rollback = dependencies.rollbackService
        ?? new RollbackService<DB>(handler, config, backup, logger, hooks);

    return new CoreServices<DB>(scanner, schemaVersion, migration, validation, backup, rollback);
}

/**
 * Create migration execution services.
 *
 * @private
 */
function createExecutionServices<DB extends IDB>(
    handler: IDatabaseMigrationHandler<DB>,
    core: CoreServices<DB>,
    config: Config,
    logger: ILogger,
    hooks?: IMigrationHooks<DB>
): ExecutionServices<DB> {
    // Create transaction manager
    const transactionManager = createTransactionManager(handler, config, logger);

    // Create selector (always new instance)
    const selector = new MigrationScriptSelector<DB>();

    // Create runner with transaction support
    const runner = new MigrationRunner<DB>(
        handler,
        core.schemaVersion,
        config,
        logger,
        transactionManager,
        hooks
    );

    return new ExecutionServices<DB>(selector, runner, transactionManager);
}

/**
 * Create output services (logging and rendering).
 *
 * @private
 */
function createOutputServices<DB extends IDB>(
    dependencies: IMigrationExecutorDependencies<DB>,
    handler: IDatabaseMigrationHandler<DB>,
    config: Config,
    logger: ILogger
): OutputServices<DB> {
    // Create renderer
    const renderer = dependencies.migrationRenderer
        ?? new MigrationRenderer<DB>(handler, config, logger, dependencies.renderStrategy);

    return new OutputServices<DB>(logger, renderer);
}

/**
 * Create orchestration services.
 *
 * @private
 */
function createOrchestrationServices<DB extends IDB>(
    handler: IDatabaseMigrationHandler<DB>,
    core: CoreServices<DB>,
    execution: ExecutionServices<DB>,
    output: OutputServices<DB>,
    config: Config,
    logger: ILogger,
    loaderRegistry: ILoaderRegistry<DB>,
    hooks?: IMigrationHooks<DB>
): OrchestrationServices<DB> {
    // Create error handler
    const errorHandler = new MigrationErrorHandler<DB>({
        logger: output.logger,
        hooks: hooks,
        rollbackService: core.rollback
    });

    // Create hook executor
    const hookExecutor = new MigrationHookExecutor<DB>({
        runner: execution.runner,
        hooks: hooks
    });

    // Create validation orchestrator
    const validationOrchestrator = new MigrationValidationOrchestrator<DB>({
        validationService: core.validation,
        logger: output.logger,
        config: config,
        loaderRegistry: loaderRegistry,
        migrationScanner: core.scanner,
        schemaVersionService: core.schemaVersion,
        handler: handler
    });

    // Create reporting orchestrator
    const reportingOrchestrator = new MigrationReportingOrchestrator<DB>({
        migrationRenderer: output.renderer,
        logger: output.logger,
        config: config
    });

    // Create rollback manager
    const rollbackManager = new MigrationRollbackManager<DB>({
        handler: handler,
        schemaVersionService: core.schemaVersion,
        migrationScanner: core.scanner,
        selector: execution.selector,
        logger: output.logger,
        config: config,
        loaderRegistry: loaderRegistry,
        validationService: core.validation,
        hooks: hooks,
        errorHandler: errorHandler
    });

    // Create workflow orchestrator with all required services
    const workflowOrchestrator = new MigrationWorkflowOrchestrator<DB>({
        migrationScanner: core.scanner,
        validationOrchestrator: validationOrchestrator,
        reportingOrchestrator: reportingOrchestrator,
        backupService: core.backup,
        hookExecutor: hookExecutor,
        errorHandler: errorHandler,
        rollbackService: core.rollback,
        schemaVersionService: core.schemaVersion,
        loaderRegistry: loaderRegistry,
        selector: execution.selector,
        transactionManager: execution.transactionManager,
        config: config,
        logger: output.logger,
        hooks: hooks,
        handler: handler,
        migrationService: core.migration
    });

    return new OrchestrationServices<DB>(
        workflowOrchestrator,
        validationOrchestrator,
        reportingOrchestrator,
        errorHandler,
        hookExecutor,
        rollbackManager
    );
}

/**
 * Create transaction manager if transactions are enabled.
 *
 * Auto-creates appropriate transaction manager based on database interface:
 * - Imperative (SQL): Creates DefaultTransactionManager for ITransactionalDB
 * - Callback (NoSQL): Creates CallbackTransactionManager for ICallbackTransactionalDB
 *
 * @private
 */
function createTransactionManager<DB extends IDB>(
    handler: IDatabaseMigrationHandler<DB>,
    config: Config,
    logger: ILogger
): ITransactionManager<DB> | undefined {
    // If transaction mode is NONE, don't create transaction manager
    if (config.transaction.mode === TransactionMode.NONE) {
        return undefined;
    }

    // If handler provides custom transaction manager, use it
    if (handler.transactionManager) {
        logger.debug('Using custom transaction manager from handler');
        return handler.transactionManager;
    }

    // Check for imperative transaction support (SQL-style)
    if (isImperativeTransactional(handler.db)) {
        logger.debug('Auto-creating DefaultTransactionManager (db implements ITransactionalDB)');
        return new DefaultTransactionManager<DB>(
            handler.db,
            config.transaction,
            logger
        );
    }

    // Check for callback transaction support (NoSQL-style)
    if (isCallbackTransactional(handler.db)) {
        logger.debug('Auto-creating CallbackTransactionManager (db implements ICallbackTransactionalDB)');
        return new CallbackTransactionManager<DB>(
            handler.db,
            config.transaction,
            logger
        );
    }

    // No transaction support available
    logger.warn(
        'Transaction mode is configured but database does not support transactions. ' +
        'Either implement ITransactionalDB (SQL) or ICallbackTransactionalDB (NoSQL), ' +
        'or provide a custom transactionManager in the handler.'
    );
    return undefined;
}
