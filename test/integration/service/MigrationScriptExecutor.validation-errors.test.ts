import { expect } from 'chai';
import { MigrationScriptExecutor, Config, SilentLogger, IDatabaseMigrationHandler, ValidationError, ISchemaVersion, IMigrationInfo, IDB, TransactionMode } from '../../../src';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('MigrationScriptExecutor - Validation Error Paths Coverage', () => {
    let tempDir: string;
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
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-coverage-'));

        config = new Config();
        config.folder = tempDir;
        config.validateBeforeRun = true;
        config.transaction.mode = TransactionMode.NONE; // Tests don't use transactions

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
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    /**
     * Test: migrate() validates and displays errors for invalid migrations
     * Covers validateMigrations() error path (lines 552-564)
     */
    it('should validate migrations and display errors during migrate()', async () => {
        // Create a valid migration that will be rejected by custom validator
        const migrationContent = [
            'export default class Migration {',
            '    async up(db: any, info: any, handler: any): Promise<string> {',
            '        return \'Success\';',
            '    }',
            '}'
        ].join('\n');
        const paddedTimestamp = String(1).padStart(12, '0');
        fs.writeFileSync(
            path.join(tempDir, `V${paddedTimestamp}_invalid.ts`),
            migrationContent
        );

        // Add custom validator that always fails (with details to cover line 560)
        const { ValidationIssueType } = require('../../../src/model/ValidationIssueType');
        config.customValidators = [{
            validate: async () => ({
                valid: false,
                issues: [{
                    type: ValidationIssueType.ERROR,
                    code: 'CUSTOM_ERROR',
                    message: 'Custom validation failed',
                    details: 'Additional error details for debugging'
                }],
                script: {} as any
            })
        }];

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

        const result = await executor.migrate();

        expect(result.success).to.be.false;
        expect(result.errors).to.have.lengthOf(1);
        expect(result.errors![0]).to.be.instanceOf(ValidationError);
        expect(result.errors![0].message).to.include('Migration validation failed');
    });

    /**
     * Test: migrate() validates and displays warnings
     * Covers validateMigrations() warning path (lines 568-587)
     */
    it('should validate migrations and display warnings during migrate()', async () => {
        config.downMethodPolicy = require('../../../src/model/DownMethodPolicy').DownMethodPolicy.RECOMMENDED;
        config.rollbackStrategy = require('../../../src/model/RollbackStrategy').RollbackStrategy.BOTH;
        
        // Create migration without down() method (triggers warning)
        const migrationContent = [
            'export default class Migration {',
            '    async up(db: any, info: any, handler: any): Promise<string> {',
            '        return \'Success\';',
            '    }',
            '}'
        ].join('\n');
        const paddedTimestamp = String(1).padStart(12, '0');
        fs.writeFileSync(
            path.join(tempDir, `V${paddedTimestamp}_no_down.ts`),
            migrationContent
        );

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

        // Should succeed with warnings
        const result = await executor.migrate();
        expect(result.success).to.be.true;
    });

    /**
     * Test: migrate() treats warnings as errors in strict mode
     * Covers validateMigrations() strict mode path (lines 582-584)
     */
    it('should treat warnings as errors in strict validation mode', async () => {
        config.strictValidation = true;
        config.downMethodPolicy = require('../../../src/model/DownMethodPolicy').DownMethodPolicy.RECOMMENDED;
        config.rollbackStrategy = require('../../../src/model/RollbackStrategy').RollbackStrategy.BOTH;

        // Create migration without down() method (triggers warning)
        const migrationContent = [
            'export default class Migration {',
            '    async up(db: any, info: any, handler: any): Promise<string> {',
            '        return \'Success\';',
            '    }',
            '}'
        ].join('\n');
        const paddedTimestamp = String(1).padStart(12, '0');
        fs.writeFileSync(
            path.join(tempDir, `V${paddedTimestamp}_no_down.ts`),
            migrationContent
        );

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

        const result = await executor.migrate();

        expect(result.success).to.be.false;
        expect(result.errors).to.have.lengthOf(1);
        expect(result.errors![0]).to.be.instanceOf(ValidationError);
        expect(result.errors![0].message).to.include('Strict validation');
    });

    /**
     * Test: migrate() validates migrated file integrity and displays errors
     * Covers validateMigratedFileIntegrity() error path (lines 606-625)
     */
    it('should validate migrated file integrity and display errors', async () => {
        config.validateMigratedFiles = true;

        // Create a migration file
        const migrationContent = [
            'export default class Migration {',
            '    async up(db: any, info: any, handler: any): Promise<string> {',
            '        return \'Success\';',
            '    }',
            '}'
        ].join('\n');
        const paddedTimestamp = String(1).padStart(12, '0');
        const filename = `V${paddedTimestamp}_executed.ts`;
        const filepath = path.join(tempDir, filename);
        fs.writeFileSync(filepath, migrationContent);

        // Calculate checksum
        const ChecksumService = require('../../../src/service/ChecksumService').ChecksumService;
        const originalChecksum = ChecksumService.calculateChecksum(filepath, config.checksumAlgorithm);

        // Mock that this migration was already executed with correct checksum
        handler.schemaVersion.migrationRecords.getAllExecuted = () => Promise.resolve([{
            name: filename,
            filepath: filepath,
            timestamp: 1,
            checksum: originalChecksum
        }] as any);

        // Now modify the file to create checksum mismatch
        fs.writeFileSync(filepath, migrationContent + '// Modified');

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: new SilentLogger()
, config: config });

        const result = await executor.migrate();

        expect(result.success).to.be.false;
        expect(result.errors).to.have.lengthOf(1);
        expect(result.errors![0]).to.be.instanceOf(ValidationError);
        expect(result.errors![0].message).to.include('integrity check failed');
    });

    /**
     * Test: Transaction validation warnings are logged
     * Covers lines 1430-1431 in MigrationScriptExecutor.ts
     * Validates that transaction configuration warnings (not errors) are logged appropriately.
     */
    it('should log transaction validation warnings when isolation level not supported', async () => {
        config.validateBeforeRun = false;
        config.transaction.mode = 'PER_MIGRATION' as any;
        config.transaction.isolation = 'SERIALIZABLE' as any;

        // Create handler with transactional DB that doesn't support setIsolationLevel
        // This will generate a WARNING (not an ERROR)
        const transactionalDB = {
            query: () => Promise.resolve([]),
            checkConnection: () => Promise.resolve(true),
            beginTransaction: () => Promise.resolve(),
            commit: () => Promise.resolve(),
            rollback: () => Promise.resolve()
            // No setIsolationLevel method - this triggers the warning
        };

        handler.db = transactionalDB as any;

        // Mock scanner that returns a pending migration
        const mockScanner = {
            scan: async () => ({
                all: [
                    {
                        timestamp: 1,
                        name: 'V1__test',
                        filepath: '/fake/V1__test.ts',
                        init: async () => {},
                        script: {
                            up: async () => {},
                            down: async () => {}
                        }
                    }
                ],
                migrated: [],
                pending: [
                    {
                        timestamp: 1,
                        name: 'V1__test',
                        filepath: '/fake/V1__test.ts',
                        init: async () => {},
                        script: {
                            up: async () => {},
                            down: async () => {}
                        }
                    }
                ],
                ignored: [],
                executed: []
            })
        };

        // Create a capturing logger to verify warning messages
        let loggedMessages: string[] = [];
        const capturingLogger = {
            info: (msg: string) => loggedMessages.push(`INFO: ${msg}`),
            error: (msg: string) => loggedMessages.push(`ERROR: ${msg}`),
            warn: (msg: string) => loggedMessages.push(`WARN: ${msg}`),
            success: (msg: string) => loggedMessages.push(`SUCCESS: ${msg}`),
            debug: (msg: string) => loggedMessages.push(`DEBUG: ${msg}`),
            log: (msg: string) => loggedMessages.push(`LOG: ${msg}`)
        };

        const executor = new MigrationScriptExecutor<IDB>({ handler: handler, logger: capturingLogger,
            migrationScanner: mockScanner as any
, config: config });

        try {
            await executor.migrate();
        } catch (error) {
            // Migration may fail, but validation should run first
        }

        // Verify warning messages were logged (covers lines 1430-1431)
        const hasWarningHeader = loggedMessages.some(msg =>
            msg.includes('Transaction configuration warnings')
        );

        expect(hasWarningHeader).to.be.true;
    });
});
