---
layout: default
title: Custom Rendering
parent: Customization
nav_order: 5
---

# Custom Rendering
{: .no_toc }

MSR uses the Strategy Pattern to provide flexible rendering of migration information through the `IRenderStrategy` interface, allowing you to customize output format for different environments.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

By default, MSR uses `AsciiTableRenderStrategy` which outputs formatted ASCII tables to the terminal. However, you can customize this behavior by:

- Using `JsonRenderStrategy` for structured JSON output (CI/CD, log aggregation)
- Using `SilentRenderStrategy` to suppress all rendering output (testing, library usage)
- Creating custom render strategy implementations for specialized formats (XML, CSV, HTML, etc.)

All rendering is handled by the `MigrationRenderer` class which accepts a render strategy in its constructor or through `IMigrationExecutorDependencies`.

---

## The IRenderStrategy Interface

The `IRenderStrategy` interface defines five rendering methods:

```typescript
interface IRenderStrategy {
  renderMigrated(
    scripts: IScripts,
    handler: IDatabaseMigrationHandler,
    limit?: number
  ): void;

  renderPending(scripts: MigrationScript[]): void;

  renderExecuted(scripts: IMigrationInfo[]): void;

  renderIgnored(scripts: MigrationScript[]): void;

  renderBanner(version: string, handlerName: string): void;
}
```

---

## Built-in Render Strategies

MSR provides three built-in render strategy implementations. For detailed documentation on each, see the [Render Strategy Documentation](/msr-core/rendering).

### Quick Overview

- **[AsciiTableRenderStrategy](/msr-core/rendering/ascii-table-strategy)** - Default strategy with beautiful ASCII tables. Perfect for development and CLI tools.
- **[JsonRenderStrategy](/msr-core/rendering/json-strategy)** - Structured JSON output. Best for CI/CD pipelines and log aggregation.
- **[SilentRenderStrategy](/msr-core/rendering/silent-strategy)** - Suppresses all output. Ideal for testing and library usage.

### AsciiTableRenderStrategy (Default)

```typescript
import { MigrationScriptExecutor, AsciiTableRenderStrategy } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new AsciiTableRenderStrategy()
});
```

[→ Full AsciiTableRenderStrategy Documentation](/msr-core/rendering/ascii-table-strategy)

### JsonRenderStrategy

```typescript
import { MigrationScriptExecutor, JsonRenderStrategy } from '@migration-script-runner/core';

// Pretty-printed JSON
const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new JsonRenderStrategy(true)
});

// Compact JSON
const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new JsonRenderStrategy(false)
});
```

[→ Full JsonRenderStrategy Documentation](/msr-core/rendering/json-strategy)

### SilentRenderStrategy

```typescript
import { MigrationScriptExecutor, SilentRenderStrategy } from '@migration-script-runner/core';

const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new SilentRenderStrategy()
});
```

[→ Full SilentRenderStrategy Documentation](/msr-core/rendering/silent-strategy)

---

## Creating Custom Render Strategies

You can create custom render strategies by implementing the `IRenderStrategy` interface.

### Example: XML Render Strategy

```typescript
import { IRenderStrategy, IScripts, IMigrationInfo, MigrationScript, IDatabaseMigrationHandler, ILogger } from '@migration-script-runner/core';

export class XmlRenderStrategy implements IRenderStrategy {
    constructor(private logger: ILogger) {}

    renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit = 0): void {
        if (!scripts.migrated.length) return;

        let migrated = scripts.migrated;
        if (limit > 0) {
            migrated = migrated.slice(-limit);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<migrations>
${migrated.map(m => `  <migration>
    <timestamp>${m.timestamp}</timestamp>
    <name>${m.name}</name>
    <executed>${new Date(m.finishedAt).toISOString()}</executed>
    <duration>${this.calculateDuration(m)}</duration>
    <username>${m.username}</username>
    <foundLocally>${scripts.all?.some(s => s.timestamp === m.timestamp) || false}</foundLocally>
  </migration>`).join('\n')}
</migrations>`;

        this.logger.log(xml);
    }

    renderPending(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<pending>
${scripts.map(s => `  <migration>
    <timestamp>${s.timestamp}</timestamp>
    <name>${s.name}</name>
    <path>${s.filepath}</path>
  </migration>`).join('\n')}
</pending>`;

        this.logger.log(xml);
    }

    renderExecuted(scripts: IMigrationInfo[]): void {
        if (!scripts.length) return;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<executed>
${scripts.map(s => `  <migration>
    <timestamp>${s.timestamp}</timestamp>
    <name>${s.name}</name>
    <duration>${this.calculateDuration(s)}</duration>
    <result>${s.result || ''}</result>
  </migration>`).join('\n')}
</executed>`;

        this.logger.log(xml);
    }

    renderIgnored(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ignored>
${scripts.map(s => `  <migration>
    <timestamp>${s.timestamp}</timestamp>
    <name>${s.name}</name>
    <path>${s.filepath}</path>
  </migration>`).join('\n')}
</ignored>`;

        this.logger.warn(xml);
    }

    renderBanner(version: string, handlerName: string): void {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<banner>
  <application>Migration Script Runner</application>
  <version>${version}</version>
  <handler>${handlerName}</handler>
</banner>`;

        this.logger.log(xml);
    }

    private calculateDuration(m: IMigrationInfo): number {
        return (m.finishedAt - m.startedAt) / 1000;
    }
}
```

### Using the Custom Strategy

```typescript
import { MigrationScriptExecutor, ConsoleLogger } from '@migration-script-runner/core';
import { XmlRenderStrategy } from './XmlRenderStrategy';

const logger = new ConsoleLogger();
const executor = new MigrationScriptExecutor(handler, config, {
    logger,
    renderStrategy: new XmlRenderStrategy(logger)
});

await executor.migrate();
```

---

## Advanced Examples

### CSV Render Strategy

Perfect for importing into spreadsheets:

```typescript
import { IRenderStrategy, IScripts, IMigrationInfo, MigrationScript, IDatabaseMigrationHandler, ILogger } from '@migration-script-runner/core';

export class CsvRenderStrategy implements IRenderStrategy {
    constructor(private logger: ILogger) {}

    renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit = 0): void {
        if (!scripts.migrated.length) return;

        let migrated = scripts.migrated;
        if (limit > 0) {
            migrated = migrated.slice(-limit);
        }

        const csv = [
            'Timestamp,Name,Executed,Duration,Username,FoundLocally',
            ...migrated.map(m => [
                m.timestamp,
                `"${m.name}"`,
                new Date(m.finishedAt).toISOString(),
                this.calculateDuration(m),
                m.username,
                scripts.all?.some(s => s.timestamp === m.timestamp) || false
            ].join(','))
        ].join('\n');

        this.logger.log(csv);
    }

    renderPending(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const csv = [
            'Timestamp,Name,Path',
            ...scripts.map(s => [
                s.timestamp,
                `"${s.name}"`,
                `"${s.filepath}"`
            ].join(','))
        ].join('\n');

        this.logger.log(csv);
    }

    renderExecuted(scripts: IMigrationInfo[]): void {
        if (!scripts.length) return;

        const csv = [
            'Timestamp,Name,Duration,Result',
            ...scripts.map(s => [
                s.timestamp,
                `"${s.name}"`,
                this.calculateDuration(s),
                `"${s.result || ''}"`
            ].join(','))
        ].join('\n');

        this.logger.log(csv);
    }

    renderIgnored(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const csv = [
            'Timestamp,Name,Path',
            ...scripts.map(s => [
                s.timestamp,
                `"${s.name}"`,
                `"${s.filepath}"`
            ].join(','))
        ].join('\n');

        this.logger.warn(csv);
    }

    renderBanner(version: string, handlerName: string): void {
        this.logger.log(`Migration Script Runner,${version},${handlerName}`);
    }

    private calculateDuration(m: IMigrationInfo): number {
        return (m.finishedAt - m.startedAt) / 1000;
    }
}
```

### Markdown Render Strategy

Perfect for documentation and reports:

```typescript
import { IRenderStrategy, IScripts, IMigrationInfo, MigrationScript, IDatabaseMigrationHandler, ILogger } from '@migration-script-runner/core';

export class MarkdownRenderStrategy implements IRenderStrategy {
    constructor(private logger: ILogger) {}

    renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler, limit = 0): void {
        if (!scripts.migrated.length) return;

        let migrated = scripts.migrated;
        if (limit > 0) {
            migrated = migrated.slice(-limit);
        }

        const markdown = [
            '## Migrated Scripts\n',
            '| Timestamp | Name | Executed | Duration | Username | Found Locally |',
            '|-----------|------|----------|----------|----------|---------------|',
            ...migrated.map(m => `| ${m.timestamp} | ${m.name} | ${new Date(m.finishedAt).toISOString()} | ${this.calculateDuration(m)}s | ${m.username} | ${scripts.all?.some(s => s.timestamp === m.timestamp) ? '✓' : '✗'} |`)
        ].join('\n');

        this.logger.log(markdown);
    }

    renderPending(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const markdown = [
            '## Pending Migrations\n',
            '| Timestamp | Name | Path |',
            '|-----------|------|------|',
            ...scripts.map(s => `| ${s.timestamp} | ${s.name} | ${s.filepath} |`)
        ].join('\n');

        this.logger.log(markdown);
    }

    renderExecuted(scripts: IMigrationInfo[]): void {
        if (!scripts.length) return;

        const markdown = [
            '## Executed Migrations\n',
            '| Timestamp | Name | Duration | Result |',
            '|-----------|------|----------|--------|',
            ...scripts.map(s => `| ${s.timestamp} | ${s.name} | ${this.calculateDuration(s)}s | ${s.result || ''} |`)
        ].join('\n');

        this.logger.log(markdown);
    }

    renderIgnored(scripts: MigrationScript[]): void {
        if (!scripts.length) return;

        const markdown = [
            '## ⚠️ Ignored Scripts\n',
            '| Timestamp | Name | Path |',
            '|-----------|------|------|',
            ...scripts.map(s => `| ${s.timestamp} | ${s.name} | ${s.filepath} |`)
        ].join('\n');

        this.logger.warn(markdown);
    }

    renderBanner(version: string, handlerName: string): void {
        const markdown = [
            '# Migration Script Runner',
            '',
            `**Version:** ${version}`,
            `**Handler:** ${handlerName}`,
            ''
        ].join('\n');

        this.logger.log(markdown);
    }

    private calculateDuration(m: IMigrationInfo): number {
        return (m.finishedAt - m.startedAt) / 1000;
    }
}
```

---

## Combining Strategies with Loggers

Render strategies work seamlessly with any logger implementation:

### JSON Strategy with File Logger

```typescript
import { MigrationScriptExecutor, JsonRenderStrategy, FileLogger } from '@migration-script-runner/core';

const logger = new FileLogger({ logPath: './migrations.json' });
const executor = new MigrationScriptExecutor(handler, config, {
    logger,
    renderStrategy: new JsonRenderStrategy(false)  // Compact JSON
});

await executor.migrate();
// Output written to ./migrations.json
```

### Custom Strategy with Cloud Logger

```typescript
import { MigrationScriptExecutor } from '@migration-script-runner/core';
import { CloudWatchLogger } from './CloudWatchLogger';
import { JsonRenderStrategy } from '@migration-script-runner/core';

const logger = new CloudWatchLogger({
    logGroupName: '/aws/migrations',
    logStreamName: 'production'
});

const executor = new MigrationScriptExecutor(handler, config, {
    logger,
    renderStrategy: new JsonRenderStrategy(false)
});

await executor.migrate();
// Structured JSON sent to CloudWatch Logs
```

---

## Environment-Based Strategy Selection

Choose strategies based on the environment:

```typescript
import {
    MigrationScriptExecutor,
    AsciiTableRenderStrategy,
    JsonRenderStrategy,
    SilentRenderStrategy,
    ConsoleLogger,
    FileLogger
} from '@migration-script-runner/core';

function getRenderStrategy() {
    switch (process.env.NODE_ENV) {
        case 'development':
            // Beautiful tables for local development
            return new AsciiTableRenderStrategy(new ConsoleLogger());

        case 'production':
            // Structured JSON for log aggregation
            return new JsonRenderStrategy(false, new FileLogger({
                logPath: '/var/log/migrations.json'
            }));

        case 'test':
            // Silent for clean test output
            return new SilentRenderStrategy();

        case 'ci':
            // Pretty JSON for CI/CD readability
            return new JsonRenderStrategy(true, new ConsoleLogger());

        default:
            return new AsciiTableRenderStrategy();
    }
}

const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: getRenderStrategy()
});
```

---

## Best Practices

### 1. Implement All Methods

Even if you don't need all methods, implement them all to satisfy the interface:

```typescript
// Good: All methods implemented
export class MyStrategy implements IRenderStrategy {
    renderMigrated(...) { /* implementation */ }
    renderPending(...) { /* implementation */ }
    renderExecuted(...) { /* implementation */ }
    renderIgnored(...) { /* implementation */ }
    renderBanner(...) { /* implementation */ }
}

// Bad: Missing methods (won't compile)
export class MyStrategy implements IRenderStrategy {
    renderMigrated(...) { /* implementation */ }
    // Missing other methods
}
```

### 2. Handle Empty Collections

Always check for empty collections:

```typescript
// Good: Check before rendering
renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler): void {
    if (!scripts.migrated.length) return;
    // Render logic
}

// Bad: No check (may produce empty output)
renderMigrated(scripts: IScripts, handler: IDatabaseMigrationHandler): void {
    // Renders empty structure
}
```

### 3. Use Appropriate Logger Methods

Use `logger.warn()` for warnings (ignored migrations):

```typescript
// Good: Use warn for ignored migrations
renderIgnored(scripts: MigrationScript[]): void {
    if (!scripts.length) return;
    this.logger.warn(output);
}

// Avoid: Using log for warnings
renderIgnored(scripts: MigrationScript[]): void {
    this.logger.log(output);  // Should be warn
}
```

### 4. Escape Special Characters

When generating structured formats, escape special characters:

```typescript
// Good: Escape XML special characters
const escapedName = name
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Good: Escape CSV quotes
const escapedName = name.replace(/"/g, '""');

// Bad: No escaping (may break format)
const xml = `<name>${name}</name>`;  // Breaks if name contains <
```

### 5. Consider Performance

For large migration lists, be mindful of string concatenation:

```typescript
// Good: Use array join
const lines = scripts.map(s => `${s.timestamp},${s.name}`);
const csv = lines.join('\n');

// Avoid: String concatenation in loop
let csv = '';
for (const s of scripts) {
    csv += `${s.timestamp},${s.name}\n`;  // Slower for large lists
}
```

---

## Testing Custom Strategies

### Unit Testing

```typescript
import { XmlRenderStrategy } from './XmlRenderStrategy';
import { SilentLogger } from '@migration-script-runner/core';

describe('XmlRenderStrategy', () => {
    let strategy: XmlRenderStrategy;
    let logger: SilentLogger;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        logger = new SilentLogger();
        logSpy = jest.spyOn(logger, 'log');
        strategy = new XmlRenderStrategy(logger);
    });

    it('should render migrated scripts as XML', () => {
        const scripts = {
            migrated: [
                { timestamp: 123, name: 'test', finishedAt: Date.now(), startedAt: Date.now(), username: 'admin' }
            ],
            all: []
        };

        strategy.renderMigrated(scripts, handler);

        expect(logSpy).toHaveBeenCalled();
        const xml = logSpy.mock.calls[0][0];
        expect(xml).toContain('<?xml version="1.0"');
        expect(xml).toContain('<timestamp>123</timestamp>');
    });
});
```

---

## Related

- [AsciiTableRenderStrategy](/msr-core/rendering/ascii-table-strategy) - Default ASCII table strategy
- [JsonRenderStrategy](/msr-core/rendering/json-strategy) - Built-in JSON strategy
- [SilentRenderStrategy](/msr-core/rendering/silent-strategy) - Built-in silent strategy
- [Custom Logging](/msr-co../customization/custom-logging) - Creating custom loggers
