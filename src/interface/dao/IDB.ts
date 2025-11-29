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

/**
 * Interface for SQL database connections that support SQL migration files.
 *
 * Extends IDB with a required query() method for executing SQL statements.
 * Use this interface when implementing database handlers that will run SQL migrations.
 *
 * @example
 * ```typescript
 * // PostgreSQL implementation
 * class PostgresConnection implements ISqlDB {
 *   constructor(private pool: Pool) {}
 *
 *   async query(sql: string): Promise<unknown> {
 *     const result = await this.pool.query(sql);
 *     return result.rows;
 *   }
 * }
 *
 * // MySQL implementation
 * class MySQLConnection implements ISqlDB {
 *   constructor(private connection: Connection) {}
 *
 *   async query(sql: string): Promise<unknown> {
 *     const [rows] = await this.connection.execute(sql);
 *     return rows;
 *   }
 * }
 *
 * // Usage with handler
 * const handler: IDatabaseMigrationHandler = {
 *   db: new PostgresConnection(pool),
 *   schemaVersion: schemaVersionImpl,
 *   getName: () => 'PostgresHandler'
 * };
 * ```
 */
export interface ISqlDB extends IDB {
    /**
     * Execute a SQL statement and return the result.
     *
     * @param sql - The SQL statement to execute (can be multi-statement)
     * @returns Promise that resolves with query results (implementation-specific)
     *
     * @example
     * ```typescript
     * // Single statement
     * await db.query('CREATE TABLE users (id INT, name TEXT)');
     *
     * // Multiple statements (if database supports it)
     * await db.query(`
     *   CREATE TABLE users (id INT, name TEXT);
     *   CREATE INDEX idx_users_name ON users(name);
     * `);
     * ```
     */
    query(sql: string): Promise<unknown>;
}