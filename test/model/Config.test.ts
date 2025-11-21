import { expect } from 'chai';
import { Config, BackupConfig } from '../../src/index';

describe('Config', () => {

    /**
     * Test: Config has correct default values
     * Validates that a new Config instance is initialized with expected
     * default values for all properties. This ensures backward compatibility
     * and sensible defaults for users who don't customize configuration.
     */
    it('should have correct default values', () => {
        const config = new Config();

        // Verify file pattern defaults to V{12 digits}_ format
        expect(config.filePattern).to.be.instanceOf(RegExp);
        expect(config.filePattern.toString()).to.eq('/^V(\\d{12})_/');

        // Verify folder defaults to migrations in current working directory
        expect(config.folder).to.eq(`${process.cwd()}/migrations`);

        // Verify table name defaults to schema_version
        expect(config.tableName).to.eq('schema_version');

        // Verify backup config is initialized
        expect(config.backup).to.be.instanceOf(BackupConfig);

        // Verify displayLimit defaults to 0 (show all)
        expect(config.displayLimit).to.eq(0);
    })

    /**
     * Test: filePattern regex matches valid migration filenames
     * Validates that the default file pattern correctly matches migration
     * files with the V{timestamp}_{name} format. This is critical for
     * the migration discovery process.
     */
    it('should match valid migration filenames with filePattern', () => {
        const config = new Config();

        // Test valid migration filenames
        expect(config.filePattern.test('V202311020036_test.ts')).to.be.true;
        expect(config.filePattern.test('V999999999999_migration.ts')).to.be.true;
        expect(config.filePattern.test('V000000000001_init.ts')).to.be.true;

        // Verify pattern extracts timestamp correctly
        const match = config.filePattern.exec('V202311020036_test.ts');
        expect(match).to.not.be.null;
        expect(match![1]).to.eq('202311020036');
    })

    /**
     * Test: filePattern regex rejects invalid filenames
     * Validates that the file pattern correctly rejects filenames that don't
     * match the expected format. This prevents incorrect files from being
     * processed as migrations.
     */
    it('should reject invalid migration filenames with filePattern', () => {
        const config = new Config();

        // Test invalid formats
        expect(config.filePattern.test('invalid.ts')).to.be.false;
        expect(config.filePattern.test('V123_too_short.ts')).to.be.false;
        expect(config.filePattern.test('V12345678901234_too_long.ts')).to.be.false;
        expect(config.filePattern.test('202311020036_no_v_prefix.ts')).to.be.false;
        expect(config.filePattern.test('v202311020036_lowercase.ts')).to.be.false;
        expect(config.filePattern.test('VabcdefghijKL_letters.ts')).to.be.false;
    })

    /**
     * Test: filePattern can be customized
     * Validates that the filePattern property can be overridden with a custom
     * regex. This allows users to implement their own migration naming conventions
     * while maintaining compatibility with the migration system.
     */
    it('should allow customizing filePattern', () => {
        const config = new Config();

        // Customize to use different prefix and timestamp format
        config.filePattern = /^MIGRATION_(\d{10})_/;

        // Verify custom pattern works
        expect(config.filePattern.test('MIGRATION_1234567890_test.ts')).to.be.true;
        expect(config.filePattern.test('V202311020036_test.ts')).to.be.false;

        const match = config.filePattern.exec('MIGRATION_1234567890_test.ts');
        expect(match![1]).to.eq('1234567890');
    })

    /**
     * Test: folder property can be customized
     * Validates that the folder path can be set to a custom location.
     * This is essential for projects with custom directory structures.
     */
    it('should allow customizing folder path', () => {
        const config = new Config();

        // Set custom folder
        config.folder = '/custom/path/to/migrations';

        // Verify custom folder is used
        expect(config.folder).to.eq('/custom/path/to/migrations');
    })

    /**
     * Test: folder property handles relative paths
     * Validates that relative paths work correctly for the folder property.
     * Many projects use relative paths in their configuration.
     */
    it('should handle relative folder paths', () => {
        const config = new Config();

        // Set relative path
        config.folder = './database/migrations';

        // Verify relative path is preserved
        expect(config.folder).to.eq('./database/migrations');
    })

    /**
     * Test: tableName property can be customized
     * Validates that the schema version table name can be changed.
     * This is important for projects with naming conventions or multiple
     * migration systems in the same database.
     */
    it('should allow customizing tableName', () => {
        const config = new Config();

        // Set custom table name
        config.tableName = 'custom_migrations_table';

        // Verify custom table name is used
        expect(config.tableName).to.eq('custom_migrations_table');
    })

    /**
     * Test: tableName accepts special characters
     * Edge case test validating that table names with underscores, hyphens,
     * and other special characters are accepted. Different databases have
     * different naming restrictions.
     */
    it('should accept tableName with special characters', () => {
        const config = new Config();

        // Test various special characters
        config.tableName = 'my_schema_version';
        expect(config.tableName).to.eq('my_schema_version');

        config.tableName = 'schema-version-2';
        expect(config.tableName).to.eq('schema-version-2');

        config.tableName = 'schema.version';
        expect(config.tableName).to.eq('schema.version');
    })

    /**
     * Test: backup property returns BackupConfig instance
     * Validates that the backup property is properly initialized with a
     * BackupConfig instance. This ensures backup functionality is available
     * by default.
     */
    it('should initialize backup property with BackupConfig instance', () => {
        const config = new Config();

        // Verify backup is BackupConfig instance
        expect(config.backup).to.be.instanceOf(BackupConfig);
        expect(config.backup.timestamp).to.be.true;
        expect(config.backup.deleteBackup).to.be.true;
    })

    /**
     * Test: backup property can be replaced with custom BackupConfig
     * Validates that the backup configuration can be completely replaced.
     * This allows users to customize backup behavior while maintaining
     * type safety.
     */
    it('should allow replacing backup with custom BackupConfig', () => {
        const config = new Config();
        const customBackup = new BackupConfig();
        customBackup.timestamp = false;
        customBackup.folder = '/custom/backups';

        // Replace backup config
        config.backup = customBackup;

        // Verify custom backup is used
        expect(config.backup.timestamp).to.be.false;
        expect(config.backup.folder).to.eq('/custom/backups');
    })

    /**
     * Test: displayLimit defaults to 0 (show all migrations)
     * Validates that the default displayLimit of 0 means "show all migrations"
     * rather than "show none". This is the expected user-friendly default.
     */
    it('should default displayLimit to 0 (show all)', () => {
        const config = new Config();

        // Verify default is 0
        expect(config.displayLimit).to.eq(0);
    })

    /**
     * Test: displayLimit can be set to positive numbers
     * Validates that displayLimit accepts positive integers to limit the
     * number of migrations shown in console output. Useful for projects
     * with many migrations.
     */
    it('should allow setting displayLimit to positive numbers', () => {
        const config = new Config();

        // Set to limit display to 10 most recent
        config.displayLimit = 10;
        expect(config.displayLimit).to.eq(10);

        // Set to limit display to 1
        config.displayLimit = 1;
        expect(config.displayLimit).to.eq(1);

        // Set to large number
        config.displayLimit = 1000;
        expect(config.displayLimit).to.eq(1000);
    })

    /**
     * Test: displayLimit accepts negative numbers (implementation dependent)
     * Edge case test to verify behavior with negative displayLimit values.
     * While not recommended, the property doesn't enforce validation, so
     * it's up to the consuming code to handle this.
     */
    it('should accept negative displayLimit values', () => {
        const config = new Config();

        // Set to negative (likely treated as 0 or ignored by consuming code)
        config.displayLimit = -5;
        expect(config.displayLimit).to.eq(-5);
    })

    /**
     * Test: Config properties are independent across instances
     * Validates that creating multiple Config instances doesn't share state.
     * This ensures configuration isolation between different uses of the library.
     */
    it('should create independent instances', () => {
        const config1 = new Config();
        const config2 = new Config();

        // Modify first instance
        config1.tableName = 'custom_table_1';
        config1.displayLimit = 5;
        config1.folder = '/path/1';

        // Modify second instance
        config2.tableName = 'custom_table_2';
        config2.displayLimit = 10;
        config2.folder = '/path/2';

        // Verify instances are independent
        expect(config1.tableName).to.eq('custom_table_1');
        expect(config2.tableName).to.eq('custom_table_2');
        expect(config1.displayLimit).to.eq(5);
        expect(config2.displayLimit).to.eq(10);
        expect(config1.folder).to.eq('/path/1');
        expect(config2.folder).to.eq('/path/2');
    })

    /**
     * Test: Config properties can be chained
     * Validates that Config properties can be set in a fluent/chained manner.
     * While not enforced by the class, this tests that property assignment
     * works as expected in various usage patterns.
     */
    it('should allow chained property assignment', () => {
        const config = new Config();

        // Set multiple properties
        config.tableName = 'test_table';
        config.displayLimit = 20;
        config.folder = '/test/path';

        // Verify all properties were set
        expect(config.tableName).to.eq('test_table');
        expect(config.displayLimit).to.eq(20);
        expect(config.folder).to.eq('/test/path');
    })
})
