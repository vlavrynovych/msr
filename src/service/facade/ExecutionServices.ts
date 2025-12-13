import {MigrationScriptSelector} from "../MigrationScriptSelector";
import {MigrationRunner} from "../MigrationRunner";
import {ITransactionManager} from "../../interface/service/ITransactionManager";
import {IDB} from "../../interface";

/**
 * Facade for migration execution services.
 *
 * Groups services responsible for selecting and executing migration scripts,
 * including transaction management.
 *
 * @template DB - Database interface type
 *
 * @since v0.7.0
 */
export class ExecutionServices<DB extends IDB> {
    /**
     * Creates a new ExecutionServices facade.
     *
     * @param selector - Service for selecting which migrations to execute
     * @param runner - Service for executing migration scripts
     * @param transactionManager - Optional transaction manager for database transactions
     */
    constructor(
        public readonly selector: MigrationScriptSelector<DB>,
        public readonly runner: MigrationRunner<DB>,
        public readonly transactionManager?: ITransactionManager<DB>
    ) {}
}
