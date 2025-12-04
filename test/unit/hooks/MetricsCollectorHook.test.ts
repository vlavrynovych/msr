import { expect } from 'chai';
import { MetricsCollectorHook } from '../../../src/hooks/MetricsCollectorHook';
import { IMetricsCollector, IMigrationContext } from '../../../src/interface/IMetricsCollector';
import { MigrationScript } from '../../../src/model/MigrationScript';
import { IMigrationResult } from '../../../src/interface/IMigrationResult';
import { RollbackStrategy } from '../../../src/model/RollbackStrategy';
import { ValidationError } from '../../../src/error/ValidationError';
import { ILogger } from '../../../src/interface/ILogger';
import { IDB } from '../../../src/interface/dao';

describe('MetricsCollectorHook', () => {
    let hook: MetricsCollectorHook<IDB>;
    let mockCollector: IMetricsCollector;
    let collectorCalls: Record<string, any[]>;
    let mockLogger: ILogger;
    let loggerWarnings: string[];

    beforeEach(() => {
        collectorCalls = {};
        loggerWarnings = [];

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
            recordScriptError: (script: MigrationScript<IDB>, error: Error) => {
                collectorCalls['recordScriptError'] = collectorCalls['recordScriptError'] || [];
                collectorCalls['recordScriptError'].push({ script, error });
            },
            recordRollback: (strategy: RollbackStrategy, success: boolean, duration?: number) => {
                collectorCalls['recordRollback'] = collectorCalls['recordRollback'] || [];
                collectorCalls['recordRollback'].push({ strategy, success, duration });
            },
            recordValidationErrors: (errors: ValidationError<IDB>[]) => {
                collectorCalls['recordValidationErrors'] = collectorCalls['recordValidationErrors'] || [];
                collectorCalls['recordValidationErrors'].push(errors);
            },
            recordBackup: (backupPath: string, duration: number) => {
                collectorCalls['recordBackup'] = collectorCalls['recordBackup'] || [];
                collectorCalls['recordBackup'].push({ backupPath, duration });
            },
            recordError: (error: Error) => {
                collectorCalls['recordError'] = collectorCalls['recordError'] || [];
                collectorCalls['recordError'].push(error);
            },
            close: () => {
                collectorCalls['close'] = collectorCalls['close'] || [];
                collectorCalls['close'].push(true);
            }
        };

        // Mock logger
        mockLogger = {
            info: () => {},
            warn: (message: string) => {
                loggerWarnings.push(message);
            },
            error: () => {},
            debug: () => {},
            log: () => {}
        };

        hook = new MetricsCollectorHook<IDB>([mockCollector], mockLogger);
    });

    describe('onStart', () => {
        it('should call recordMigrationStart with correct context', async () => {
            await hook.onStart(5, 3);

            expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);
            const context = collectorCalls['recordMigrationStart'][0];
            expect(context.total).to.equal(5);
            expect(context.pending).to.equal(3);
            expect(context.executed).to.equal(2); // total - pending
            expect(context.startTime).to.be.a('number');
        });

        it('should store start time for duration calculation', async () => {
            const beforeStart = Date.now();
            await hook.onStart(5, 3);
            const afterStart = Date.now();

            const context = collectorCalls['recordMigrationStart'][0];
            expect(context.startTime).to.be.at.least(beforeStart);
            expect(context.startTime).to.be.at.most(afterStart);
        });
    });

    describe('onComplete', () => {
        it('should call recordMigrationComplete with calculated duration', async () => {
            await hook.onStart(3, 3);

            // Wait a bit to ensure duration > 0
            const waitStart = Date.now();
            while (Date.now() - waitStart < 10) {
                // Wait 10ms
            }

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
                errors: []
            };

            await hook.onComplete(result);

            expect(collectorCalls['recordMigrationComplete']).to.have.lengthOf(1);
            const call = collectorCalls['recordMigrationComplete'][0];
            expect(call.result).to.equal(result);
            expect(call.duration).to.be.a('number');
            expect(call.duration).to.be.at.least(10);
        });

        it('should call close on all collectors', async () => {
            await hook.onStart(1, 1);

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
                errors: []
            };

            await hook.onComplete(result);

            expect(collectorCalls['close']).to.have.lengthOf(1);
        });
    });

    describe('onBeforeMigrate', () => {
        it('should call recordScriptStart', async () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            await hook.onBeforeMigrate(script);

            expect(collectorCalls['recordScriptStart']).to.have.lengthOf(1);
            expect(collectorCalls['recordScriptStart'][0]).to.equal(script);
        });
    });

    describe('onAfterMigrate', () => {
        it('should call recordScriptComplete with calculated duration', async () => {
            const startTime = Date.now();
            const endTime = startTime + 823;

            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {},
                startedAt: startTime,
                finishedAt: endTime
            } as MigrationScript<IDB>;

            await hook.onAfterMigrate(script, 'success');

            expect(collectorCalls['recordScriptComplete']).to.have.lengthOf(1);
            const call = collectorCalls['recordScriptComplete'][0];
            expect(call.script).to.equal(script);
            expect(call.duration).to.equal(823);
        });

        it('should handle missing timing info gracefully', async () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            await hook.onAfterMigrate(script, 'success');

            expect(collectorCalls['recordScriptComplete']).to.have.lengthOf(1);
            const call = collectorCalls['recordScriptComplete'][0];
            expect(call.duration).to.equal(0);
        });
    });

    describe('onMigrationError', () => {
        it('should call recordScriptError', async () => {
            const script = {
                name: 'V2_AddIndex',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Index already exists');

            await hook.onMigrationError(script, error);

            expect(collectorCalls['recordScriptError']).to.have.lengthOf(1);
            const call = collectorCalls['recordScriptError'][0];
            expect(call.script).to.equal(script);
            expect(call.error).to.equal(error);
        });
    });

    describe('onError', () => {
        it('should call recordError', async () => {
            const error = new Error('Database connection failed');

            await hook.onError(error);

            expect(collectorCalls['recordError']).to.have.lengthOf(1);
            expect(collectorCalls['recordError'][0]).to.equal(error);
        });
    });

    describe('onBeforeBackup', () => {
        it('should track backup start time', async () => {
            await hook.onBeforeBackup();

            // Verify start time is tracked by checking onAfterBackup calculates duration
            const waitStart = Date.now();
            while (Date.now() - waitStart < 10) {
                // Wait 10ms
            }

            await hook.onAfterBackup('./backup.bkp');

            expect(collectorCalls['recordBackup']).to.have.lengthOf(1);
            const call = collectorCalls['recordBackup'][0];
            expect(call.duration).to.be.at.least(10);
        });
    });

    describe('onAfterBackup', () => {
        it('should call recordBackup with calculated duration', async () => {
            await hook.onBeforeBackup();

            // Wait a bit
            const waitStart = Date.now();
            while (Date.now() - waitStart < 10) {
                // Wait 10ms
            }

            await hook.onAfterBackup('./backups/migration-20250101.bkp');

            expect(collectorCalls['recordBackup']).to.have.lengthOf(1);
            const call = collectorCalls['recordBackup'][0];
            expect(call.backupPath).to.equal('./backups/migration-20250101.bkp');
            expect(call.duration).to.be.a('number');
            expect(call.duration).to.be.at.least(10);
        });
    });

    describe('error handling', () => {
        it('should continue if collector throws error', async () => {
            const failingCollector: IMetricsCollector = {
                recordMigrationStart: () => {
                    throw new Error('Collector failed');
                }
            };

            hook = new MetricsCollectorHook<IDB>([failingCollector, mockCollector], mockLogger);

            // Should not throw
            await hook.onStart(3, 3);

            // Second collector should still be called
            expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);

            // Logger should record the failure
            expect(loggerWarnings.length).to.be.greaterThan(0);
            expect(loggerWarnings[0]).to.include('Collector failed');
        });

        it('should log summary of failed collectors', async () => {
            const failingCollector1: IMetricsCollector = {
                recordMigrationStart: () => {
                    throw new Error('Collector 1 failed');
                }
            };

            const failingCollector2: IMetricsCollector = {
                recordMigrationStart: () => {
                    throw new Error('Collector 2 failed');
                }
            };

            hook = new MetricsCollectorHook<IDB>(
                [failingCollector1, failingCollector2, mockCollector],
                mockLogger
            );

            await hook.onStart(3, 3);

            // Summary message should be logged
            const summaryMessage = loggerWarnings.find(msg =>
                msg.includes('2/3 metrics collectors failed')
            );
            expect(summaryMessage).to.exist;
        });

        it('should handle async collector failures', async () => {
            const asyncFailingCollector: IMetricsCollector = {
                recordMigrationStart: async () => {
                    await new Promise(resolve => setTimeout(resolve, 1));
                    throw new Error('Async collector failed');
                }
            };

            hook = new MetricsCollectorHook<IDB>([asyncFailingCollector, mockCollector], mockLogger);

            // Should not throw
            await hook.onStart(3, 3);

            // Second collector should still be called
            expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);
        });

        it('should handle non-Error thrown values', async () => {
            const nonErrorThrowingCollector: IMetricsCollector = {
                recordMigrationStart: () => {
                    // eslint-disable-next-line @typescript-eslint/no-throw-literal
                    throw 'String error thrown';
                }
            };

            hook = new MetricsCollectorHook<IDB>([nonErrorThrowingCollector, mockCollector], mockLogger);

            // Should not throw
            await hook.onStart(3, 3);

            // Logger should convert non-Error to string
            expect(loggerWarnings.length).to.be.greaterThan(0);
            expect(loggerWarnings[0]).to.include('String error thrown');

            // Second collector should still be called
            expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);
        });
    });

    describe('multiple collectors', () => {
        it('should call all collectors in parallel', async () => {
            const collector1Calls: string[] = [];
            const collector2Calls: string[] = [];

            const collector1: IMetricsCollector = {
                recordMigrationStart: () => {
                    collector1Calls.push('recordMigrationStart');
                }
            };

            const collector2: IMetricsCollector = {
                recordMigrationStart: () => {
                    collector2Calls.push('recordMigrationStart');
                }
            };

            hook = new MetricsCollectorHook<IDB>([collector1, collector2]);

            await hook.onStart(3, 3);

            expect(collector1Calls).to.have.lengthOf(1);
            expect(collector2Calls).to.have.lengthOf(1);
        });

        it('should call close on all collectors', async () => {
            const collector1Closed: boolean[] = [];
            const collector2Closed: boolean[] = [];

            const collector1: IMetricsCollector = {
                close: () => {
                    collector1Closed.push(true);
                }
            };

            const collector2: IMetricsCollector = {
                close: () => {
                    collector2Closed.push(true);
                }
            };

            hook = new MetricsCollectorHook<IDB>([collector1, collector2]);

            await hook.onStart(1, 1);

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
                errors: []
            };

            await hook.onComplete(result);

            expect(collector1Closed).to.have.lengthOf(1);
            expect(collector2Closed).to.have.lengthOf(1);
        });
    });

    describe('without logger', () => {
        it('should handle collector failures without logger', async () => {
            const failingCollector: IMetricsCollector = {
                recordMigrationStart: () => {
                    throw new Error('Collector failed');
                }
            };

            hook = new MetricsCollectorHook<IDB>([failingCollector, mockCollector]);

            // Should not throw even without logger
            await hook.onStart(3, 3);

            // Second collector should still be called
            expect(collectorCalls['recordMigrationStart']).to.have.lengthOf(1);
        });
    });

    describe('collectors without optional methods', () => {
        it('should handle collectors without close method', async () => {
            const minimalCollector: IMetricsCollector = {
                // No close method
            };

            hook = new MetricsCollectorHook<IDB>([minimalCollector]);

            await hook.onStart(1, 1);

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
                errors: []
            };

            // Should not throw when calling close on collector without close method
            await expect(hook.onComplete(result)).to.eventually.be.fulfilled;
        });

        it('should handle collectors without recordScriptError method', async () => {
            const minimalCollector: IMetricsCollector = {
                // No recordScriptError method
            };

            hook = new MetricsCollectorHook<IDB>([minimalCollector]);

            const script = {
                name: 'V1_Test',
                timestamp: 202501010001,
                filepath: '/migrations/V1_Test.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Test error');

            // Should not throw when calling onMigrationError on collector without recordScriptError
            await expect(hook.onMigrationError(script, error)).to.eventually.be.fulfilled;
        });

        it('should handle collectors without recordError method', async () => {
            const minimalCollector: IMetricsCollector = {
                // No recordError method
            };

            hook = new MetricsCollectorHook<IDB>([minimalCollector]);

            const error = new Error('Test error');

            // Should not throw when calling onError on collector without recordError
            await expect(hook.onError(error)).to.eventually.be.fulfilled;
        });

        it('should handle collectors with only some methods', async () => {
            const partialCollector: IMetricsCollector = {
                recordMigrationStart: (context: IMigrationContext) => {
                    // Has this method
                },
                // Missing: recordScriptStart, recordScriptComplete, recordScriptError, etc.
            };

            hook = new MetricsCollectorHook<IDB>([partialCollector]);

            await hook.onStart(1, 1);

            const script = {
                name: 'V1_Test',
                timestamp: 202501010001,
                filepath: '/migrations/V1_Test.ts',
                script: {},
                startedAt: Date.now(),
                finishedAt: Date.now() + 100
            } as MigrationScript<IDB>;

            // All these should work without throwing
            await expect(hook.onBeforeMigrate(script)).to.eventually.be.fulfilled;
            await expect(hook.onAfterMigrate(script, 'success')).to.eventually.be.fulfilled;
            await expect(hook.onMigrationError(script, new Error('test'))).to.eventually.be.fulfilled;
            await expect(hook.onError(new Error('test'))).to.eventually.be.fulfilled;
            await expect(hook.onBeforeBackup()).to.eventually.be.fulfilled;
            await expect(hook.onAfterBackup('./backup.bkp')).to.eventually.be.fulfilled;

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
                errors: []
            };

            await hook.onComplete(result);
        });
    });
});
