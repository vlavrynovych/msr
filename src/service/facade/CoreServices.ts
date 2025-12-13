import {IMigrationScanner} from "../../interface/service/IMigrationScanner";
import {ISchemaVersionService} from "../../interface/service/ISchemaVersionService";
import {IMigrationService} from "../../interface/service/IMigrationService";
import {IMigrationValidationService} from "../../interface/service/IMigrationValidationService";
import {IBackupService} from "../../interface/service/IBackupService";
import {IRollbackService} from "../../interface/service/IRollbackService";
import {IDB} from "../../interface";

/**
 * Facade for core business logic services.
 *
 * Groups services responsible for core migration operations including
 * scanning migrations, tracking versions, validation, backup, and rollback.
 *
 * @template DB - Database interface type
 *
 * @since v0.7.0
 */
export class CoreServices<DB extends IDB> {
    /**
     * Creates a new CoreServices facade.
     *
     * @param scanner - Service for scanning and gathering migration state
     * @param schemaVersion - Service for tracking executed migrations in database
     * @param migration - Service for discovering and loading migration files
     * @param validation - Service for validating migration scripts
     * @param backup - Service for creating and managing database backups
     * @param rollback - Service for handling rollback operations
     */
    constructor(
        public readonly scanner: IMigrationScanner<DB>,
        public readonly schemaVersion: ISchemaVersionService<DB>,
        public readonly migration: IMigrationService<DB>,
        public readonly validation: IMigrationValidationService<DB>,
        public readonly backup: IBackupService,
        public readonly rollback: IRollbackService<DB>
    ) {}
}
