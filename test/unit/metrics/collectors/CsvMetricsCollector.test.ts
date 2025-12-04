import { expect } from 'chai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CsvMetricsCollector, CsvMetricsCollectorConfig } from '../../../../src/metrics/collectors/CsvMetricsCollector';
import { MigrationScript } from '../../../../src/model/MigrationScript';
import { IDB } from '../../../../src/interface/dao';

describe('CsvMetricsCollector', () => {
    const testDir = './test-output/csv-metrics';
    let config: CsvMetricsCollectorConfig;
    let collector: CsvMetricsCollector;

    beforeEach(async () => {
        config = {
            filePath: path.join(testDir, 'metrics.csv'),
            includeHeader: true
            // Note: delimiter intentionally omitted to test default
        };
        collector = new CsvMetricsCollector(config);

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

    describe('recordScriptComplete', () => {
        it('should record successful script completion', async () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script, 823);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines).to.have.lengthOf(2); // Header + 1 data row
            expect(lines[0]).to.equal('timestamp,migration,migrationTimestamp,durationMs,status,error');
            expect(lines[1]).to.include('V1_CreateUsers');
            expect(lines[1]).to.include('202501010001');
            expect(lines[1]).to.include('823');
            expect(lines[1]).to.include('success');
        });
    });

    describe('recordScriptError', () => {
        it('should record script error with escaped message', async () => {
            const script = {
                name: 'V2_AddIndex',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Index already exists');

            collector.recordScriptError(script, error);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines).to.have.lengthOf(2); // Header + 1 data row
            expect(lines[1]).to.include('V2_AddIndex');
            expect(lines[1]).to.include('202501010002');
            expect(lines[1]).to.include('failed');
            expect(lines[1]).to.include('Index already exists');
        });

        it('should escape error messages containing delimiter', async () => {
            const script = {
                name: 'V3_AddColumn',
                timestamp: 202501010003,
                filepath: '/migrations/V3_AddColumn.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Error: column "name" already exists, must be unique');

            collector.recordScriptError(script, error);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');

            // Error message should be quoted because it contains comma and quotes
            // Check full content since parsing CSV with embedded commas is complex
            expect(content).to.include('Error: column ""name"" already exists, must be unique');
            expect(content).to.match(/"Error: column ""name"" already exists, must be unique"/);
        });

        it('should escape error messages containing quotes', async () => {
            const script = {
                name: 'V4_AddData',
                timestamp: 202501010004,
                filepath: '/migrations/V4_AddData.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Cannot insert "duplicate" value');

            collector.recordScriptError(script, error);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            // Quotes should be escaped (doubled)
            expect(lines[1]).to.include('Cannot insert ""duplicate"" value');
        });

        it('should escape error messages containing newlines', async () => {
            const script = {
                name: 'V5_AddConstraint',
                timestamp: 202501010005,
                filepath: '/migrations/V5_AddConstraint.ts',
                script: {}
            } as MigrationScript<IDB>;

            const error = new Error('Line 1\nLine 2\nLine 3');

            collector.recordScriptError(script, error);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');

            // Multi-line error should be in quotes - file will have actual newlines
            expect(content).to.include('"Line 1\nLine 2\nLine 3"');
        });
    });

    describe('close', () => {
        it('should write header and data rows with default delimiter', async () => {
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

            collector.recordScriptComplete(script1, 823);
            collector.recordScriptComplete(script2, 645);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines).to.have.lengthOf(3); // Header + 2 data rows
            expect(lines[0]).to.equal('timestamp,migration,migrationTimestamp,durationMs,status,error');
        });

        it('should write without header when includeHeader is false and file exists', async () => {
            config.includeHeader = false;

            // Pre-create file with header
            await fs.writeFile(config.filePath, 'timestamp,migration,migrationTimestamp,durationMs,status,error\n', 'utf-8');

            collector = new CsvMetricsCollector(config);

            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script, 500);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines).to.have.lengthOf(2); // Header + 1 data row
            expect(lines[0]).to.include('timestamp,migration');
            expect(lines[1]).to.include('V1_CreateUsers');
        });

        it('should append without header to existing file', async () => {
            config.includeHeader = false;
            collector = new CsvMetricsCollector(config);

            // Create file with existing data
            await fs.writeFile(config.filePath, 'timestamp,migration,migrationTimestamp,durationMs,status,error\n', 'utf-8');
            await fs.appendFile(config.filePath, '2025-01-01T00:00:00.000Z,V0_Init,202501010000,100,success,\n', 'utf-8');

            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script, 500);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines).to.have.lengthOf(3); // Header + 2 data rows
            expect(lines[0]).to.include('timestamp,migration');
            expect(lines[1]).to.include('V0_Init');
            expect(lines[2]).to.include('V1_CreateUsers');
        });

        it('should create file with header when file does not exist and includeHeader is false', async () => {
            config.includeHeader = false;
            collector = new CsvMetricsCollector(config);

            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script, 500);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            // Should create file with header when file doesn't exist
            expect(lines).to.have.lengthOf(2); // Header + 1 data row
            expect(lines[0]).to.equal('timestamp,migration,migrationTimestamp,durationMs,status,error');
            expect(lines[1]).to.include('V1_CreateUsers');
            expect(lines[1]).to.include('500');
        });


        it('should use custom delimiter', async () => {
            config.delimiter = '|';
            collector = new CsvMetricsCollector(config);

            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script, 500);

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines[0]).to.equal('timestamp|migration|migrationTimestamp|durationMs|status|error');
            expect(lines[1]).to.include('|V1_CreateUsers|');
            expect(lines[1]).to.include('|500|');
        });

        it('should create parent directories if they do not exist', async () => {
            const nestedPath = path.join(testDir, 'nested', 'deep', 'metrics.csv');
            config.filePath = nestedPath;
            collector = new CsvMetricsCollector(config);

            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script, 500);

            await collector.close();

            // Verify file was created in nested directory
            const content = await fs.readFile(nestedPath, 'utf-8');
            expect(content).to.not.be.empty;
        });

        it('should not write anything when no rows collected', async () => {
            await collector.close();

            // Verify file was not created
            try {
                await fs.access(config.filePath);
                expect.fail('File should not exist');
            } catch (error: any) {
                expect(error.code).to.equal('ENOENT');
            }
        });

        it('should handle complete migration lifecycle', async () => {
            // Success
            const script1 = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script1, 823);

            // Success
            const script2 = {
                name: 'V2_AddEmail',
                timestamp: 202501010002,
                filepath: '/migrations/V2_AddEmail.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptComplete(script2, 645);

            // Error
            const script3 = {
                name: 'V3_AddIndex',
                timestamp: 202501010003,
                filepath: '/migrations/V3_AddIndex.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptError(script3, new Error('Index already exists'));

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines).to.have.lengthOf(4); // Header + 3 data rows

            // Verify first success
            expect(lines[1]).to.include('V1_CreateUsers');
            expect(lines[1]).to.include('823');
            expect(lines[1]).to.include('success');

            // Verify second success
            expect(lines[2]).to.include('V2_AddEmail');
            expect(lines[2]).to.include('645');
            expect(lines[2]).to.include('success');

            // Verify error
            expect(lines[3]).to.include('V3_AddIndex');
            expect(lines[3]).to.include('failed');
            expect(lines[3]).to.include('Index already exists');
        });

        it('should handle null duration for errors', async () => {
            const script = {
                name: 'V1_CreateUsers',
                timestamp: 202501010001,
                filepath: '/migrations/V1_CreateUsers.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptError(script, new Error('Test error'));

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            // Duration should be empty for errors
            const dataParts = lines[1].split(',');
            expect(dataParts[3]).to.equal(''); // durationMs column should be empty
        });
    });

    describe('CSV escaping edge cases', () => {
        it('should handle empty error message', async () => {
            const script = {
                name: 'V1_Test',
                timestamp: 202501010001,
                filepath: '/migrations/V1_Test.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptError(script, new Error(''));

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            // Should handle empty error without issues
            expect(lines[1]).to.include('failed');
        });

        it('should handle error with only delimiter', async () => {
            const script = {
                name: 'V1_Test',
                timestamp: 202501010001,
                filepath: '/migrations/V1_Test.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptError(script, new Error(','));

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            // Single comma should be escaped
            expect(lines[1]).to.include('","');
        });

        it('should handle error with only quotes', async () => {
            const script = {
                name: 'V1_Test',
                timestamp: 202501010001,
                filepath: '/migrations/V1_Test.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptError(script, new Error('"'));

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');
            const lines = content.trim().split('\n');

            // Single quote should be escaped
            expect(lines[1]).to.include('""""');
        });

        it('should handle complex error with all special characters', async () => {
            const script = {
                name: 'V1_Test',
                timestamp: 202501010001,
                filepath: '/migrations/V1_Test.ts',
                script: {}
            } as MigrationScript<IDB>;

            collector.recordScriptError(script, new Error('Error: "value", line\n2'));

            await collector.close();

            const content = await fs.readFile(config.filePath, 'utf-8');

            // Should be fully escaped - check in full file content (not split by lines due to embedded newline)
            expect(content).to.include('Error: ""value"", line\n2');
            expect(content).to.match(/"Error: ""value"", line\n2"/); // Should be quoted
        });
    });
});
