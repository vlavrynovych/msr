---
layout: default
title: Production Deployment
parent: Guides
nav_order: 10
---

# Production Deployment Guide
{: .no_toc }

Best practices for deploying MSR migrations safely in production environments.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Production migrations require careful planning, proper security, and reliable execution. This guide covers industry best practices for deploying database migrations safely in production environments.

{: .important }
> **Critical**: Always use the CLI for production migrations. The programmatic API is designed for development and testing only.

---

## Security Best Practices

### Principle of Least Privilege

Your application should have **minimal** database permissions. Migrations require elevated permissions that your application should never have in production.

#### ❌ **DON'T: Give App DDL Permissions**

```sql
-- DANGEROUS: App can modify schema
GRANT ALL PRIVILEGES ON DATABASE mydb TO myapp;
```

**Problems:**
- If app is compromised, attacker can DROP tables
- Violates principle of least privilege
- Increased attack surface
- No separation of concerns

####

 ✅ **DO: Separate Migration and Application Credentials**

```sql
-- PostgreSQL Example

-- 1. Migration user (used during deployment only)
CREATE USER migration_user WITH PASSWORD 'secure_migration_pass';
GRANT CREATE, ALTER, DROP ON SCHEMA public TO migration_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migration_user;

-- 2. Application user (used by running app)
CREATE USER app_user WITH PASSWORD 'secure_app_pass';
GRANT CONNECT ON DATABASE mydb TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Future tables inherit permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

**Benefits:**
- ✅ App cannot modify schema
- ✅ Attacker cannot DROP tables even if app is compromised
- ✅ Clear audit trail (who modified schema)
- ✅ Migrations use separate credentials (revocable)

### Credential Management

#### Development vs Production Credentials

```bash
# .env.development
DATABASE_URL=postgres://dev_user:dev_pass@localhost:5432/mydb_dev

# .env.production (stored in secret manager)
DATABASE_URL=postgres://app_user:prod_app_pass@db.prod:5432/mydb_prod
MIGRATION_DATABASE_URL=postgres://migration_user:prod_mig_pass@db.prod:5432/mydb_prod
```

#### Secret Storage Options

| Platform | Secret Storage | Example |
|----------|---------------|---------|
| **Kubernetes** | Secrets | `kubectl create secret generic db-creds --from-literal=url=postgres://...` |
| **AWS** | Secrets Manager / SSM | `aws secretsmanager get-secret-value --secret-id prod/db/url` |
| **GCP** | Secret Manager | `gcloud secrets versions access latest --secret="db-url"` |
| **Azure** | Key Vault | `az keyvault secret show --vault-name myvault --name db-url` |
| **Heroku** | Config Vars | `heroku config:set DATABASE_URL=...` |
| **Docker** | Secrets | `docker secret create db_url /path/to/secret` |
| **GitHub Actions** | Secrets | `${{ secrets.DATABASE_URL }}` |

---

## Deployment Patterns by Platform

### Heroku

**Recommended: Release Phase**

```bash
# Procfile
release: npx msr migrate --config-file production.config.json
web: npm start
```

**Features:**
- ✅ Runs once before new release
- ✅ Deployment fails if migrations fail
- ✅ Automatic rollback on failure
- ✅ Visible in logs

**Configuration:**
```bash
# Set migration credentials
heroku config:set DATABASE_URL=postgres://migration_user:pass@host/db --app myapp
```

**Deployment:**
```bash
git push heroku main
# Heroku automatically runs release phase
```

---

### Railway / Render

**Recommended: Release Command**

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "releaseCommand": "npx msr migrate"
  }
}
```

**Features:**
- ✅ Runs before service starts
- ✅ Deployment fails if migrations fail
- ✅ No race conditions

---

### AWS ECS / Fargate

**Recommended: Separate Migration Task**

```bash
#!/bin/bash
# deploy.sh

# 1. Run migration task
TASK_ARN=$(aws ecs run-task \
  --cluster production \
  --task-definition myapp-migrations:latest \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Waiting for migrations to complete..."
aws ecs wait tasks-stopped --cluster production --tasks $TASK_ARN

# 2. Check if migrations succeeded
EXIT_CODE=$(aws ecs describe-tasks \
  --cluster production \
  --tasks $TASK_ARN \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

if [ "$EXIT_CODE" != "0" ]; then
  echo "Migrations failed with exit code $EXIT_CODE"
  exit 1
fi

# 3. Deploy application
aws ecs update-service \
  --cluster production \
  --service myapp \
  --force-new-deployment
```

**Task Definition for Migrations:**
```json
{
  "family": "myapp-migrations",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "migrations",
      "image": "myapp:latest",
      "command": ["npx", "msr", "migrate"],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:prod/db/url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/myapp-migrations",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "migrations"
        }
      }
    }
  ]
}
```

---

### Google Cloud Run

**Recommended: Cloud Build + Migration Job**

```yaml
# cloudbuild.yaml
steps:
  # Build image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/myapp:$SHORT_SHA', '.']

  # Push image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/myapp:$SHORT_SHA']

  # Run migrations
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'jobs'
      - 'execute'
      - 'myapp-migrations'
      - '--image=gcr.io/$PROJECT_ID/myapp:$SHORT_SHA'
      - '--region=us-central1'
      - '--wait'

  # Deploy service
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'myapp'
      - '--image=gcr.io/$PROJECT_ID/myapp:$SHORT_SHA'
      - '--region=us-central1'
```

---

### Docker Compose

**Recommended: Separate Migration Service**

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  migrations:
    image: myapp:latest
    command: npx msr migrate
    environment:
      DATABASE_URL: postgres://migration_user:mig_pass@db:5432/mydb
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
    restart: on-failure

  app:
    image: myapp:latest
    command: npm start
    environment:
      DATABASE_URL: postgres://app_user:app_pass@db:5432/mydb
      NODE_ENV: production
    depends_on:
      migrations:
        condition: service_completed_successfully
    ports:
      - "3000:3000"
    replicas: 3  # Safe to scale after migrations

volumes:
  postgres_data:
```

**Deployment:**
```bash
docker-compose up -d
```

---

### Kubernetes

**Recommended: Init Container**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
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
      # Run migrations before starting app
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

      # Application containers start after migrations succeed
      containers:
      - name: app
        image: myapp:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: app-url
        - name: NODE_ENV
          value: "production"
```

**Alternative: Separate Job (Recommended for zero-downtime)**

{% raw %}
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: myapp-migrations-{{ .Release.Revision }}
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrations
        image: myapp:latest
        command: ["npx", "msr", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: migration-url
```
{% endraw %}

**Deployment script:**
```bash
#!/bin/bash
# Run migration job
kubectl apply -f migration-job.yaml

# Wait for job to complete
kubectl wait --for=condition=complete --timeout=300s job/myapp-migrations-$REVISION

# Check job status
if kubectl get job myapp-migrations-$REVISION -o jsonpath='{.status.succeeded}' | grep -q "1"; then
  echo "Migrations succeeded"
  # Deploy application
  kubectl rollout restart deployment/myapp
else
  echo "Migrations failed"
  exit 1
fi
```

---

## Deployment Workflow

### Standard Production Deployment

```mermaid
sequenceDiagram
    participant CI as CI/CD Pipeline
    participant DB as Database
    participant App as Application

    CI->>CI: Build & Test
    CI->>DB: Run Migrations (CLI)
    DB-->>CI: Success/Failure

    alt Migrations Succeed
        CI->>App: Deploy New Version
        App->>DB: Use New Schema
    else Migrations Fail
        CI->>CI: Abort Deployment
        Note over CI,App: App keeps running old version
    end
```

### Zero-Downtime Deployment

For backward-compatible schema changes:

```mermaid
graph LR
    A[Deploy Migration] --> B[Old App Still Running]
    B --> C[Migration Completes]
    C --> D[Deploy New App Version]
    D --> E[Rolling Update]
    E --> F[Both Versions Coexist]
    F --> G[Old Version Scaled Down]
    G --> H[New Version Fully Deployed]

    style A fill:#fff9c4
    style C fill:#c8e6c9
    style H fill:#a5d6a7
```

**Requirements:**
1. New migration must be backward-compatible
2. Old app version can work with new schema
3. Use rolling updates (not recreate strategy)

**Example backward-compatible change:**
```sql
-- Add nullable column (safe)
ALTER TABLE users ADD COLUMN middle_name VARCHAR(100);

-- ❌ NOT backward-compatible:
-- ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) NOT NULL;
```

---

## Rollback Strategies

### Migration Rollback

**When to rollback:**
- Migration fails during deployment
- Migration succeeds but breaks application
- Need to revert to previous version quickly

**How to rollback:**

**Option 1: Using down() methods**
```bash
# Roll back to specific version
npx msr down 202501150100
```

**Option 2: Database backup/restore**
```bash
# Restore from backup taken before migration
pg_restore -d mydb backup_before_migration.dump
```

**Option 3: Git revert + redeploy**
```bash
# Revert migration commit
git revert abc123

# Deploy reverted version
git push origin main
```

{: .warning }
> **Always test rollback procedures before production deployment.** Know exactly how to revert if something goes wrong.

### Deployment Rollback Checklist

Before deploying:
- [ ] Backup database
- [ ] Test migrations in staging
- [ ] Document rollback steps
- [ ] Have rollback scripts ready
- [ ] Know downtime window
- [ ] Have communication plan

If deployment fails:
1. **Stop deployment immediately**
2. **Assess impact** - is app still running?
3. **Run rollback** - migration and/or app
4. **Verify** - check database state
5. **Communicate** - notify team
6. **Post-mortem** - what went wrong?

---

## Monitoring and Logging

### Migration Logs

Ensure migration output is captured:

```bash
# GitHub Actions
- name: Run Migrations
  run: npx msr migrate 2>&1 | tee migration.log
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Upload Migration Logs
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: migration-logs
    path: migration.log
```

### Health Checks

Add database health check before accepting traffic:

```typescript
// src/health.ts
export async function checkDatabaseHealth() {
  try {
    // Check connection
    await db.query('SELECT 1');

    // Check schema version matches expectation
    const version = await getCurrentSchemaVersion();
    const expectedVersion = process.env.EXPECTED_SCHEMA_VERSION;

    if (version !== expectedVersion) {
      throw new Error(`Schema version mismatch: ${version} !== ${expectedVersion}`);
    }

    return {healthy: true};
  } catch (error) {
    return {healthy: false, error: error.message};
  }
}
```

### Alerts

Set up alerts for migration failures:

```yaml
# CloudWatch alarm (example)
MigrationFailureAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: migration-failure
    MetricName: MigrationFailures
    Namespace: MSR/Migrations
    Statistic: Sum
    Period: 60
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold
    AlarmActions:
      - !Ref SNSTopic
```

---

## Testing Production Migrations

### Staging Environment

**Always test in staging first:**

1. **Replicate production** - same database, same scale
2. **Run migration** - exactly as in production
3. **Verify** - check schema, check app
4. **Measure** - how long did it take?
5. **Test rollback** - can you revert?

### Production-like Testing

```bash
# 1. Clone production database (anonymized)
pg_dump prod_db | pg_restore staging_db

# 2. Run migration in staging
npx msr migrate --config-file staging.config.json

# 3. Verify migration
npx msr list
psql -d staging_db -c "\d users"

# 4. Test application
npm run e2e:staging

# 5. Test rollback
npx msr down 202501150100
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Migrations tested in staging
- [ ] Database backup completed
- [ ] Rollback procedure documented
- [ ] Team notified of deployment window
- [ ] Monitoring/alerts configured
- [ ] Health checks in place
- [ ] Migration credentials configured
- [ ] Expected downtime communicated

### During Deployment

- [ ] Migration logs being captured
- [ ] Migration progress being monitored
- [ ] Health checks passing
- [ ] Error alerts configured
- [ ] Rollback scripts ready

### Post-Deployment

- [ ] Verify schema version
- [ ] Check application health
- [ ] Monitor error rates
- [ ] Review migration logs
- [ ] Confirm no performance degradation
- [ ] Update documentation
- [ ] Cleanup old backups (if safe)

---

## Common Production Issues

### Issue: Migration Takes Too Long

**Problem:** Migration locks table, causing downtime

**Solutions:**
1. **Add index concurrently** (PostgreSQL):
   ```sql
   CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
   ```

2. **Batch large updates**:
   ```sql
   -- Instead of: UPDATE users SET status = 'active';
   -- Do in batches:
   UPDATE users SET status = 'active' WHERE id >= 0 AND id < 10000;
   UPDATE users SET status = 'active' WHERE id >= 10000 AND id < 20000;
   ```

3. **Schedule during low-traffic window**

### Issue: Migration Fails Halfway

**Problem:** Some migrations succeeded, some failed

**Solutions:**
1. **Use transactions** (if supported):
   ```typescript
   config.transaction.mode = TransactionMode.PER_BATCH;
   ```

2. **Implement idempotent migrations**:
   ```sql
   -- Can run multiple times safely
   CREATE TABLE IF NOT EXISTS users (...);
   ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
   ```

3. **Test thoroughly in staging**

### Issue: Multiple Instances Run Migrations

**Problem:** Race condition from concurrent execution

**Solutions:**

1. **Enable MSR Locking (v0.8.0+)** - Built-in database-level locking:
   ```typescript
   // Implement ILockingService in your handler
   handler.lockingService = new MyDatabaseLockingService(db);

   // Configure locking (optional - enabled by default)
   config.locking.enabled = true;
   config.locking.timeout = 600_000;  // 10 minutes
   ```
   See [Locking Configuration](../configuration/locking-settings) for full implementation guide.

2. **Use Init Container (Kubernetes)** - One migration per deployment:
   ```yaml
   initContainers:
     - name: migrations
       image: myapp:latest
       command: ["npx", "msr", "migrate"]
   ```

3. **Use Deployment Hook** - Platform-level guarantee (Heroku, Railway, etc.)

4. **Run Before Scaling** - Execute migrations before spinning up multiple instances

---

## Best Practices Summary

### ✅ DO

- Use CLI for production migrations
- Separate migration and application credentials
- Test in production-like staging environment
- Backup database before migrations
- Document rollback procedures
- Monitor migration execution
- Use transactions when possible
- Log migration output
- Verify schema after deployment
- Have health checks

### ❌ DON'T

- Use programmatic API in production
- Give application DDL permissions
- Run migrations from multiple instances
- Skip staging testing
- Deploy without backups
- Ignore migration failures
- Rush production deployments
- Skip rollback testing
- Deploy during peak traffic
- Forget to communicate downtime

---

{: .note }
> **Production Rule**: When deploying to production, always use CLI, always test in staging, always have a rollback plan.
