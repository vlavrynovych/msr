import { expect } from 'chai';
import sinon from 'sinon';
import {
    MigrationScriptExecutor,
    Config,
    SilentLogger,
    IDatabaseMigrationHandler,
    ISchemaVersion,
    IMigrationInfo,
    IDB,
    IMigrationValidationService,
    IRollbackService,
    MigrationScript,
    ILoaderRegistry,
    IMigrationScriptLoader
} from '../../../src';

describe('MigrationScriptExecutor - Dependency Injection', () => {
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
        config.showBanner = false;  // Disable banner in tests

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

    afterEach(() => {
        sinon.restore();
    });

    describe('Constructor dependency injection', () => {
        /**
         * Test: Constructor accepts custom validationService via dependencies
         * Covers line 161 (dependencies?.validationService branch)
         * Validates that a custom validation service can be injected, enabling
         * testing and customization of validation behavior.
         */
        it('should use custom validationService when provided', () => {
            const customValidationService: IMigrationValidationService<IDB> = {
                validateAll: sinon.stub().resolves([]),
                validateOne: sinon.stub().resolves({} as any),
                validateMigratedFileIntegrity: sinon.stub().resolves([]),
                validateTransactionConfiguration: sinon.stub().returns([])
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                validationService: customValidationService
, config: config });

            expect(executor.validationService).to.equal(customValidationService);
        });

        /**
         * Test: Constructor creates default validationService when not provided
         * Validates that when no custom validation service is provided,
         * a default MigrationValidationService instance is created.
         */
        it('should create default validationService when not provided', () => {
            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

            expect(executor.validationService).to.exist;
            expect(executor.validationService).to.have.property('validateAll');
            expect(executor.validationService).to.have.property('validateMigratedFileIntegrity');
        });

        /**
         * Test: Constructor accepts custom rollbackService via dependencies
         * Covers line 169 (dependencies?.rollbackService branch)
         * Validates that a custom rollback service can be injected, enabling
         * testing and customization of rollback behavior.
         */
        it('should use custom rollbackService when provided', () => {
            const customRollbackService: IRollbackService<IDB> = {
                rollback: sinon.stub().resolves(),
                shouldCreateBackup: sinon.stub().returns(true)
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                rollbackService: customRollbackService
, config: config });

            expect(executor.rollbackService).to.equal(customRollbackService);
        });

        /**
         * Test: Constructor creates default rollbackService when not provided
         * Validates that when no custom rollback service is provided,
         * a default RollbackService instance is created.
         */
        it('should create default rollbackService when not provided', () => {
            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

            expect(executor.rollbackService).to.exist;
            expect(executor.rollbackService).to.have.property('rollback');
            expect(executor.rollbackService).to.have.property('shouldCreateBackup');
        });

        /**
         * Test: Constructor accepts custom loaderRegistry via dependencies
         * Covers line 147 (dependencies?.loaderRegistry branch)
         * Validates that a custom loader registry can be injected, enabling
         * testing and customization of migration file loading behavior.
         */
        it('should use custom loaderRegistry when provided', () => {
            const customLoader: IMigrationScriptLoader<IDB> = {
                canHandle: () => true,
                load: sinon.stub().resolves({
                    up: async () => 'custom',
                    down: async () => 'custom down'
                }),
                getName: () => 'CustomLoader'
            };

            const customRegistry: ILoaderRegistry<IDB> = {
                register: sinon.stub(),
                findLoader: sinon.stub().returns(customLoader),
                getLoaders: sinon.stub().returns([customLoader])
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                loaderRegistry: customRegistry
, config: config });

            expect((executor as any).loaderRegistry).to.equal(customRegistry);
        });

        /**
         * Test: Constructor creates default loaderRegistry when not provided
         * Covers line 147 (LoaderRegistry.createDefault fallback)
         * Validates that when no custom loader registry is provided,
         * a default LoaderRegistry with TypeScriptLoader and SqlLoader is created.
         */
        it('should create default loaderRegistry when not provided', () => {
            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

            const registry = (executor as any).loaderRegistry as ILoaderRegistry<IDB>;
            expect(registry).to.exist;
            expect(registry.getLoaders()).to.have.lengthOf(2);

            const loaderNames = registry.getLoaders().map(l => l.getName());
            expect(loaderNames).to.include('TypeScriptLoader');
            expect(loaderNames).to.include('SqlLoader');
        });

        /**
         * Test: Constructor creates default ConfigLoader when configLoader not provided
         * Covers line 197 (dependencies?.configLoader fallback)
         * Validates that when no custom config loader is provided,
         * a default ConfigLoader instance is created and used.
         */
        it('should create default ConfigLoader when configLoader not provided', () => {
            // Don't provide config or configLoader - will use default ConfigLoader
            const executor = new MigrationScriptExecutor<IDB>({
                handler: handler,
                logger: new SilentLogger()
            });

            // Verify executor was created successfully with auto-loaded config
            expect(executor).to.exist;
            expect((executor as any).config).to.exist;
            expect((executor as any).config.folder).to.be.a('string');
        });

        /**
         * Test: Constructor accepts custom configLoader via dependencies
         * Covers line 197 (dependencies?.configLoader branch)
         * Validates that a custom config loader can be injected.
         */
        it('should use custom configLoader when provided', () => {
            const customConfig = new Config();
            customConfig.folder = './custom-migrations';

            const loadStub = sinon.stub().returns(customConfig);
            const customConfigLoader = {
                load: loadStub,
                applyEnvironmentVariables: sinon.stub()
            };

            const executor = new MigrationScriptExecutor<IDB>({
                handler: handler,
                logger: new SilentLogger(),
                configLoader: customConfigLoader
            });

            // Verify custom configLoader was used
            expect(loadStub.called).to.be.true;
            expect((executor as any).config.folder).to.equal('./custom-migrations');
        });
    });

    describe('Transaction Manager Creation', () => {
        /**
         * Test: Returns undefined when transaction mode is NONE
         * Covers line 245 in MigrationScriptExecutor.ts
         * Validates that no transaction manager is created when mode is NONE.
         */
        it('should return undefined when transaction mode is NONE', () => {
            config.transaction.mode = 'NONE' as any;

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

            // Access private method via reflection
            const transactionManager = (executor as any).createTransactionManager(handler);

            expect(transactionManager).to.be.undefined;
        });

        /**
         * Test: Uses custom transaction manager from handler
         * Covers lines 250-251 in MigrationScriptExecutor.ts
         * Validates that when handler provides a custom transaction manager, it is used.
         */
        it('should use custom transaction manager from handler', () => {
            const customTxManager = {
                begin: () => Promise.resolve(),
                commit: () => Promise.resolve(),
                rollback: () => Promise.resolve()
            };

            const handlerWithTx = {
                ...handler,
                transactionManager: customTxManager
            };

            const executor = new MigrationScriptExecutor<IDB>({
                handler: handlerWithTx as any,
                logger: new SilentLogger()
            , config: config });

            const transactionManager = (executor as any).createTransactionManager(handlerWithTx);

            expect(transactionManager).to.equal(customTxManager);
        });

        /**
         * Test: Auto-creates DefaultTransactionManager for ITransactionalDB
         * Covers lines 256-257 in MigrationScriptExecutor.ts
         * Validates that DefaultTransactionManager is auto-created when db implements ITransactionalDB.
         */
        it('should auto-create DefaultTransactionManager when db implements ITransactionalDB', () => {
            const transactionalDB = {
                query: () => Promise.resolve([]),
                checkConnection: () => Promise.resolve(true),
                beginTransaction: () => Promise.resolve(),
                commit: () => Promise.resolve(),
                rollback: () => Promise.resolve()
            };

            const handlerWithTransactionalDB = {
                ...handler,
                db: transactionalDB
            };

            const executor = new MigrationScriptExecutor<IDB>({
                handler: handlerWithTransactionalDB as any,
                logger: new SilentLogger()
            , config: config });

            const transactionManager = (executor as any).createTransactionManager(handlerWithTransactionalDB);

            expect(transactionManager).to.exist;
            expect(transactionManager.begin).to.be.a('function');
            expect(transactionManager.commit).to.be.a('function');
            expect(transactionManager.rollback).to.be.a('function');
        });

        /**
         * Test: Auto-creates CallbackTransactionManager for ICallbackTransactionalDB
         * Covers lines 284-285 in MigrationScriptExecutor.ts
         * Validates that CallbackTransactionManager is auto-created when db implements ICallbackTransactionalDB.
         */
        it('should auto-create CallbackTransactionManager when db implements ICallbackTransactionalDB', () => {
            const callbackTransactionalDB = {
                query: () => Promise.resolve([]),
                checkConnection: () => Promise.resolve(true),
                runTransaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
                    return callback({});
                }
            };

            const handlerWithCallbackDB = {
                ...handler,
                db: callbackTransactionalDB
            };

            config.transaction.mode = 'PER_MIGRATION' as any; // Enable transactions

            const executor = new MigrationScriptExecutor<IDB>({
                handler: handlerWithCallbackDB as any,
                logger: new SilentLogger()
            , config: config });

            const transactionManager = (executor as any).createTransactionManager(handlerWithCallbackDB);

            expect(transactionManager).to.exist;
            expect(transactionManager.begin).to.be.a('function');
            expect(transactionManager.commit).to.be.a('function');
            expect(transactionManager.rollback).to.be.a('function');
        });
    });

    describe('Optional chaining coverage', () => {
        /**
         * Test: Covers optional chaining branch at line 657 in MigrationScriptExecutor.ts
         * Uses reflection to directly test the executeDryRun private method with empty executed array.
         * This covers the `?.name` optional chaining when scripts.executed has no elements.
         */
        it('should handle empty scripts.executed array in error logging (line 657)', async () => {
            config.transaction.mode = 'PER_MIGRATION' as any;

            // Create handler with transactional DB
            const transactionalDB = {
                query: () => Promise.resolve([]),
                checkConnection: () => Promise.resolve(true),
                beginTransaction: () => Promise.resolve(),
                commit: () => Promise.resolve(),
                rollback: () => Promise.resolve()
            };

            handler.db = transactionalDB as any;

            // Capture logger messages
            let errorMessages: string[] = [];
            const capturingLogger = {
                info: (msg: string) => {},
                error: (msg: string) => errorMessages.push(msg),
                warn: (msg: string) => {},
                success: (msg: string) => {},
                debug: (msg: string) => {},
                log: (msg: string) => {}
            };

            // Enable dry run mode
            config.dryRun = true;
            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: capturingLogger
, config: config });

            // Mock hookExecutor.executeWithHooks to throw error immediately
            (executor as any).workflowOrchestrator.hookExecutor.executeWithHooks = sinon.stub().rejects(new Error('Execution failed'));

            // Create scripts object with empty executed array
            const scripts = {
                all: [],
                migrated: [],
                pending: [{
                    timestamp: 1,
                    name: 'V1__test',
                    filepath: '/fake/V1__test.ts',
                    init: async () => {},
                    script: {
                        up: async () => {},
                        down: async () => {}
                    }
                }],
                ignored: [],
                executed: [] // Empty array - this triggers the optional chaining
            };

            // Stub migrationScanner and validation
            sinon.stub((executor as any).migrationScanner, 'scan').resolves(scripts);
            sinon.stub((executor as any).workflowOrchestrator.validationOrchestrator, 'validateMigrations').resolves();

            // Call through public API which triggers workflow orchestrator
            try {
                await executor.up();
                expect.fail('Should have thrown error');
            } catch (error) {
                // Expected error
            }

            // Verify error message with 'unknown' was logged (covers line 657 optional chaining)
            const hasUnknownMessage = errorMessages.some(msg =>
                msg.includes('Failed at:') && msg.includes('unknown')
            );

            expect(hasUnknownMessage).to.be.true;
        });
    });

    describe('Banner display control', () => {
        /**
         * Test: Banner is displayed by default (showBanner: true)
         * Validates that drawFiglet is called when showBanner is true (default behavior).
         */
        it('should display banner when showBanner is true (default)', () => {
            config.showBanner = true;

            const drawFigletSpy = sinon.spy();
            const rendererStub = {
                drawFiglet: drawFigletSpy,
                render: sinon.stub(),
                renderOne: sinon.stub(),
                renderDryRunTable: sinon.stub()
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                migrationRenderer: rendererStub as any
, config: config });

            // Verify drawFiglet was called
            expect(drawFigletSpy.calledOnce).to.be.true;
        });

        /**
         * Test: Banner is not displayed when showBanner is false
         * Validates that drawFiglet is NOT called when showBanner is false.
         */
        it('should not display banner when showBanner is false', () => {
            config.showBanner = false;

            const drawFigletSpy = sinon.spy();
            const rendererStub = {
                drawFiglet: drawFigletSpy,
                render: sinon.stub(),
                renderOne: sinon.stub(),
                renderDryRunTable: sinon.stub()
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger(),
                migrationRenderer: rendererStub as any
, config: config });

            // Verify drawFiglet was NOT called
            expect(drawFigletSpy.called).to.be.false;
        });
    });
});
