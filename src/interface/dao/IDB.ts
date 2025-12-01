/**
 * Base interface for database connections.
 *
 * This is intentionally minimal to support any database system (SQL, NoSQL, etc.).
 * User implementations should extend this with their specific database methods.
 *
 * The index signature allows any additional properties while maintaining type safety
 * for the base interface.
 *
 * @example
 * ```typescript
 * // PostgreSQL implementation with connection check
 * class PostgresDB implements IDB {
 *   constructor(private pool: Pool) {}
 *
 *   async checkConnection(): Promise<boolean> {
 *     try {
 *       await this.pool.query('SELECT 1');
 *       return true;
 *     } catch (error) {
 *       return false;
 *     }
 *   }
 *
 *   async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
 *     const result = await this.pool.query(sql, params);
 *     return result.rows;
 *   }
 * }
 *
 * // MongoDB implementation with connection check
 * class MongoDB implements IDB {
 *   constructor(private client: MongoClient) {}
 *
 *   async checkConnection(): Promise<boolean> {
 *     try {
 *       await this.client.db().admin().ping();
 *       return true;
 *     } catch (error) {
 *       return false;
 *     }
 *   }
 *
 *   collection(name: string): Collection {
 *     return this.client.db().collection(name);
 *   }
 * }
 *
 * // Simple key-value store
 * interface IKeyValueDB extends IDB {
 *   get(key: string): Promise<string | null>;
 *   set(key: string, value: string): Promise<void>;
 * }
 * ```
 */
export interface IDB {
    /**
     * Generic property access for database-specific methods.
     * Allows implementations to add any additional properties while maintaining type safety.
     */
    [key: string]: unknown;

    /**
     * Check if the database connection is healthy and ready for operations.
     *
     * This method is called before migration operations to verify connectivity.
     * This enables fail-fast behavior and provides better error messages when
     * database connections are unavailable.
     *
     * @returns Promise that resolves to true if connection is healthy, false otherwise
     *
     * @throws Should not throw errors - return false instead to indicate connection failure
     *
     * @example
     * ```typescript
     * // PostgreSQL
     * async checkConnection(): Promise<boolean> {
     *   try {
     *     await this.pool.query('SELECT 1');
     *     return true;
     *   } catch (error) {
     *     return false;
     *   }
     * }
     *
     * // MySQL
     * async checkConnection(): Promise<boolean> {
     *   try {
     *     await this.connection.ping();
     *     return true;
     *   } catch (error) {
     *     return false;
     *   }
     * }
     *
     * // MongoDB
     * async checkConnection(): Promise<boolean> {
     *   try {
     *     await this.client.db().admin().ping();
     *     return true;
     *   } catch (error) {
     *     return false;
     *   }
     * }
     *
     * // Simple in-memory database
     * async checkConnection(): Promise<boolean> {
     *   // In-memory databases are always "connected"
     *   return true;
     * }
     * ```
     */
    checkConnection(): Promise<boolean>;
}
