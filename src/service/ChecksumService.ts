import crypto from 'crypto';
import fs from 'fs';

/**
 * Service for calculating file checksums.
 *
 * Used to detect if migration files have been modified after execution.
 */
export class ChecksumService {
    /**
     * Calculate checksum of a file.
     *
     * @param filePath - Absolute path to the file
     * @param algorithm - Hash algorithm ('md5' or 'sha256')
     * @returns Hex-encoded checksum string
     *
     * @throws {Error} If file cannot be read
     *
     * @example
     * ```typescript
     * const checksum = ChecksumService.calculateChecksum('./migration.ts', 'sha256');
     * console.log(checksum); // 'a3c9f8e2b1d4c7e6f5a8b9c0d1e2f3a4...'
     * ```
     */
    public static calculateChecksum(filePath: string, algorithm: 'md5' | 'sha256'): string {
        const fileBuffer = fs.readFileSync(filePath);
        const hash = crypto.createHash(algorithm);
        hash.update(fileBuffer);
        return hash.digest('hex');
    }

    /**
     * Calculate checksum of a string content.
     *
     * @param content - String content to hash
     * @param algorithm - Hash algorithm ('md5' or 'sha256')
     * @returns Hex-encoded checksum string
     *
     * @example
     * ```typescript
     * const checksum = ChecksumService.calculateChecksumFromString('file contents', 'sha256');
     * ```
     */
    public static calculateChecksumFromString(content: string, algorithm: 'md5' | 'sha256'): string {
        const hash = crypto.createHash(algorithm);
        hash.update(content);
        return hash.digest('hex');
    }
}
