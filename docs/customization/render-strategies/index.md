---
layout: default
title: Render Strategies
parent: Customization
nav_order: 2
has_children: true
---

# Render Strategy Implementations

New in v0.3.0
{: .label .label-green }

MSR uses the Strategy Pattern to provide multiple output formats for migration information, from beautiful terminal tables to structured JSON for CI/CD integration.

## Available Render Strategies

### [AsciiTableRenderStrategy](ascii-table-strategy.md)
The default rendering strategy that outputs formatted ASCII tables to the terminal. Provides a rich, visual display with human-readable timestamps, color-coded warnings, and alignment.

**Best for:** Local development, manual migration runs, interactive CLI tools

---

### [JsonRenderStrategy](json-strategy.md)
Outputs migration information as structured JSON. Supports both pretty-printed (indented) and compact formats. Perfect for parsing by CI/CD tools, log aggregators, and monitoring systems.

**Best for:** CI/CD pipelines, log aggregation, automated tools, programmatic parsing

---

### [SilentRenderStrategy](silent-strategy.md)
Suppresses all rendering output completely. Ideal for testing, library usage, and scenarios where visual output is not desired.

**Best for:** Unit tests, library integration, headless environments, silent operations

---

## Strategy Comparison

Choose the right render strategy for your environment:

| Strategy | Format | Human Readable | Machine Parsable | Best For |
|----------|--------|----------------|------------------|----------|
| **AsciiTable** | 📊 Tables | 🟢 Excellent | 🔴 Poor | **Development** |
| **Json** | 📋 JSON | 🟡 Moderate | 🟢 Excellent | **CI/CD** |
| **Silent** | ❌ None | N/A | N/A | **Testing** |

### Feature Matrix

| Feature | AsciiTable | Json | Silent |
|---------|------------|------|--------|
| Output Format | ASCII Tables | JSON | None |
| Human Readable | ✅ Very | ⚠️ Structured | N/A |
| Machine Parsable | ❌ | ✅ | N/A |
| Pretty Printing | ✅ | ✅ Configurable | N/A |
| Compact Mode | ❌ | ✅ | N/A |
| Color Support | ✅ | ❌ | N/A |
| File Size | 💾 Large | 💾 Small | Zero |
| CI/CD Friendly | ❌ | ✅ | ✅ |

{: .tip }
> **Recommended**: Use `AsciiTableRenderStrategy` for local development and `JsonRenderStrategy` in CI/CD pipelines for easy parsing.

## Usage

### Basic Usage

```typescript
import {
    MigrationScriptExecutor,
    AsciiTableRenderStrategy,
    JsonRenderStrategy,
    SilentRenderStrategy
} from '@migration-script-runner/core';

// Default ASCII tables (no configuration needed)
const config = new Config();
const executor = new MigrationScriptExecutor(handler, config);

// Pretty JSON for readability
const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new JsonRenderStrategy(true)
});

// Compact JSON for log aggregation
const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new JsonRenderStrategy(false)
});

// Silent for testing
const executor = new MigrationScriptExecutor(handler, config, {
    renderStrategy: new SilentRenderStrategy()
});
```

### With Custom Loggers

Render strategies work seamlessly with custom loggers:

```typescript
import { FileLogger, JsonRenderStrategy } from '@migration-script-runner/core';

const logger = new FileLogger({ logPath: './migrations.log' });
const executor = new MigrationScriptExecutor(handler, config, {
    logger,
    renderStrategy: new JsonRenderStrategy(true)
});
```

## Creating Custom Render Strategies

All render strategies implement the `IRenderStrategy` interface. See the [Custom Rendering Guide](../customization/custom-rendering.md) for detailed examples of creating your own render strategy implementations.

## Next Steps

- Choose a render strategy from the list above to learn more
- Read the [Custom Rendering Guide](../customization/custom-rendering.md) for advanced usage
- See [Getting Started](../getting-started.md) for basic setup
