import { IDB } from './IDB';

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
 *   async checkConnection(): Promise<boolean> {
 *     try {
 *       await this.pool.query('SELECT 1');
 *       return true;
 *     } catch {
 *       return false;
 *     }
 *   }
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
 *   async checkConnection(): Promise<boolean> {
 *     try {
 *       await this.connection.ping();
 *       return true;
 *     } catch {
 *       return false;
 *     }
 *   }
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
 *   getName: () => 'PostgresHandler',
 *   getVersion: () => '1.0.0'
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
