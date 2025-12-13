import { expect } from 'chai';
import AutoEnvParse from 'auto-envparse';

describe('auto-envparse Integration Tests', () => {
    // Store original env vars to restore after tests
    const originalEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        // Save current env vars
        Object.keys(process.env)
            .filter(key => key.startsWith('TEST_'))
            .forEach(key => {
                originalEnv[key] = process.env[key];
                delete process.env[key];
            });
    });

    afterEach(() => {
        // Restore original env vars
        Object.keys(process.env)
            .filter(key => key.startsWith('TEST_'))
            .forEach(key => delete process.env[key]);

        Object.keys(originalEnv).forEach(key => {
            if (originalEnv[key] !== undefined) {
                process.env[key] = originalEnv[key];
            }
        });
    });

    describe('parse() - Standalone automatic parsing', () => {
        it('should parse environment variables into any object', () => {
            const config = {
                host: 'localhost',
                port: 5432,
                ssl: false,
                poolSize: 10
            };

            process.env.TEST_HOST = 'db.example.com';
            process.env.TEST_PORT = '3306';
            process.env.TEST_SSL = 'true';
            process.env.TEST_POOL_SIZE = '20';

            AutoEnvParse.parse(config, { prefix: 'TEST' });

            expect(config.host).to.equal('db.example.com');
            expect(config.port).to.equal(3306);
            expect(config.ssl).to.be.true;
            expect(config.poolSize).to.equal(20);
        });

        it('should work with any custom prefix', () => {
            const dbConfig = {
                database: 'mydb',
                timeout: 5000
            };

            process.env.DB_DATABASE = 'production';
            process.env.DB_TIMEOUT = '10000';

            AutoEnvParse.parse(dbConfig, { prefix: 'DB' });

            expect(dbConfig.database).to.equal('production');
            expect(dbConfig.timeout).to.equal(10000);
        });

        it('should support nested objects', () => {
            const config = {
                connection: {
                    host: 'localhost',
                    port: 5432
                }
            };

            process.env.TEST_CONNECTION_HOST = 'remote.example.com';
            process.env.TEST_CONNECTION_PORT = '3307';

            AutoEnvParse.parse(config, { prefix: 'TEST' });

            expect(config.connection.host).to.equal('remote.example.com');
            expect(config.connection.port).to.equal(3307);
        });

        it('should support custom overrides', () => {
            const config = {
                port: 5432,
                retries: 3
            };

            const overrides = new Map();
            overrides.set('port', (obj: typeof config, envVar: string) => {
                const value = process.env[envVar];
                if (value) {
                    const port = parseInt(value, 10);
                    if (port >= 1 && port <= 65535) {
                        obj.port = port;
                    } else {
                        console.warn(`Invalid port ${port}`);
                    }
                }
            });

            // Valid port
            process.env.TEST_PORT = '8080';
            process.env.TEST_RETRIES = '5';

            AutoEnvParse.parse(config, { prefix: 'TEST', overrides });

            expect(config.port).to.equal(8080);
            expect(config.retries).to.equal(5);

            // Invalid port (out of range) - should keep original
            process.env.TEST_PORT = '99999';
            const config2 = { port: 5432, retries: 3 };
            AutoEnvParse.parse(config2, { prefix: 'TEST', overrides });

            expect(config2.port).to.equal(5432);
        });

        it('should handle null and undefined values', () => {
            const config = {
                optional: null as string | null,
                unset: undefined as string | undefined,
                value: 'test'
            };

            process.env.TEST_OPTIONAL = 'from-env';
            process.env.TEST_UNSET = 'also-from-env';

            AutoEnvParse.parse(config, { prefix: 'TEST' });

            expect(config.optional).to.equal('from-env');
            expect(config.unset).to.equal('also-from-env');
            expect(config.value).to.equal('test');
        });

        it('should skip inherited properties from prototype', () => {
            process.env.TEST_INHERITED = 'from-env';
            process.env.TEST_OWN = 'own-value';

            // Create object with prototype property
            const protoObject = { inherited: 'proto-value' };
            const config = Object.create(protoObject) as { inherited: string; own: string };
            config.own = 'default';

            AutoEnvParse.parse(config, { prefix: 'TEST' });

            // Own property should be updated
            expect(config.own).to.equal('own-value');
            // Inherited property should NOT be in result
            expect(config.hasOwnProperty('inherited')).to.be.false;
        });

        it('should handle non-RegExp arrays', () => {
            const config = {
                tags: ['default1', 'default2'],
                numbers: [1, 2, 3]
            };

            process.env.TEST_TAGS = '["tag1", "tag2", "tag3"]';
            process.env.TEST_NUMBERS = '[10, 20, 30]';

            AutoEnvParse.parse(config, { prefix: 'TEST' });

            expect(config.tags).to.deep.equal(['tag1', 'tag2', 'tag3']);
            expect(config.numbers).to.deep.equal([10, 20, 30]);
        });

        it('should handle objects with inherited properties in nested structures', () => {
            // Create nested object with prototype
            const protoObject = { inherited: 'proto' };
            const nested = Object.create(protoObject) as { inherited: string; value: number };
            nested.value = 100;

            const config = {
                nested: nested
            };

            process.env.TEST_NESTED_VALUE = '200';
            process.env.TEST_NESTED_INHERITED = 'should-not-apply';

            AutoEnvParse.parse(config, { prefix: 'TEST' });

            // Own property should be updated
            expect(config.nested.value).to.equal(200);
            // Inherited property should not be modified
            expect(config.nested.hasOwnProperty('inherited')).to.be.false;
        });

        it('should skip inherited properties in complex objects', () => {
            // Create a complex object (class instance) with prototype
            class ComplexConfig {
                value: number = 100;
            }
            const protoObject = { inherited: 'proto' };
            Object.setPrototypeOf(ComplexConfig.prototype, protoObject);

            const complexInstance = new ComplexConfig();
            const config = {
                complex: complexInstance
            };

            process.env.TEST_COMPLEX_VALUE = '200';
            process.env.TEST_COMPLEX_INHERITED = 'should-not-apply';

            AutoEnvParse.parse(config, { prefix: 'TEST' });

            // Own property should be updated
            expect(config.complex.value).to.equal(200);
            // Inherited property should not be on instance
            expect(config.complex.hasOwnProperty('inherited')).to.be.false;
        });
    });

    describe('Real-world usage examples', () => {
        it('should work for database configuration', () => {
            const dbConfig = {
                host: 'localhost',
                port: 5432,
                database: 'mydb',
                user: 'postgres',
                password: '',
                ssl: false,
                pool: {
                    min: 2,
                    max: 10
                }
            };

            process.env.DB_HOST = 'prod-db.example.com';
            process.env.DB_PORT = '5433';
            process.env.DB_DATABASE = 'production';
            process.env.DB_USER = 'app_user';
            process.env.DB_PASSWORD = 'secret123';
            process.env.DB_SSL = 'true';
            process.env.DB_POOL_MIN = '5';
            process.env.DB_POOL_MAX = '50';

            AutoEnvParse.parse(dbConfig, { prefix: 'DB' });

            expect(dbConfig.host).to.equal('prod-db.example.com');
            expect(dbConfig.port).to.equal(5433);
            expect(dbConfig.database).to.equal('production');
            expect(dbConfig.user).to.equal('app_user');
            expect(dbConfig.password).to.equal('secret123');
            expect(dbConfig.ssl).to.be.true;
            expect(dbConfig.pool.min).to.equal(5);
            expect(dbConfig.pool.max).to.equal(50);
        });

        it('should work for application configuration', () => {
            const appConfig = {
                port: 3000,
                host: '0.0.0.0',
                debug: false,
                cors: {
                    enabled: true,
                    origin: '*'
                },
                rateLimit: {
                    windowMs: 900000,
                    max: 100
                }
            };

            process.env.APP_PORT = '8080';
            process.env.APP_DEBUG = 'true';
            process.env.APP_CORS_ORIGIN = 'https://example.com';
            process.env.APP_RATE_LIMIT_MAX = '1000';

            AutoEnvParse.parse(appConfig, { prefix: 'APP' });

            expect(appConfig.port).to.equal(8080);
            expect(appConfig.debug).to.be.true;
            expect(appConfig.cors.origin).to.equal('https://example.com');
            expect(appConfig.rateLimit.max).to.equal(1000);
        });
    });
});
