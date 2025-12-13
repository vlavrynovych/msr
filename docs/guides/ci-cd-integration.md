---
layout: default
title: CI/CD Integration
parent: Guides
nav_order: 11
---

# CI/CD Integration Guide
{: .no_toc }

Integrate MSR migrations into your CI/CD pipelines for automated, reliable deployments.
{: .fs-6 .fw-300 }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

CI/CD pipelines should run migrations as an explicit step before deploying your application. This ensures migrations are:
- ✅ Visible in logs
- ✅ Fail-fast (deployment stops if migrations fail)
- ✅ Auditable (who ran what, when)
- ✅ Controlled (single execution)

---

## General CI/CD Pattern

```mermaid
graph LR
    A[Build] --> B[Test]
    B --> C[Run Migrations]
    C --> D{Success?}
    D -->|Yes| E[Deploy App]
    D -->|No| F[Abort Deployment]
    E --> G[Health Check]
    G --> H{Healthy?}
    H -->|Yes| I[Complete]
    H -->|No| J[Rollback]

    style C fill:#fff9c4
    style E fill:#c8e6c9
    style F fill:#ffcdd2
    style J fill:#ffcdd2
```

---

## GitHub Actions

### Basic Workflow

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Run database migrations
        run: npx msr migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NODE_ENV: production

      - name: Deploy to production
        run: |
          # Your deployment script
          ./scripts/deploy.sh
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

### With Migration Logging

```yaml
- name: Run database migrations
  run: npx msr migrate 2>&1 | tee migration.log
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Upload migration logs
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: migration-logs-${{ github.run_number }}
    path: migration.log
    retention-days: 30
```

### Multi-Environment Workflow

```yaml
name: Deploy

on:
  push:
    branches:
      - main        # production
      - develop     # staging

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "db_url=${{ secrets.PROD_DATABASE_URL }}" >> $GITHUB_OUTPUT
          else
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "db_url=${{ secrets.STAGING_DATABASE_URL }}" >> $GITHUB_OUTPUT
          fi

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx msr migrate
        env:
          DATABASE_URL: ${{ steps.env.outputs.db_url }}
          NODE_ENV: ${{ steps.env.outputs.environment }}

      - name: Deploy to ${{ steps.env.outputs.environment }}
        run: ./scripts/deploy.sh
        env:
          ENVIRONMENT: ${{ steps.env.outputs.environment }}
```

### With Rollback on Failure

```yaml
- name: Backup database before migration
  id: backup
  run: |
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    pg_dump $DATABASE_URL > $BACKUP_FILE
    echo "backup_file=$BACKUP_FILE" >> $GITHUB_OUTPUT
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Run migrations
  id: migrations
  run: npx msr migrate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  continue-on-error: true

- name: Rollback on failure
  if: steps.migrations.outcome == 'failure'
  run: |
    echo "Migration failed, restoring backup..."
    psql $DATABASE_URL < ${{ steps.backup.outputs.backup_file }}
    exit 1
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}

- name: Deploy application
  if: steps.migrations.outcome == 'success'
  run: ./scripts/deploy.sh
```

---

## GitLab CI

### Basic Pipeline

```yaml
# .gitlab-ci.yml

stages:
  - build
  - test
  - migrate
  - deploy

variables:
  NODE_VERSION: "20"

build:
  stage: build
  image: node:${NODE_VERSION}
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
      - node_modules/
    expire_in: 1 hour

test:
  stage: test
  image: node:${NODE_VERSION}
  script:
    - npm test
  dependencies:
    - build

migrate:
  stage: migrate
  image: node:${NODE_VERSION}
  script:
    - npm ci --production
    - npx msr migrate
  environment:
    name: production
  only:
    - main
  dependencies:
    - build

deploy:
  stage: deploy
  image: node:${NODE_VERSION}
  script:
    - ./scripts/deploy.sh
  environment:
    name: production
  only:
    - main
  dependencies:
    - build
    - migrate
```

### Multi-Environment with Protected Variables

```yaml
# .gitlab-ci.yml

stages:
  - migrate
  - deploy

.migrate_template: &migrate
  image: node:20
  script:
    - npm ci --production
    - npx msr migrate 2>&1 | tee migration.log
  artifacts:
    paths:
      - migration.log
    expire_in: 30 days
    when: always

migrate:staging:
  <<: *migrate
  stage: migrate
  environment:
    name: staging
  variables:
    DATABASE_URL: $STAGING_DATABASE_URL
  only:
    - develop

migrate:production:
  <<: *migrate
  stage: migrate
  environment:
    name: production
  variables:
    DATABASE_URL: $PROD_DATABASE_URL
  only:
    - main
  when: manual  # Require manual approval for production
```

### With Kubernetes Deployment

```yaml
migrate:production:
  stage: migrate
  image: bitnami/kubectl:latest
  script:
    - kubectl create configmap migrations --from-file=migrations/ --dry-run=client -o yaml | kubectl apply -f -
    - |
      kubectl create job migration-$CI_PIPELINE_ID \
        --image=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA \
        --restart=Never \
        -- npx msr migrate
    - kubectl wait --for=condition=complete --timeout=300s job/migration-$CI_PIPELINE_ID
  environment:
    name: production
  only:
    - main
```

---

## Jenkins

### Declarative Pipeline

```groovy
// Jenkinsfile

pipeline {
    agent any

    environment {
        NODE_VERSION = '20'
        DATABASE_URL = credentials('production-database-url')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh "nvm use ${NODE_VERSION}"
                sh 'npm ci'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Run Migrations') {
            steps {
                script {
                    try {
                        sh 'npx msr migrate 2>&1 | tee migration.log'
                    } catch (Exception e) {
                        currentBuild.result = 'FAILURE'
                        error("Migration failed: ${e.message}")
                    }
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'migration.log', fingerprint: true
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh './scripts/deploy.sh'
            }
        }
    }

    post {
        failure {
            emailext(
                subject: "Migration Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
                body: "Migration failed. Check console output at ${env.BUILD_URL}",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

### With Docker

```groovy
pipeline {
    agent {
        docker {
            image 'node:20'
        }
    }

    stages {
        stage('Migrate') {
            steps {
                sh '''
                    npm ci --production
                    npx msr migrate
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh './scripts/deploy.sh'
            }
        }
    }
}
```

---

## Azure DevOps

### Basic Pipeline

```yaml
# azure-pipelines.yml

trigger:
  branches:
    include:
      - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '20.x'

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
            displayName: 'Install Node.js'

          - script: npm ci
            displayName: 'Install dependencies'

          - script: npm run build
            displayName: 'Build application'

          - script: npm test
            displayName: 'Run tests'

          - publish: $(System.DefaultWorkingDirectory)
            artifact: drop

  - stage: Migrate
    dependsOn: Build
    jobs:
      - deployment: MigrateDatabase
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - task: NodeTool@0
                  inputs:
                    versionSpec: $(nodeVersion)

                - download: current
                  artifact: drop

                - script: |
                    cd $(Pipeline.Workspace)/drop
                    npx msr migrate
                  displayName: 'Run database migrations'
                  env:
                    DATABASE_URL: $(DATABASE_URL)

  - stage: Deploy
    dependsOn: Migrate
    jobs:
      - deployment: DeployApp
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - script: ./scripts/deploy.sh
                  displayName: 'Deploy application'
```

---

## CircleCI

### Config Example

{% raw %}
```yaml
# .circleci/config.yml

version: 2.1

executors:
  node-executor:
    docker:
      - image: cimg/node:20.0
    working_directory: ~/project

jobs:
  build:
    executor: node-executor
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-dependencies-{{ checksum "package-lock.json" }}
            - v1-dependencies-
      - run:
          name: Install dependencies
          command: npm ci
      - save_cache:
          paths:
            - node_modules
          key: v1-dependencies-{{ checksum "package-lock.json" }}
      - run:
          name: Build
          command: npm run build
      - persist_to_workspace:
          root: ~/project
          paths:
            - .

  test:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Run tests
          command: npm test

  migrate:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Run migrations
          command: npx msr migrate
      - store_artifacts:
          path: migration.log
          destination: logs/migration.log

  deploy:
    executor: node-executor
    steps:
      - attach_workspace:
          at: ~/project
      - run:
          name: Deploy
          command: ./scripts/deploy.sh

workflows:
  version: 2
  build-test-migrate-deploy:
    jobs:
      - build
      - test:
          requires:
            - build
      - migrate:
          requires:
            - test
          filters:
            branches:
              only: main
      - deploy:
          requires:
            - migrate
          filters:
            branches:
              only: main
```
{% endraw %}

---

## Travis CI

### Config Example

```yaml
# .travis.yml

language: node_js
node_js:
  - '20'

cache:
  directories:
    - node_modules

stages:
  - name: test
  - name: migrate
    if: branch = main
  - name: deploy
    if: branch = main

jobs:
  include:
    - stage: test
      script:
        - npm ci
        - npm run build
        - npm test

    - stage: migrate
      script:
        - npm ci --production
        - npx msr migrate
      env:
        - secure: "encrypted_database_url"

    - stage: deploy
      script:
        - ./scripts/deploy.sh
      env:
        - secure: "encrypted_deploy_key"
```

---

## Best Practices for CI/CD

### 1. Environment-Specific Configuration

```bash
# Use different config files
npx msr migrate --config-file production.config.json

# Or environment variables
export MSR_FOLDER=./migrations
export MSR_TABLE_NAME=schema_version
npx msr migrate
```

### 2. Fail-Fast on Migration Errors

```yaml
# GitHub Actions - fail immediately
- name: Run migrations
  run: npx msr migrate
  # Don't use continue-on-error unless you have explicit rollback
```

### 3. Capture and Store Logs

```yaml
# Always capture logs
- name: Run migrations
  run: npx msr migrate 2>&1 | tee migration.log

- name: Upload logs
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: migration-logs
    path: migration.log
```

### 4. Use Secrets Management

```yaml
# GitHub Actions
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}

# GitLab CI
variables:
  DATABASE_URL: $CI_DB_URL  # Protected variable

# Jenkins
environment {
  DATABASE_URL = credentials('db-url')
}
```

### 5. Separate Migration and Deployment Steps

```yaml
# ✅ Good: Explicit steps
- migrate
- deploy

# ❌ Bad: Combined
- deploy-and-migrate
```

### 6. Add Manual Approval for Production

```yaml
# GitLab CI
migrate:production:
  stage: migrate
  when: manual  # Requires click to proceed
  only:
    - main
```

### 7. Test Migrations in CI

```yaml
# Run migrations against test database in CI
- name: Test migrations
  run: |
    # Start test database
    docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:15
    sleep 5

    # Run migrations
    npx msr migrate
  env:
    DATABASE_URL: postgres://postgres:test@localhost:5432/test
```

---

## Troubleshooting CI/CD Migrations

### Issue: Migrations succeed in CI but fail in production

**Causes:**
- Different database versions
- Different data volume
- Different permissions
- Network issues

**Solutions:**
- Use same database version in CI
- Test with production-like data
- Verify credentials/permissions
- Add retries for transient errors

### Issue: Migration timeout in CI

**Causes:**
- Long-running migration
- CI runner resource limits
- Network latency

**Solutions:**
```yaml
# Increase timeout
- name: Run migrations
  run: npx msr migrate
  timeout-minutes: 15  # Default is 360
```

### Issue: Race condition with parallel jobs

**Causes:**
- Multiple CI jobs running migrations

**Solutions:**
```yaml
# Ensure only one migration job runs
migrate:
  stage: migrate
  resource_group: production-migrations
```

---

## Related Documentation

- [Production Deployment](production-deployment) - Deployment best practices
- [CLI vs API Usage](cli-vs-api) - When to use CLI
- [Docker & Kubernetes](docker-kubernetes) - Container deployment
- [Environment Variables](environment-variables) - Configuration options

---

{: .note }
> **CI/CD Rule**: Always run migrations as an explicit, separate step before deploying your application. Fail fast if migrations fail.
