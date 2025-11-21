import { expect } from 'chai';
import { BackupConfig } from '../../../src/index';

describe('BackupConfig', () => {

    /**
     * Test: BackupConfig has correct default values
     * Validates that a new BackupConfig instance is initialized with expected
     * default values. This ensures the backup system works out-of-the-box with
     * sensible defaults.
     */
    it('should have correct default values', () => {
        const config = new BackupConfig();

        // Verify timestamp is enabled by default
        expect(config.timestamp).to.be.true;

        // Verify backup deletion is enabled by default
        expect(config.deleteBackup).to.be.true;

        // Verify folder defaults to backups in current working directory
        expect(config.folder).to.eq(`${process.cwd()}/backups`);

        // Verify filename components have correct defaults
        expect(config.prefix).to.eq('backup');
        expect(config.custom).to.eq('');
        expect(config.suffix).to.eq('');

        // Verify timestamp format defaults to YYYY-MM-DD-HH-mm-ss
        expect(config.timestampFormat).to.eq('YYYY-MM-DD-HH-mm-ss');

        // Verify extension defaults to bkp
        expect(config.extension).to.eq('bkp');
    })

    /**
     * Test: timestamp property can be disabled
     * Validates that timestamp can be set to false, which causes backup
     * filenames to be consistent (allowing overwrites). Useful for single-backup
     * scenarios where old backups should be replaced.
     */
    it('should allow disabling timestamp in filename', () => {
        const config = new BackupConfig();

        // Disable timestamp
        config.timestamp = false;

        // Verify timestamp is disabled
        expect(config.timestamp).to.be.false;
    })

    /**
     * Test: deleteBackup property can be disabled
     * Validates that automatic backup deletion can be disabled. This allows
     * users to keep backups for manual review or external backup management.
     */
    it('should allow disabling automatic backup deletion', () => {
        const config = new BackupConfig();

        // Disable automatic deletion
        config.deleteBackup = false;

        // Verify deletion is disabled
        expect(config.deleteBackup).to.be.false;
    })

    /**
     * Test: folder property can be customized
     * Validates that the backup folder location can be changed to any custom
     * path. Essential for projects with specific directory requirements.
     */
    it('should allow customizing backup folder', () => {
        const config = new BackupConfig();

        // Set custom backup folder
        config.folder = '/custom/backup/location';

        // Verify custom folder is used
        expect(config.folder).to.eq('/custom/backup/location');
    })

    /**
     * Test: folder property handles relative paths
     * Validates that relative paths work correctly for backup folder.
     * Many projects prefer relative paths for portability.
     */
    it('should handle relative backup folder paths', () => {
        const config = new BackupConfig();

        // Set relative path
        config.folder = './data/backups';

        // Verify relative path is preserved
        expect(config.folder).to.eq('./data/backups');
    })

    /**
     * Test: prefix property can be customized
     * Validates that the backup filename prefix can be changed. Useful for
     * organizing backups or following naming conventions.
     */
    it('should allow customizing filename prefix', () => {
        const config = new BackupConfig();

        // Set custom prefix
        config.prefix = 'db-snapshot';

        // Verify custom prefix is used
        expect(config.prefix).to.eq('db-snapshot');
    })

    /**
     * Test: custom property can be set
     * Validates that the custom filename component can be added. This provides
     * flexibility for adding identifiers or metadata to backup filenames.
     */
    it('should allow setting custom filename component', () => {
        const config = new BackupConfig();

        // Set custom component
        config.custom = 'production';

        // Verify custom component is set
        expect(config.custom).to.eq('production');
    })

    /**
     * Test: suffix property can be set
     * Validates that a suffix can be added to backup filenames. Useful for
     * adding additional context or version information.
     */
    it('should allow setting filename suffix', () => {
        const config = new BackupConfig();

        // Set suffix
        config.suffix = '-v2';

        // Verify suffix is set
        expect(config.suffix).to.eq('-v2');
    })

    /**
     * Test: timestampFormat can be customized
     * Validates that the timestamp format string can be changed. Different
     * projects may prefer different timestamp formats (ISO, Unix, custom).
     * Uses moment.js format strings.
     */
    it('should allow customizing timestamp format', () => {
        const config = new BackupConfig();

        // Set custom timestamp format
        config.timestampFormat = 'YYYYMMDD-HHmmss';

        // Verify custom format is used
        expect(config.timestampFormat).to.eq('YYYYMMDD-HHmmss');
    })

    /**
     * Test: timestampFormat accepts various moment.js formats
     * Validates that different moment.js format strings are accepted.
     * This ensures flexibility in timestamp formatting.
     */
    it('should accept various timestamp formats', () => {
        const config = new BackupConfig();

        // Test ISO format
        config.timestampFormat = 'YYYY-MM-DDTHH:mm:ss';
        expect(config.timestampFormat).to.eq('YYYY-MM-DDTHH:mm:ss');

        // Test Unix timestamp
        config.timestampFormat = 'X';
        expect(config.timestampFormat).to.eq('X');

        // Test compact format
        config.timestampFormat = 'YYYYMMDDHHmmss';
        expect(config.timestampFormat).to.eq('YYYYMMDDHHmmss');
    })

    /**
     * Test: extension property can be customized
     * Validates that the backup file extension can be changed. Different
     * backup formats may require different extensions (.sql, .json, .dump, etc.).
     */
    it('should allow customizing file extension', () => {
        const config = new BackupConfig();

        // Set custom extension
        config.extension = 'sql';

        // Verify custom extension is used
        expect(config.extension).to.eq('sql');
    })

    /**
     * Test: extension property handles extensions with dots
     * Edge case test validating that extensions can be specified with or
     * without a leading dot. The consuming code should handle both formats.
     */
    it('should accept extensions with or without dots', () => {
        const config = new BackupConfig();

        // With dot
        config.extension = '.backup';
        expect(config.extension).to.eq('.backup');

        // Without dot
        config.extension = 'backup';
        expect(config.extension).to.eq('backup');
    })

    /**
     * Test: empty string values are accepted for optional fields
     * Validates that prefix, custom, and suffix can be set to empty strings.
     * This is the default for custom and suffix, but users might want to
     * remove the prefix as well.
     */
    it('should accept empty strings for optional filename components', () => {
        const config = new BackupConfig();

        // Set to empty strings
        config.prefix = '';
        config.custom = '';
        config.suffix = '';

        // Verify empty strings are preserved
        expect(config.prefix).to.eq('');
        expect(config.custom).to.eq('');
        expect(config.suffix).to.eq('');
    })

    /**
     * Test: filename components accept special characters
     * Validates that prefix, custom, and suffix accept special characters
     * like hyphens, underscores, and dots. Useful for structured naming.
     */
    it('should accept special characters in filename components', () => {
        const config = new BackupConfig();

        // Set with special characters
        config.prefix = 'my-backup_v1.0';
        config.custom = 'prod-db';
        config.suffix = '-final_2023';

        // Verify special characters are preserved
        expect(config.prefix).to.eq('my-backup_v1.0');
        expect(config.custom).to.eq('prod-db');
        expect(config.suffix).to.eq('-final_2023');
    })

    /**
     * Test: BackupConfig properties are independent across instances
     * Validates that creating multiple BackupConfig instances doesn't share state.
     * This ensures configuration isolation.
     */
    it('should create independent instances', () => {
        const config1 = new BackupConfig();
        const config2 = new BackupConfig();

        // Modify first instance
        config1.prefix = 'backup1';
        config1.timestamp = false;
        config1.extension = 'sql';

        // Modify second instance
        config2.prefix = 'backup2';
        config2.timestamp = true;
        config2.extension = 'json';

        // Verify instances are independent
        expect(config1.prefix).to.eq('backup1');
        expect(config2.prefix).to.eq('backup2');
        expect(config1.timestamp).to.be.false;
        expect(config2.timestamp).to.be.true;
        expect(config1.extension).to.eq('sql');
        expect(config2.extension).to.eq('json');
    })

    /**
     * Test: all properties can be configured together
     * Integration test validating that all BackupConfig properties can be
     * customized simultaneously. This simulates real-world usage where users
     * customize multiple settings at once.
     */
    it('should allow configuring all properties together', () => {
        const config = new BackupConfig();

        // Configure all properties
        config.timestamp = false;
        config.deleteBackup = false;
        config.folder = '/var/backups/app';
        config.prefix = 'db-backup';
        config.custom = 'production';
        config.suffix = '-v1';
        config.timestampFormat = 'YYYYMMDD-HHmmss';
        config.extension = 'sql.gz';

        // Verify all properties are set correctly
        expect(config.timestamp).to.be.false;
        expect(config.deleteBackup).to.be.false;
        expect(config.folder).to.eq('/var/backups/app');
        expect(config.prefix).to.eq('db-backup');
        expect(config.custom).to.eq('production');
        expect(config.suffix).to.eq('-v1');
        expect(config.timestampFormat).to.eq('YYYYMMDD-HHmmss');
        expect(config.extension).to.eq('sql.gz');
    })

    /**
     * Test: folder with trailing slash is preserved
     * Edge case test validating that folder paths with trailing slashes
     * are preserved as-is. The consuming code should handle path normalization.
     */
    it('should preserve trailing slashes in folder paths', () => {
        const config = new BackupConfig();

        // Set folder with trailing slash
        config.folder = '/backups/';

        // Verify trailing slash is preserved
        expect(config.folder).to.eq('/backups/');
    })

    /**
     * Test: Windows-style paths are accepted
     * Cross-platform test validating that Windows-style paths work correctly.
     * Important for ensuring the library works across different operating systems.
     */
    it('should accept Windows-style paths', () => {
        const config = new BackupConfig();

        // Set Windows-style path
        config.folder = 'C:\\backups\\database';

        // Verify Windows path is preserved
        expect(config.folder).to.eq('C:\\backups\\database');
    })
})
