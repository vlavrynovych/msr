---
layout: default
title: Extending MSR
nav_order: 6
has_children: true
---

# Extending MSR
{: .no_toc }

Extend and customize Migration Script Runner to fit your needs.
{: .fs-6 .fw-300 }

---

## Overview

MSR is designed to be highly customizable. This section covers how to extend the framework with your own implementations for logging, rendering, validation, and lifecycle hooks.

---

## Customization Areas

### 📝 [Loggers](loggers/)
Built-in and custom logger implementations:
- ConsoleLogger - Standard console output
- SilentLogger - No output (testing)
- FileLogger - Log to files
- Cloud Logger - Cloud logging services
- CompositeLogger - Multiple destinations
- **Custom Loggers** - Implement your own

### 🎨 [Render Strategies](render-strategies/)
Output format implementations:
- AsciiTableRenderStrategy - Beautiful terminal tables
- JsonRenderStrategy - Structured JSON output
- SilentRenderStrategy - No output
- **Custom Renderers** - Create custom formats

### 🔧 [Custom Logging](custom-logging)
Implement custom logger behavior:
- Logger interface implementation
- Integration with logging frameworks
- Multi-destination logging
- Log levels and formatting

### 🖼️ [Custom Rendering](custom-rendering)
Create custom output formats:
- Render strategy interface
- Custom table formats
- JSON variations
- Integration with reporting tools

### 🪝 [Migration Hooks](hooks)
Extend migration lifecycle:
- beforeMigrate and afterMigrate hooks
- Notifications and alerts
- Custom validation
- Integration with external systems

### 📊 [Metrics Collection](metrics/)
Track and monitor migration performance:
- ConsoleMetricsCollector - Development feedback
- LoggerMetricsCollector - Production monitoring
- JsonMetricsCollector - Detailed analysis
- CsvMetricsCollector - Spreadsheet reports
- **Custom Collectors** - Your monitoring service

### ✅ [Custom Validation](validation/)
Extend the validation system:
- Built-in validation rules
- Custom validator implementation
- Checksum and integrity checking
- Migration script validation

---

## Quick Start

### Custom Logger Example

```typescript
import { ILogger } from '@migration-script-runner/core';

class MyLogger implements ILogger {
  log(message: string): void {
    // Your implementation
  }

  warn(message: string): void {
    // Your implementation
  }

  error(message: string): void {
    // Your implementation
  }
}

const executor = new MigrationScriptExecutor(handler, config, {
  logger: new MyLogger()
});
```

### Custom Render Strategy Example

```typescript
import { IRenderStrategy } from '@migration-script-runner/core';

class MyRenderStrategy implements IRenderStrategy {
  renderPending(scripts: MigrationScript[]): void {
    // Your custom rendering
  }
  // ... implement other methods
}

const renderer = new MigrationRenderer(
  new MyRenderStrategy(),
  logger,
  config
);
```

---

