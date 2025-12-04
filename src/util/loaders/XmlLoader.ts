import * as path from 'path';
import * as fs from 'fs';
import { IConfigFileLoader } from '../../interface/IConfigFileLoader';

/**
 * Loader for XML configuration files.
 *
 * Supports:
 * - `.xml` files
 *
 * **Requires optional peer dependency:** `fast-xml-parser`
 *
 * Install with: `npm install fast-xml-parser`
 *
 * **Expected XML Structure:**
 * ```xml
 * <msr>
 *   <folder>./migrations</folder>
 *   <tableName>schema_version</tableName>
 *   <transaction>
 *     <mode>PER_MIGRATION</mode>
 *     <retries>3</retries>
 *   </transaction>
 * </msr>
 * ```
 *
 * @example
 * ```typescript
 * const loader = new XmlLoader();
 *
 * if (loader.isAvailable()) {
 *     const config = loader.load('msr.config.xml');
 * } else {
 *     console.error('fast-xml-parser not installed');
 * }
 * ```
 */
export class XmlLoader implements IConfigFileLoader {
    readonly supportedExtensions = ['.xml'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly xmlModule: any = null;
    private readonly loadError: Error | null = null;

    constructor() {
        try {
            // Try to load fast-xml-parser (optional peer dependency)
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            this.xmlModule = require('fast-xml-parser');
        } catch (error) {
            // Ensure error has a meaningful message for reporting
            if (error instanceof Error) {
                this.loadError = error;
            } else {
                this.loadError = new Error('Unknown error');
            }
        }
    }

    /**
     * Check if fast-xml-parser is available.
     *
     * @returns True if fast-xml-parser is installed, false otherwise
     *
     * @example
     * ```typescript
     * const loader = new XmlLoader();
     * if (!loader.isAvailable()) {
     *     console.log('Install fast-xml-parser: npm install fast-xml-parser');
     * }
     * ```
     */
    isAvailable(): boolean {
        return this.xmlModule !== null;
    }

    /**
     * Check if this loader can handle the given file.
     *
     * @param filePath - Path to the configuration file
     * @returns True if file has .xml extension
     */
    canLoad(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ext === '.xml';
    }

    /**
     * Load and parse XML configuration file.
     *
     * The XML file should have a root element (typically `<msr>`), and the
     * configuration properties should be nested inside.
     *
     * @param filePath - Path to the configuration file
     * @returns Parsed configuration object
     * @throws Error if fast-xml-parser is not installed, file cannot be read, or XML is invalid
     *
     * @example
     * ```typescript
     * const loader = new XmlLoader();
     *
     * try {
     *     const config = loader.load<Partial<Config>>('msr.config.xml');
     *     console.log('Folder:', config.folder);
     * } catch (error) {
     *     console.error('Load failed:', error.message);
     * }
     * ```
     */
    load<T = unknown>(filePath: string): T {
        if (!this.isAvailable()) {
            // loadError is guaranteed to be Error (never null when !isAvailable)
            // and Error.message always exists
            const errorMessage = this.loadError?.message || 'Module not available';
            throw new Error(
                `Cannot load XML file ${filePath}: fast-xml-parser is not installed.\n` +
                `Install it with: npm install fast-xml-parser\n` +
                `Original error: ${errorMessage}`
            );
        }

        try {
            const resolvedPath = path.resolve(filePath);
            const content = fs.readFileSync(resolvedPath, 'utf8');

            // Parse XML content with options to preserve structure
            const parser = new this.xmlModule!.XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                parseAttributeValue: true,
                parseTagValue: true,
                trimValues: true,
                removeNSPrefix: true
            });

            const parsed = parser.parse(content);

            if (parsed === null || parsed === undefined) {
                throw new Error('XML file is empty or contains only null/undefined');
            }

            if (typeof parsed !== 'object') {
                throw new Error(`Expected XML file to contain an object, got ${typeof parsed}`);
            }

            // Extract the root element's content (typically <msr>...</msr>)
            // If there's a single root element, unwrap it
            const keys = Object.keys(parsed);
            if (keys.length === 1 && keys[0] !== 'msr') {
                // Single root element that's not 'msr' - unwrap it
                return parsed[keys[0]] as T;
            } else if (keys.length === 1 && keys[0] === 'msr') {
                // Root element is 'msr' - unwrap it
                return parsed.msr as T;
            }

            // Multiple root elements or no wrapping - return as-is
            return parsed as T;
        } catch (error) {
            // Don't double-wrap our own error messages
            if (error instanceof Error && error.message.startsWith('Cannot load XML file')) {
                throw error;
            }

            // Format error message with fallback for non-Error exceptions
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to load configuration from ${filePath}: ${errorMessage}`);
        }
    }
}
