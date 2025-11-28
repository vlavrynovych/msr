---
layout: default
title: Loggers
parent: Customization
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

---

### [Cloud Logger Guide](cloud-logger-guide.md)
Guide for implementing cloud logging services (AWS CloudWatch, Google Cloud Logging, Azure, Datadog, etc.).

**Best for:** Centralized logging, multi-instance deployments, cloud-native applications

*Note: These implementations are not included in MSR but serve as production-ready examples and starting points.*

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
