/**
 * Summary format for execution summary files
 */
export enum SummaryFormat {
    /**
     * JSON format for programmatic processing
     */
    JSON = 'json',

    /**
     * Human-readable text format
     */
    TEXT = 'text',

    /**
     * Both JSON and text formats
     */
    BOTH = 'both'
}

/**
 * Configuration for execution summary logging
 */
export interface IExecutionSummaryConfig {
    /**
     * Enable execution summary logging
     *
     * @default true (enabled for failures only)
     */
    enabled?: boolean;

    /**
     * Log summaries for successful migrations
     *
     * @default false
     */
    logSuccessful?: boolean;

    /**
     * Directory path where summary files will be saved
     *
     * @default './logs/migrations'
     */
    path?: string;

    /**
     * Format for summary files
     *
     * @default SummaryFormat.JSON
     */
    format?: SummaryFormat;

    /**
     * Maximum number of summary files to keep (0 = unlimited)
     * Oldest files are deleted when limit is reached
     *
     * @default 0 (no limit)
     */
    maxFiles?: number;
}

/**
 * Status of a migration execution
 */
export enum MigrationExecutionStatus {
    SUCCESS = 'success',
    FAILED = 'failed',
    ROLLED_BACK = 'rolled_back'
}

/**
 * Details of a single migration execution
 */
export interface IMigrationExecutionDetail {
    /**
     * Migration name
     */
    name: string;

    /**
     * Migration timestamp
     */
    timestamp: number;

    /**
     * When the migration started
     */
    startTime: string;

    /**
     * When the migration ended
     */
    endTime: string;

    /**
     * Execution duration in milliseconds
     */
    duration: number;

    /**
     * Execution status
     */
    status: MigrationExecutionStatus;

    /**
     * Error message if failed
     */
    error?: string;

    /**
     * Stack trace if failed
     */
    stackTrace?: string;
}

/**
 * Backup information
 */
export interface IBackupInfo {
    /**
     * Whether a backup was created
     */
    created: boolean;

    /**
     * Path to backup file
     */
    path?: string;

    /**
     * Backup file size in bytes
     */
    size?: number;
}

/**
 * Rollback information
 */
export interface IRollbackInfo {
    /**
     * Whether rollback was triggered
     */
    triggered: boolean;

    /**
     * Rollback strategy used
     */
    strategy?: string;

    /**
     * Whether rollback was successful
     */
    success?: boolean;

    /**
     * Error message if rollback failed
     */
    error?: string;
}

/**
 * Configuration snapshot
 */
export interface IConfigSnapshot {
    /**
     * Migrations folder path
     */
    folder: string;

    /**
     * Rollback strategy
     */
    rollbackStrategy: string;

    /**
     * Backup mode
     */
    backupMode: string;

    /**
     * Dry run mode
     */
    dryRun: boolean;

    /**
     * Validation enabled
     */
    validateBeforeRun: boolean;

    /**
     * Transaction mode
     * **New in v0.5.0**
     */
    transactionMode?: string;

    /**
     * Transaction isolation level
     * **New in v0.5.0**
     */
    transactionIsolation?: string;

    /**
     * Maximum transaction commit retries
     * **New in v0.5.0**
     */
    transactionRetries?: number;
}

/**
 * Transaction metrics summary
 * **New in v0.5.0**
 */
export interface ITransactionMetrics {
    /**
     * Total number of transactions started
     */
    transactionsStarted: number;

    /**
     * Number of transactions committed successfully
     */
    transactionsCommitted: number;

    /**
     * Number of transactions rolled back
     */
    transactionsRolledBack: number;

    /**
     * Total number of commit retry attempts
     */
    commitRetries: number;

    /**
     * Total transaction duration in milliseconds
     */
    totalTransactionDuration: number;
}

/**
 * Final result summary
 */
export interface IResultSummary {
    /**
     * Overall success status
     */
    success: boolean;

    /**
     * Number of migrations executed
     */
    executed: number;

    /**
     * Number of migrations failed
     */
    failed: number;

    /**
     * Total execution duration in milliseconds
     */
    totalDuration: number;
}

/**
 * Complete execution summary
 */
export interface IExecutionSummary {
    /**
     * When the migration run started
     */
    timestamp: string;

    /**
     * MSR Core version
     */
    msrVersion: string;

    /**
     * Database adapter version
     */
    adapterVersion: string;

    /**
     * Database handler name
     */
    handler: string;

    /**
     * Configuration snapshot
     */
    config: IConfigSnapshot;

    /**
     * Migration executions
     */
    migrations: IMigrationExecutionDetail[];

    /**
     * Backup information
     */
    backup?: IBackupInfo;

    /**
     * Rollback information
     */
    rollback?: IRollbackInfo;

    /**
     * Transaction metrics
     * **New in v0.5.0**
     */
    transactions?: ITransactionMetrics;

    /**
     * Final result
     */
    result: IResultSummary;
}
