import { expect } from 'chai';
import { SqlLoader, MigrationScript, SilentLogger, IDB, IMigrationInfo, IDatabaseMigrationHandler } from '../../../src';
import path from 'path';

describe('SqlLoader', () => {
    let loader: SqlLoader;
    const fixturesPath = path.join(process.cwd(), 'test', 'fixtures', 'migrations-sql');

    beforeEach(() => {
        loader = new SqlLoader(new SilentLogger());
    });

    describe('getName()', () => {
        it('should return "SqlLoader"', () => {
            expect(loader.getName()).to.equal('SqlLoader');
        });
    });

    describe('canHandle()', () => {
        it('should handle .up.sql files', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.up.sql')).to.be.true;
        });

        it('should handle uppercase .UP.SQL', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.UP.SQL')).to.be.true;
        });

        it('should not handle .down.sql files directly', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.down.sql')).to.be.false;
        });

        it('should not handle .sql files without .up suffix', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.sql')).to.be.false;
        });

        it('should not handle .ts files', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.ts')).to.be.false;
        });

        it('should not handle .js files', () => {
            expect(loader.canHandle('/path/to/V202501220100_test.js')).to.be.false;
        });
    });

    describe('load()', () => {
        it('should load SQL file with up and down', async () => {
            const script = new MigrationScript(
                'V202501220100_create_users.up.sql',
                path.join(fixturesPath, 'V202501220100_create_users.up.sql'),
                202501220100
            );

            const runnable = await loader.load(script);

            expect(runnable).to.exist;
            expect(typeof runnable.up).to.equal('function');
            expect(typeof runnable.down).to.equal('function');
        });

        it('should load SQL file without down', async () => {
            const script = new MigrationScript(
                'V202501220200_no_down.up.sql',
                path.join(fixturesPath, 'V202501220200_no_down.up.sql'),
                202501220200
            );

            const runnable = await loader.load(script);

            expect(runnable).to.exist;
            expect(typeof runnable.up).to.equal('function');
            expect(typeof runnable.down).to.equal('function');
        });

        it('should execute up() successfully with valid db.query', async () => {
            const script = new MigrationScript(
                'V202501220100_create_users.up.sql',
                path.join(fixturesPath, 'V202501220100_create_users.up.sql'),
                202501220100
            );

            const runnable = await loader.load(script);

            const db = {
                query: async (sql: string) => {
                    expect(sql).to.include('CREATE TABLE users');
                    return [];
                }
            } as IDB;

            const result = await runnable.up(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);

            expect(result).to.include('Executed SQL migration');
            expect(result).to.include('lines');
        });

        it('should execute down() successfully with valid db.query', async () => {
            const script = new MigrationScript(
                'V202501220100_create_users.up.sql',
                path.join(fixturesPath, 'V202501220100_create_users.up.sql'),
                202501220100
            );

            const runnable = await loader.load(script);

            const db = {
                query: async (sql: string) => {
                    expect(sql).to.include('DROP TABLE');
                    return [];
                }
            } as IDB;

            const result = await runnable.down!(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);

            expect(result).to.include('Rolled back SQL migration');
            expect(result).to.include('lines');
        });

        it('should throw error when db.query is not available', async () => {
            const script = new MigrationScript(
                'V202501220100_create_users.up.sql',
                path.join(fixturesPath, 'V202501220100_create_users.up.sql'),
                202501220100
            );

            const runnable = await loader.load(script);

            const db = {} as IDB; // No query method
            const handler = { getName: () => 'TestHandler' } as IDatabaseMigrationHandler;

            try {
                await runnable.up(db, {} as IMigrationInfo, handler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('SQL migrations require');
                expect((error as Error).message).to.include('ISqlDB interface');
            }
        });

        it('should throw error when calling down() without .down.sql file', async () => {
            const script = new MigrationScript(
                'V202501220200_no_down.up.sql',
                path.join(fixturesPath, 'V202501220200_no_down.up.sql'),
                202501220200
            );

            const runnable = await loader.load(script);

            const db = {
                query: async () => []
            } as IDB;

            try {
                await runnable.down!(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('No down() SQL file found');
                expect((error as Error).message).to.include('.down.sql');
            }
        });

        it('should throw error for non-existent SQL file', async () => {
            const script = new MigrationScript(
                'V999999999999_nonexistent.up.sql',
                path.join(fixturesPath, 'V999999999999_nonexistent.up.sql'),
                999999999999
            );

            try {
                await loader.load(script);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('SQL file not found');
            }
        });

        it('should throw error when SQL execution fails with short SQL', async () => {
            const script = new MigrationScript(
                'V202501220500_short.up.sql',
                path.join(fixturesPath, 'V202501220500_short.up.sql'),
                202501220500
            );

            const runnable = await loader.load(script);

            const db = {
                query: async () => {
                    throw new Error('SQL syntax error');
                }
            } as IDB;

            try {
                await runnable.up(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('SQL migration failed');
                expect((error as Error).message).to.include('SQL syntax error');
                expect((error as Error).message).to.include('SQL Preview:');
                // Short SQL should NOT have truncation
                expect((error as Error).message).to.not.include('...');
            }
        });

        it('should throw error when SQL rollback execution fails with short SQL', async () => {
            const script = new MigrationScript(
                'V202501220500_short.up.sql',
                path.join(fixturesPath, 'V202501220500_short.up.sql'),
                202501220500
            );

            const runnable = await loader.load(script);

            const db = {
                query: async () => {
                    throw new Error('Rollback failed: table not found');
                }
            } as IDB;

            try {
                await runnable.down!(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('SQL rollback failed');
                expect((error as Error).message).to.include('Rollback failed');
                expect((error as Error).message).to.include('SQL Preview:');
                // Short SQL should NOT have truncation
                expect((error as Error).message).to.not.include('...');
            }
        });

        it('should throw error for empty SQL file', async () => {
            const script = new MigrationScript(
                'V202501220300_empty.up.sql',
                path.join(fixturesPath, 'V202501220300_empty.up.sql'),
                202501220300
            );

            const runnable = await loader.load(script);

            const db = {
                query: async () => []
            } as IDB;

            try {
                await runnable.up(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('Empty up() SQL content');
            }
        });

        it('should throw error when down() db.query is not available', async () => {
            const script = new MigrationScript(
                'V202501220100_create_users.up.sql',
                path.join(fixturesPath, 'V202501220100_create_users.up.sql'),
                202501220100
            );

            const runnable = await loader.load(script);

            const db = {} as IDB; // No query method
            const handler = { getName: () => 'TestHandler' } as IDatabaseMigrationHandler;

            try {
                await runnable.down!(db, {} as IMigrationInfo, handler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('SQL migrations require');
                expect((error as Error).message).to.include('ISqlDB interface');
            }
        });

        it('should trim whitespace from SQL content', async () => {
            const script = new MigrationScript(
                'V202501220100_create_users.up.sql',
                path.join(fixturesPath, 'V202501220100_create_users.up.sql'),
                202501220100
            );

            const runnable = await loader.load(script);

            let capturedSql = '';
            const db = {
                query: async (sql: string) => {
                    capturedSql = sql;
                    return [];
                }
            } as IDB;

            await runnable.up(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);

            // Should not have leading/trailing whitespace
            expect(capturedSql).to.equal(capturedSql.trim());
            // Should start with a comment or CREATE
            expect(capturedSql.startsWith('--') || capturedSql.startsWith('CREATE')).to.be.true;
        });

        it('should truncate long SQL content in error preview for up()', async () => {
            const script = new MigrationScript(
                'V202501220400_long_sql.up.sql',
                path.join(fixturesPath, 'V202501220400_long_sql.up.sql'),
                202501220400
            );

            const runnable = await loader.load(script);

            const db = {
                query: async () => {
                    throw new Error('SQL execution failed');
                }
            } as IDB;

            try {
                await runnable.up(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('SQL migration failed');
                expect((error as Error).message).to.include('SQL Preview:');
                // Should include truncation indicator if SQL is long
                expect((error as Error).message).to.include('...');
            }
        });

        it('should truncate long SQL content in error preview for down()', async () => {
            const script = new MigrationScript(
                'V202501220400_long_sql.up.sql',
                path.join(fixturesPath, 'V202501220400_long_sql.up.sql'),
                202501220400
            );

            const runnable = await loader.load(script);

            const db = {
                query: async () => {
                    throw new Error('Rollback execution failed');
                }
            } as IDB;

            try {
                await runnable.down!(db, {} as IMigrationInfo, {} as IDatabaseMigrationHandler);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect((error as Error).message).to.include('SQL rollback failed');
                expect((error as Error).message).to.include('SQL Preview:');
                // Should include truncation indicator if SQL is long
                expect((error as Error).message).to.include('...');
            }
        });
    });
});
