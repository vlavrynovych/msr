import { expect } from 'chai';
import {
    Config,
    IDatabaseMigrationHandler,
    IDB,
    IMigrationInfo,
    MigrationScriptExecutor,
    SilentLogger,
    TransactionMode,
    IMetricsCollector,
    IMigrationContext
} from '../../../src';
import { TestUtils } from '../../helpers';
import { MigrationScript } from '../../../src/model/MigrationScript';
import { IMigrationResult } from '../../../src/interface/IMigrationResult';

describe('MigrationScriptExecutor with Metrics Collectors', () => {
    let config: Config;
    let handler: IDatabaseMigrationHandler<IDB>;
    let mockCollector: IMetricsCollector;
    let collectorCalls: Record<string, any[]>;

    beforeEach(() => {
        config = TestUtils.getConfig();
        config.transaction.mode = TransactionMode.NONE;
        config.logging.enabled = false; // Disable logging to test only metrics

        collectorCalls = {};

        // Mock collector that tracks all calls
        mockCollector = {
            recordMigrationStart: (context: IMigrationContext) => {
                collectorCalls['recordMigrationStart'] = collectorCalls['recordMigrationStart'] || [];
                collectorCalls['recordMigrationStart'].push(context);
            },
            recordMigrationComplete: (result: IMigrationResult<IDB>, duration: number) => {
                collectorCalls['recordMigrationComplete'] = collectorCalls['recordMigrationComplete'] || [];
                collectorCalls['recordMigrationComplete'].push({ result, duration });
            },
            recordScriptStart: (script: MigrationScript<IDB>) => {
                collectorCalls['recordScriptStart'] = collectorCalls['recordScriptStart'] || [];
                collectorCalls['recordScriptStart'].push(script);
            },
            recordScriptComplete: (script: MigrationScript<IDB>, duration: number) => {
                collectorCalls['recordScriptComplete'] = collectorCalls['recordScriptComplete'] || [];
                collectorCalls['recordScriptComplete'].push({ script, duration });
            },
            close: () => {
                collectorCalls['close'] = collectorCalls['close'] || [];
                collectorCalls['close'].push(true);
            }
        };

        // Mock handler
        handler = {
            db: {
                execute: async (sql: string) => {
                    return [];
                },
                checkConnection: async () => true
            } as IDB,
            backup: {
                backup: async () => {
                    return './test-backup.bkp';
                },
                restore: async (backupPath: string) => {
                    // Restore simulation
                }
            },
            migrationRecords: {
                save: async (details: IMigrationInfo) => {
                    // Save simulation
                },
                getAllExecuted: async () => [],
                remove: async (timestamp: number) => {
                    // Remove simulation
                }
            },
            schemaVersion: {
                save: async (details: IMigrationInfo) => {
                    // Save simulation
                },
                getAllExecuted: async () => [],
                remove: async (timestamp: number) => {
                    // Remove simulation
                },
                isInitialized: async () => true,
                createTable: async () => true,
                validateTable: async () => true,
                migrationRecords: {
                    save: async (details: IMigrationInfo) => {
                        // Save simulation
                    },
                    getAllExecuted: async () => [],
                    remove: async (timestamp: number) => {
                        // Remove simulation
                    }
                }
            },
            getName: () => 'TestHandler',
            getVersion: () => '1.0.0-test',
            createTable: async () => true,
            isInitialized: async () => true,
            validateTable: async () => true
        } as IDatabaseMigrationHandler<IDB>;
    });

    it('should create MetricsCollectorHook when metricsCollectors provided', async () => {
        const executor = new MigrationScriptExecutor<IDB>(
            {
                handler: handler,
                logger: new SilentLogger(),
                metricsCollectors: [mockCollector]
            },
            config
        );

        await executor.up();

        // Verify MetricsCollectorHook was created and called the collector
        expect(collectorCalls['recordMigrationStart']).to.exist;
        expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);
        expect(collectorCalls['recordMigrationComplete']).to.exist;
        expect(collectorCalls['recordMigrationComplete']).to.have.lengthOf(1);
        expect(collectorCalls['close']).to.exist;
        expect(collectorCalls['close']).to.have.lengthOf(1);
    });

    it('should not create MetricsCollectorHook when metricsCollectors is empty', async () => {
        const executor = new MigrationScriptExecutor<IDB>(
            {
                handler: handler,
                logger: new SilentLogger(),
                metricsCollectors: []
            },
            config
        );

        await executor.up();

        // Collector should not be called when array is empty
        expect(collectorCalls['recordMigrationStart']).to.be.undefined;
    });

    it('should not create MetricsCollectorHook when metricsCollectors is undefined', async () => {
        const executor = new MigrationScriptExecutor<IDB>(
            {
                handler: handler,
                logger: new SilentLogger()
            },
            config
        );

        await executor.up();

        // Collector should not be called when not provided
        expect(collectorCalls['recordMigrationStart']).to.be.undefined;
    });

    it('should call collectors for each migration lifecycle event', async () => {
        const executor = new MigrationScriptExecutor<IDB>(
            {
                handler: handler,
                logger: new SilentLogger(),
                metricsCollectors: [mockCollector]
            },
            config
        );

        await executor.up();

        // Verify all lifecycle events were called
        expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);
        expect(collectorCalls['recordMigrationComplete']).to.have.lengthOf(1);
        expect(collectorCalls['close']).to.have.lengthOf(1);

        // Verify context was passed correctly
        const startContext = collectorCalls['recordMigrationStart'][0];
        expect(startContext.total).to.be.a('number');
        expect(startContext.pending).to.be.a('number');
        expect(startContext.executed).to.be.a('number');

        // Verify result and duration were passed
        const completeCall = collectorCalls['recordMigrationComplete'][0];
        expect(completeCall.result).to.exist;
        expect(completeCall.duration).to.be.a('number');
    });

    it('should work with multiple collectors simultaneously', async () => {
        const collector2Calls: Record<string, any[]> = {};

        const mockCollector2: IMetricsCollector = {
            recordMigrationStart: (context: IMigrationContext) => {
                collector2Calls['recordMigrationStart'] = collector2Calls['recordMigrationStart'] || [];
                collector2Calls['recordMigrationStart'].push(context);
            },
            close: () => {
                collector2Calls['close'] = collector2Calls['close'] || [];
                collector2Calls['close'].push(true);
            }
        };

        const executor = new MigrationScriptExecutor<IDB>(
            {
                handler: handler,
                logger: new SilentLogger(),
                metricsCollectors: [mockCollector, mockCollector2]
            },
            config
        );

        await executor.up();

        // Both collectors should be called
        expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);
        expect(collector2Calls['recordMigrationStart']).to.have.lengthOf(1);
        expect(collectorCalls['close']).to.have.lengthOf(1);
        expect(collector2Calls['close']).to.have.lengthOf(1);
    });
});
