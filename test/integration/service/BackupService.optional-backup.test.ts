import { expect } from 'chai';
import sinon from 'sinon';
import {BackupService, Config, IBackup, IDatabaseMigrationHandler, ISchemaVersion, IDB} from "../../../src";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for BackupService with optional backup interface.
 * Validates error handling when backup interface is missing or unavailable.
 */
describe('BackupService - Optional Backup', () => {

    let testDir: string;

    before(() => {
        testDir = path.join(process.cwd(), `test-backup-coverage-${Date.now()}`);
        fs.mkdirSync(testDir, {recursive: true});
    });

    after(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, {recursive: true, force: true});
        }
    });

    /**
     * Test: restore() should reject when backup file cannot be opened
     */
    it('should reject when backup file does not exist', async () => {
        const mockBackup: IBackup = {
            backup: sinon.stub().resolves('backup-data'),
            restore: sinon.stub().resolves()
        };

        const handler: IDatabaseMigrationHandler = {
            backup: mockBackup,
            db: {} as IDB,
            schemaVersion: {} as ISchemaVersion,
            getName: () => 'Test Handler',
            getVersion: () => '1.0.0-test',
        };

        const config = new Config();
        const backupService = new BackupService(handler, config);

        // Set a non-existent backup file path
        const nonExistentPath = path.join(testDir, 'non-existent-backup.json');
        (backupService as any).backupFile = nonExistentPath;

        try {
            await backupService.restore();
            expect.fail('Should have rejected with error');
        } catch (error) {
            expect((error as string).toString()).to.include(`Cannot open ${nonExistentPath}`);
        }
    });

    /**
     * Test: backup() should throw when no backup interface provided
     */
    it('should throw when no backup interface provided', async () => {
        const handler: IDatabaseMigrationHandler = {
            // No backup interface
            db: {} as IDB,
            schemaVersion: {} as ISchemaVersion,
            getName: () => 'Test Handler',
            getVersion: () => '1.0.0-test',
        };

        const config = new Config();
        const backupService = new BackupService(handler, config);

        try {
            await backupService.backup();
            expect.fail('Should have thrown error');
        } catch (error) {
            expect((error as Error).message).to.equal('No backup interface provided - cannot create backup');
        }
    });

    /**
     * Test: restore() should throw when no backup interface provided
     * Additional coverage for optional backup handling
     */
    it('should throw when trying to restore without backup interface', async () => {
        const handler: IDatabaseMigrationHandler = {
            // No backup interface
            db: {} as IDB,
            schemaVersion: {} as ISchemaVersion,
            getName: () => 'Test Handler',
            getVersion: () => '1.0.0-test',
        };

        const config = new Config();
        const backupService = new BackupService(handler, config);

        // Create a fake backup file
        const backupPath = path.join(testDir, 'fake-backup.json');
        fs.writeFileSync(backupPath, 'fake-backup-data');
        (backupService as any).backupFile = backupPath;

        try {
            await backupService.restore();
            expect.fail('Should have thrown error');
        } catch (error) {
            expect(error).to.equal('No backup interface provided - cannot restore');
        }

        // Cleanup
        fs.unlinkSync(backupPath);
    });

    /**
     * Test: Successful backup and restore flow
     * Ensures the happy path still works with optional backup
     */
    it('should successfully backup and restore when backup interface is provided', async () => {
        const backupData = 'test-backup-data-12345';
        const mockBackup: IBackup = {
            backup: sinon.stub().resolves(backupData),
            restore: sinon.stub().resolves()
        };

        const handler: IDatabaseMigrationHandler = {
            backup: mockBackup,
            db: {} as IDB,
            schemaVersion: {} as ISchemaVersion,
            getName: () => 'Test Handler',
            getVersion: () => '1.0.0-test',
        };

        const config = new Config();
        const backupService = new BackupService(handler, config);

        // Backup
        const result = await backupService.backup();
        expect(result).to.be.a('string');
        expect(fs.existsSync(result)).to.be.true;

        // Verify backup was called
        expect((mockBackup.backup as sinon.SinonStub).calledOnce).to.be.true;

        // Restore
        await backupService.restore();

        // Verify restore was called with the backup data
        expect((mockBackup.restore as sinon.SinonStub).calledOnce).to.be.true;
        expect((mockBackup.restore as sinon.SinonStub).firstCall.args[0]).to.equal(backupData);

        // Cleanup
        if (fs.existsSync(result)) {
            fs.unlinkSync(result);
        }
    });
});
