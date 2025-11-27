import { expect } from 'chai';
import { MigrationScriptExecutor, Config, SilentLogger, IDatabaseMigrationHandler, ValidationError, ISchemaVersion, IMigrationInfo, IDB } from '../../../src';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('MigrationScriptExecutor - Validation Error Paths Coverage', () => {
    let tempDir: string;
    let handler: IDatabaseMigrationHandler;
    let config: Config;
    const db: IDB = new class implements IDB {
        [key: string]: unknown;
        test() { throw new Error('Not implemented') }
    }

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validation-coverage-'));
        
        config = new Config();
        config.folder = tempDir;
        config.validateBeforeRun = true;
        
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

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger()
        });

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

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger()
        });

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

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger()
        });

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
        handler.schemaVersion.migrations.getAll = () => Promise.resolve([{
            name: filename,
            filepath: filepath,
            timestamp: 1,
            checksum: originalChecksum
        }] as any);

        // Now modify the file to create checksum mismatch
        fs.writeFileSync(filepath, migrationContent + '// Modified');

        const executor = new MigrationScriptExecutor(handler, config, {
            logger: new SilentLogger()
        });

        const result = await executor.migrate();

        expect(result.success).to.be.false;
        expect(result.errors).to.have.lengthOf(1);
        expect(result.errors![0]).to.be.instanceOf(ValidationError);
        expect(result.errors![0].message).to.include('integrity check failed');
    });
});
