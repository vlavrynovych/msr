import { expect } from 'chai';
import {
    createMigrationServices,
    Config,
    SilentLogger,
    IDatabaseMigrationHandler,
    ISchemaVersion,
    IMigrationInfo,
    IDB
} from '../../../src';

describe('MigrationServicesFactory', () => {
    let handler: IDatabaseMigrationHandler<IDB>;
    let config: Config;
    const db: IDB = new class implements IDB {
        [key: string]: unknown;
        test() { throw new Error('Not implemented') }
        async checkConnection(): Promise<boolean> {
            return true;
        }
    }

    beforeEach(() => {
        config = new Config();
        config.folder = '/test/path';
        config.showBanner = false;

        handler = {
            db,
            schemaVersion: {
                isInitialized: () => Promise.resolve(true),
                createTable: () => Promise.resolve(true),
                validateTable: () => Promise.resolve(true),
                migrationRecords: {
                    getAllExecuted: () => Promise.resolve([]),
                    save: (details: IMigrationInfo) => Promise.resolve(),
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                }
            } as ISchemaVersion<IDB>,
            getName: () => 'TestHandler',
            getVersion: () => '1.0.0-test',
        } as IDatabaseMigrationHandler<IDB>;
    });

    describe('createMigrationServices', () => {
        /**
         * Test: Factory creates all service facades correctly
         * Validates that createMigrationServices returns all required facades
         * and infrastructure components.
         */
        it('should create all service facades', () => {
            const services = createMigrationServices<IDB>({
                handler: handler,
                logger: new SilentLogger(),
                config: config
            });

            // Verify all facades exist
            expect(services.config).to.exist;
            expect(services.handler).to.equal(handler);
            expect(services.core).to.exist;
            expect(services.execution).to.exist;
            expect(services.output).to.exist;
            expect(services.orchestration).to.exist;
            expect(services.loaderRegistry).to.exist;

            // Verify core services
            expect(services.core.scanner).to.exist;
            expect(services.core.schemaVersion).to.exist;
            expect(services.core.migration).to.exist;
            expect(services.core.validation).to.exist;
            expect(services.core.backup).to.exist;
            expect(services.core.rollback).to.exist;

            // Verify execution services
            expect(services.execution.selector).to.exist;
            expect(services.execution.runner).to.exist;

            // Verify output services
            expect(services.output.logger).to.exist;
            expect(services.output.renderer).to.exist;

            // Verify orchestration services
            expect(services.orchestration.workflow).to.exist;
            expect(services.orchestration.validation).to.exist;
            expect(services.orchestration.reporting).to.exist;
            expect(services.orchestration.error).to.exist;
            expect(services.orchestration.hooks).to.exist;
            expect(services.orchestration.rollback).to.exist;
        });

        /**
         * Test: Default executeBeforeMigrate placeholder doesn't throw
         * Covers the arrow function at line 333 in MigrationServicesFactory.ts
         * This placeholder is always overridden by MigrationScriptExecutor,
         * but we test it to achieve 100% function coverage.
         */
        it('should create workflow orchestrator with callable executeBeforeMigrate placeholder', async () => {
            const services = createMigrationServices<IDB>({
                handler: handler,
                logger: new SilentLogger(),
                config: config
            });

            // Access the private executeBeforeMigrate to test the placeholder
            const workflowOrchestrator = services.orchestration.workflow as any;

            // Verify the placeholder exists and is callable without throwing
            expect(workflowOrchestrator.executeBeforeMigrate).to.be.a('function');

            // Call it to cover the arrow function (line 333)
            await expect(workflowOrchestrator.executeBeforeMigrate()).to.be.fulfilled;
        });
    });
});
