import { expect } from 'chai';
import fs from "fs";
import sinon from 'sinon';
import {BackupConfig, BackupService, Config, IDatabaseMigrationHandler, SilentLogger} from "../../../src";

describe('BackupService', () => {

    describe('prepareFilePath()', () => {

        /**
         * Test: prepareFilePath uses correct folder configuration
         * Validates that the backup file path includes the configured folder,
         * defaulting to '/backups/' but respecting custom folder configuration.
         * This ensures backups are saved to the expected location.
         */
        it('should use correct folder configuration', () => {
            // Test with default configuration
            const cfg:BackupConfig = new BackupConfig();
            let res:string = BackupService.prepareFilePath(cfg);

            // Verify default folder is used
            expect(res).to.include('/backups/', 'Should have default folder')

            // Configure custom folder
            cfg.folder = 'test-folder';
            res = BackupService.prepareFilePath(cfg);

            // Verify custom folder is used
            expect(res.startsWith('test-folder/'), 'Should start with test-folder folder').to.be.true
        })

        /**
         * Test: prepareFilePath uses correct file extension
         * Validates that the backup file path ends with the configured extension.
         * Different backup implementations may use different extensions (.bkp, .sql, .json, etc.).
         */
        it('should use correct file extension', () => {
            // Configure custom extension
            const cfg:BackupConfig = new BackupConfig();
            const ext:string = 'my-bkp-ext';
            cfg.extension = ext

            // Generate file path
            const res:string = BackupService.prepareFilePath(cfg);

            // Verify custom extension is used
            expect(res.endsWith(ext), 'Should have specified extension').to.be.true
        })

        /**
         * Test: prepareFilePath handles timestamp configuration
         * Validates that when timestamps are disabled, the backup filename is
         * consistent (backup.bkp) rather than time-based. This allows for
         * single-backup scenarios where old backups are overwritten.
         */
        it('should omit timestamp when timestamp is disabled', () => {
            // Configure to disable timestamps
            const cfg:BackupConfig = new BackupConfig();
            cfg.timestamp = false

            // Generate file path
            const res:string = BackupService.prepareFilePath(cfg);

            // Verify no timestamp in filename
            expect(res).to.include('/backups/backup.bkp', 'Should not have timestamp in the file name')
        })

        /**
         * Test: prepareFilePath handles custom backup configuration
         * Validates that all custom configuration parts are included in the path.
         */
        it('should handle custom backup configuration', () => {
            // having: fully customized config
            const cfg = new BackupConfig();
            cfg.folder = 'custom-backups';
            cfg.prefix = 'my-backup';
            cfg.custom = '-custom';
            cfg.suffix = '-test';
            cfg.extension = 'bak';
            cfg.timestamp = false;

            // when
            const path = BackupService.prepareFilePath(cfg);

            // then: should include all custom parts
            expect(path).to.eq('custom-backups/my-backup-custom-test.bak');
        })

        /**
         * Test: prepareFilePath formats timestamp correctly
         * Validates that timestamp format configuration is properly applied to the path.
         */
        it('should format timestamp correctly', () => {
            // having
            const cfg = new BackupConfig();
            cfg.timestamp = true;
            cfg.timestampFormat = 'YYYY-MM-DD';

            // when
            const path = BackupService.prepareFilePath(cfg);

            // then: should include formatted timestamp
            expect(path).to.match(/backup-\d{4}-\d{2}-\d{2}\.bkp/);
        })
    })

    describe('backup()', () => {

        /**
         * Test: backup handles file overwrite scenario
         * Validates that when a backup file already exists at the target path,
         * it is renamed (moved aside) before creating the new backup. This
         * prevents data loss from overwriting previous backups.
         */
        it('should handle file overwrite when creating backup', async () => {
            // Configure backup with fixed filename (no timestamp)
            const cfg = new Config();
            cfg.backup.deleteBackup = false;
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-backup-file-overwrite-${Date.now()}`;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'data'
                    }
                }
            } as IDatabaseMigrationHandler, new SilentLogger());

            // Stub filesystem to simulate existing file
            const existsStub = sinon.stub(fs, 'existsSync').returns(true);
            const renameStub = sinon.stub(fs, 'renameSync');

            // Create backup (should handle existing file)
            await bs.backup();

            // Verify renameSync was called to archive old backup
            expect(renameStub.calledOnce).to.be.true;

            const [oldPath, newPath] = renameStub.firstCall.args;

            // Verify old file is renamed to archive path with timestamp
            expect(oldPath).to.be.a('string');
            expect(newPath).to.be.a('string');
            expect(newPath).to.match(/\.old-\d+$/); // Should end with .old-<timestamp>
            expect(newPath).to.not.equal(oldPath); // Should NOT rename to itself

            existsStub.restore();
            renameStub.restore();
        })

        /**
         * Test: backup handles filesystem write permission errors
         * Validates error handling when the backup file cannot be written due to
         * permission issues. This could happen if the backup directory is read-only
         * or owned by a different user. The error should be propagated clearly.
         */
        it('should handle write permission error', async () => {
            // Configure backup service
            const cfg = new Config();
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-test-${Date.now()}`;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'data'
                    }
                }
            } as IDatabaseMigrationHandler, new SilentLogger());

            // Stub filesystem to simulate permission error
            const writeStub = sinon.stub(fs, 'writeFileSync')
                .throws(new Error('EACCES: permission denied'));

            // Verify the permission error is propagated
            await expect(bs.backup()).to.be.rejectedWith('EACCES: permission denied');

            writeStub.restore();
        })

        /**
         * Test: backup handles disk full errors
         * Validates error handling when the backup cannot be written because the
         * disk is full. This is a critical failure scenario that prevents backup
         * creation. The error should be clear to help admins free up space.
         */
        it('should handle disk full error', async () => {
            // Configure backup service
            const cfg = new Config();
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-test-${Date.now()}`;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'data'
                    }
                }
            } as IDatabaseMigrationHandler, new SilentLogger());

            // Stub filesystem to simulate disk full error
            const writeStub = sinon.stub(fs, 'writeFileSync')
                .throws(new Error('ENOSPC: no space left on device'));

            // Verify the disk full error is propagated
            await expect(bs.backup()).to.be.rejectedWith('ENOSPC: no space left on device');

            writeStub.restore();
        })

        /**
         * Test: backup handles database handler backup() method failures
         * Validates error handling when the underlying database backup implementation
         * fails (e.g., database connection issues, query timeouts). The error should
         * be propagated to prevent proceeding with a failed backup.
         */
        it('should handle backup() method failure from handler', async () => {
            // Configure backup with failing database handler
            const cfg = new Config();
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        throw new Error('Database connection failed')
                    }
                }
            } as IDatabaseMigrationHandler);

            // Verify the database error is propagated
            await expect(bs.backup()).to.be.rejectedWith('Database connection failed');
        })

        /**
         * Test: backup handles very large data sets efficiently
         * Performance test with 10MB backup data. Validates that the backup
         * service can handle large backups without memory issues or timeouts.
         * Important for databases with significant data volumes.
         */
        it('should handle very large backup data', async () => {
            // Configure backup service
            const cfg = new Config();
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-large-${Date.now()}`;
            const largeData = 'x'.repeat(10 * 1024 * 1024); // 10MB string
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return largeData
                    }
                }
            } as IDatabaseMigrationHandler);

            // Create and write large backup (should not throw or timeout)
            await bs.backup();

            // Cleanup the test backup file
            bs.deleteBackup();
        })

        /**
         * Test: backup logs success message with file path
         * Validates that backup completion is logged with the file path information.
         */
        it('should log success message with file path', async () => {
            // having
            const cfg = new Config();
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-log-test-${Date.now()}`;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'test data'
                    }
                }
            } as IDatabaseMigrationHandler);

            // and: spy on console
            const consoleInfoSpy = sinon.spy(console, 'info');

            // when
            await bs.backup();

            // then: should log success with file path
            expect(consoleInfoSpy.calledWith('Preparing backup...')).to.be.true;
            expect(consoleInfoSpy.calledWith(sinon.match('Backup prepared successfully'))).to.be.true;

            consoleInfoSpy.restore();
            bs.deleteBackup();
        })
    })

    describe('restore()', () => {

        /**
         * Test: restore fails gracefully when no backup file exists
         * Validates error handling when restore() is called but no backup
         * file has been created yet. This prevents undefined behavior when
         * trying to restore from nothing.
         */
        it('should fail when restoring with no backup file', async () => {
            // Create backup service without creating a backup file
            const cfg = new Config();
            cfg.backup.deleteBackup = false;
            const bs = new BackupService({cfg: cfg} as IDatabaseMigrationHandler);

            // Attempt to restore (should fail with clear error)
            await expect(bs.restore()).to.be.rejectedWith("Cannot open undefined");
        })

        /**
         * Test: restore handles corrupted backup data
         * Validates error handling when the backup file exists but contains
         * corrupted or invalid data that the database handler cannot parse.
         * This prevents silent data corruption during restore operations.
         */
        it('should handle corrupted backup data', async () => {
            // Configure backup service with restore validation
            const cfg = new Config();
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-corrupted-${Date.now()}`;
            let restoredData: string | undefined;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'valid data'
                    },
                    async restore(data: string): Promise<any> {
                        restoredData = data;
                        if (data === 'corrupted') {
                            throw new Error('Failed to parse corrupted backup')
                        }
                        return Promise.resolve('restored')
                    }
                }
            } as IDatabaseMigrationHandler);

            // Create backup and then stub file read to return corrupted data
            await bs.backup();
            const readStub = sinon.stub(fs, 'readFileSync')
                .returns('corrupted' as any);

            // Verify corrupted data error is propagated
            await expect(bs.restore()).to.be.rejectedWith('Failed to parse corrupted backup');

            readStub.restore();
        })

        /**
         * Test: restore handles file read permission errors
         * Validates error handling when the backup file exists but cannot be
         * read due to permission issues. This prevents restore operations from
         * proceeding with undefined/missing data.
         */
        it('should handle file read permission error', async () => {
            // Configure backup service
            const cfg = new Config();
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-perm-test-${Date.now()}`;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'data'
                    },
                    async restore(data: string): Promise<any> {
                        return Promise.resolve('restored')
                    }
                }
            } as IDatabaseMigrationHandler);

            // Create backup successfully
            await bs.backup();

            // Stub file read to throw permission error
            const readStub = sinon.stub(fs, 'readFileSync')
                .throws(new Error('EACCES: permission denied'));

            // Verify the permission error is propagated
            await expect(bs.restore()).to.be.rejectedWith('EACCES: permission denied');

            readStub.restore();
        })

        /**
         * Test: restore logs restoration messages
         * Validates that restoration progress is logged with appropriate messages.
         */
        it('should log restoration messages', async () => {
            // having
            const cfg = new Config();
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-restore-log-${Date.now()}`;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'test data'
                    },
                    async restore(data: string): Promise<any> {
                        return Promise.resolve('restored')
                    }
                }
            } as IDatabaseMigrationHandler);

            // and: create backup first
            await bs.backup();

            // and: spy on console
            const consoleInfoSpy = sinon.spy(console, 'info');

            // when
            await bs.restore();

            // then: should log restore messages
            expect(consoleInfoSpy.calledWith('Restoring from backup...')).to.be.true;
            expect(consoleInfoSpy.calledWith(sinon.match('Restored to the previous state'))).to.be.true;

            consoleInfoSpy.restore();
            bs.deleteBackup();
        })
    })

    describe('deleteBackup()', () => {

        /**
         * Test: deleteBackup respects configuration flag
         * Validates that when deleteBackup is disabled in configuration,
         * calling deleteBackup() does nothing (no-op). This allows users
         * to keep backups around for manual review or rollback.
         */
        it('should not delete backup when deleteBackup is disabled', () => {
            // Configure to disable backup deletion
            const cfg = new Config();
            cfg.backup.deleteBackup = false;
            const bs = new BackupService({cfg: cfg} as IDatabaseMigrationHandler);

            // Call deleteBackup (should be no-op, not throw)
            bs.deleteBackup()
        })

        /**
         * Test: deleteBackup handles file deletion errors
         * Validates error handling when the backup file cannot be deleted due
         * to permission issues or file locks. The error should be propagated
         * to alert the user that cleanup failed.
         */
        it('should handle file deletion error', async () => {
            // Configure backup with deletion enabled
            const cfg = new Config();
            cfg.backup.deleteBackup = true;
            cfg.backup.timestamp = false;
            cfg.backup.suffix = `-delete-test-${Date.now()}`;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'data'
                    }
                }
            } as IDatabaseMigrationHandler, new SilentLogger());

            // Create backup successfully
            await bs.backup();

            // Stub file deletion to throw permission error
            const rmStub = sinon.stub(fs, 'rmSync')
                .throws(new Error('EACCES: permission denied'));

            // Verify the deletion error is thrown
            expect(() => bs.deleteBackup()).to.throw('EACCES: permission denied');

            rmStub.restore();
        })

        /**
         * Test: deleteBackup handles missing backup file gracefully
         * Edge case test validating that calling deleteBackup() when no backup
         * file exists doesn't throw an error. This prevents errors during cleanup
         * when backup creation was skipped or failed.
         */
        it('should handle already deleted file', () => {
            // Configure backup with deletion enabled
            const cfg = new Config();
            cfg.backup.deleteBackup = true;
            const bs = new BackupService({
                cfg: cfg,
                backup: {
                    async backup(): Promise<string> {
                        return 'data'
                    }
                }
            } as IDatabaseMigrationHandler, new SilentLogger());

            // Call deleteBackup without creating a backup first
            bs.deleteBackup();

            // Should complete without throwing (backupFile is undefined, early return)
        })
    })
})