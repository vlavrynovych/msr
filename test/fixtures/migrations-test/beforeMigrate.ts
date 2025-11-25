import {IRunnableScript, IMigrationInfo, IDatabaseMigrationHandler, IDB} from "../../../src";

/**
 * Example beforeMigrate script that runs once before any migrations execute.
 *
 * This special script (named beforeMigrate.ts) is similar to Flyway's beforeMigrate.sql.
 * Perfect for:
 * - Loading production snapshots or test data
 * - Creating database extensions on fresh setups
 * - Environment-specific setup
 * - Pre-migration validation
 *
 * The script is executed only if there are pending migrations to run.
 */
export default class BeforeMigrate implements IRunnableScript {

    async up(
        db: IDB,
        info: IMigrationInfo,
        handler: IDatabaseMigrationHandler
    ): Promise<string> {

        console.log('BeforeMigrate: Setting up test environment...');

        // Example: Load test data, create extensions, validate environment, etc.
        // For this test fixture, we just log and return

        return 'BeforeMigrate setup completed successfully';
    }
}
