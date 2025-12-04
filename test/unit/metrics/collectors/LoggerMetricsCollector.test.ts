import { expect } from 'chai';
import { LoggerMetricsCollector, LoggerMetricsCollectorConfig } from '../../../../src/metrics/collectors/LoggerMetricsCollector';
import { MigrationScript } from '../../../../src/model/MigrationScript';
import { IMigrationResult } from '../../../../src/interface/IMigrationResult';
import { IMigrationContext } from '../../../../src/interface/IMetricsCollector';
import { RollbackStrategy } from '../../../../src/model/RollbackStrategy';
import { ValidationError } from '../../../../src/error/ValidationError';
import { IDB } from '../../../../src/interface/dao';
import { ILogger } from '../../../../src/interface/ILogger';

describe('LoggerMetricsCollector', () => {
    let collector: LoggerMetricsCollector;
    let loggerCalls: Record<string, string[]>;
    let mockLogger: ILogger;

    beforeEach(() => {
        loggerCalls = {
            info: [],
            warn: [],
            error: [],
            debug: [],
            log: []
        };

        mockLogger = {
            info: (message: string) => {
                loggerCalls.info.push(message);
            },
            warn: (message: string) => {
                loggerCalls.warn.push(message);
            },
            error: (message: string) => {
                loggerCalls.error.push(message);
            },
            debug: (message: string) => {
                loggerCalls.debug.push(message);
            },
            log: (message: string) => {
                loggerCalls.log.push(message);
            }
        };
    });

    describe('constructor', () => {
        it('should use default prefix when not provided', () => {
            const config: LoggerMetricsCollectorConfig = {
                logger: mockLogger
            };
            collector = new LoggerMetricsCollector(config);

            const context: IMigrationContext = {
                total: 1,
                pending: 1,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            expect(loggerCalls.info[0]).to.include('[METRICS]');
        });

        it('should use custom prefix when provided', () => {
            const config: LoggerMetricsCollectorConfig = {
                logger: mockLogger,
                prefix: '[PERF]'
            };
            collector = new LoggerMetricsCollector(config);

            const context: IMigrationContext = {
                total: 1,
                pending: 1,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            expect(loggerCalls.info[0]).to.include('[PERF]');
            expect(loggerCalls.info[0]).to.not.include('[METRICS]');
        });
    });

    describe('recordMigrationStart', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log migration start with pending and executed counts', () => {
            const context: IMigrationContext = {
                total: 5,
                pending: 3,
                executed: 2,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            expect(loggerCalls.info).to.have.lengthOf(1);
            expect(loggerCalls.info[0]).to.include('Migration started');
            expect(loggerCalls.info[0]).to.include('3 pending scripts');
            expect(loggerCalls.info[0]).to.include('2 already executed');
        });
    });

    describe('recordScriptStart', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log script start', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);

            expect(loggerCalls.info).to.have.lengthOf(1);
            expect(loggerCalls.info[0]).to.include('V1_CreateUsers started');
        });
    });

    describe('recordScriptComplete', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log script completion with duration', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script, 823);

            expect(loggerCalls.info).to.have.lengthOf(1);
            expect(loggerCalls.info[0]).to.include('V1_CreateUsers completed');
            expect(loggerCalls.info[0]).to.include('823ms');
        });
    });

    describe('recordScriptError', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log script error with error message', () => {
            const script = {
                name: 'V2_AddIndex',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Index already exists');

            collector.recordScriptError(script, error);

            expect(loggerCalls.error).to.have.lengthOf(1);
            expect(loggerCalls.error[0]).to.include('V2_AddIndex failed');
            expect(loggerCalls.error[0]).to.include('Index already exists');
        });
    });

    describe('recordMigrationComplete', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log successful migration completion', () => {
            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [
                    { name: 'V1_CreateUsers' } as MigrationScript<IDB>,
                    { name: 'V2_AddEmail' } as MigrationScript<IDB>
                ],
                migrated: [],
                ignored: [],
                errors: []
            };

            collector.recordMigrationComplete(result, 2450);

            expect(loggerCalls.info).to.have.lengthOf(1);
            expect(loggerCalls.info[0]).to.include('Migration completed');
            expect(loggerCalls.info[0]).to.include('2 scripts');
            expect(loggerCalls.info[0]).to.include('2450ms');
            expect(loggerCalls.info[0]).to.include('success');
        });

        it('should log failed migration completion', () => {
            const result: IMigrationResult<IDB> = {
                success: false,
                executed: [
                    { name: 'V1_CreateUsers' } as MigrationScript<IDB>
                ],
                migrated: [],
                ignored: [],
                errors: [new Error('V2_AddIndex failed')]
            };

            collector.recordMigrationComplete(result, 1200);

            expect(loggerCalls.error).to.have.lengthOf(1);
            expect(loggerCalls.error[0]).to.include('Migration failed');
            expect(loggerCalls.error[0]).to.include('1 succeeded');
            expect(loggerCalls.error[0]).to.include('1 failed');
            expect(loggerCalls.error[0]).to.include('1200ms');
        });
    });

    describe('recordRollback', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log successful rollback with duration', () => {
            collector.recordRollback(RollbackStrategy.BACKUP, true, 1500);

            expect(loggerCalls.info).to.have.lengthOf(1);
            expect(loggerCalls.info[0]).to.include('Rollback');
            expect(loggerCalls.info[0]).to.include('backup');
            expect(loggerCalls.info[0]).to.include('succeeded');
            expect(loggerCalls.info[0]).to.include('1500ms');
        });

        it('should log failed rollback without duration', () => {
            collector.recordRollback(RollbackStrategy.DOWN, false);

            expect(loggerCalls.info).to.have.lengthOf(1);
            expect(loggerCalls.info[0]).to.include('Rollback');
            expect(loggerCalls.info[0]).to.include('down');
            expect(loggerCalls.info[0]).to.include('failed');
            expect(loggerCalls.info[0]).to.not.include('ms');
        });
    });

    describe('recordValidationErrors', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log validation errors summary and details', () => {
            const errors = [
                new ValidationError('Duplicate migration timestamp', []),
                new ValidationError('Invalid migration name', [])
            ];

            collector.recordValidationErrors(errors);

            expect(loggerCalls.warn).to.have.lengthOf(3);
            expect(loggerCalls.warn[0]).to.include('Validation errors: 2 issues found');
            expect(loggerCalls.warn[1]).to.include('Duplicate migration timestamp');
            expect(loggerCalls.warn[2]).to.include('Invalid migration name');
        });
    });

    describe('recordBackup', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log backup creation with path and duration', () => {
            collector.recordBackup('./backups/migration-20250101.bkp', 3200);

            expect(loggerCalls.info).to.have.lengthOf(1);
            expect(loggerCalls.info[0]).to.include('Backup created');
            expect(loggerCalls.info[0]).to.include('3200ms');
            expect(loggerCalls.info[0]).to.include('./backups/migration-20250101.bkp');
        });
    });

    describe('recordError', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should log general error', () => {
            const error = new Error('Database connection failed');

            collector.recordError(error);

            expect(loggerCalls.error).to.have.lengthOf(1);
            expect(loggerCalls.error[0]).to.include('Error:');
            expect(loggerCalls.error[0]).to.include('Database connection failed');
        });
    });

    describe('close', () => {
        beforeEach(() => {
            collector = new LoggerMetricsCollector({ logger: mockLogger });
        });

        it('should not log anything when all scripts completed', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            collector.recordScriptComplete(script, 100);

            // Clear previous calls
            loggerCalls.warn = [];

            collector.close();

            expect(loggerCalls.warn).to.have.lengthOf(0);
        });

        it('should warn about incomplete scripts', () => {
            const script1 = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            const script2 = {
                name: 'V2_AddEmail',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddEmail.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script1);
            collector.recordScriptStart(script2);

            // Don't complete them - clear previous calls
            loggerCalls.info = [];
            loggerCalls.warn = [];

            collector.close();

            expect(loggerCalls.warn).to.have.length.greaterThan(0);
            expect(loggerCalls.warn[0]).to.include('2 scripts never completed');
            expect(loggerCalls.warn.join('\n')).to.include('V1_CreateUsers');
            expect(loggerCalls.warn.join('\n')).to.include('V2_AddEmail');
        });
    });

    describe('integration with different loggers', () => {
        it('should work with a logger that tracks all calls', () => {
            const allCalls: Array<{ level: string; message: string }> = [];

            const trackingLogger: ILogger = {
                info: (msg: string) => allCalls.push({ level: 'info', message: msg }),
                warn: (msg: string) => allCalls.push({ level: 'warn', message: msg }),
                error: (msg: string) => allCalls.push({ level: 'error', message: msg }),
                debug: (msg: string) => allCalls.push({ level: 'debug', message: msg }),
                log: (msg: string) => allCalls.push({ level: 'log', message: msg })
            };

            collector = new LoggerMetricsCollector({ logger: trackingLogger });

            const context: IMigrationContext = {
                total: 1,
                pending: 1,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            const script = {
                name: 'V1_Test',
                timestamp: 202501010001,
                filepath: '/migrations/V1_Test.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            collector.recordScriptComplete(script, 100);

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [script],
                migrated: [],
                ignored: [],
                errors: []
            };

            collector.recordMigrationComplete(result, 100);

            expect(allCalls).to.have.lengthOf(4);
            expect(allCalls[0].level).to.equal('info');
            expect(allCalls[1].level).to.equal('info');
            expect(allCalls[2].level).to.equal('info');
            expect(allCalls[3].level).to.equal('info');
        });
    });
});
