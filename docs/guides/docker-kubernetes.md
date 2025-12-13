---
layout: default
title: Docker & Kubernetes
parent: Guides
nav_order: 12
---

# Docker & Kubernetes Deployment
{: .no_toc }

Container orchestration patterns for running MSR migrations safely and reliably.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Containers and orchestration platforms require special consideration for database migrations:
- **Single execution** - Migrations must run once, not per container instance
- **Ordering** - Migrations must complete before application starts
- **Failure handling** - Failed migrations should prevent deployment
- **Secrets management** - Database credentials must be secure

---

## Docker

### Basic Dockerfile

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Build if needed
RUN npm run build

# Application runs separately from migrations
CMD ["npm", "start"]
```

{: .important }
> **Don't run migrations in ENTRYPOINT or CMD** - migrations should be a separate step

###

 Docker Compose Patterns

#### Pattern 1: Separate Migration Service (Recommended)

```yaml
version: '3.8'

services:
  # Database
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Run migrations (separate service)
  migrations:
    image: myapp:latest
    command: npx msr migrate
    environment:
      DATABASE_URL: postgres://migration_user:${MIGRATION_PASSWORD}@db:5432/mydb
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
    restart: on-failure

  # Application
  app:
    image: myapp:latest
    command: npm start
    environment:
      DATABASE_URL: postgres://app_user:${APP_PASSWORD}@db:5432/mydb
      NODE_ENV: production
    ports:
      - "3000:3000"
    depends_on:
      migrations:
        condition: service_completed_successfully
    deploy:
      replicas: 3  # Safe to scale after migrations

volumes:
  postgres_data:
```

**Benefits:**
- ✅ Migrations run once
- ✅ App starts only after migrations succeed
- ✅ Separate credentials for migrations vs app
- ✅ Easy to scale app service

**Usage:**
```bash
docker-compose up -d
```

#### Pattern 2: Multi-Stage Build with Scripts

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

# Separate scripts for migrations and app
COPY scripts/migrate.sh /usr/local/bin/migrate
COPY scripts/start.sh /usr/local/bin/start

RUN chmod +x /usr/local/bin/migrate /usr/local/bin/start

# Default to app, override for migrations
CMD ["start"]
```

**migrate.sh:**
```bash
#!/bin/sh
set -e

echo "Running migrations..."
npx msr migrate

echo "Migrations completed successfully"
```

**start.sh:**
```bash
#!/bin/sh
set -e

echo "Starting application..."
exec npm start
```

**docker-compose.yml:**
```yaml
services:
  migrations:
    image: myapp:latest
    command: migrate
    environment:
      DATABASE_URL: ${MIGRATION_DATABASE_URL}

  app:
    image: myapp:latest
    command: start
    environment:
      DATABASE_URL: ${APP_DATABASE_URL}
    depends_on:
      migrations:
        condition: service_completed_successfully
```

---

## Kubernetes

### Pattern 1: Init Container (Recommended for Most Cases)

Init containers run before main application containers and block startup if they fail.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      # Init container runs migrations before app starts
      initContainers:
      - name: migrations
        image: myapp:latest
        command: ["npx", "msr", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: migration-url
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"

      # Application containers start after migrations succeed
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: app-url
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Benefits:**
- ✅ Migrations run once per pod
- ✅ Pod fails if migrations fail
- ✅ Built into Kubernetes primitives
- ✅ Works with rolling updates

**Limitations:**
- ⚠️ Runs per pod (can cause race conditions during rolling updates)
- ⚠️ Not ideal for zero-downtime deployments

### Pattern 2: Separate Job (Recommended for Production)

Jobs run once to completion and are separate from deployments.

{% raw %}
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: myapp-migrations-{{ .Values.version }}
  namespace: production
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 300  # 5 minute timeout
  template:
    metadata:
      labels:
        app: myapp-migrations
    spec:
      restartPolicy: Never
      containers:
      - name: migrations
        image: myapp:{{ .Values.version }}
        command: ["npx", "msr", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: migration-url
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:{{ .Values.version }}
        # ... app container spec
```
{% endraw %}

**Deployment Script:**
```bash
#!/bin/bash
set -e

VERSION=$1
NAMESPACE="production"

# 1. Create and run migration job
echo "Running migrations for version $VERSION..."
kubectl create -f migration-job-$VERSION.yaml

# 2. Wait for job to complete
kubectl wait \
  --for=condition=complete \
  --timeout=300s \
  job/myapp-migrations-$VERSION \
  -n $NAMESPACE

# 3. Check job status
if kubectl get job myapp-migrations-$VERSION -n $NAMESPACE -o jsonpath='{.status.succeeded}' | grep -q "1"; then
  echo "✓ Migrations succeeded"
else
  echo "✗ Migrations failed"
  kubectl logs job/myapp-migrations-$VERSION -n $NAMESPACE
  exit 1
fi

# 4. Deploy application
echo "Deploying application..."
kubectl apply -f deployment-$VERSION.yaml

# 5. Wait for rollout
kubectl rollout status deployment/myapp -n $NAMESPACE

echo "✓ Deployment complete"
```

**Benefits:**
- ✅ Migrations run exactly once
- ✅ No race conditions
- ✅ Better for zero-downtime deployments
- ✅ Explicit control over execution
- ✅ Easy to debug (separate pod)

### Pattern 3: Helm Chart

{% raw %}
```yaml
# templates/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "myapp.fullname" . }}-migrations-{{ .Release.Revision }}
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
    component: migrations
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation
spec:
  backoffLimit: {{ .Values.migrations.backoffLimit | default 3 }}
  activeDeadlineSeconds: {{ .Values.migrations.timeout | default 300 }}
  template:
    metadata:
      name: {{ include "myapp.fullname" . }}-migrations
      labels:
        {{- include "myapp.selectorLabels" . | nindent 8 }}
        component: migrations
    spec:
      restartPolicy: Never
      containers:
      - name: migrations
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
        command: ["npx", "msr", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{ .Values.database.secretName }}
              key: migration-url
        {{- with .Values.migrations.extraEnv }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
        resources:
          {{- toYaml .Values.migrations.resources | nindent 10 }}
```
{% endraw %}

**values.yaml:**
```yaml
image:
  repository: myapp
  tag: "1.0.0"

database:
  secretName: db-credentials

migrations:
  backoffLimit: 3
  timeout: 300
  resources:
    requests:
      memory: 256Mi
      cpu: 200m
    limits:
      memory: 512Mi
      cpu: 500m
  extraEnv:
    - name: NODE_ENV
      value: production
```

**Deploy:**
```bash
helm upgrade --install myapp ./myapp-chart \
  --namespace production \
  --values production-values.yaml \
  --wait
```

**Benefits:**
- ✅ Runs as Helm hook (before upgrade/install)
- ✅ Automatic cleanup with hook-delete-policy
- ✅ Parameterized configuration
- ✅ Follows Helm best practices

---

## Secrets Management

### Kubernetes Secrets

```yaml
# Create secret
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: production
type: Opaque
stringData:
  migration-url: postgres://migration_user:migration_pass@postgres:5432/mydb
  app-url: postgres://app_user:app_pass@postgres:5432/mydb
```

```bash
# Or via kubectl
kubectl create secret generic db-credentials \
  --from-literal=migration-url='postgres://...' \
  --from-literal=app-url='postgres://...' \
  --namespace production
```

### External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: db-credentials
  data:
  - secretKey: migration-url
    remoteRef:
      key: prod/database/migration-url
  - secretKey: app-url
    remoteRef:
      key: prod/database/app-url
```

### Sealed Secrets

```bash
# Create sealed secret
kubectl create secret generic db-credentials \
  --from-literal=migration-url='postgres://...' \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Apply to cluster
kubectl apply -f sealed-secret.yaml
```

---

## Health Checks and Readiness

### Application Health Check

```typescript
// src/health.ts
import {MigrationScriptExecutor} from '@migration-script-runner/core';

export async function checkHealth() {
  try {
    // Check database connection
    await db.query('SELECT 1');

    // Optionally: check schema version
    const executor = new MigrationScriptExecutor({handler, config});
    const status = await executor.list(1);

    return {
      status: 'healthy',
      database: 'connected',
      lastMigration: status[0]?.timestamp
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}
```

### Kubernetes Probes

```yaml
containers:
- name: app
  image: myapp:latest
  ports:
  - containerPort: 3000
  livenessProbe:
    httpGet:
      path: /health
      port: 3000
    initialDelaySeconds: 30
    periodSeconds: 10
    failureThreshold: 3
  readinessProbe:
    httpGet:
      path: /ready
      port: 3000
    initialDelaySeconds: 5
    periodSeconds: 5
    failureThreshold: 3
```

---

## Zero-Downtime Deployments

### Requirements for Zero-Downtime

1. **Backward-compatible migrations**
   ```sql
   -- ✅ Good: Add nullable column
   ALTER TABLE users ADD COLUMN middle_name VARCHAR(100);

   -- ❌ Bad: Add required column (breaks old version)
   ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) NOT NULL;
   ```

2. **Rolling update strategy**
   ```yaml
   spec:
     strategy:
       type: RollingUpdate
       rollingUpdate:
         maxSurge: 1
         maxUnavailable: 0
   ```

3. **Separate migration job** (not init container)

### Deployment Sequence

```mermaid
sequenceDiagram
    participant CI as CI/CD
    participant Job as Migration Job
    participant DB as Database
    participant Old as Old Pods
    participant New as New Pods

    CI->>Job: Create migration job
    Job->>DB: Run migrations
    DB-->>Job: Success

    CI->>New: Deploy new version (1 pod)
    New->>DB: Use new schema
    Old->>DB: Use new schema

    CI->>New: Scale up new version
    CI->>Old: Scale down old version

    Note over New,Old: Both versions work with new schema
```

---

## Monitoring and Logging

### Centralized Logging

```yaml
# Fluentd sidecar for migration logs
initContainers:
- name: migrations
  image: myapp:latest
  command: ["sh", "-c"]
  args:
    - |
      npx msr migrate 2>&1 | tee /var/log/migrations.log
  volumeMounts:
  - name: logs
    mountPath: /var/log

- name: log-forwarder
  image: fluent/fluent-bit:latest
  volumeMounts:
  - name: logs
    mountPath: /var/log
  - name: fluent-bit-config
    mountPath: /fluent-bit/etc/

volumes:
- name: logs
  emptyDir: {}
- name: fluent-bit-config
  configMap:
    name: fluent-bit-config
```

### Prometheus Metrics

```yaml
# ServiceMonitor for migration metrics
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: myapp-migrations
spec:
  selector:
    matchLabels:
      app: myapp-migrations
  endpoints:
  - port: metrics
    interval: 30s
```

---

## Troubleshooting

### Issue: Init container fails repeatedly

**Problem:** Migration fails, pod never starts

**Debug:**
```bash
# View init container logs
kubectl logs pod/myapp-xxx -c migrations

# Describe pod for events
kubectl describe pod myapp-xxx

# Check previous failed attempt
kubectl logs pod/myapp-xxx -c migrations --previous
```

**Solutions:**
- Check database connectivity
- Verify credentials in secret
- Check migration files exist
- Review migration logs

### Issue: Race condition during rolling update

**Problem:** Multiple pods run migrations simultaneously

**Solution:** Use separate Job instead of init container

```bash
# Check if multiple migration pods running
kubectl get pods -l app=myapp -o wide

# Use Job pattern instead
```

### Issue: Migration job doesn't complete

**Problem:** Job stuck in running state

**Debug:**
```bash
# Check job status
kubectl describe job myapp-migrations

# Check pod logs
kubectl logs job/myapp-migrations

# Check pod events
kubectl get events --sort-by='.lastTimestamp'
```

**Solutions:**
- Increase activeDeadlineSeconds
- Check database locks
- Verify network connectivity

---

## Best Practices Summary

### ✅ DO

- Use separate migration step (Job or init container)
- Use Kubernetes Secrets for credentials
- Set resource limits on migration containers
- Implement health checks
- Use Jobs for production deployments
- Log migration output
- Set timeouts (activeDeadlineSeconds)
- Use separate credentials for migrations vs app
- Test in staging first
- Document rollback procedure

### ❌ DON'T

- Run migrations in ENTRYPOINT/CMD
- Use same credentials for app and migrations
- Run migrations from every pod
- Skip health checks
- Ignore migration failures
- Use init containers for zero-downtime deployments
- Forget to set resource limits
- Deploy without testing

---

## Complete Examples

### Example: Production-Ready Kubernetes Deployment

Available in the repository:
- `examples/kubernetes/deployment.yaml` - Full deployment with init container
- `examples/kubernetes/migration-job.yaml` - Separate migration job
- `examples/kubernetes/secrets.yaml` - Secret templates
- `examples/helm/myapp/` - Complete Helm chart

### Example: Docker Compose for Development

Available in the repository:
- `examples/docker-compose/development.yml` - Local development setup
- `examples/docker-compose/production.yml` - Production-like setup

---

## Related Documentation

- [Production Deployment](production-deployment) - Deployment best practices
- [CI/CD Integration](ci-cd-integration) - Pipeline examples
- [CLI vs API Usage](cli-vs-api) - When to use CLI
- [Environment Variables](environment-variables) - Configuration options

---

{: .note }
> **Container Rule**: Always run migrations as a separate step before application containers start. Use Jobs for production, init containers for development.
