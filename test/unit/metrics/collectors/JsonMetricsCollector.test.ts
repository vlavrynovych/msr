import { expect } from 'chai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { JsonMetricsCollector, JsonMetricsCollectorConfig } from '../../../../src/metrics/collectors/JsonMetricsCollector';
import { MigrationScript } from '../../../../src/model/MigrationScript';
import { IMigrationResult } from '../../../../src/interface/IMigrationResult';
import { IMigrationContext } from '../../../../src/interface/IMetricsCollector';
import { RollbackStrategy } from '../../../../src/model/RollbackStrategy';
import { ValidationError } from '../../../../src/error/ValidationError';
import { IDB } from '../../../../src/interface/dao';

describe('JsonMetricsCollector', () => {
    const testDir = './test-output/json-metrics';
    let config: JsonMetricsCollectorConfig;
    let collector: JsonMetricsCollector;

    beforeEach(async () => {
        config = {
            filePath: path.join(testDir, 'metrics.json'),
            pretty: true
        };
        collector = new JsonMetricsCollector(config);

        // Ensure test directory exists
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    describe('recordMigrationStart', () => {
        it('should record migration start context', () => {
            const context: IMigrationContext = {
                total: 5,
                pending: 3,
                executed: 2,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            const metrics = (collector as any).metrics;
            expect(metrics.summary.startTime).to.not.be.empty;
        });
    });

    describe('recordScriptStart', () => {
        it('should add new migration to migrations array', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);

            const metrics = (collector as any).metrics;
            expect(metrics.migrations).to.have.lengthOf(1);
            expect(metrics.migrations[0].name).to.equal('V1_CreateUsers');
            expect(metrics.migrations[0].timestamp).to.equal(202501010001);
            expect(metrics.migrations[0].status).to.equal('running');
        });

        it('should update existing migration if called again', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            const firstStartTime = (collector as any).metrics.migrations[0].startTime;

            // Wait a bit
            const startWait = Date.now();
            while (Date.now() - startWait < 10) {
                // Wait 10ms
            }

            collector.recordScriptStart(script);

            const metrics = (collector as any).metrics;
            expect(metrics.migrations).to.have.lengthOf(1);
            expect(metrics.migrations[0].status).to.equal('running');
            expect(metrics.migrations[0].startTime).to.not.equal(firstStartTime);
        });
    });

    describe('recordScriptComplete', () => {
        it('should update migration status to success', () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script);
            collector.recordScriptComplete(script, 823);

            const metrics = (collector as any).metrics;
            expect(metrics.migrations[0].status).to.equal('success');
            expect(metrics.migrations[0].duration).to.equal(823);
            expect(metrics.migrations[0].endTime).to.not.be.undefined;
            expect(metrics.summary.migrationsSucceeded).to.equal(1);
        });
    });

    describe('recordScriptError', () => {
        it('should update migration status to failed with error message', () => {
            const script = {
                name: 'V2_AddIndex',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Index already exists');

            collector.recordScriptStart(script);
            collector.recordScriptError(script, error);

            const metrics = (collector as any).metrics;
            expect(metrics.migrations[0].status).to.equal('failed');
            expect(metrics.migrations[0].error).to.equal('Index already exists');
            expect(metrics.migrations[0].endTime).to.not.be.undefined;
            expect(metrics.summary.migrationsFailed).to.equal(1);
        });
    });

    describe('recordMigrationComplete', () => {
        it('should update summary with final migration result', () => {
            const context: IMigrationContext = {
                total: 3,
                pending: 3,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

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

            const metrics = (collector as any).metrics;
            expect(metrics.summary.endTime).to.not.be.empty;
            expect(metrics.summary.totalDuration).to.equal(2453);
            expect(metrics.summary.migrationsExecuted).to.equal(3);
            expect(metrics.summary.success).to.be.true;
        });
    });

    describe('recordRollback', () => {
        it('should add rollback entry with success', () => {
            collector.recordRollback(RollbackStrategy.BACKUP, true, 1500);

            const metrics = (collector as any).metrics;
            expect(metrics.rollbacks).to.have.lengthOf(1);
            expect(metrics.rollbacks[0].strategy).to.equal('backup');
            expect(metrics.rollbacks[0].success).to.be.true;
            expect(metrics.rollbacks[0].duration).to.equal(1500);
            expect(metrics.rollbacks[0].timestamp).to.not.be.empty;
        });

        it('should add rollback entry with failure', () => {
            collector.recordRollback(RollbackStrategy.DOWN, false);

            const metrics = (collector as any).metrics;
            expect(metrics.rollbacks).to.have.lengthOf(1);
            expect(metrics.rollbacks[0].strategy).to.equal('down');
            expect(metrics.rollbacks[0].success).to.be.false;
            expect(metrics.rollbacks[0].duration).to.be.undefined;
        });
    });

    describe('recordValidationErrors', () => {
        it('should add validation errors to array', () => {
            const errors = [
                new ValidationError('Duplicate migration timestamp', []),
                new ValidationError('Invalid migration name', [])
            ];

            collector.recordValidationErrors(errors);

            const metrics = (collector as any).metrics;
            expect(metrics.validationErrors).to.have.lengthOf(2);
            expect(metrics.validationErrors[0].message).to.equal('Duplicate migration timestamp');
            expect(metrics.validationErrors[0].severity).to.equal('error');
            expect(metrics.validationErrors[1].message).to.equal('Invalid migration name');
        });
    });

    describe('recordBackup', () => {
        it('should add backup entry with path and duration', () => {
            collector.recordBackup('./backups/migration-20250101.bkp', 3200);

            const metrics = (collector as any).metrics;
            expect(metrics.backups).to.have.lengthOf(1);
            expect(metrics.backups[0].path).to.equal('./backups/migration-20250101.bkp');
            expect(metrics.backups[0].duration).to.equal(3200);
            expect(metrics.backups[0].timestamp).to.not.be.empty;
        });
    });

    describe('recordError', () => {
        it('should add error entry with message and stack', () => {
            const error = new Error('Database connection failed');

            collector.recordError(error);

            const metrics = (collector as any).metrics;
            expect(metrics.errors).to.have.lengthOf(1);
            expect(metrics.errors[0].message).to.equal('Database connection failed');
            expect(metrics.errors[0].stack).to.not.be.undefined;
            expect(metrics.errors[0].timestamp).to.not.be.empty;
        });
    });

    describe('close', () => {
        it('should write pretty-printed JSON to file', async () => {
            const context: IMigrationContext = {
                total: 2,
                pending: 2,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            const script1 = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script1);
            collector.recordScriptComplete(script1, 500);

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [script1],
                migrated: [],
                ignored: [],
                errors: []
            };

            collector.recordMigrationComplete(result, 500);

            await collector.close();

            // Verify file was created
            const fileContent = await fs.readFile(config.filePath, 'utf-8');
            const metrics = JSON.parse(fileContent);

            expect(metrics.summary).to.exist;
            expect(metrics.summary.success).to.be.true;
            expect(metrics.summary.migrationsExecuted).to.equal(1);
            expect(metrics.migrations).to.have.lengthOf(1);
            expect(metrics.migrations[0].name).to.equal('V1_CreateUsers');
            expect(metrics.migrations[0].status).to.equal('success');
        });

        it('should write compact JSON when pretty is false', async () => {
            config.pretty = false;
            collector = new JsonMetricsCollector(config);

            const context: IMigrationContext = {
                total: 1,
                pending: 1,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
                errors: []
            };

            collector.recordMigrationComplete(result, 100);

            await collector.close();

            // Verify file was created without pretty printing
            const fileContent = await fs.readFile(config.filePath, 'utf-8');

            // Compact JSON should not have newlines within the structure
            expect(fileContent).to.not.include('\n  ');
        });

        it('should create parent directories if they do not exist', async () => {
            const nestedPath = path.join(testDir, 'nested', 'deep', 'metrics.json');
            config.filePath = nestedPath;
            collector = new JsonMetricsCollector(config);

            const context: IMigrationContext = {
                total: 0,
                pending: 0,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            const result: IMigrationResult<IDB> = {
                success: true,
                executed: [],
                migrated: [],
                ignored: [],
                errors: []
            };

            collector.recordMigrationComplete(result, 0);

            await collector.close();

            // Verify file was created in nested directory
            const fileContent = await fs.readFile(nestedPath, 'utf-8');
            expect(fileContent).to.not.be.empty;
        });

        it('should handle complete migration lifecycle', async () => {
            const context: IMigrationContext = {
                total: 3,
                pending: 3,
                executed: 0,
                startTime: Date.now()
            };

            collector.recordMigrationStart(context);

            // Script 1: Success
            const script1 = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script1);
            collector.recordScriptComplete(script1, 823);

            // Script 2: Success
            const script2 = {
                name: 'V2_AddEmail',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddEmail.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script2);
            collector.recordScriptComplete(script2, 645);

            // Script 3: Failure
            const script3 = {
                name: 'V3_AddIndex',
                timestamp: 202501010003,
                filepath: '/migrations/V3_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptStart(script3);
            collector.recordScriptError(script3, new Error('Index already exists'));

            // Rollback
            collector.recordRollback(RollbackStrategy.BACKUP, true, 1200);

            // Backup
            collector.recordBackup('./backups/backup-20250101.bkp', 800);

            // Validation errors
            collector.recordValidationErrors([
                new ValidationError('Test validation error', [])
            ]);

            // General error
            collector.recordError(new Error('General migration error'));

            const result: IMigrationResult<IDB> = {
                success: false,
                executed: [script1, script2],
                migrated: [],
                ignored: [],
                errors: [new Error('Index already exists')]
            };

            collector.recordMigrationComplete(result, 2468);

            await collector.close();

            // Verify complete metrics file
            const fileContent = await fs.readFile(config.filePath, 'utf-8');
            const metrics = JSON.parse(fileContent);

            // Summary
            expect(metrics.summary.success).to.be.false;
            expect(metrics.summary.migrationsExecuted).to.equal(2);
            expect(metrics.summary.migrationsSucceeded).to.equal(2);
            expect(metrics.summary.migrationsFailed).to.equal(1);
            expect(metrics.summary.totalDuration).to.equal(2468);

            // Migrations
            expect(metrics.migrations).to.have.lengthOf(3);
            expect(metrics.migrations[0].status).to.equal('success');
            expect(metrics.migrations[0].duration).to.equal(823);
            expect(metrics.migrations[1].status).to.equal('success');
            expect(metrics.migrations[1].duration).to.equal(645);
            expect(metrics.migrations[2].status).to.equal('failed');
            expect(metrics.migrations[2].error).to.equal('Index already exists');

            // Rollbacks
            expect(metrics.rollbacks).to.have.lengthOf(1);
            expect(metrics.rollbacks[0].strategy).to.equal('backup');
            expect(metrics.rollbacks[0].success).to.be.true;

            // Backups
            expect(metrics.backups).to.have.lengthOf(1);
            expect(metrics.backups[0].path).to.equal('./backups/backup-20250101.bkp');

            // Validation errors
            expect(metrics.validationErrors).to.have.lengthOf(1);
            expect(metrics.validationErrors[0].message).to.equal('Test validation error');

            // Errors
            expect(metrics.errors).to.have.lengthOf(1);
            expect(metrics.errors[0].message).to.equal('General migration error');
        });
    });
});
