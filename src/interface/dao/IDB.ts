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
 * // PostgreSQL implementation
 * interface IPostgresDB extends IDB {
 *   query<T>(sql: string, params?: unknown[]): Promise<T[]>;
 *   transaction(callback: (client: IPostgresDB) => Promise<void>): Promise<void>;
 * }
 *
 * // MongoDB implementation
 * interface IMongoDBConnection extends IDB {
 *   collection(name: string): Collection;
 *   startSession(): ClientSession;
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
}