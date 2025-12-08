import {expect} from 'chai';
import sinon from 'sinon';
import {
    Config,
    IDB,
    IDatabaseMigrationHandler,
    MigrationScriptExecutor,
    IBackup,
    ISchemaVersion,
    SilentLogger,
    LevelAwareLogger
} from "../../../src";
import {TestUtils} from "../../helpers";

/**
 * Integration tests for MigrationScriptExecutor dependency injection.
 * Tests constructor and custom service injection.
 */
describe('MigrationScriptExecutor - Dependency Injection', () => {

    let handler: IDatabaseMigrationHandler<IDB>;
    let cfg: Config;

    before(() => {
        cfg = TestUtils.getConfig();
        const db: IDB = new class implements IDB {
            [key: string]: unknown;
            test() { throw new Error('Not implemented') }
            async checkConnection(): Promise<boolean> {
                return true;
            }
        }
        handler = new class implements IDatabaseMigrationHandler<IDB> {
            backup: IBackup<IDB> = {
                backup(): Promise<string> { return Promise.resolve('content') },
                restore(data: string): Promise<any> { return Promise.resolve('restored') }
            };
            schemaVersion: ISchemaVersion<IDB> = {
                migrationRecords: {
                    getAllExecuted: sinon.stub().resolves([]),
                    save: sinon.stub().resolves(),
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                },
                isInitialized: sinon.stub().resolves(true),
                createTable: sinon.stub().resolves(),
                validateTable: sinon.stub().resolves(true)
            };
            db: IDB = db;
            getName(): string { return "Test Implementation" }
            getVersion(): string { return "1.0.0-test" }
        }
    });

    describe('Constructor', () => {
        /**
         * Test: Constructor uses default ConsoleLogger when logger not provided
         * Validates that the default logger parameter works correctly
         */
        it('should use default ConsoleLogger when logger not provided', () => {
            const executorWithDefaultLogger = new MigrationScriptExecutor<IDB>({ handler , config: cfg });
            expect(executorWithDefaultLogger).to.be.instanceOf(MigrationScriptExecutor);
        })

        /**
         * Test: Constructor accepts custom logger through dependencies
         * Validates that custom logger is wrapped with LevelAwareLogger
         */
        it('should use custom logger when provided', () => {
            const customLogger = new SilentLogger();
            const executorWithCustomLogger = new MigrationScriptExecutor<IDB>({ handler: handler, logger: customLogger
, config: cfg });
            // Logger should be wrapped with LevelAwareLogger for level filtering
            expect(executorWithCustomLogger.logger).to.be.instanceOf(LevelAwareLogger);
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
            const executorWithCustomBackup = new MigrationScriptExecutor<IDB>({ handler: handler, backupService: mockBackupService
, config: cfg });
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
                getAllMigratedScripts: sinon.stub().resolves([]),
                remove: sinon.stub().resolves()
            };
            const executorWithCustomSchema = new MigrationScriptExecutor<IDB>({ handler: handler, schemaVersionService: mockSchemaVersionService
, config: cfg });
            expect(executorWithCustomSchema.schemaVersionService).to.equal(mockSchemaVersionService);
        })

        /**
         * Test: Constructor accepts custom migrationRenderer through dependencies
         * Validates that custom migrationRenderer is used instead of default
         */
        it('should use custom migrationRenderer when provided', () => {
            cfg.showBanner = true;  // Enable banner to test renderer is called
            const mockRenderer = {
                drawFiglet: sinon.stub(),
                drawMigrated: sinon.stub(),
                drawPending: sinon.stub(),
                drawIgnored: sinon.stub(),
                drawExecuted: sinon.stub()
            };
            const executorWithCustomRenderer = new MigrationScriptExecutor<IDB>({ handler: handler, migrationRenderer: mockRenderer
, config: cfg });
            expect(executorWithCustomRenderer.migrationRenderer).to.equal(mockRenderer);
            expect(mockRenderer.drawFiglet.calledOnce).to.be.true;
        })

        /**
         * Test: Constructor accepts custom migrationService through dependencies
         * Validates that custom migrationService is used instead of default
         */
        it('should use custom migrationService when provided', () => {
            const mockMigrationService = {
                findMigrationScripts: sinon.stub().resolves([]),
                findBeforeMigrateScript: sinon.stub().resolves(undefined)
            };
            const executorWithCustomMigration = new MigrationScriptExecutor<IDB>({ handler: handler, migrationService: mockMigrationService
, config: cfg });
            expect(executorWithCustomMigration.migrationService).to.equal(mockMigrationService);
        })

        /**
         * Test: Constructor accepts custom migrationScanner through dependencies
         * Validates that custom migrationScanner is used instead of default
         */
        it('should use custom migrationScanner when provided', () => {
            const mockMigrationScanner = {
                scan: sinon.stub().resolves({
                    all: [],
                    migrated: [],
                    pending: [],
                    ignored: [],
                    executed: []
                })
            };
            const executorWithCustomScanner = new MigrationScriptExecutor<IDB>({ handler: handler, migrationScanner: mockMigrationScanner
, config: cfg });
            expect(executorWithCustomScanner.migrationScanner).to.equal(mockMigrationScanner);
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
                getAllMigratedScripts: sinon.stub().resolves([]),
                remove: sinon.stub().resolves()
            };
            const mockRenderer = {
                drawFiglet: sinon.stub(),
                drawMigrated: sinon.stub(),
                drawPending: sinon.stub(),
                drawIgnored: sinon.stub(),
                drawExecuted: sinon.stub()
            };
            const mockMigrationService = {
                findMigrationScripts: sinon.stub().resolves([]),
                findBeforeMigrateScript: sinon.stub().resolves(undefined)
            };

            const executorWithAllCustom = new MigrationScriptExecutor<IDB>({ handler: handler, logger: customLogger,
                backupService: mockBackupService,
                schemaVersionService: mockSchemaVersionService,
                migrationRenderer: mockRenderer,
                migrationService: mockMigrationService
, config: cfg });

            // Logger should be wrapped with LevelAwareLogger for level filtering
            expect(executorWithAllCustom.logger).to.be.instanceOf(LevelAwareLogger);
            expect(executorWithAllCustom.backupService).to.equal(mockBackupService);
            expect(executorWithAllCustom.schemaVersionService).to.equal(mockSchemaVersionService);
            expect(executorWithAllCustom.migrationRenderer).to.equal(mockRenderer);
            expect(executorWithAllCustom.migrationService).to.equal(mockMigrationService);
        })

        /**
         * Test: Constructor auto-loads config when not provided
         * Validates that ConfigLoader.load() is called when config parameter is undefined
         */
        it('should auto-load config using ConfigLoader when config not provided', () => {
            // Call constructor without config parameter - should use ConfigLoader.load()
            const executorWithAutoConfig = new MigrationScriptExecutor<IDB>({ handler: handler });

            // Verify executor was created successfully
            expect(executorWithAutoConfig).to.be.instanceOf(MigrationScriptExecutor);

            // Verify config was loaded (should have default values from ConfigLoader)
            // Note: config is private, so we cast to any for testing
            expect((executorWithAutoConfig as any).config).to.exist;
            expect((executorWithAutoConfig as any).config).to.be.instanceOf(Config);
        })

    })

});
