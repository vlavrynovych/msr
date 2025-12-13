---
layout: default
title: JsonMetricsCollector
parent: Metrics Collection
grand_parent: Extending MSR
nav_order: 3
---

# JsonMetricsCollector
{: .no_toc }

Detailed structured metrics for analysis and debugging.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

`JsonMetricsCollector` captures comprehensive migration metrics in structured JSON format. Perfect for post-migration analysis, performance debugging, dashboard generation, and detailed reporting.

**Perfect for:**
- ✅ Performance analysis
- ✅ Debugging migration issues
- ✅ Building dashboards
- ✅ Generating reports
- ✅ Historical tracking

---

## Quick Start

```typescript
import {
  MigrationScriptExecutor,
  JsonMetricsCollector
} from '@vlavrynovych/msr';

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new JsonMetricsCollector({
      filePath: './metrics/migration.json',
      pretty: true
    })
  ], 
  config
});

await executor.up();
```

**Output file** (`./metrics/migration.json`):
```json
{
  "summary": {
    "startTime": "2025-01-15T10:30:00.000Z",
    "endTime": "2025-01-15T10:30:02.453Z",
    "totalDuration": 2453,
    "migrationsExecuted": 3,
    "migrationsSucceeded": 2,
    "migrationsFailed": 1,
    "success": false
  },
  "migrations": [
    {
      "name": "V1_CreateUsers",
      "timestamp": 202501010001,
      "status": "success",
      "startTime": "2025-01-15T10:30:00.100Z",
      "endTime": "2025-01-15T10:30:00.923Z",
      "duration": 823
    }
  ]
}
```

---

## API

### Constructor

```typescript
new JsonMetricsCollector(config: JsonMetricsCollectorConfig)
```

### Configuration

```typescript
interface JsonMetricsCollectorConfig {
  /** Path to output JSON file */
  filePath: string;

  /** Pretty-print JSON (default: false) */
  pretty?: boolean;
}
```

---

## JSON Structure

### Complete Schema

```json
{
  "summary": {
    "startTime": "ISO 8601 timestamp",
    "endTime": "ISO 8601 timestamp",
    "totalDuration": 0,
    "migrationsExecuted": 0,
    "migrationsSucceeded": 0,
    "migrationsFailed": 0,
    "success": true
  },
  "migrations": [
    {
      "name": "string",
      "timestamp": 0,
      "status": "running|success|failed",
      "startTime": "ISO 8601 timestamp",
      "endTime": "ISO 8601 timestamp (optional)",
      "duration": 0,
      "error": "string (optional)"
    }
  ],
  "rollbacks": [
    {
      "strategy": "backup|down|both|none",
      "success": true,
      "duration": 0,
      "timestamp": "ISO 8601 timestamp"
    }
  ],
  "backups": [
    {
      "path": "string",
      "duration": 0,
      "timestamp": "ISO 8601 timestamp"
    }
  ],
  "validationErrors": [
    {
      "message": "string",
      "severity": "error|warning",
      "timestamp": "ISO 8601 timestamp"
    }
  ],
  "errors": [
    {
      "message": "string",
      "stack": "string (optional)",
      "timestamp": "ISO 8601 timestamp"
    }
  ]
}
```

---

## Examples

### Basic Usage

```typescript
new JsonMetricsCollector({
  filePath: './metrics/migration.json'
})
```

---

### Pretty-Printed for Humans

```typescript
new JsonMetricsCollector({
  filePath: './metrics/migration.json',
  pretty: true  // Indent with 2 spaces
})
```

---

### Timestamped Files

```typescript
const timestamp = new Date().toISOString();

new JsonMetricsCollector({
  filePath: `./metrics/migration-${timestamp}.json`
})
```

---

### Environment-Specific

```typescript
new JsonMetricsCollector({
  filePath: `./metrics/${process.env.NODE_ENV}.json`,
  pretty: process.env.NODE_ENV === 'development'
})
```

---

## Analysis Examples

### Find Slowest Migrations

```typescript
import * as fs from 'fs';

const metrics = JSON.parse(fs.readFileSync('./metrics/migration.json', 'utf-8'));

const slowest = metrics.migrations
  .sort((a, b) => b.duration - a.duration)
  .slice(0, 5);

console.log('5 Slowest migrations:', slowest);
```

---

### Calculate Success Rate

```typescript
const successRate = 
  (metrics.summary.migrationsSucceeded / metrics.summary.migrationsExecuted) * 100;

console.log(`Success rate: ${successRate.toFixed(2)}%`);
```

---

### Export to CSV

```typescript
const csv = [
  'name,timestamp,duration,status',
  ...metrics.migrations.map(m => 
    `${m.name},${m.timestamp},${m.duration || ''},${m.status}`
  )
].join('\n');

fs.writeFileSync('./metrics/export.csv', csv);
```

[← LoggerMetricsCollector](logger-collector){: .btn }
[CsvMetricsCollector →](csv-collector){: .btn .btn-primary }
