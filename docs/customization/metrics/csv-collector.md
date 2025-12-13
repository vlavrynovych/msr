---
layout: default
title: CsvMetricsCollector
parent: Metrics Collection
grand_parent: Extending MSR
nav_order: 4
---

# CsvMetricsCollector
{: .no_toc }

Spreadsheet-friendly metrics for Excel and data analysis.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

`CsvMetricsCollector` writes migration metrics in CSV format, making them easy to import into Excel, Google Sheets, or any data analysis tool. Perfect for creating charts, pivot tables, and tracking migration history over time.

**Perfect for:**
- ✅ Excel analysis
- ✅ Creating charts and graphs
- ✅ Pivot tables
- ✅ Historical tracking
- ✅ Sharing with non-technical stakeholders

---

## Quick Start

```typescript
import {
  MigrationScriptExecutor,
  CsvMetricsCollector
} from '@vlavrynovych/msr';

const executor = new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new CsvMetricsCollector({
      filePath: './metrics/migrations.csv',
      includeHeader: true
    })
  ], 
  config 
});

await executor.up();
```

**Output file** (`./metrics/migrations.csv`):
```csv
timestamp,migration,migrationTimestamp,durationMs,status,error
2025-01-15T10:30:00Z,V1_CreateUsers,202501010001,823,success,
2025-01-15T10:30:01Z,V2_AddEmail,202501010002,645,success,
2025-01-15T10:30:02Z,V3_AddIndex,202501010003,,failed,Index already exists
```

---

## API

### Constructor

```typescript
new CsvMetricsCollector(config: CsvMetricsCollectorConfig)
```

### Configuration

```typescript
interface CsvMetricsCollectorConfig {
  /** Path to output CSV file */
  filePath: string;

  /** Include header row (default: true) */
  includeHeader?: boolean;

  /** Column delimiter (default: ',') */
  delimiter?: string;
}
```

---

## CSV Format

### Columns

1. **timestamp** - ISO 8601 when metric was recorded
2. **migration** - Migration script name
3. **migrationTimestamp** - Migration timestamp number
4. **durationMs** - Duration in milliseconds (empty for errors)
5. **status** - 'success' or 'failed'
6. **error** - Error message (empty for success)

### Example

```csv
timestamp,migration,migrationTimestamp,durationMs,status,error
2025-01-15T10:30:00.100Z,V1_CreateUsers,202501010001,823,success,
2025-01-15T10:30:00.923Z,V2_AddEmail,202501010002,645,success,
2025-01-15T10:30:01.568Z,V3_AddIndex,202501010003,,failed,Index already exists
```

---

## Examples

### Basic Usage

```typescript
new CsvMetricsCollector({
  filePath: './metrics/migrations.csv'
})
```

---

### Append to Existing File

```typescript
// First run - create with header
new CsvMetricsCollector({
  filePath: './metrics/history.csv',
  includeHeader: true
})

// Subsequent runs - append without header
new CsvMetricsCollector({
  filePath: './metrics/history.csv',
  includeHeader: false
})
```

---

### Custom Delimiter

```typescript
// Tab-separated values
new CsvMetricsCollector({
  filePath: './metrics/migrations.tsv',
  delimiter: '\t'
})

// Pipe-separated
new CsvMetricsCollector({
  filePath: './metrics/migrations.psv',
  delimiter: '|'
})
```

---

## Excel Analysis

### Import into Excel

1. Open Excel
2. Go to **Data** > **Get Data** > **From File** > **From Text/CSV**
3. Select your CSV file
4. Click **Load**

### Create Pivot Table

1. Select data range
2. Go to **Insert** > **PivotTable**
3. Analyze by:
   - Average duration per migration
   - Success vs failure rates
   - Trends over time

### Create Charts

```
Average Duration by Migration:
- X-axis: Migration names
- Y-axis: Average duration (ms)
- Chart type: Column chart

Success Rate Over Time:
- X-axis: Timestamp (by day)
- Y-axis: Success percentage
- Chart type: Line chart
```

---

## Appending Data

### Historical Tracking Pattern

```typescript
// Week 1 - Create new file
new CsvMetricsCollector({
  filePath: './metrics/2025-history.csv',
  includeHeader: true
})

// Week 2+ - Append without header
new CsvMetricsCollector({
  filePath: './metrics/2025-history.csv',
  includeHeader: false
})
```

**Result:** Single CSV with entire year's data

---

## Special Character Handling

CSV properly escapes:
- Commas in error messages
- Quotes in error messages
- Newlines in error messages

### Example

```csv
timestamp,migration,migrationTimestamp,durationMs,status,error
2025-01-15T10:30:00Z,V1_Test,202501010001,,failed,"Error: column ""name"" already exists, must be unique"
```

Quoted fields with escaped quotes (`""`) for proper Excel handling.

[← JsonMetricsCollector](json-collector){: .btn }
[Custom Collectors →](custom-collectors){: .btn .btn-primary }
