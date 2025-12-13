#!/usr/bin/env ts-node
/**
 * Simple CLI Example
 *
 * This demonstrates the basic structure of a CLI created with createCLI().
 * It shows all the built-in commands and how to add custom commands using
 * the extendCLI callback without needing a full database implementation.
 *
 * Run with:
 *   npx ts-node examples/simple-cli.ts --help
 *   npx ts-node examples/simple-cli.ts demo:show-features
 */

import {createCLI} from '../src/cli/createCLI';
import {Config} from '../src/model/Config';

console.log('🚀 MSR CLI Demo\n');
console.log('Creating CLI with createCLI()...\n');

// Create a CLI with custom commands via extendCLI callback
const program = createCLI({
    name: 'msr-demo',
    description: 'Demo Migration Script Runner',
    version: '1.0.0',

    config: {
        folder: './demo-migrations',
        tableName: 'demo_versions',
    },

    createExecutor: (config: Config) => {
        console.log('📋 Executor would be created with config:', config);
        // In a real adapter, you'd return: new YourAdapter({handler, config})
        throw new Error('Demo only - no executor implementation');
    },

    // Preferred way to add custom commands (with full type safety)
    extendCLI: (program, createExecutor) => {
        program
            .command('demo:show-features')
            .description('Show what the CLI provides automatically')
            .action(() => {
                console.log('\n✨ Features provided by createCLI():\n');
                console.log('📦 Built-in Commands:');
                console.log('   ✓ migrate (alias: up)     - Run pending migrations');
                console.log('   ✓ list                    - List migration status');
                console.log('   ✓ down (alias: rollback)  - Roll back migrations');
                console.log('   ✓ validate                - Validate migrations');
                console.log('   ✓ backup                  - Backup/restore operations');
                console.log('');
                console.log('⚙️  Configuration Management:');
                console.log('   ✓ Waterfall config loading (defaults → file → env → options → flags)');
                console.log('   ✓ CLI flags have highest priority');
                console.log('   ✓ Support for --config-file, --folder, --dry-run, --logger, etc.');
                console.log('');
                console.log('🎨 Extensibility (via extendCLI callback):');
                console.log('   ✓ Add custom commands with full type safety');
                console.log('   ✓ Access your adapter methods (no type casting!)');
                console.log('   ✓ Automatic config merging with CLI flags');
                console.log('   ✓ createExecutor() already has flags applied');
                console.log('');
                console.log('📖 Try these commands:');
                console.log('   npx ts-node examples/simple-cli.ts --help');
                console.log('   npx ts-node examples/simple-cli.ts migrate --help');
                console.log('   npx ts-node examples/simple-cli.ts demo:show-features');
                console.log('');
            });

        program
            .command('demo:config')
            .description('Show merged config (demonstrates config merging)')
            .action(() => {
                try {
                    // createExecutor() has all config merged (defaults → file → env → options → flags)
                    createExecutor();
                } catch (error) {
                    // Expected error since this is a demo
                    console.log('\n✓ Config was successfully merged and passed to createExecutor');
                    console.log('  (Error is expected - this is just a demo without real database)\n');
                }
            });
    }
});

// Show help if no args or parse the provided args
if (process.argv.length === 2) {
    console.log('No command specified. Showing help:\n');
    program.help();
} else {
    program.parse(process.argv);
}
