---
layout: default
title: Custom Collectors
parent: Metrics Collection
grand_parent: Extending MSR
nav_order: 5
---

# Custom Metrics Collectors
{: .no_toc }

Build collectors for your monitoring service or custom use case.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Create custom collectors by implementing the `IMetricsCollector` interface. Send metrics to Datadog, Prometheus, CloudWatch, or any monitoring service.

**Build collectors for:**
- Cloud monitoring services (Datadog, CloudWatch, etc.)
- Time-series databases (Prometheus, InfluxDB)
- Custom analytics platforms
- Notification systems (Slack, PagerDuty)
- Internal monitoring tools

---

## Interface

```typescript
interface IMetricsCollector {
  recordMigrationStart?(context: IMigrationContext): void;
  recordMigrationComplete?(result: IMigrationResult, duration: number): void;
  recordScriptStart?(script: MigrationScript): void;
  recordScriptComplete?(script: MigrationScript, duration: number): void;
  recordScriptError?(script: MigrationScript, error: Error): void;
  recordRollback?(strategy: RollbackStrategy, success: boolean, duration?: number): void;
  recordValidationErrors?(errors: ValidationError[]): void;
  recordBackup?(backupPath: string, duration: number): void;
  recordError?(error: Error): void;
  close?(): Promise<void>;
}
```

**All methods are optional** - implement only what you need.

---

## Quick Example

### Simple HTTP Metrics Collector

Post metrics to any HTTP endpoint:

```typescript
import { IMetricsCollector, MigrationScript } from '@vlavrynovych/msr';

export class HttpMetricsCollector implements IMetricsCollector {
  constructor(private endpoint: string) {}

  recordScriptComplete(script: MigrationScript, duration: number): void {
    fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'script_complete',
        script: script.name,
        duration,
        timestamp: new Date().toISOString()
      })
    }).catch(err => console.error('Metrics error:', err));
  }

  recordScriptError(script: MigrationScript, error: Error): void {
    fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'script_error',
        script: script.name,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }).catch(err => console.error('Metrics error:', err));
  }
}
```

**Usage:**
```typescript
new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new HttpMetricsCollector('https://api.example.com/metrics')
  ]
}, config);
```

---

## Complete Examples

### Cloud Service Integration

The examples below show production-ready integrations with popular cloud monitoring services.

**Note:** These collectors are currently custom implementations. They will be added as built-in collectors in future releases:
- [#118 - DatadogCollector](https://github.com/migration-script-runner/msr-core/issues/118)
- [#119 - CloudWatchCollector](https://github.com/migration-script-runner/msr-core/issues/119)
- [#120 - PrometheusCollector](https://github.com/migration-script-runner/msr-core/issues/120)

---

### Datadog Collector

**Status:** Custom implementation (will be built-in in [future release](https://github.com/migration-script-runner/msr-core/issues/118))

Send metrics to Datadog APM using the StatsD client:

```typescript
import { IMetricsCollector, MigrationScript, IMigrationResult, IMigrationContext } from '@vlavrynovych/msr';
import StatsD from 'hot-shots';

export interface DataDogCollectorConfig {
  apiKey: string;
  host?: string;
  prefix?: string;
}

export class DataDogCollector implements IMetricsCollector {
  private client: StatsD;

  constructor(config: DataDogCollectorConfig) {
    this.client = new StatsD({
      host: config.host || 'localhost',
      port: 8125,
      prefix: config.prefix || 'msr.',
      globalTags: {
        env: process.env.NODE_ENV || 'production',
        service: 'migration-runner'
      }
    });
  }

  recordMigrationStart(context: IMigrationContext): void {
    this.client.gauge('migrations.pending', context.pending, {
      executed: context.executed.toString()
    });
  }

  recordScriptComplete(script: MigrationScript, duration: number): void {
    this.client.increment('migrations.success', 1, {
      script: script.name
    });
    this.client.timing('migrations.duration', duration, {
      script: script.name
    });
  }

  recordScriptError(script: MigrationScript, error: Error): void {
    this.client.increment('migrations.failed', 1, {
      script: script.name,
      error: error.constructor.name
    });
  }

  recordRollback(strategy: string, success: boolean, duration?: number): void {
    this.client.increment('rollbacks.total', 1, {
      strategy,
      success: success.toString()
    });

    if (duration) {
      this.client.timing('rollbacks.duration', duration, { strategy });
    }
  }

  recordBackup(backupPath: string, duration: number): void {
    this.client.timing('backups.duration', duration);
    this.client.increment('backups.total', 1);
  }

  async close(): Promise<void> {
    this.client.close();
  }
}
```

**Usage:**
```typescript
import { DataDogCollector } from './collectors/DataDogCollector';

new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new DataDogCollector({
      apiKey: process.env.DD_API_KEY,
      host: 'localhost',
      prefix: 'myapp.'
    })
  ]
}, config);
```

**Install dependencies:**
```bash
npm install hot-shots
```

**Datadog Dashboards:**
- View `myapp.migrations.success` counter
- Track `myapp.migrations.duration` histograms
- Monitor `myapp.rollbacks.total` for alerts
- Create SLO based on success rate

---

### AWS CloudWatch Collector

**Status:** Custom implementation (will be built-in in [future release](https://github.com/migration-script-runner/msr-core/issues/119))

Send metrics to AWS CloudWatch:

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

export interface CloudWatchCollectorConfig {
  region: string;
  namespace?: string;  // default: 'MSR/Migrations'
  dimensions?: Array<{ Name: string; Value: string }>;
}

export class CloudWatchCollector implements IMetricsCollector {
  private client: CloudWatchClient;
  private namespace: string;
  private dimensions: Array<{ Name: string; Value: string }>;

  constructor(config: CloudWatchCollectorConfig) {
    this.client = new CloudWatchClient({ region: config.region });
    this.namespace = config.namespace || 'MSR/Migrations';
    this.dimensions = config.dimensions || [
      { Name: 'Environment', Value: process.env.NODE_ENV || 'production' }
    ];
  }

  async recordScriptComplete(script: MigrationScript, duration: number): Promise<void> {
    await this.client.send(new PutMetricDataCommand({
      Namespace: this.namespace,
      MetricData: [
        {
          MetricName: 'MigrationDuration',
          Value: duration,
          Unit: 'Milliseconds',
          Dimensions: [
            ...this.dimensions,
            { Name: 'ScriptName', Value: script.name }
          ],
          Timestamp: new Date()
        },
        {
          MetricName: 'MigrationSuccess',
          Value: 1,
          Unit: 'Count',
          Dimensions: this.dimensions,
          Timestamp: new Date()
        }
      ]
    }));
  }

  async recordScriptError(script: MigrationScript, error: Error): Promise<void> {
    await this.client.send(new PutMetricDataCommand({
      Namespace: this.namespace,
      MetricData: [{
        MetricName: 'MigrationFailures',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          ...this.dimensions,
          { Name: 'ScriptName', Value: script.name },
          { Name: 'ErrorType', Value: error.constructor.name }
        ],
        Timestamp: new Date()
      }]
    }));
  }

  async recordMigrationComplete(result: IMigrationResult, duration: number): Promise<void> {
    await this.client.send(new PutMetricDataCommand({
      Namespace: this.namespace,
      MetricData: [
        {
          MetricName: 'TotalMigrationDuration',
          Value: duration,
          Unit: 'Milliseconds',
          Dimensions: this.dimensions,
          Timestamp: new Date()
        },
        {
          MetricName: 'ScriptsExecuted',
          Value: result.executed.length,
          Unit: 'Count',
          Dimensions: this.dimensions,
          Timestamp: new Date()
        }
      ]
    }));
  }

  async recordRollback(strategy: string, success: boolean, duration?: number): Promise<void> {
    const metrics = [
      {
        MetricName: 'RollbackAttempts',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          ...this.dimensions,
          { Name: 'Strategy', Value: strategy },
          { Name: 'Success', Value: success.toString() }
        ],
        Timestamp: new Date()
      }
    ];

    if (duration) {
      metrics.push({
        MetricName: 'RollbackDuration',
        Value: duration,
        Unit: 'Milliseconds',
        Dimensions: [
          ...this.dimensions,
          { Name: 'Strategy', Value: strategy }
        ],
        Timestamp: new Date()
      });
    }

    await this.client.send(new PutMetricDataCommand({
      Namespace: this.namespace,
      MetricData: metrics
    }));
  }
}
```

**Usage:**
```typescript
import { CloudWatchCollector } from './collectors/CloudWatchCollector';

new MigrationScriptExecutor({
  handler,
  metricsCollectors: [
    new CloudWatchCollector({
      region: 'us-east-1',
      namespace: 'MyApp/Migrations',
      dimensions: [
        { Name: 'Environment', Value: 'production' },
        { Name: 'Application', Value: 'api-server' }
      ]
    })
  ]
}, config);
```

**Install dependencies:**
```bash
npm install @aws-sdk/client-cloudwatch
```

**CloudWatch Alarms:**
- Alert on `MigrationFailures` > 0
- Monitor `MigrationDuration` for performance
- Track `RollbackAttempts` for stability issues

---

### Prometheus Collector

**Status:** Custom implementation (will be built-in in [future release](https://github.com/migration-script-runner/msr-core/issues/120))

```typescript
import { register, Gauge, Counter } from 'prom-client';

export class PrometheusMetricsCollector implements IMetricsCollector {
  private durationGauge: Gauge;
  private successCounter: Counter;
  private failureCounter: Counter;

  constructor() {
    this.durationGauge = new Gauge({
      name: 'msr_script_duration_ms',
      help: 'Migration script execution duration',
      labelNames: ['script_name']
    });

    this.successCounter = new Counter({
      name: 'msr_migrations_success_total',
      help: 'Total successful migrations'
    });

    this.failureCounter = new Counter({
      name: 'msr_migrations_failed_total',
      help: 'Total failed migrations'
    });
  }

  recordScriptComplete(script: MigrationScript, duration: number): void {
    this.durationGauge.set({ script_name: script.name }, duration);
    this.successCounter.inc();
  }

  recordScriptError(script: MigrationScript, error: Error): void {
    this.failureCounter.inc();
  }
}
```

---

### Slack Notification Collector

```typescript
export class SlackMetricsCollector implements IMetricsCollector {
  constructor(private webhookUrl: string) {}

  recordScriptError(script: MigrationScript, error: Error): void {
    fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `⚠️ Migration Failed`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Migration Failed*\n*Script:* ${script.name}\n*Error:* ${error.message}`
            }
          }
        ]
      })
    });
  }

  recordMigrationComplete(result: IMigrationResult, duration: number): void {
    if (!result.success) {
      fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `❌ Migration Process Failed (${duration}ms)`
        })
      });
    }
  }
}
```

---

### Database Collector

```typescript
export class DatabaseMetricsCollector implements IMetricsCollector {
  constructor(private db: IDatabase) {}

  async recordScriptComplete(script: MigrationScript, duration: number): Promise<void> {
    await this.db.query(
      'INSERT INTO migration_metrics (name, timestamp, duration, status) VALUES (?, ?, ?, ?)',
      [script.name, script.timestamp, duration, 'success']
    );
  }

  async recordScriptError(script: MigrationScript, error: Error): Promise<void> {
    await this.db.query(
      'INSERT INTO migration_metrics (name, timestamp, error, status) VALUES (?, ?, ?, ?)',
      [script.name, script.timestamp, error.message, 'failed']
    );
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
```

---

## Best Practices

### 1. Handle Errors Gracefully

```typescript
recordScriptComplete(script: MigrationScript, duration: number): void {
  try {
    // Send metrics
    this.sendToMonitoring(script, duration);
  } catch (error) {
    // Log but don't throw - metrics failures shouldn't stop migrations
    console.error('Metrics error:', error);
  }
}
```

### 2. Use Async When Needed

```typescript
async recordScriptComplete(script: MigrationScript, duration: number): Promise<void> {
  await this.apiClient.send({
    metric: 'migration.duration',
    value: duration
  });
}

async close(): Promise<void> {
  await this.apiClient.flush();
}
```

### 3. Batch Operations

```typescript
export class BatchingCollector implements IMetricsCollector {
  private buffer: MetricEvent[] = [];

  recordScriptComplete(script: MigrationScript, duration: number): void {
    this.buffer.push({ type: 'complete', script, duration });

    if (this.buffer.length >= 10) {
      this.flush();
    }
  }

  async close(): Promise<void> {
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    await this.apiClient.sendBatch(this.buffer);
    this.buffer = [];
  }
}
```

### 4. Add Configuration

```typescript
export interface CloudWatchCollectorConfig {
  region: string;
  namespace: string;
  dimensions?: Record<string, string>;
}

export class CloudWatchMetricsCollector implements IMetricsCollector {
  constructor(private config: CloudWatchCollectorConfig) {}

  // Implementation...
}
```

---

## Testing Custom Collectors

```typescript
import { expect } from 'chai';

describe('MyMetricsCollector', () => {
  it('should send metrics to service', async () => {
    const collector = new MyMetricsCollector(config);
    const script = {
      name: 'V1_Test',
      timestamp: 202501010001
    } as MigrationScript;

    collector.recordScriptComplete(script, 100);

    // Verify metrics were sent
    expect(mockApiClient.calls).to.have.lengthOf(1);
  });
});
```

[← CsvMetricsCollector](csv-collector){: .btn }
[Back to Metrics Overview](./){: .btn .btn-primary }
