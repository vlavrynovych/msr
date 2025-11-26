import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ChecksumService } from '../../../src';

describe('ChecksumService', () => {
    let tempDir: string;
    let testFilePath: string;

    beforeEach(() => {
        // Create temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'checksum-test-'));
        testFilePath = path.join(tempDir, 'test-file.txt');
    });

    afterEach(() => {
        // Cleanup temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('calculateChecksum()', () => {
        /**
         * Test: calculateChecksum() computes MD5 hash correctly
         * Validates that the service can calculate MD5 checksums
         * for file contents and returns consistent hashes.
         */
        it('should calculate MD5 checksum correctly', () => {
            const content = 'Hello, World!';
            fs.writeFileSync(testFilePath, content);

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'md5');

            // Known MD5 hash for "Hello, World!"
            expect(checksum).to.equal('65a8e27d8879283831b664bd8b7f0ad4');
        });

        /**
         * Test: calculateChecksum() computes SHA256 hash correctly
         * Validates that the service can calculate SHA256 checksums
         * for file contents and returns consistent hashes.
         */
        it('should calculate SHA256 checksum correctly', () => {
            const content = 'Hello, World!';
            fs.writeFileSync(testFilePath, content);

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            // Known SHA256 hash for "Hello, World!"
            expect(checksum).to.equal('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
        });

        /**
         * Test: calculateChecksum() returns same hash for same content
         * Validates that checksums are deterministic - same content
         * always produces the same hash.
         */
        it('should return consistent checksums for same content', () => {
            const content = 'Consistent content';
            fs.writeFileSync(testFilePath, content);

            const checksum1 = ChecksumService.calculateChecksum(testFilePath, 'sha256');
            const checksum2 = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum1).to.equal(checksum2);
        });

        /**
         * Test: calculateChecksum() returns different hashes for different content
         * Validates that even small changes in content produce
         * completely different checksums.
         */
        it('should return different checksums for different content', () => {
            fs.writeFileSync(testFilePath, 'Content A');
            const checksum1 = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            fs.writeFileSync(testFilePath, 'Content B');
            const checksum2 = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum1).to.not.equal(checksum2);
        });

        /**
         * Test: calculateChecksum() handles empty files
         * Validates that the service can compute checksums for
         * empty files without errors.
         */
        it('should handle empty files', () => {
            fs.writeFileSync(testFilePath, '');

            const md5Checksum = ChecksumService.calculateChecksum(testFilePath, 'md5');
            const sha256Checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            // Known hashes for empty content
            expect(md5Checksum).to.equal('d41d8cd98f00b204e9800998ecf8427e');
            expect(sha256Checksum).to.equal('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
        });

        /**
         * Test: calculateChecksum() handles large files
         * Validates that the service can compute checksums for
         * large files without memory issues.
         */
        it('should handle large files', () => {
            // Create a 1MB file
            const largeContent = 'x'.repeat(1024 * 1024);
            fs.writeFileSync(testFilePath, largeContent);

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum).to.be.a('string').with.lengthOf(64); // SHA256 is 64 hex chars
        });

        /**
         * Test: calculateChecksum() handles files with special characters
         * Validates that the service correctly computes checksums for
         * files containing unicode and special characters.
         */
        it('should handle files with special characters', () => {
            const content = '🚀 Hello 世界 \n\t\r Special: äöü ñ';
            fs.writeFileSync(testFilePath, content, 'utf8');

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum).to.be.a('string').with.lengthOf(64);
        });

        /**
         * Test: calculateChecksum() handles binary files
         * Validates that the service can compute checksums for
         * binary file content.
         */
        it('should handle binary files', () => {
            const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
            fs.writeFileSync(testFilePath, binaryContent);

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum).to.be.a('string').with.lengthOf(64);
        });

        /**
         * Test: calculateChecksum() returns lowercase hex string
         * Validates that checksums are returned in lowercase
         * hexadecimal format for consistency.
         */
        it('should return lowercase hex string', () => {
            const content = 'Test Content';
            fs.writeFileSync(testFilePath, content);

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum).to.match(/^[0-9a-f]+$/);
            expect(checksum).to.equal(checksum.toLowerCase());
        });

        /**
         * Test: calculateChecksum() MD5 returns 32 character hash
         * Validates that MD5 checksums are the correct length
         * (128 bits = 32 hex characters).
         */
        it('should return 32 character MD5 hash', () => {
            const content = 'Test';
            fs.writeFileSync(testFilePath, content);

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'md5');

            expect(checksum).to.have.lengthOf(32);
        });

        /**
         * Test: calculateChecksum() SHA256 returns 64 character hash
         * Validates that SHA256 checksums are the correct length
         * (256 bits = 64 hex characters).
         */
        it('should return 64 character SHA256 hash', () => {
            const content = 'Test';
            fs.writeFileSync(testFilePath, content);

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum).to.have.lengthOf(64);
        });

        /**
         * Test: calculateChecksum() throws error for non-existent file
         * Validates that the service throws an appropriate error
         * when trying to compute checksum for a missing file.
         */
        it('should throw error for non-existent file', () => {
            const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');

            expect(() => {
                ChecksumService.calculateChecksum(nonExistentPath, 'sha256');
            }).to.throw();
        });

        /**
         * Test: calculateChecksum() throws error for directory path
         * Validates that the service throws an error when given
         * a directory path instead of a file path.
         */
        it('should throw error for directory path', () => {
            expect(() => {
                ChecksumService.calculateChecksum(tempDir, 'sha256');
            }).to.throw();
        });

        /**
         * Test: calculateChecksum() handles files with no extension
         * Validates that the service can compute checksums for
         * files without file extensions.
         */
        it('should handle files with no extension', () => {
            const noExtPath = path.join(tempDir, 'fileWithoutExtension');
            fs.writeFileSync(noExtPath, 'content');

            const checksum = ChecksumService.calculateChecksum(noExtPath, 'md5');

            expect(checksum).to.be.a('string').with.lengthOf(32);
        });

        /**
         * Test: calculateChecksum() detects file content changes
         * Validates that modifying file content results in
         * a different checksum (integrity check scenario).
         */
        it('should detect file content changes', () => {
            const originalContent = 'Original migration code';
            fs.writeFileSync(testFilePath, originalContent);
            const originalChecksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            // Simulate file modification
            const modifiedContent = 'Modified migration code';
            fs.writeFileSync(testFilePath, modifiedContent);
            const modifiedChecksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(originalChecksum).to.not.equal(modifiedChecksum);
        });

        /**
         * Test: calculateChecksum() is algorithm-specific
         * Validates that MD5 and SHA256 produce different
         * hashes for the same content.
         */
        it('should produce different hashes for different algorithms', () => {
            const content = 'Same content';
            fs.writeFileSync(testFilePath, content);

            const md5Hash = ChecksumService.calculateChecksum(testFilePath, 'md5');
            const sha256Hash = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(md5Hash).to.not.equal(sha256Hash);
            expect(md5Hash).to.have.lengthOf(32);
            expect(sha256Hash).to.have.lengthOf(64);
        });

        /**
         * Test: calculateChecksum() handles newline variations
         * Validates that different line ending styles produce
         * different checksums (important for cross-platform integrity).
         */
        it('should detect different line endings', () => {
            fs.writeFileSync(testFilePath, 'Line 1\nLine 2\n'); // Unix
            const unixChecksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            fs.writeFileSync(testFilePath, 'Line 1\r\nLine 2\r\n'); // Windows
            const windowsChecksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(unixChecksum).to.not.equal(windowsChecksum);
        });

        /**
         * Test: calculateChecksum() handles files with only whitespace
         * Validates that whitespace-only files produce valid checksums.
         */
        it('should handle files with only whitespace', () => {
            fs.writeFileSync(testFilePath, '   \n\t\r\n  ');

            const checksum = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum).to.be.a('string').with.lengthOf(64);
        });

        /**
         * Test: calculateChecksum() performance for multiple calls
         * Validates that the service can handle multiple checksum
         * calculations efficiently.
         */
        it('should handle multiple sequential calculations', () => {
            fs.writeFileSync(testFilePath, 'Test content');

            const checksums: string[] = [];
            for (let i = 0; i < 10; i++) {
                checksums.push(ChecksumService.calculateChecksum(testFilePath, 'sha256'));
            }

            // All checksums should be identical
            expect(new Set(checksums).size).to.equal(1);
        });

        /**
         * Test: calculateChecksum() real-world migration file scenario
         * Validates the service works with actual TypeScript
         * migration file content.
         */
        it('should work with TypeScript migration file content', () => {
            const migrationContent = `
import { IDatabaseMigrationHandler, IMigrationInfo } from 'migration-script-runner';

export default class Migration {
    async up(db: any, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
        await db.query('CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT)');
        return 'Created users table';
    }
}
            `;
            fs.writeFileSync(testFilePath, migrationContent);

            const checksum1 = ChecksumService.calculateChecksum(testFilePath, 'sha256');
            const checksum2 = ChecksumService.calculateChecksum(testFilePath, 'sha256');

            expect(checksum1).to.equal(checksum2);
            expect(checksum1).to.have.lengthOf(64);
        });
    });

    describe('calculateChecksumFromString()', () => {
        /**
         * Test: calculateChecksumFromString() computes checksum from string content
         * Validates that the service can calculate checksums directly from
         * string content without requiring a file.
         */
        it('should calculate checksum from string content', () => {
            const content = 'Hello, World!';

            const md5 = ChecksumService.calculateChecksumFromString(content, 'md5');
            const sha256 = ChecksumService.calculateChecksumFromString(content, 'sha256');

            expect(md5).to.equal('65a8e27d8879283831b664bd8b7f0ad4');
            expect(sha256).to.equal('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
        });
    });
});
