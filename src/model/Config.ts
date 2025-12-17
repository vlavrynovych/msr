import {BackupConfig, RollbackStrategy, DownMethodPolicy, BackupMode, DuplicateTimestampMode, TransactionConfig, LockingConfig} from "./index";
import {IMigrationValidator} from "../interface/validation/IMigrationValidator";
import {IExecutionSummaryConfig, SummaryFormat} from "../interface/logging/IExecutionSummary";
import {LogLevel} from "../interface/ILogger";

/**
 * Configuration for the migration system.
 *
 * Controls migration script discovery, database table naming, console output, and backup behavior.
 *
 * @example
 * ```typescript
 * const config = new Config();
 * config.folder = './database/migrations';
 * config.tableName = 'migration_history';
 * config.displayLimit = 10;
 * ```
 */
export class Config {
    /**
     * Array of regular expression patterns for matching migration script filenames.
     *
     * Supports multiple file types (TypeScript, SQL, JavaScript, etc.).
     * Each pattern must capture the timestamp in group 1.
     *
     * @default [/^V(\d{12})_.*\.ts$/, /^V(\d{12})_.*\.js$/, /^V(\d{12})_.*\.up\.sql$/]
     *
     * @example
     * ```typescript
     * // Support TypeScript and SQL files only
     * config.filePatterns = [
     *     /^V(\d{12})_.*\.ts$/,
     *     /^V(\d{12})_.*\.up\.sql$/
     * ];
     *
     * // Support TypeScript, JavaScript, and SQL
     * config.filePatterns = [
     *     /^V(\d{12})_.*\.ts$/,
     *     /^V(\d{12})_.*\.js$/,
     *     /^V(\d{12})_.*\.up\.sql$/
     * ];
     *
     * // Custom timestamp format (YYYYMMDD)
     * config.filePatterns = [
     *     /^V(\d{8})_.*\.ts$/
     * ];
     * ```
     */
    filePatterns:RegExp[] = [
        /^V(\d{12})_.*\.ts$/,
        /^V(\d{12})_.*\.js$/,
        /^V(\d{12})_.*\.up\.sql$/
    ]

    /**
     * Directory path containing migration script files.
     * Can be relative or absolute path.
     *
     * @default './migrations' (relative to current working directory)
     *
     * @example
     * ```typescript
     * // Relative path
     * config.folder = './migrations';
     *
     * // Absolute path
     * config.folder = '/usr/local/app/migrations';
     * ```
     */
    folder:string = `${process.cwd()}/migrations`

    /**
     * Name of the database table used to track executed migrations.
     * This table stores migration metadata including timestamp, name, execution time, and result.
     *
     * @default 'schema_version'
     *
     * @example
     * ```typescript
     * config.tableName = 'schema_version';
     * // or
     * config.tableName = 'migrations_history';
     * ```
     */
    tableName:string = 'schema_version';

    /**
     * Backup configuration settings.
     * Controls how database backups are created, named, and managed during migrations.
     *
     * @default new BackupConfig()
     *
     * @example
     * ```typescript
     * config.backup = new BackupConfig();
     * config.backup.folder = './backups';
     * config.backup.deleteBackup = true;
     * ```
     */
    backup:BackupConfig = new BackupConfig()

    /**
     * Transaction management configuration.
     *
     * Controls how migrations are executed within database transactions, including
     * transaction mode (per-migration, per-batch, or none), isolation level, timeout,
     * and automatic retry behavior on transient failures.
     *
     * **New in v0.5.0**
     *
     * @default new TransactionConfig()
     *
     * @example
     * ```typescript
     * // Default configuration (recommended)
     * config.transaction = new TransactionConfig();
     * // mode: PER_MIGRATION, isolation: READ_COMMITTED, retries: 3
     *
     * // All migrations in single transaction
     * config.transaction.mode = TransactionMode.PER_BATCH;
     *
     * // Increase retries for high-contention databases
     * config.transaction.retries = 10;
     *
     * // Maximum consistency (slower, more deadlocks)
     * config.transaction.isolation = IsolationLevel.SERIALIZABLE;
     *
     * // No automatic transactions
     * config.transaction.mode = TransactionMode.NONE;
     * ```
     *
     * @see {@link TransactionConfig} for all configuration options
     * @see {@link TransactionMode} for detailed explanation of each mode
     * @see {@link IsolationLevel} for isolation level details
     */
    transaction:TransactionConfig = new TransactionConfig()

    /**
     * Locking mechanism configuration.
     *
     * Controls how migration locks are acquired and managed to prevent
     * concurrent migration execution across multiple instances or processes.
     *
     * **Critical for Production:**
     * - Enable in production to prevent race conditions
     * - Enable in CI/CD to prevent parallel pipeline conflicts
     * - Disable in development/testing for faster iteration
     *
     * **New in v0.8.0**
     *
     * @default new LockingConfig()
     *
     * @example
     * ```typescript
     * // Default configuration (fail fast)
     * config.locking = new LockingConfig();
     * // enabled: true, timeout: 10 minutes, retries: 0
     *
     * // Production with retries
     * config.locking.enabled = true;
     * config.locking.timeout = 600_000;  // 10 minutes
     * config.locking.retryAttempts = 5;
     * config.locking.retryDelay = 2000;  // 2 seconds
     *
     * // Disable for development
     * config.locking.enabled = false;
     *
     * // Custom lock table name
     * config.locking.tableName = 'migration_locks';
     * ```
     *
     * @see {@link LockingConfig} for all configuration options
     * @see {@link ILockingService} for implementation details
     */
    locking:LockingConfig = new LockingConfig()

    /**
     * Limits the number of migrated scripts displayed in console output.
     * Set to 0 to show all scripts (default).
     *
     * This only affects console display - all migrations are still tracked in the database.
     * Useful for projects with many migrations to keep console output manageable.
     *
     * @default 0 (show all)
     *
     * @example
     * ```typescript
     * // Show all migrations
     * config.displayLimit = 0;
     *
     * // Show only the last 10 migrations
     * config.displayLimit = 10;
     * ```
     */
    displayLimit:number = 0

    /**
     * Name of the special setup script that executes before any migrations.
     * This file should be placed in the migrations folder and will be executed
     * before MSR scans for pending migrations.
     *
     * The script executes with the same interface as regular migrations (IRunnableScript),
     * but is NOT saved to the schema version table.
     *
     * Set to `null` to disable beforeMigrate functionality entirely.
     *
     * @default 'beforeMigrate'
     *
     * @example
     * ```typescript
     * // Use default name (beforeMigrate.ts or beforeMigrate.js)
     * config.beforeMigrateName = 'beforeMigrate';
     *
     * // Use custom name
     * config.beforeMigrateName = 'setup';
     * // Will look for setup.ts or setup.js
     *
     * // Disable beforeMigrate entirely
     * config.beforeMigrateName = null;
     * ```
     */
    beforeMigrateName: string | null = 'beforeMigrate'

    /**
     * Enable recursive scanning of sub-folders for migration scripts.
     * When enabled, the migration scanner will search all sub-directories within
     * the configured folder, allowing you to organize migrations by feature, module,
     * version, or any other logical grouping.
     *
     * Migrations are always executed in timestamp order regardless of folder structure.
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Recursive sub-folder support (default)
     * config.recursive = true;
     *
     * // Directory structure:
     * // migrations/
     * // ├── users/
     * // │   ├── V202311010001_create_users_table.ts
     * // │   └── V202311020002_add_user_roles.ts
     * // ├── auth/
     * // │   └── V202311015001_create_sessions_table.ts
     * // └── products/
     * //     └── V202311030001_create_products_table.ts
     * //
     * // Execution order: V202311010001 → V202311015001 → V202311020002 → V202311030001
     *
     * // Disable for single-folder mode
     * config.recursive = false;
     * ```
     */
    recursive:boolean = true

    /**
     * Rollback strategy for handling migration failures.
     *
     * Determines how MSR responds when a migration fails:
     * - `BACKUP` (default): Create database backup before migrations, restore on failure
     * - `DOWN`: Call down() methods on failed migrations for rollback
     * - `BOTH`: Create backup AND use down() methods (safest - tries down() first, backup on down() failure)
     * - `NONE`: No automatic rollback (not recommended - database may be left in inconsistent state)
     *
     * @default RollbackStrategy.BACKUP
     *
     * @example
     * ```typescript
     * import { RollbackStrategy } from '@migration-script-runner/core';
     *
     * // Use backup/restore (default, recommended for production)
     * config.rollbackStrategy = RollbackStrategy.BACKUP;
     * // Requires: handler.backup implementation
     *
     * // Use down() migrations for rollback
     * config.rollbackStrategy = RollbackStrategy.DOWN;
     * // Requires: down() methods in migration scripts
     *
     * // Use both strategies for maximum safety
     * config.rollbackStrategy = RollbackStrategy.BOTH;
     * // Tries down() first, falls back to backup if down() fails
     *
     * // No rollback (dangerous - use with caution)
     * config.rollbackStrategy = RollbackStrategy.NONE;
     * // Database will be left in potentially inconsistent state on failure
     * ```
     *
     * @see IDatabaseMigrationHandler.backup for backup implementation
     * @see IRunnableScript.down for down() method implementation
     * @see RollbackStrategy enum for all available options
     */
    rollbackStrategy: RollbackStrategy = RollbackStrategy.BACKUP

    /**
     * Backup behavior mode during migration execution.
     *
     * Controls when backups are created and whether automatic restore occurs on failure.
     * Works in conjunction with rollbackStrategy to provide granular control over backup workflows.
     *
     * - `FULL` (default): Creates backup before migrations, restores on failure, deletes on success
     * - `CREATE_ONLY`: Creates backup but doesn't restore automatically on failure
     * - `RESTORE_ONLY`: Doesn't create backup, restores from existing backup on failure (requires existingBackupPath)
     * - `MANUAL`: No automatic backup/restore, use public methods (createBackup/restoreFromBackup/deleteBackup)
     *
     * @default BackupMode.FULL
     *
     * @example
     * ```typescript
     * import { BackupMode, RollbackStrategy } from '@migration-script-runner/core';
     *
     * // Full automatic backup and restore (default)
     * config.backupMode = BackupMode.FULL;
     * config.rollbackStrategy = RollbackStrategy.BACKUP;
     * // Creates backup, restores on failure, deletes on success
     *
     * // Create backup but use down() for rollback
     * config.backupMode = BackupMode.CREATE_ONLY;
     * config.rollbackStrategy = RollbackStrategy.DOWN;
     * // Creates backup for safety, uses down() methods for rollback, keeps backup
     *
     * // Use external backup system
     * config.backupMode = BackupMode.RESTORE_ONLY;
     * config.backup.existingBackupPath = './backups/pre-deploy.bkp';
     * // No backup creation, restores from existing backup on failure
     *
     * // Full manual control
     * config.backupMode = BackupMode.MANUAL;
     * const backupPath = await executor.createBackup();
     * try {
     *   await executor.migrate();
     * } catch (error) {
     *   await executor.restoreFromBackup(backupPath);
     * }
     * ```
     *
     * @see BackupMode enum for detailed mode descriptions
     * @see BackupConfig.existingBackupPath for RESTORE_ONLY mode
     */
    backupMode: BackupMode = BackupMode.FULL

    /**
     * Enable validation of migration scripts before execution.
     *
     * When enabled, MSR validates all pending migrations before running them:
     * - Structural validation (exports, instantiation, methods)
     * - Interface validation (up/down signatures)
     * - Custom validation (if customValidators are provided)
     *
     * Validation runs BEFORE database initialization and backup creation,
     * allowing fast failure if scripts have issues.
     *
     * @default true (enabled for safety)
     *
     * @example
     * ```typescript
     * // Enable validation (default)
     * config.validateBeforeRun = true;
     *
     * // Disable validation (not recommended)
     * config.validateBeforeRun = false;
     * ```
     */
    validateBeforeRun: boolean = true

    /**
     * Treat validation warnings as errors (strict mode).
     *
     * When enabled, migrations with warnings will fail validation and won't execute.
     * When disabled, warnings are logged but don't prevent execution.
     *
     * @default false (warnings don't block execution)
     *
     * @example
     * ```typescript
     * // Allow execution with warnings (default)
     * config.strictValidation = false;
     *
     * // Block execution if any warnings (strict mode)
     * config.strictValidation = true;
     * ```
     */
    strictValidation: boolean = false

    /**
     * Policy for handling missing down() methods during validation.
     *
     * Controls whether missing down() methods are treated as errors, warnings, or ignored:
     * - `AUTO` (default): Based on rollbackStrategy (error for DOWN, warning for BOTH, silent for BACKUP/NONE)
     * - `REQUIRED`: Always error if down() is missing
     * - `RECOMMENDED`: Always warn if down() is missing
     * - `OPTIONAL`: Never check for down() method
     *
     * @default DownMethodPolicy.AUTO
     *
     * @example
     * ```typescript
     * import { DownMethodPolicy } from '@migration-script-runner/core';
     *
     * // Auto-detect based on rollback strategy (default)
     * config.downMethodPolicy = DownMethodPolicy.AUTO;
     *
     * // Require all migrations to have down() methods
     * config.downMethodPolicy = DownMethodPolicy.REQUIRED;
     *
     * // Recommend but don't enforce down() methods
     * config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;
     *
     * // Don't check for down() methods
     * config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
     * ```
     */
    downMethodPolicy: DownMethodPolicy = DownMethodPolicy.AUTO

    /**
     * Custom validators to run in addition to built-in validation.
     *
     * Implement IMigrationValidator to add project-specific validation rules
     * such as naming conventions, required documentation, database-specific patterns, etc.
     *
     * Custom validators run after built-in validation passes.
     *
     * @default []
     *
     * @example
     * ```typescript
     * import { IMigrationValidator, ValidationIssueType } from '@migration-script-runner/core';
     *
     * class NamingValidator implements IMigrationValidator<DB> {
     *   async validate(script, config) {
     *     const className = script.script.constructor.name;
     *     const expectedName = this.toClassName(script.name);
     *
     *     if (className !== expectedName) {
     *       return {
     *         valid: false,
     *         issues: [{
     *           type: ValidationIssueType.ERROR,
     *           code: 'INVALID_CLASS_NAME',
     *           message: `Expected class name '${expectedName}', got '${className}'`
     *         }],
     *         script
     *       };
     *     }
     *
     *     return { valid: true, issues: [], script };
     *   }
     * }
     *
     * config.customValidators = [new NamingValidator()];
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customValidators: IMigrationValidator<any>[] = []

    /**
     * Enable validation of already-executed migration files.
     *
     * When enabled, MSR will:
     * - Calculate and store checksums when migrations are executed
     * - Validate checksums of previously-executed migrations on subsequent runs
     * - Detect if migration files have been modified after execution
     *
     * This helps prevent accidental or malicious modifications to executed migrations.
     *
     * @default false
     *
     * @example
     * ```typescript
     * // Enable integrity checking (recommended for production)
     * config.validateMigratedFiles = true;
     * config.checksumAlgorithm = 'sha256';
     *
     * // Disable for development
     * config.validateMigratedFiles = false;
     * ```
     */
    validateMigratedFiles: boolean = false

    /**
     * Validate that already-executed migration files still exist at their original paths.
     *
     * When true: Migration files that were executed must still exist
     * When false: Missing files are allowed (only checksum is validated if file exists)
     *
     * Set to false if you delete old migration files after deployment.
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Require all migration files to exist (strict)
     * config.validateMigratedFilesLocation = true;
     *
     * // Allow missing files (e.g., if you clean up old migrations)
     * config.validateMigratedFilesLocation = false;
     * ```
     */
    validateMigratedFilesLocation: boolean = true

    /**
     * Algorithm used for calculating migration file checksums.
     *
     * - 'md5': Faster, smaller checksums (32 characters)
     * - 'sha256': More secure, longer checksums (64 characters)
     *
     * @default 'sha256'
     *
     * @example
     * ```typescript
     * // Use SHA256 for better security (recommended)
     * config.checksumAlgorithm = 'sha256';
     *
     * // Use MD5 for faster calculation
     * config.checksumAlgorithm = 'md5';
     * ```
     */
    checksumAlgorithm: 'md5' | 'sha256' = 'sha256'

    /**
     * How to handle duplicate migration timestamps.
     *
     * Duplicate timestamps can cause undefined execution order when migrations
     * are discovered and executed. This setting controls whether duplicates
     * trigger a warning, error, or are silently ignored.
     *
     * - `WARN` (default): Log warning but continue - alerts developers without blocking
     * - `ERROR`: Throw error and halt - ensures timestamp uniqueness in production
     * - `IGNORE`: Silent - use only when you have external ordering guarantees
     *
     * @default DuplicateTimestampMode.WARN
     *
     * @example
     * ```typescript
     * import { DuplicateTimestampMode } from '@migration-script-runner/core';
     *
     * // Warn about duplicates (default, recommended)
     * config.duplicateTimestampMode = DuplicateTimestampMode.WARN;
     *
     * // Block execution on duplicates (strict, for production)
     * config.duplicateTimestampMode = DuplicateTimestampMode.ERROR;
     *
     * // Ignore duplicates (when using subdirectory-based ordering)
     * config.duplicateTimestampMode = DuplicateTimestampMode.IGNORE;
     * ```
     */
    duplicateTimestampMode: DuplicateTimestampMode = DuplicateTimestampMode.WARN

    /**
     * Configuration for execution summary logging.
     *
     * Controls whether and how to log detailed execution summaries to files.
     * Summaries include complete trace of migration executions, errors, and actions taken.
     *
     * @default { enabled: true, logSuccessful: false, path: './logs/migrations', format: 'json', maxFiles: 0 }
     *
     * @example
     * ```typescript
     * import { Config, SummaryFormat } from '@migration-script-runner/core';
     *
     * const config = new Config();
     * config.logging = {
     *     enabled: true,              // Enable summary logging
     *     logSuccessful: true,        // Log successful runs too
     *     path: './logs/migrations',  // Where to save summaries
     *     format: SummaryFormat.BOTH, // JSON and text formats
     *     maxFiles: 10                // Keep last 10 summaries
     * };
     * ```
     *
     * @example
     * ```typescript
     * // Production audit trail
     * config.logging = {
     *     enabled: true,
     *     logSuccessful: true,  // Log all runs for audit
     *     format: SummaryFormat.JSON,
     *     maxFiles: 100         // Keep 100 most recent
     * };
     * ```
     *
     * @example
     * ```typescript
     * // Debug failures only
     * config.logging = {
     *     enabled: true,
     *     logSuccessful: false,  // Only log failures
     *     format: SummaryFormat.BOTH,
     *     path: './debug/migrations'
     * };
     * ```
     */
    logging: IExecutionSummaryConfig = {
        enabled: false,
        logSuccessful: false,
        path: './logs/migrations',
        format: SummaryFormat.JSON,
        maxFiles: 0
    }

    /**
     * Enable dry run mode to preview migrations without executing them.
     *
     * When enabled, MSR will:
     * - Show which migrations would be executed
     * - Run validation (if enabled)
     * - Skip actual migration execution
     * - Skip backup/restore operations
     * - Pass isDryRun flag to hooks
     *
     * Perfect for:
     * - CI/CD validation before deployment
     * - Safety checks before production runs
     * - Documenting planned changes
     * - Testing migration logic
     *
     * @default false
     *
     * @example
     * ```typescript
     * import { Config, MigrationScriptExecutor } from '@migration-script-runner/core';
     *
     * const config = new Config();
     * config.dryRun = true;
     *
     * const executor = new MigrationScriptExecutor<DB>(handler, config);
     * await executor.migrate(); // No changes made, only preview
     * ```
     *
     * @example
     * ```typescript
     * // CI/CD validation
     * const config = new Config();
     * config.dryRun = process.env.CI === 'true';
     * config.validateBeforeRun = true;
     *
     * // Preview changes in CI, execute in deployment
     * await executor.migrate();
     * ```
     */
    dryRun: boolean = false

    /**
     * Display banner with version and handler information.
     *
     * When enabled, shows application banner at the start of migration runs.
     * Disable for cleaner console output in CI/CD or when embedding MSR in other tools.
     *
     * @default true
     *
     * @example
     * ```typescript
     * // Show banner (default)
     * config.showBanner = true;
     *
     * // Hide banner for cleaner output
     * config.showBanner = false;
     * ```
     */
    showBanner: boolean = true

    /**
     * Log level for controlling output verbosity.
     *
     * Controls which log messages are displayed during migration execution:
     * - `'error'`: Only errors (highest priority)
     * - `'warn'`: Errors and warnings
     * - `'info'`: Normal operation logs (default)
     * - `'debug'`: Detailed debugging information (lowest priority)
     *
     * Each level includes all higher priority levels.
     * For example, `'warn'` will show both warnings and errors.
     *
     * @default 'info'
     *
     * @example
     * ```typescript
     * // Show debug logs for troubleshooting
     * config.logLevel = 'debug';
     *
     * // Production: Only show errors
     * config.logLevel = 'error';
     *
     * // Default behavior (info + warn + error)
     * config.logLevel = 'info';
     * ```
     */
    logLevel: LogLevel = 'info'

    /**
     * List of .env file paths to load for environment variable configuration.
     *
     * Files are loaded in priority order (first file takes precedence).
     * MSR will automatically search for and load these files before parsing environment variables.
     *
     * **Supported since:** auto-envparse v2.1.0 (MSR v0.7.0+)
     *
     * @default ['.env.local', '.env', 'env']
     *
     * @example
     * ```typescript
     * // Default behavior - load .env.local, .env, and env in priority order
     * config.envFileSources = ['.env.local', '.env', 'env'];
     *
     * // Production environment - load production-specific file first
     * config.envFileSources = ['.env.production', '.env'];
     *
     * // Development with local overrides
     * config.envFileSources = ['.env.development.local', '.env.development', '.env'];
     *
     * // Disable .env file loading (use system environment variables only)
     * config.envFileSources = [];
     *
     * // Custom file names
     * config.envFileSources = ['database.env', 'secrets.env'];
     * ```
     *
     * @see https://github.com/vlavrynovych/auto-envparse#env-file-loading
     */
    envFileSources: string[] = ['.env.local', '.env', 'env']
}