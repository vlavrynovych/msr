/**
 * CLI Example Implementation
 *
 * This example demonstrates how database adapter packages should implement
 * their CLI using the createCLI factory from @migration-script-runner/core.
 *
 * Adapters (like msr-mongodb, msr-postgres, etc.) should:
 * 1. Create their own bin/ directory with an executable script
 * 2. Use createCLI() to create the base CLI program
 * 3. Optionally extend with adapter-specific commands
 * 4. Parse and execute the program
 *
 * Usage in adapter packages:
 * - Create bin/msr (or bin/msr-mongodb, etc.)
 * - Make it executable: chmod +x bin/msr
 * - Add to package.json: "bin": { "msr": "./bin/msr" }
 */

import {createCLI} from '../src/cli/createCLI';
import {IDB, IDatabaseMigrationHandler} from '../src/interface';
import {Command} from 'commander';

// Example: Mock database type for demonstration
interface MockDB extends IDB {
    collections: string[];
}

// Example: Mock database handler for demonstration
class MockDatabaseHandler implements IDatabaseMigrationHandler<MockDB> {
    async connect(): Promise<MockDB> {
        console.log('Connecting to mock database...');
        return {collections: ['migrations']};
    }

    async disconnect(db: MockDB): Promise<void> {
        console.log('Disconnecting from mock database...');
    }

    async getCurrentVersion(db: MockDB): Promise<number> {
        console.log('Getting current version from mock database...');
        return 0;
    }

    async setCurrentVersion(db: MockDB, version: number): Promise<void> {
        console.log(`Setting current version to ${version} in mock database...`);
    }

    async getExecutedMigrations(db: MockDB): Promise<Array<{version: number; executedAt: Date; checksum: string}>> {
        console.log('Getting executed migrations from mock database...');
        return [];
    }

    async addExecutedMigration(
        db: MockDB,
        version: number,
        checksum: string
    ): Promise<void> {
        console.log(`Adding executed migration ${version} to mock database...`);
    }

    async removeExecutedMigration(db: MockDB, version: number): Promise<void> {
        console.log(`Removing executed migration ${version} from mock database...`);
    }

    async backup(db: MockDB, backupPath: string): Promise<void> {
        console.log(`Creating backup at ${backupPath}...`);
    }

    async restore(db: MockDB, backupPath: string): Promise<void> {
        console.log(`Restoring from backup at ${backupPath}...`);
    }
}

// Example: Create CLI program with base commands
const program: Command = createCLI<MockDB>({
    name: 'msr-example',
    description: 'Example Migration Script Runner CLI',
    version: '1.0.0',
    createExecutor: (config) => {
        // Adapter developers receive the final merged config
        // They can use it to initialize their handler and executor
        const handler = new MockDatabaseHandler();
        return new MigrationScriptExecutor<MockDB>({
            handler,
            config,
        });
    },
});

// Example: Extend with custom adapter-specific commands
program
    .command('custom-command')
    .description('Example of adapter-specific command')
    .action(() => {
        console.log('This is a custom command specific to this adapter');
        console.log('Adapters can add any number of custom commands');
    });

// Example: Add another custom command with options
program
    .command('stats')
    .description('Show database statistics (adapter-specific)')
    .option('-v, --verbose', 'Show verbose statistics')
    .action((options: {verbose?: boolean}) => {
        console.log('Database Statistics:');
        console.log('  Collections: 5');
        console.log('  Total Size: 1.2 GB');
        if (options.verbose) {
            console.log('  Connection Pool: 10/20');
            console.log('  Active Queries: 3');
        }
    });

// Parse command line arguments and execute
program.parse(process.argv);

/**
 * ADAPTER PACKAGE STRUCTURE EXAMPLE
 *
 * msr-mongodb/
 * ├── bin/
 * │   └── msr              # Executable script (see below)
 * ├── src/
 * │   ├── MongoHandler.ts  # Implements IDatabaseMigrationHandler<Db>
 * │   └── index.ts         # Exports handler and utilities
 * ├── package.json
 * └── tsconfig.json
 *
 * BIN SCRIPT EXAMPLE (bin/msr):
 * #!/usr/bin/env node
 *
 * const { createCLI } = require('@migration-script-runner/core');
 * const { MongoAdapter } = require('../dist/MongoAdapter');
 * const { MongoHandler } = require('../dist/MongoHandler');
 *
 * const program = createCLI({
 *   name: 'msr-mongodb',
 *   description: 'MongoDB Migration Script Runner',
 *   version: require('../package.json').version,
 *   createExecutor: (config) => {
 *     // Initialize handler with config
 *     const handler = new MongoHandler(config.mongoUri || 'mongodb://localhost:27017');
 *     // Return adapter instance with merged config
 *     return new MongoAdapter({ handler, config });
 *   }
 * });
 *
 * // Add MongoDB-specific commands if needed
 * program
 *   .command('mongo-specific')
 *   .description('MongoDB-specific command')
 *   .action(() => {
 *     console.log('MongoDB-specific functionality');
 *   });
 *
 * program.parse(process.argv);
 */

/**
 * USAGE EXAMPLES
 *
 * # Run all pending migrations
 * msr migrate
 *
 * # Run migrations up to specific version
 * msr migrate 202501220100
 *
 * # List all migrations with status
 * msr list
 *
 * # List only last 10 migrations
 * msr list --number 10
 *
 * # Roll back to specific version
 * msr down 202501220100
 * msr rollback 202501220100  # alias
 *
 * # Validate all migrations
 * msr validate
 *
 * # Create backup
 * msr backup create
 *
 * # Restore from most recent backup
 * msr backup restore
 *
 * # Restore from specific backup
 * msr backup restore ./backups/backup-2025-01-22.bkp
 *
 * # Delete backup
 * msr backup delete
 *
 * # Override config with CLI flags
 * msr migrate --folder ./custom-migrations --table-name custom_versions
 *
 * # Use different logger
 * msr migrate --logger console --log-level debug
 * msr migrate --logger file --log-file ./logs/migration.log
 * msr migrate --logger silent  # No output
 *
 * # Use custom config file
 * msr migrate --config-file ./config/production.json
 *
 * # Dry run (simulate without executing)
 * msr migrate --dry-run
 *
 * # Custom adapter command
 * msr custom-command
 * msr stats --verbose
 */
