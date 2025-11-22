---
layout: default
title: Loggers
nav_order: 4
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

### [Cloud Logger Guide](cloud-logger-guide.md)
Guide for implementing cloud logging services (AWS CloudWatch, Google Cloud Logging, Azure, Datadog, etc.).

**Best for:** Centralized logging, multi-instance deployments, cloud-native applications

*Note: These implementations are not included in MSR but serve as production-ready examples and starting points.*

---

## Quick Comparison

| Feature | ConsoleLogger | SilentLogger | FileLogger |
|---------|---------------|--------------|------------|
| Output Location | Console | None | File system |
| Rotation | N/A | N/A | ✅ Size-based |
| Timestamps | ❌ | N/A | ✅ Configurable |
| Configuration | None | None | Extensive |
| Performance | Fast | Fastest | Moderate |
| Best Use Case | Development | Testing | Production |

## Creating Custom Loggers

All loggers implement the `ILogger` interface. See the [Custom Logging Guide](../guides/custom-logging.md) for detailed examples of creating your own logger implementations.

## Next Steps

- Choose a logger from the list above to learn more
- Read the [Custom Logging Guide](../guides/custom-logging.md) for advanced usage
- See [Getting Started](../guides/getting-started.md) for basic setup
