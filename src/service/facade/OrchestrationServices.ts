import {IMigrationWorkflowOrchestrator} from "../../interface/service/IMigrationWorkflowOrchestrator";
import {IMigrationValidationOrchestrator} from "../../interface/service/IMigrationValidationOrchestrator";
import {IMigrationReportingOrchestrator} from "../../interface/service/IMigrationReportingOrchestrator";
import {IMigrationErrorHandler} from "../../interface/service/IMigrationErrorHandler";
import {IMigrationHookExecutor} from "../../interface/service/IMigrationHookExecutor";
import {IMigrationRollbackManager} from "../../interface/service/IMigrationRollbackManager";
import {IDB} from "../../interface";

/**
 * Facade for orchestration services.
 *
 * Groups high-level orchestrators responsible for coordinating complex workflows
 * including validation, reporting, error handling, hooks, and rollback operations.
 *
 * Introduced in v0.7.0 as part of the orchestrator pattern refactoring.
 *
 * @template DB - Database interface type
 *
 * @since v0.7.0
 */
export class OrchestrationServices<DB extends IDB> {
    /**
     * Creates a new OrchestrationServices facade.
     *
     * @param workflow - Orchestrator for coordinating migration workflow
     * @param validation - Orchestrator for validation operations
     * @param reporting - Orchestrator for rendering and logging
     * @param error - Service for handling migration errors and recovery
     * @param hooks - Service for executing lifecycle hooks
     * @param rollback - Service for managing version-based rollbacks
     */
    constructor(
        public readonly workflow: IMigrationWorkflowOrchestrator<DB>,
        public readonly validation: IMigrationValidationOrchestrator<DB>,
        public readonly reporting: IMigrationReportingOrchestrator<DB>,
        public readonly error: IMigrationErrorHandler<DB>,
        public readonly hooks: IMigrationHookExecutor<DB>,
        public readonly rollback: IMigrationRollbackManager<DB>
    ) {}
}
