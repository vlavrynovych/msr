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
    MigrationScript
} from '../../../src';

describe('MigrationScriptExecutor - Dependency Injection', () => {
    let handler: IDatabaseMigrationHandler;
    let config: Config;
    const db: IDB = new class implements IDB {
        [key: string]: unknown;
        test() { throw new Error('Not implemented') }
    }

    beforeEach(() => {
        config = new Config();
        config.folder = '/test/path';

        handler = {
            db,
            schemaVersion: {
                isInitialized: () => Promise.resolve(true),
                createTable: () => Promise.resolve(true),
                validateTable: () => Promise.resolve(true),
                migrations: {
                    getAll: () => Promise.resolve([]),
                    save: (details: IMigrationInfo) => Promise.resolve(),
                    remove(timestamp: number): Promise<void> {
                        return Promise.resolve(undefined);
                    }
                }
            } as ISchemaVersion,
            getName: () => 'TestHandler'
        } as IDatabaseMigrationHandler;
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
            const customValidationService: IMigrationValidationService = {
                validateAll: sinon.stub().resolves([]),
                validateOne: sinon.stub().resolves({} as any),
                validateMigratedFileIntegrity: sinon.stub().resolves([])
            };

            const executor = new MigrationScriptExecutor(handler, config, {
                logger: new SilentLogger(),
                validationService: customValidationService
            });

            expect(executor.validationService).to.equal(customValidationService);
        });

        /**
         * Test: Constructor creates default validationService when not provided
         * Validates that when no custom validation service is provided,
         * a default MigrationValidationService instance is created.
         */
        it('should create default validationService when not provided', () => {
            const executor = new MigrationScriptExecutor(handler, config, {
                logger: new SilentLogger()
            });

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
            const customRollbackService: IRollbackService = {
                rollback: sinon.stub().resolves(),
                shouldCreateBackup: sinon.stub().returns(true)
            };

            const executor = new MigrationScriptExecutor(handler, config, {
                logger: new SilentLogger(),
                rollbackService: customRollbackService
            });

            expect(executor.rollbackService).to.equal(customRollbackService);
        });

        /**
         * Test: Constructor creates default rollbackService when not provided
         * Validates that when no custom rollback service is provided,
         * a default RollbackService instance is created.
         */
        it('should create default rollbackService when not provided', () => {
            const executor = new MigrationScriptExecutor(handler, config, {
                logger: new SilentLogger()
            });

            expect(executor.rollbackService).to.exist;
            expect(executor.rollbackService).to.have.property('rollback');
            expect(executor.rollbackService).to.have.property('shouldCreateBackup');
        });
    });
});
