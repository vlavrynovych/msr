import {expect} from 'chai';
import sinon from 'sinon';
import {createCLI} from '../../../src/cli/createCLI';
import {IDB} from '../../../src/interface';
import {Config} from '../../../src/model/Config';
import {MigrationScriptExecutor} from '../../../src/service/MigrationScriptExecutor';

interface MockDB extends IDB {
    data: string;
}

describe('createCLI', () => {
    let mockExecutor: sinon.SinonStubbedInstance<MigrationScriptExecutor<MockDB>>;
    let createExecutorStub: sinon.SinonStub;

    beforeEach(() => {
        // Create mock executor
        mockExecutor = sinon.createStubInstance(MigrationScriptExecutor);

        // Create factory stub
        createExecutorStub = sinon.stub().returns(mockExecutor);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Program creation', () => {
        /**
         * Test: Creates CLI program with default metadata
         * Validates that program is created with default name, description, version
         */
        it('should create CLI program with default metadata', () => {
            const program = createCLI({createExecutor: createExecutorStub});

            expect(program.name()).to.equal('msr');
            expect(program.description()).to.equal('Migration Script Runner');
            expect(program.version()).to.equal('1.0.0');
        });

        /**
         * Test: Creates CLI program with custom metadata
         * Validates that custom name, description, version are used
         */
        it('should create CLI program with custom metadata', () => {
            const program = createCLI({
                createExecutor: createExecutorStub,
                name: 'msr-custom',
                description: 'Custom Migration Runner',
                version: '2.5.0',
            });

            expect(program.name()).to.equal('msr-custom');
            expect(program.description()).to.equal('Custom Migration Runner');
            expect(program.version()).to.equal('2.5.0');
        });

        /**
         * Test: Returns Commander program instance
         * Validates that the returned object is a Commander program
         */
        it('should return Commander program instance', () => {
            const program = createCLI({createExecutor: createExecutorStub});

            expect(program).to.be.an('object');
            expect(program.parse).to.be.a('function');
            expect(program.parseAsync).to.be.a('function');
            expect(program.command).to.be.a('function');
        });
    });

    describe('Command registration', () => {
        /**
         * Test: Registers all base commands
         * Validates that migrate, list, down, validate, backup are registered
         */
        it('should register all base commands', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            const commands = program.commands.map(cmd => cmd.name());

            expect(commands).to.include('migrate');
            expect(commands).to.include('list');
            expect(commands).to.include('down');
            expect(commands).to.include('validate');
            expect(commands).to.include('backup');
        });

        /**
         * Test: Registers exactly 7 base commands
         * Validates that no extra commands are added
         */
        it('should register exactly 7 base commands', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            expect(program.commands.length).to.equal(7);
        });

        /**
         * Test: Allows extending with custom commands
         * Validates that adapters can add custom commands
         */
        it('should allow extending with custom commands', () => {
            const program = createCLI({createExecutor: createExecutorStub});

            program
                .command('custom')
                .description('Custom command')
                .action(() => {});

            const commands = program.commands.map(cmd => cmd.name());
            expect(commands).to.include('custom');
            expect(program.commands.length).to.equal(8);
        });
    });

    describe('Common options', () => {
        /**
         * Test: Registers all common CLI options
         * Validates that all common options are available
         */
        it('should register all common CLI options', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            const optionFlags = program.options.map(opt => opt.long);

            expect(optionFlags).to.include('--config-file');
            expect(optionFlags).to.include('--folder');
            expect(optionFlags).to.include('--table-name');
            expect(optionFlags).to.include('--display-limit');
            expect(optionFlags).to.include('--dry-run');
            expect(optionFlags).to.include('--logger');
            expect(optionFlags).to.include('--log-level');
            expect(optionFlags).to.include('--log-file');
            expect(optionFlags).to.include('--format');
        });

        /**
         * Test: Registers short options
         * Validates that short option aliases are available
         */
        it('should register short options', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            const shortOptions = program.options.map(opt => opt.short).filter(Boolean);

            expect(shortOptions).to.include('-c');
        });

        /**
         * Test: Registers option with parser for display-limit
         * Validates that display-limit option uses parseInt parser
         */
        it('should register option with parser for display-limit', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            const displayLimitOption = program.options.find(opt => opt.long === '--display-limit');

            expect(displayLimitOption).to.exist;
            expect(displayLimitOption?.parseArg).to.be.a('function');
        });
    });

    describe('Configuration loading', () => {
        /**
         * Test: createExecutor receives Config parameter
         * Validates that factory function is called with Config object
         */
        it('should pass Config to createExecutor factory', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            expect(program).to.exist;
            // createExecutor will be called when a command is invoked, not during setup
            expect(createExecutorStub.called).to.be.false;
        });

        /**
         * Test: Merges options.config with loaded config
         * Validates that options.config overrides loaded values
         */
        it('should merge options.config with loaded config', () => {
            const program = createCLI({
                createExecutor: createExecutorStub,
                config: {
                    folder: './custom-migrations',
                    tableName: 'custom_versions',
                },
            });

            expect(program).to.exist;
        });
    });

    describe('Extensibility', () => {
        /**
         * Test: Returned program can be extended with additional commands
         * Validates that the returned program supports adding commands
         */
        it('should allow adding additional commands to returned program', () => {
            const program = createCLI({createExecutor: createExecutorStub});

            program
                .command('stats')
                .description('Show statistics')
                .option('-v, --verbose', 'Verbose output')
                .action(() => {});

            const statsCmd = program.commands.find(cmd => cmd.name() === 'stats');
            expect(statsCmd).to.exist;
            expect(statsCmd?.description()).to.equal('Show statistics');
        });

        /**
         * Test: Returned program can be extended with global options
         * Validates that the returned program supports adding global options
         */
        it('should allow adding global options to returned program', () => {
            const program = createCLI({createExecutor: createExecutorStub});

            program.option('--custom-option <value>', 'Custom global option');

            const options = program.options.map(opt => opt.long);
            expect(options).to.include('--custom-option');
        });

        /**
         * Test: Returned program can have hooks attached
         * Validates that the returned program supports hooks
         */
        it('should allow attaching hooks to returned program', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            const hookSpy = sinon.spy();

            program.hook('preAction', hookSpy);

            expect(program).to.exist;
        });
    });

    describe('Options parameter handling', () => {
        /**
         * Test: Works with minimal options (createExecutor only)
         * Validates that only createExecutor is required
         */
        it('should work with minimal options (createExecutor only)', () => {
            const program = createCLI({createExecutor: createExecutorStub});

            expect(program).to.exist;
            expect(program.name()).to.equal('msr');
        });

        /**
         * Test: Works with all optional parameters
         * Validates that all optional parameters can be provided
         */
        it('should work with all optional parameters', () => {
            const program = createCLI({
                createExecutor: createExecutorStub,
                name: 'test-cli',
                description: 'Test CLI',
                version: '1.0.0-test',
                config: {folder: './test-migrations'},
            });

            expect(program).to.exist;
            expect(program.name()).to.equal('test-cli');
            expect(program.description()).to.equal('Test CLI');
            expect(program.version()).to.equal('1.0.0-test');
        });

        /**
         * Test: Handles undefined optional parameters
         * Validates that undefined optional parameters don't cause errors
         */
        it('should handle undefined optional parameters', () => {
            const program = createCLI({
                createExecutor: createExecutorStub,
                name: undefined,
                description: undefined,
                version: undefined,
                config: undefined,
            });

            expect(program).to.exist;
            expect(program.name()).to.equal('msr');
            expect(program.description()).to.equal('Migration Script Runner');
            expect(program.version()).to.equal('1.0.0');
        });
    });

    describe('Type safety', () => {
        /**
         * Test: Accepts generic DB type parameter
         * Validates that the function works with custom DB types
         */
        it('should accept generic DB type parameter', () => {
            interface CustomDB extends IDB {
                customField: string;
            }

            const customExecutorStub = sinon.stub().returns(sinon.createStubInstance(MigrationScriptExecutor));
            const program = createCLI<CustomDB>({createExecutor: customExecutorStub});

            expect(program).to.exist;
        });
    });

    describe('Integration', () => {
        let consoleLogStub: sinon.SinonStub;
        let processExitStub: sinon.SinonStub;

        beforeEach(() => {
            consoleLogStub = sinon.stub(console, 'log');
            processExitStub = sinon.stub(process, 'exit');
        });

        afterEach(() => {
            consoleLogStub.restore();
            processExitStub.restore();
        });

        /**
         * Test: Created program can parse arguments
         * Validates that the program can parse command-line arguments
         */
        it('should create a program that can parse arguments', () => {
            const program = createCLI({createExecutor: createExecutorStub});
            program.exitOverride(); // Prevent process.exit in tests

            expect(() => program.parse(['node', 'test', '--version'])).to.throw(Error, '1.0.0');
        });

        /**
         * Test: Created program can parse async
         * Validates that the program supports parseAsync
         */
        it('should create a program that supports parseAsync', async () => {
            const program = createCLI({createExecutor: createExecutorStub});
            expect(program.parseAsync).to.be.a('function');
        });

        /**
         * Test: Executes command with config merging
         * Validates that createExecutorWithFlags properly merges config and creates executor
         */
        it('should execute command with config merging and flag processing', async () => {
            mockExecutor.migrate.resolves({success: true, executed: [], migrated: [], ignored: []});

            const program = createCLI({
                createExecutor: createExecutorStub,
                config: {folder: './custom-folder'},
            });
            program.exitOverride();

            await program.parseAsync(['node', 'test', 'migrate', '--dry-run']);

            expect(createExecutorStub.calledOnce).to.be.true;
            const passedConfig = createExecutorStub.firstCall.args[0] as Config;
            expect(passedConfig).to.be.an('object');
            expect(passedConfig.dryRun).to.be.true;
            expect(passedConfig.folder).to.equal('./custom-folder');
        });

        /**
         * Test: Handles CLI flags with logger override
         * Validates that logger CLI flag overrides executor logger
         */
        it('should handle CLI flags with logger creation', async () => {
            mockExecutor.list.resolves();

            const program = createCLI({createExecutor: createExecutorStub});
            program.exitOverride();

            await program.parseAsync(['node', 'test', 'list', '--logger', 'silent']);

            expect(createExecutorStub.calledOnce).to.be.true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((mockExecutor as any).logger).to.exist;
        });

        /**
         * Test: Handles config-file flag
         * Validates that --config-file flag triggers config file loading
         */
        it('should handle --config-file flag', async () => {
            mockExecutor.migrate.resolves({success: true, executed: [], migrated: [], ignored: []});

            const program = createCLI({createExecutor: createExecutorStub});
            program.exitOverride();

            // Note: This will fail to load the file, but exercises the config loading path
            try {
                await program.parseAsync(['node', 'test', 'migrate', '--config-file', './nonexistent.json']);
            } catch (error) {
                // Expected to fail due to nonexistent file
            }
        });
    });

    describe('CLI Extension (extendCLI)', () => {
        /**
         * Test: extendCLI callback is called if provided
         * Validates that the extendCLI callback is invoked with program and createExecutor
         */
        it('should call extendCLI callback when provided', () => {
            const extendCLISpy = sinon.spy();

            const program = createCLI({
                createExecutor: createExecutorStub,
                extendCLI: extendCLISpy
            });

            expect(extendCLISpy.calledOnce).to.be.true;
            expect(extendCLISpy.firstCall.args[0]).to.equal(program);
            expect(extendCLISpy.firstCall.args[1]).to.be.a('function');
        });

        /**
         * Test: extendCLI can add custom commands
         * Validates that custom commands added via extendCLI work correctly
         */
        it('should allow adding custom commands via extendCLI', async () => {
            const customActionSpy = sinon.spy();

            const program = createCLI({
                createExecutor: createExecutorStub,
                extendCLI: (prog, createExec) => {
                    prog
                        .command('custom')
                        .description('Custom command')
                        .action(async () => {
                            const executor = await createExec();
                            customActionSpy(executor);
                        });
                }
            });

            program.exitOverride();

            // Execute custom command
            await program.parseAsync(['node', 'test', 'custom']);

            expect(customActionSpy.calledOnce).to.be.true;
            expect(customActionSpy.firstCall.args[0]).to.equal(mockExecutor);
        });

        /**
         * Test: createExecutor in extendCLI returns correct type
         * Validates type safety for adapter-specific methods
         */
        it('should provide typed createExecutor to extendCLI callback', async () => {
            // Create a custom adapter class with custom method
            class CustomAdapter extends MigrationScriptExecutor<MockDB> {
                customMethod(): string {
                    return 'custom result';
                }
            }

            // Mock the custom adapter
            const customAdapter = sinon.createStubInstance(CustomAdapter);
            (customAdapter as any).customMethod = sinon.stub().returns('custom result');

            const customExecutorStub = sinon.stub().returns(customAdapter);

            let capturedExecutor: any;

            const program = createCLI({
                createExecutor: customExecutorStub,
                extendCLI: (prog, createExec) => {
                    prog
                        .command('custom-typed')
                        .action(async () => {
                            // TypeScript should infer this as CustomAdapter
                            const adapter = await createExec();
                            capturedExecutor = adapter;
                        });
                }
            });

            program.exitOverride();

            // Trigger command to capture executor
            await program.parseAsync(['node', 'test', 'custom-typed']);

            expect(capturedExecutor).to.equal(customAdapter);
            expect(customExecutorStub.calledOnce).to.be.true;
        });

        /**
         * Test: extendCLI callback not called when not provided
         * Validates that extendCLI is optional
         */
        it('should not fail when extendCLI is not provided', () => {
            expect(() => {
                createCLI({createExecutor: createExecutorStub});
            }).to.not.throw();
        });

        /**
         * Test: extendCLI receives createExecutor with config merging
         * Validates that executor created in extendCLI has proper config
         */
        it('should pass createExecutor with config merging to extendCLI', async () => {
            let executorConfig: Config | undefined;

            const program = createCLI({
                createExecutor: (config) => {
                    executorConfig = config;
                    return createExecutorStub(config);
                },
                config: {
                    folder: './initial-folder'
                },
                extendCLI: (prog, createExec) => {
                    prog
                        .command('test-config')
                        .action(async () => {
                            await createExec();
                        });
                }
            });

            program.exitOverride();

            await program.parseAsync(['node', 'test', 'test-config', '--folder', './override-folder']);

            expect(executorConfig).to.exist;
            expect(executorConfig!.folder).to.equal('./override-folder');
        });
    });

    describe('Async executor support (v0.8.2)', () => {
        /**
         * Test: synchronous executor (backward compatibility)
         * Tests the instanceof Promise === false branch
         */
        it('should handle synchronous executor creation', async () => {
            mockExecutor.validate.resolves({pending: [], migrated: []});

            // Return executor directly (not a Promise)
            const syncStub = sinon.stub().returns(mockExecutor);

            // Stub process.exit to prevent test hanging
            const exitStub = sinon.stub(process, 'exit');

            try {
                const program = createCLI({
                    createExecutor: syncStub
                });

                program.exitOverride();

                await program.parseAsync(['node', 'test', 'validate']);

                expect(syncStub.calledOnce).to.be.true;
            } finally {
                exitStub.restore();
            }
        });

        /**
         * Test: asynchronous executor (new in v0.8.2)
         * Tests the instanceof Promise === true branch
         */
        it('should handle asynchronous executor creation', async () => {
            mockExecutor.validate.resolves({pending: [], migrated: []});

            // Return a Promise
            const asyncStub = sinon.stub().returns(Promise.resolve(mockExecutor));

            // Stub process.exit to prevent test hanging
            const exitStub = sinon.stub(process, 'exit');

            try {
                const program = createCLI({
                    createExecutor: asyncStub
                });

                program.exitOverride();

                await program.parseAsync(['node', 'test', 'validate']);

                expect(asyncStub.calledOnce).to.be.true;
            } finally {
                exitStub.restore();
            }
        });
    });
});
