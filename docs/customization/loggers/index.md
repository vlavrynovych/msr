---
layout: default
title: Loggers
parent: Extending MSR
nav_order: 1
has_children: true
---

# Logger Implementations

MSR provides multiple logger implementations to suit different use cases, from development to production environments.

## Available Loggers

### [ConsoleLogger](console-logger.md)
The default logger that outputs all messages to the console using standard `console.*` methods. Perfect for development and debugging.

**Best for:** Local development, debugging, interactive environments

---

### [SilentLogger](silent-logger.md)
Suppresses all log output completely. Ideal for testing and scenarios where logging is not desired.

**Best for:** Unit tests, CI/CD pipelines, silent operations

---

### [FileLogger](file-logger.md)
Writes logs to files with automatic rotation based on file size. Includes timestamp support and configurable backup retention.

**Best for:** Production environments, persistent logging, audit trails

---

### [CompositeLogger](composite-logger.md)
Forwards log messages to multiple logger implementations simultaneously. Enables logging to multiple destinations (console + file, file + cloud, etc.) with dynamic logger management.

**Best for:** Multi-destination logging, production environments, flexible logging strategies

## Logger Comparison

Choose the right logger for your environment:

| Logger | Output | Performance | Use Case | Best For |
|--------|--------|-------------|----------|----------|
| **ConsoleLogger** | 🖥️ Console | 🟢 Fast | Development | **Local dev** |
| **SilentLogger** | ❌ None | 🟢 Fastest | Testing | **Unit tests** |
| **FileLogger** | 📄 Files | 🟡 Medium | Production | **Audit logs** |
| **CompositeLogger** | 🔀 Multiple | 🟡 Medium | Production | **Multi-dest** |
| **Cloud Loggers** | ☁️ Cloud | 🟡 Network | Production | **Distributed** |

### Feature Matrix

| Feature | Console | Silent | File | Composite | Cloud |
|---------|---------|--------|------|-----------|-------|
| Timestamps | ✅ | N/A | ✅ | ✅ | ✅ |
| Log Levels | ✅ | N/A | ✅ | ✅ | ✅ |
| Rotation | ❌ | N/A | ✅ | Depends | ✅ |
| Async | ❌ | ❌ | ✅ | Depends | ✅ |
| Persistence | ❌ | ❌ | ✅ | Depends | ✅ |
| Searchable | ❌ | ❌ | ⚠️ Limited | Depends | ✅ |
| Cost | Free | Free | Free | Free | 💰 Paid |

{: .tip }
> **Recommended for Production**: Use `CompositeLogger` with `FileLogger` + Cloud Logger for redundancy and better observability.

---

### [Cloud Logger Guide](cloud-logger-guide.md)
Guide for implementing cloud logging services (AWS CloudWatch, Google Cloud Logging, Azure, Datadog, etc.).

**Best for:** Centralized logging, multi-instance deployments, cloud-native applications

*Note: These implementations are not included in MSR but serve as production-ready examples and starting points.*

---

## Log Level Control

MSR v0.6.0+ includes **automatic log level filtering** through the `LevelAwareLogger` wrapper. When you provide a logger to `MigrationScriptExecutor`, it's automatically wrapped to filter messages based on your configured log level.

### Automatic Wrapping

All loggers are automatically wrapped with level-aware filtering:

```typescript
// Your logger is automatically wrapped with log level filtering
const executor = new MigrationScriptExecutor({ handler }, {
    logLevel: 'error'  // Only errors will be shown
}, {
    logger: new ConsoleLogger()  // Automatically wrapped
});
```

### Log Levels

Control output verbosity with four levels (each includes higher priority levels):

| Level | Shows | Environment |
|-------|-------|-------------|
| `error` | Errors only | Production (quiet) |
| `warn` | Warnings + Errors | Production (monitoring) |
| `info` | Info + Warnings + Errors | **Default** (standard operation) |
| `debug` | All logs | Development (verbose) |

### Configuration

Set via configuration object or environment variable:

```typescript
// Programmatic
config.logLevel = 'debug';

// Environment variable
export MSR_LOG_LEVEL=error
```

**See Also:**
- [MSR_LOG_LEVEL Reference](../../api/environment-variables/core-variables#msr_log_level) - Complete documentation
- [Environment Variables Guide](../../guides/environment-variables) - Configuration guide

---

## Quick Comparison

| Feature | ConsoleLogger | SilentLogger | FileLogger | CompositeLogger |
|---------|---------------|--------------|------------|-----------------|
| Output Location | Console | None | File system | Multiple destinations |
| Rotation | N/A | N/A | ✅ Size-based | Depends on child loggers |
| Timestamps | ❌ | N/A | ✅ Configurable | Depends on child loggers |
| Configuration | None | None | Extensive | Dynamic (add/remove loggers) |
| Performance | Fast | Fastest | Moderate | Depends on number of loggers |
| Best Use Case | Development | Testing | Production | Multi-destination logging |

## Creating Custom Loggers

All loggers implement the `ILogger` interface. See the [Custom Logging Guide](../customization/custom-logging.md) for detailed examples of creating your own logger implementations.

## Next Steps

- Choose a logger from the list above to learn more
- Read the [Custom Logging Guide](../customization/custom-logging.md) for advanced usage
- See [Getting Started](../guides/getting-started.md) for basic setup
