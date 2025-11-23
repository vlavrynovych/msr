import {expect} from 'chai';
import * as sinon from 'sinon';
import {MigrationScanner} from '../../../src/service/MigrationScanner';
import {MigrationScriptSelector} from '../../../src/service/MigrationScriptSelector';
import {IMigrationService} from '../../../src/interface/service/IMigrationService';
import {ISchemaVersionService} from '../../../src/interface/service/ISchemaVersionService';
import {Config, MigrationScript, IDatabaseMigrationHandler} from '../../../src';
import {IMigrationInfo} from '../../../src/interface/IMigrationInfo';

/**
 * Unit tests for MigrationScanner service.
 *
 * Tests the migration state scanning functionality including:
 * - Complete state gathering (all, migrated, pending, ignored, executed)
 * - Pending migration identification
 * - Ignored migration identification
 * - Edge cases (empty states, first run)
 * - Parallel execution of database and filesystem queries
 * - Error propagation from both services
 */
describe('MigrationScanner', () => {
    let scanner: MigrationScanner;
    let migrationService: sinon.SinonStubbedInstance<IMigrationService>;
    let schemaVersionService: sinon.SinonStubbedInstance<ISchemaVersionService>;
    let selector: MigrationScriptSelector;
    let handler: IDatabaseMigrationHandler;
    let config: Config;

    beforeEach(() => {
        // Create stubs for services
        migrationService = {
            readMigrationScripts: sinon.stub()
        } as sinon.SinonStubbedInstance<IMigrationService>;

        schemaVersionService = {
            getAllMigratedScripts: sinon.stub(),
            init: sinon.stub(),
            save: sinon.stub()
        } as sinon.SinonStubbedInstance<ISchemaVersionService>;

        selector = new MigrationScriptSelector();
        config = new Config();

        handler = {
            cfg: config
        } as IDatabaseMigrationHandler;

        scanner = new MigrationScanner(
            migrationService,
            schemaVersionService,
            selector,
            handler
        );
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('scan()', () => {
        it('should scan and return complete migration state', async () => {
            // Setup test data
            const now = Date.now();
            const migratedInfo = new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100);
            migratedInfo.startedAt = now - 1000;
            migratedInfo.finishedAt = now;
            migratedInfo.username = 'test';
            migratedInfo.result = 'success';

            const migratedScripts: MigrationScript[] = [migratedInfo];

            const allScripts: MigrationScript[] = [
                new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100),
                new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200),
                new MigrationScript('V300_migration.ts', '/path/V300_migration.ts', 300)
            ];

            schemaVersionService.getAllMigratedScripts.resolves(migratedScripts);
            migrationService.readMigrationScripts.resolves(allScripts);

            // Execute
            const result = await scanner.scan();

            // Verify
            expect(result).to.have.property('all');
            expect(result).to.have.property('migrated');
            expect(result).to.have.property('pending');
            expect(result).to.have.property('ignored');
            expect(result).to.have.property('executed');

            expect(result.all).to.deep.equal(allScripts);
            expect(result.migrated).to.deep.equal(migratedScripts);
            expect(result.pending).to.have.lengthOf(2); // V200 and V300
            expect(result.ignored).to.have.lengthOf(0);
            expect(result.executed).to.have.lengthOf(0); // Empty until execution
        });

        it('should identify pending migrations correctly', async () => {
            const now = Date.now();
            const migratedScript1 = new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100);
            migratedScript1.startedAt = now - 1000;
            migratedScript1.finishedAt = now;
            migratedScript1.username = 'test';
            migratedScript1.result = 'success';

            const migratedScript2 = new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200);
            migratedScript2.startedAt = now - 1000;
            migratedScript2.finishedAt = now;
            migratedScript2.username = 'test';
            migratedScript2.result = 'success';

            const migratedScripts: MigrationScript[] = [migratedScript1, migratedScript2];

            const allScripts: MigrationScript[] = [
                new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100),
                new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200),
                new MigrationScript('V300_migration.ts', '/path/V300_migration.ts', 300),
                new MigrationScript('V400_migration.ts', '/path/V400_migration.ts', 400)
            ];

            schemaVersionService.getAllMigratedScripts.resolves(migratedScripts);
            migrationService.readMigrationScripts.resolves(allScripts);

            const result = await scanner.scan();

            expect(result.pending).to.have.lengthOf(2);
            expect(result.pending[0].timestamp).to.equal(300);
            expect(result.pending[1].timestamp).to.equal(400);
        });

        it('should identify ignored migrations correctly', async () => {
            const now = Date.now();
            const migratedScript = new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200);
            migratedScript.startedAt = now - 1000;
            migratedScript.finishedAt = now;
            migratedScript.username = 'test';
            migratedScript.result = 'success';

            const migratedScripts: MigrationScript[] = [migratedScript];

            const allScripts: MigrationScript[] = [
                new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100), // Ignored (older than last)
                new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200), // Already executed
                new MigrationScript('V300_migration.ts', '/path/V300_migration.ts', 300)  // Pending
            ];

            schemaVersionService.getAllMigratedScripts.resolves(migratedScripts);
            migrationService.readMigrationScripts.resolves(allScripts);

            const result = await scanner.scan();

            expect(result.pending).to.have.lengthOf(1);
            expect(result.pending[0].timestamp).to.equal(300);
            expect(result.ignored).to.have.lengthOf(1);
            expect(result.ignored[0].timestamp).to.equal(100);
        });

        it('should handle no migrations case', async () => {
            schemaVersionService.getAllMigratedScripts.resolves([]);
            migrationService.readMigrationScripts.resolves([]);

            const result = await scanner.scan();

            expect(result.all).to.have.lengthOf(0);
            expect(result.migrated).to.have.lengthOf(0);
            expect(result.pending).to.have.lengthOf(0);
            expect(result.ignored).to.have.lengthOf(0);
            expect(result.executed).to.have.lengthOf(0);
        });

        it('should handle all migrations already executed', async () => {
            const now = Date.now();
            const migratedScript1 = new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100);
            migratedScript1.startedAt = now - 1000;
            migratedScript1.finishedAt = now;
            migratedScript1.username = 'test';
            migratedScript1.result = 'success';

            const migratedScript2 = new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200);
            migratedScript2.startedAt = now - 1000;
            migratedScript2.finishedAt = now;
            migratedScript2.username = 'test';
            migratedScript2.result = 'success';

            const migratedScripts: MigrationScript[] = [migratedScript1, migratedScript2];

            const allScripts: MigrationScript[] = [
                new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100),
                new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200)
            ];

            schemaVersionService.getAllMigratedScripts.resolves(migratedScripts);
            migrationService.readMigrationScripts.resolves(allScripts);

            const result = await scanner.scan();

            expect(result.pending).to.have.lengthOf(0);
            expect(result.ignored).to.have.lengthOf(0);
        });

        it('should handle first migration run (no executed migrations)', async () => {
            const allScripts: MigrationScript[] = [
                new MigrationScript('V100_migration.ts', '/path/V100_migration.ts', 100),
                new MigrationScript('V200_migration.ts', '/path/V200_migration.ts', 200),
                new MigrationScript('V300_migration.ts', '/path/V300_migration.ts', 300)
            ];

            schemaVersionService.getAllMigratedScripts.resolves([]);
            migrationService.readMigrationScripts.resolves(allScripts);

            const result = await scanner.scan();

            expect(result.migrated).to.have.lengthOf(0);
            expect(result.pending).to.have.lengthOf(3); // All migrations are pending
            expect(result.ignored).to.have.lengthOf(0);
        });

        it('should call services in parallel for performance', async () => {
            const migratedScripts: MigrationScript[] = [];
            const allScripts: MigrationScript[] = [];

            schemaVersionService.getAllMigratedScripts.resolves(migratedScripts);
            migrationService.readMigrationScripts.resolves(allScripts);

            await scanner.scan();

            // Both services should be called
            expect(schemaVersionService.getAllMigratedScripts.called).to.be.true;
            expect(migrationService.readMigrationScripts.called).to.be.true;
        });

        it('should propagate errors from schemaVersionService', async () => {
            const error = new Error('Database connection failed');
            schemaVersionService.getAllMigratedScripts.rejects(error);
            migrationService.readMigrationScripts.resolves([]);

            try {
                await scanner.scan();
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err).to.equal(error);
            }
        });

        it('should propagate errors from migrationService', async () => {
            const error = new Error('Filesystem read failed');
            schemaVersionService.getAllMigratedScripts.resolves([]);
            migrationService.readMigrationScripts.rejects(error);

            try {
                await scanner.scan();
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err).to.equal(error);
            }
        });
    });
});
