import { expect } from 'chai';
import {
    Config,
    IDatabaseMigrationHandler,
    IDB,
    IMigrationInfo,
    MigrationScriptExecutor,
    SilentLogger,
    ISchemaVersion
} from '../../../src';

describe('MigrationScriptExecutor - Connection Check', () => {
    let config: Config;
    let baseHandler: IDatabaseMigrationHandler<IDB>;

    beforeEach(() => {
        config = new Config();
        config.folder = './test/fixtures/migrations-test';
        config.tableName = 'schema_version_connection_test';
        config.validateBeforeRun = false;

        // Base handler with successful connection
        baseHandler = {
            db: {
                execute: async () => [],
                checkConnection: async () => true
            } as IDB,
            schemaVersion: {
                isInitialized: async () => true,
                createTable: async () => true,
                validateTable: async () => true,
                migrationRecords: {
                    getAllExecuted: async () => [],
                    save: async (details: IMigrationInfo) => {},
                    remove: async (timestamp: number) => {}
                }
            } as ISchemaVersion<IDB>,
            getName: () => 'TestHandler',
            getVersion: () => '1.0.0-test',
        };
    });

    describe('up() method', () => {
        it('should check connection before running migrations', async () => {
            let connectionChecked = false;
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => {
                        connectionChecked = true;
                        return true;
                    }
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });
            await executor.up();

            expect(connectionChecked).to.be.true;
});

        it('should throw error when connection check fails', async () => {
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => false
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });

            try {
                await executor.up();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect((error as Error).message).to.include('Database connection check failed');
            }
});

        it('should not run migrations when connection fails', async () => {
            let migrationsRun = false;
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => {
                        migrationsRun = true;
                        return [];
                    },
                    checkConnection: async () => false
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });

            try {
                await executor.up();
            } catch (error) {
                // Expected
            }

            expect(migrationsRun).to.be.false;
});
    });

    describe('down() method', () => {
        it('should check connection before rolling back', async () => {
            let connectionChecked = false;
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => {
                        connectionChecked = true;
                        return true;
                    }
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });
            await executor.down(202501010001);

            expect(connectionChecked).to.be.true;
});

        it('should throw error when connection check fails during rollback', async () => {
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => false
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });

            try {
                await executor.down(202501010001);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect((error as Error).message).to.include('Database connection check failed');
            }
});
    });

    describe('validate() method', () => {
        it('should check connection before validation', async () => {
            let connectionChecked = false;
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => {
                        connectionChecked = true;
                        return true;
                    }
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });
            await executor.validate();

            expect(connectionChecked).to.be.true;
});

        it('should throw error when connection check fails during validation', async () => {
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => false
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });

            try {
                await executor.validate();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect((error as Error).message).to.include('Database connection check failed');
            }
});
    });

    describe('Error messages', () => {
        it('should provide clear error message on connection failure', async () => {
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => false
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });

            try {
                await executor.up();
                expect.fail('Should have thrown error');
            } catch (error) {
                const errorMsg = (error as Error).message;
                expect(errorMsg).to.include('Database connection check failed');
                expect(errorMsg).to.include('Cannot proceed with migration operations');
                expect(errorMsg).to.include('verify your database connection settings');
            }
});
    });

    describe('Connection check timing', () => {
        it('should check connection before any database operations', async () => {
            const operations: string[] = [];

            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => {
                        operations.push('execute');
                        return [];
                    },
                    checkConnection: async () => {
                        operations.push('checkConnection');
                        return true;
                    }
                } as IDB,
                schemaVersion: {
                    ...baseHandler.schemaVersion,
                    isInitialized: async () => {
                        operations.push('isInitialized');
                        return true;
                    }
                } as ISchemaVersion<IDB>
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });
            await executor.up();

            // checkConnection should be first
            expect(operations[0]).to.equal('checkConnection');
});
    });

    describe('migrate() alias', () => {
        it('should also check connection when using migrate() method', async () => {
            let connectionChecked = false;
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => {
                        connectionChecked = true;
                        return true;
                    }
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });
            await executor.migrate();

            expect(connectionChecked).to.be.true;
});

        it('should fail when connection check fails using migrate() method', async () => {
            const handler = {
                ...baseHandler,
                db: {
                    execute: async () => [],
                    checkConnection: async () => false
                } as IDB
            };

            const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger() , config: config });

            try {
                await executor.migrate();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect((error as Error).message).to.include('Database connection check failed');
            }
});
    });
});
