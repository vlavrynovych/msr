import { expect } from 'chai';
import { ConsoleMetricsCollector } from '../../../../src/metrics/collectors/ConsoleMetricsCollector';
import { MigrationScript } from '../../../../src/model/MigrationScript';
import { IMigrationResult } from '../../../../src/interface/IMigrationResult';
import { IMigrationContext } from '../../../../src/interface/IMetricsCollector';
import { RollbackStrategy } from '../../../../src/model/RollbackStrategy';
import { ValidationError } from '../../../../src/error/ValidationError';
import { IDB } from '../../../../src/interface/dao';

describe('ConsoleMetricsCollector', () => {
    let collector: ConsoleMetricsCollector;
    let consoleOutput: string[];
    let errorOutput: string[];
    let warnOutput: string[];
    let originalLog: typeof console.log;
    let originalInfo: typeof console.info;
    let originalError: typeof console.error;
    let originalWarn: typeof console.warn;

    beforeEach(() => {
        collector = new ConsoleMetricsCollector();
        consoleOutput = [];
        errorOutput = [];
        warnOutput = [];

        // Capture console output
        originalLog = console.log;
        originalInfo = console.info;
        originalError = console.error;
        originalWarn = console.warn;

        console.log = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
        };
        console.info = (...args: any[]) => {
            consoleOutput.push(args.join(' '));
        };
        console.error = (...args: any[]) => {
            errorOutput.push(args.join(' '));
        };
        console.warn = (...args: any[]) => {
            warnOutput.push(args.join(' '));
        };
    });

    afterEach(() => {
        // Restore console functions
        console.log = originalLog;
        console.info = originalInfo;
        console.error = originalError;
        console.warn = originalWarn;
    });

    describe('recordMigrationStart', () => {
        it('should log migration start with context', () => {
            const context: IMigrationContext = {
                total: 5,
                pending: 3,
                executed: 2,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.include('[METRICS] Migration started');
            expect(consoleOutput[0]).to.include('3 pending scripts');
            expect(consoleOutput[0]).to.include('2 already executed');
        });

        it('should handle zero pending migrations', () => {
            const context: IMigrationContext = {
                total: 5,
                pending: 0,
                executed: 5,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            expect(consoleOutput[0]).to.include('0 pending scripts');
            expect(consoleOutput[0]).to.include('5 already executed');
        });
    });

    describe('recordScriptStart', () => {
        it('should log script start and track start time', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.equal('[METRICS] V1_CreateUsers started');
        });
    });

    describe('recordScriptComplete', () => {
        it('should log script completion with duration', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            consoleOutput = []; // Clear start message

            collector.recordScriptComplete(script, 823);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.equal('[METRICS] V1_CreateUsers completed in 823ms');
        });

        it('should remove script from tracking map', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            collector.recordScriptComplete(script, 823);

            // close() should not warn about incomplete scripts
            consoleOutput = [];
            warnOutput = [];
            collector.close();

            expect(warnOutput).to.have.lengthOf(0);
        });
    });

    describe('recordScriptError', () => {
        it('should log script failure with error message', () => {
            const script = {
                name: 'V2_AddIndex',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Index already exists');

            collector.recordScriptStart(script);
            errorOutput = []; // Clear start message

            collector.recordScriptError(script, error);

            expect(errorOutput).to.have.lengthOf(1);
            expect(errorOutput[0]).to.equal('[METRICS] V2_AddIndex failed: Index already exists');
        });

        it('should remove script from tracking map', () => {
            const script = {
                name: 'V2_AddIndex',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            collector.recordScriptError(script, new Error('Test error'));

            // close() should not warn about incomplete scripts
            consoleOutput = [];
            warnOutput = [];
            collector.close();

            expect(warnOutput).to.have.lengthOf(0);
        });
    });

    describe('recordMigrationComplete', () => {
        it('should log successful migration completion', () => {
            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [
                    { name: 'V1_CreateUsers', timestamp: 202501010001 } as MigrationScript<IDB>,
                    { name: 'V2_AddEmail', timestamp: 202501010002 } as MigrationScript<IDB>,
                    { name: 'V3_AddIndex', timestamp: 202501010003 } as MigrationScript<IDB>
                ],
                migrated: [],
                ignored: [],
                errors: []
            };

            collector.recordMigrationComplete(result, 2453);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.equal('[METRICS] Migration completed - 3 scripts in 2453ms (success)');
        });

        it('should log failed migration completion with failure count', () => {
            const result: IMigrationResult<IDB> = {
                success: false,
                executed: [
                    { name: 'V1_CreateUsers', timestamp: 202501010001 } as MigrationScript<IDB>,
                    { name: 'V2_AddEmail', timestamp: 202501010002 } as MigrationScript<IDB>
                ],
                migrated: [],
                ignored: [],
                errors: [
                    new Error('Index exists')
                ]
            };

            collector.recordMigrationComplete(result, 1800);

            expect(errorOutput).to.have.lengthOf(1);
            expect(errorOutput[0]).to.equal('[METRICS] Migration failed - 2 succeeded, 1 failed in 1800ms');
        });

        it('should handle zero errors array', () => {
            const result: IMigrationResult<IDB> = {
                success: false,
                executed: [],
                migrated: [],
                ignored: [],
                errors: undefined
            };

            collector.recordMigrationComplete(result, 100);

            expect(errorOutput[0]).to.include('0 failed');
        });
    });

    describe('recordRollback', () => {
        it('should log successful rollback with duration', () => {
            collector.recordRollback(RollbackStrategy.BACKUP, true, 1500);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.equal('[METRICS] Rollback (backup) succeeded in 1500ms');
        });

        it('should log failed rollback', () => {
            collector.recordRollback(RollbackStrategy.DOWN, false, 800);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.equal('[METRICS] Rollback (down) failed in 800ms');
        });

        it('should handle undefined duration', () => {
            collector.recordRollback(RollbackStrategy.BOTH, true);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.equal('[METRICS] Rollback (both) succeeded');
        });
    });

    describe('recordValidationErrors', () => {
        it('should log validation errors with count and messages', () => {
            const errors = [
                new ValidationError('Duplicate migration timestamp', []),
                new ValidationError('Invalid migration name', [])
            ];

            collector.recordValidationErrors(errors);

            expect(warnOutput).to.have.lengthOf(3);
            expect(warnOutput[0]).to.equal('[METRICS] Validation errors: 2 issues found');
            expect(warnOutput[1]).to.equal('[METRICS]   - Duplicate migration timestamp');
            expect(warnOutput[2]).to.equal('[METRICS]   - Invalid migration name');
        });

        it('should handle single validation error', () => {
            const errors = [
                new ValidationError('Single error', [])
            ];

            collector.recordValidationErrors(errors);

            expect(warnOutput).to.have.lengthOf(2);
            expect(warnOutput[0]).to.equal('[METRICS] Validation errors: 1 issues found');
        });

        it('should handle empty validation errors array', () => {
            const errors: ValidationError<IDB>[] = [];

            collector.recordValidationErrors(errors);

            expect(warnOutput).to.have.lengthOf(1);
            expect(warnOutput[0]).to.equal('[METRICS] Validation errors: 0 issues found');
        });
    });

    describe('recordBackup', () => {
        it('should log backup creation with duration and path', () => {
            collector.recordBackup('./backups/migration-20250101.bkp', 3200);

            expect(consoleOutput).to.have.lengthOf(1);
            expect(consoleOutput[0]).to.equal('[METRICS] Backup created in 3200ms: ./backups/migration-20250101.bkp');
        });
    });

    describe('recordError', () => {
        it('should log general error message', () => {
            const error = new Error('Database connection failed');

            collector.recordError(error);

            expect(errorOutput).to.have.lengthOf(1);
            expect(errorOutput[0]).to.equal('[METRICS] Error: Database connection failed');
        });
    });

    describe('close', () => {
        it('should not warn if all scripts completed', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            collector.recordScriptComplete(script, 500);

            consoleOutput = [];
            warnOutput = [];
            collector.close();

            expect(warnOutput).to.have.lengthOf(0);
        });

        it('should warn about scripts that never completed', () => {
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

            // Don't complete them
            consoleOutput = [];
            warnOutput = [];
            collector.close();

            expect(warnOutput).to.have.lengthOf(3);
            expect(warnOutput[0]).to.equal('[METRICS] Warning: 2 scripts never completed');
            expect(warnOutput[1]).to.include('[METRICS]   - V1_CreateUsers (running for');
            expect(warnOutput[2]).to.include('[METRICS]   - V2_AddEmail (running for');
        });

        it('should calculate running duration for incomplete scripts', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);

            // Wait a bit to ensure duration > 0
            const startTime = Date.now();
            while (Date.now() - startTime < 10) {
                // Wait 10ms
            }

            consoleOutput = [];
            warnOutput = [];
            collector.close();

            expect(warnOutput[1]).to.match(/\(running for \d+ms\)/);
        });
    });
});
