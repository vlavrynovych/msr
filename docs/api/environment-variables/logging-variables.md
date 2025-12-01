---
layout: default
title: Logging Configuration
parent: Environment Variables
grand_parent: API Reference
nav_order: 3
---

# Logging Environment Variables
{: .no_toc }

Environment variables for configuring file-based logging of migration operations.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Logging environment variables control file-based logging for audit trails, troubleshooting, and compliance requirements.

**Key Features:**
- File-based logging separate from console output
- Configurable retention and rotation
- Success and failure tracking
- Timestamp formatting

---

## Configuration Approaches

### Dot-Notation (Recommended)

Configure individual properties:

```bash
export MSR_LOGGING_ENABLED=true
export MSR_LOGGING_PATH=./logs
export MSR_LOGGING_MAX_FILES=30
export MSR_LOGGING_LOG_SUCCESSFUL=true
```

### JSON Format

Configure all settings at once:

```bash
export MSR_LOGGING='{
  "enabled": true,
  "path": "./logs",
  "maxFiles": 30,
  "timestampFormat": "YYYY-MM-DD",
  "logSuccessful": true
}'
```

**Priority**: Dot-notation variables override JSON configuration.

---

## Variables

### MSR_LOGGING

**Complete logging configuration as JSON**

- **Type**: `JSON object`
- **Default**: None
- **Example**: See JSON Format above

Alternative to dot-notation variables. Provides complete logging configuration in a single variable.

```bash
export MSR_LOGGING='{"enabled":true,"path":"./logs","maxFiles":30}'
```

**JSON Schema:**
```typescript
{
  enabled?: boolean;          // Enable file logging
  path?: string;              // Log directory
  maxFiles?: number;          // File retention
  timestampFormat?: string;   // Timestamp format
  logSuccessful?: boolean;    // Log successful migrations
}
```

**Programmatic Equivalent:**
```typescript
config.logging = {
  enabled: true,
  path: './logs',
  maxFiles: 30,
  logSuccessful: true
};
```

---

### MSR_LOGGING_ENABLED

**Enable file logging**

- **Type**: `boolean`
- **Default**: `false`
- **Example**: `true`, `false`

Controls whether migration operations are logged to files.

```bash
export MSR_LOGGING_ENABLED=true
```

**Programmatic Equivalent:**
```typescript
config.logging.enabled = true;
```

**Use Cases:**
- **Production**: `true` - Audit trail and troubleshooting
- **CI/CD**: `true` - Build artifact logs
- **Development**: `false` - Console output sufficient

**See Also:**
- [Logging Configuration](../../customization/loggers/)

---

### MSR_LOGGING_PATH

**Log file directory**

- **Type**: `string`
- **Default**: `./migrations-logs`
- **Example**: `./logs`, `/var/log/migrations`

Directory where log files are written. Created automatically if it doesn't exist.

```bash
export MSR_LOGGING_PATH=./logs
```

**Programmatic Equivalent:**
```typescript
config.logging.path = './logs';
```

**File Naming:**
Log files are named using the timestamp format:
```
./logs/
  ├── 2024-01-15.log
  ├── 2024-01-16.log
  └── 2024-01-17.log
```

**Permissions:**
- Directory must be writable by the application
- Consider log rotation and disk space in production

---

### MSR_LOGGING_MAX_FILES

**Maximum log files to retain**

- **Type**: `number`
- **Default**: `10`
- **Example**: `30`, `90`, `365`

Maximum number of log files to keep. Older files are automatically deleted.

```bash
export MSR_LOGGING_MAX_FILES=30
```

**Programmatic Equivalent:**
```typescript
config.logging.maxFiles = 30;
```

**Retention Examples:**

| Value | Retention | Use Case |
|-------|-----------|----------|
| `7` | 1 week | Development/staging |
| `30` | 1 month | Standard production |
| `90` | 3 months | Compliance requirements |
| `365` | 1 year | Long-term audit trail |

**Disk Space Considerations:**
```bash
# Estimate: ~1MB per day average
# 30 files = ~30MB
# 365 files = ~365MB
```

---

### MSR_LOGGING_TIMESTAMP_FORMAT

**Log timestamp format**

- **Type**: `string` (Moment.js format)
- **Default**: `YYYY-MM-DD`
- **Example**: `YYYY-MM-DD`, `YYYY-MM-DD-HH`, `YYYYMMDD`

Moment.js format string for log file timestamps.

```bash
# Daily log files (default)
export MSR_LOGGING_TIMESTAMP_FORMAT=YYYY-MM-DD

# Hourly log files
export MSR_LOGGING_TIMESTAMP_FORMAT=YYYY-MM-DD-HH

# Monthly log files
export MSR_LOGGING_TIMESTAMP_FORMAT=YYYY-MM
```

**Programmatic Equivalent:**
```typescript
config.logging.timestampFormat = 'YYYY-MM-DD';
```

**Common Formats:**

| Format | Example | Use Case |
|--------|---------|----------|
| `YYYY-MM-DD` | `2024-01-15.log` | Daily logs (default) |
| `YYYY-MM-DD-HH` | `2024-01-15-14.log` | Hourly logs (high volume) |
| `YYYY-MM` | `2024-01.log` | Monthly logs (low volume) |
| `YYYYMMDD` | `20240115.log` | Compact daily logs |

**See Also:**
- [Moment.js Format Documentation](https://momentjs.com/docs/#/displaying/format/)

---

### MSR_LOGGING_LOG_SUCCESSFUL

**Log successful migrations**

- **Type**: `boolean`
- **Default**: `false`
- **Example**: `true`, `false`

Controls whether successful migrations are logged to files. Failures are always logged.

```bash
# Log failures only (default)
export MSR_LOGGING_LOG_SUCCESSFUL=false

# Log both successes and failures
export MSR_LOGGING_LOG_SUCCESSFUL=true
```

**Programmatic Equivalent:**
```typescript
config.logging.logSuccessful = true;
```

**Behavior:**

| Setting | Success Logged | Failure Logged |
|---------|----------------|----------------|
| `false` | ❌ No | ✅ Yes |
| `true` | ✅ Yes | ✅ Yes |

**Use Cases:**
- **Audit Trail**: `true` - Complete history of all operations
- **Troubleshooting**: `false` - Only log when things go wrong
- **Compliance**: `true` - Full operational log required

**Log Volume:**
```bash
# false: ~50KB per failure
# true: ~50KB per migration run
```

---

## Complete Examples

### Development Environment

Minimal logging for troubleshooting:

```bash
export MSR_LOGGING_ENABLED=false
```

### Production Environment

Full audit trail with 30-day retention:

```bash
export MSR_LOGGING_ENABLED=true
export MSR_LOGGING_PATH=/var/log/migrations
export MSR_LOGGING_MAX_FILES=30
export MSR_LOGGING_TIMESTAMP_FORMAT=YYYY-MM-DD
export MSR_LOGGING_LOG_SUCCESSFUL=true
```

### CI/CD Pipeline

Build artifact logging:

```bash
export MSR_LOGGING_ENABLED=true
export MSR_LOGGING_PATH=./build/logs
export MSR_LOGGING_MAX_FILES=5
export MSR_LOGGING_LOG_SUCCESSFUL=true
```

### Docker Configuration

```dockerfile
ENV MSR_LOGGING_ENABLED=true \
    MSR_LOGGING_PATH=/var/log/migrations \
    MSR_LOGGING_MAX_FILES=30 \
    MSR_LOGGING_LOG_SUCCESSFUL=true
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: msr-logging-config
data:
  MSR_LOGGING_ENABLED: "true"
  MSR_LOGGING_PATH: "/var/log/migrations"
  MSR_LOGGING_MAX_FILES: "90"
  MSR_LOGGING_TIMESTAMP_FORMAT: "YYYY-MM-DD"
  MSR_LOGGING_LOG_SUCCESSFUL: "true"
```

### Using JSON Format

Complete configuration in single variable:

```bash
export MSR_LOGGING='{
  "enabled": true,
  "path": "/var/log/migrations",
  "maxFiles": 30,
  "timestampFormat": "YYYY-MM-DD",
  "logSuccessful": true
}'
```

---

## Log File Format

Example log entry:

```
[2024-01-15 14:30:45] INFO: Migration batch started
[2024-01-15 14:30:45] INFO: Executing V001_create_users.ts
[2024-01-15 14:30:46] SUCCESS: V001_create_users.ts completed in 1.2s
[2024-01-15 14:30:46] INFO: Executing V002_add_indexes.ts
[2024-01-15 14:30:47] ERROR: V002_add_indexes.ts failed: Table 'users' does not exist
[2024-01-15 14:30:47] INFO: Rollback initiated
[2024-01-15 14:30:48] SUCCESS: Rollback completed
[2024-01-15 14:30:48] INFO: Migration batch completed with errors
```

---

## Related Documentation

- **[Environment Variables Index](index)** - All environment variables
- **[Logging Customization](../../customization/loggers/)** - Custom loggers
- **[FileLogger API](../../api/services#filelogger)** - FileLogger service
- **[Execution Summary](../../guides/execution-summary)** - Summary output

---

## Source Code

TypeScript enum definition: [`src/model/env/LoggingEnvVars.ts`](../../../src/model/env/LoggingEnvVars.ts)
