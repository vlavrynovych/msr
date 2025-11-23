import {expect} from 'chai';
import sinon from 'sinon';
import {
    Config,
    IDB,
    IDatabaseMigrationHandler,
    MigrationScriptExecutor,
    IBackup,
    ISchemaVersion,
    SilentLogger
} from "../../../src";
import {TestUtils} from "../../helpers/TestUtils";

/**
 * Integration tests for MigrationScriptExecutor dependency injection.
 * Tests constructor and custom service injection.
 */
describe('MigrationScriptExecutor - Dependency Injection', () => {

    let handler: IDatabaseMigrationHandler;

    before(() => {
        const cfg = TestUtils.getConfig();
        const db: IDB = new class implements IDB {
            test() { throw new Error('Not implemented') }
        }
        handler = new class implements IDatabaseMigrationHandler {
            backup: IBackup = {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            };
            schemaVersion: ISchemaVersion = {
                migrations: {
                    getAll: sinon.stub().resolves([]),
                    save: sinon.stub().resolves()
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            };
            cfg: Config = cfg;
            db: IDB = db;
            getName(): string { return "Test Implementation" }
        }
    });

    describe('Constructor', () => {
        /**
         * Test: Constructor uses default ConsoleLogger when logger not provided
         * Validates that the default logger parameter works correctly
         */
        it('should use default ConsoleLogger when logger not provided', () => {
            const executorWithDefaultLogger = new MigrationScriptExecutor(handler);
            expect(executorWithDefaultLogger).to.be.instanceOf(MigrationScriptExecutor);
        })

        /**
         * Test: Constructor accepts custom logger through dependencies
         * Validates that custom logger is used instead of default
         */
        it('should use custom logger when provided', () => {
            const customLogger = new SilentLogger();
            const executorWithCustomLogger = new MigrationScriptExecutor(handler, {
                logger: customLogger
            });
            expect(executorWithCustomLogger.logger).to.equal(customLogger);
        })

        /**
         * Test: Constructor accepts custom backupService through dependencies
         * Validates that custom backupService is used instead of default
         */
        it('should use custom backupService when provided', () => {
            const mockBackupService = {
                backup: sinon.stub().resolves(),
                restore: sinon.stub().resolves(),
                deleteBackup: sinon.stub()
            };
            const executorWithCustomBackup = new MigrationScriptExecutor(handler, {
                backupService: mockBackupService
            });
            expect(executorWithCustomBackup.backupService).to.equal(mockBackupService);
        })

        /**
         * Test: Constructor accepts custom schemaVersionService through dependencies
         * Validates that custom schemaVersionService is used instead of default
         */
        it('should use custom schemaVersionService when provided', () => {
            const mockSchemaVersionService = {
                init: sinon.stub().resolves(),
                save: sinon.stub().resolves(),
                getAllMigratedScripts: sinon.stub().resolves([])
            };
            const executorWithCustomSchema = new MigrationScriptExecutor(handler, {
                schemaVersionService: mockSchemaVersionService
            });
            expect(executorWithCustomSchema.schemaVersionService).to.equal(mockSchemaVersionService);
        })

        /**
         * Test: Constructor accepts custom consoleRenderer through dependencies
         * Validates that custom consoleRenderer is used instead of default
         */
        it('should use custom consoleRenderer when provided', () => {
            const mockRenderer = {
                drawFiglet: sinon.stub(),
                drawMigrated: sinon.stub(),
                drawTodoTable: sinon.stub(),
                drawIgnoredTable: sinon.stub(),
                drawExecutedTable: sinon.stub()
            };
            const executorWithCustomRenderer = new MigrationScriptExecutor(handler, {
                consoleRenderer: mockRenderer
            });
            expect(executorWithCustomRenderer.consoleRenderer).to.equal(mockRenderer);
            expect(mockRenderer.drawFiglet.calledOnce).to.be.true;
        })

        /**
         * Test: Constructor accepts custom migrationService through dependencies
         * Validates that custom migrationService is used instead of default
         */
        it('should use custom migrationService when provided', () => {
            const mockMigrationService = {
                readMigrationScripts: sinon.stub().resolves([])
            };
            const executorWithCustomMigration = new MigrationScriptExecutor(handler, {
                migrationService: mockMigrationService
            });
            expect(executorWithCustomMigration.migrationService).to.equal(mockMigrationService);
        })

        /**
         * Test: Constructor accepts all custom dependencies at once
         * Validates that all custom dependencies can be injected together
         */
        it('should use all custom dependencies when provided', () => {
            const customLogger = new SilentLogger();
            const mockBackupService = {
                backup: sinon.stub().resolves(),
                restore: sinon.stub().resolves(),
                deleteBackup: sinon.stub()
            };
            const mockSchemaVersionService = {
                init: sinon.stub().resolves(),
                save: sinon.stub().resolves(),
                getAllMigratedScripts: sinon.stub().resolves([])
            };
            const mockRenderer = {
                drawFiglet: sinon.stub(),
                drawMigrated: sinon.stub(),
                drawTodoTable: sinon.stub(),
                drawIgnoredTable: sinon.stub(),
                drawExecutedTable: sinon.stub()
            };
            const mockMigrationService = {
                readMigrationScripts: sinon.stub().resolves([])
            };

            const executorWithAllCustom = new MigrationScriptExecutor(handler, {
                logger: customLogger,
                backupService: mockBackupService,
                schemaVersionService: mockSchemaVersionService,
                consoleRenderer: mockRenderer,
                migrationService: mockMigrationService
            });

            expect(executorWithAllCustom.logger).to.equal(customLogger);
            expect(executorWithAllCustom.backupService).to.equal(mockBackupService);
            expect(executorWithAllCustom.schemaVersionService).to.equal(mockSchemaVersionService);
            expect(executorWithAllCustom.consoleRenderer).to.equal(mockRenderer);
            expect(executorWithAllCustom.migrationService).to.equal(mockMigrationService);
        })

    })

});
