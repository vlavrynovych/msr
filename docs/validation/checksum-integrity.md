---
layout: default
title: Checksum & Integrity Checking
parent: Validation
nav_order: 3
---

# Checksum & Integrity Checking
{: .no_toc }

Detect unauthorized modifications to executed migrations
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

**Checksum integrity checking** ensures that migration files cannot be modified after they've been executed. This is critical for maintaining database consistency across environments and preventing accidental or malicious changes to historical migrations.

### How It Works

1. **On First Execution**: MSR calculates a checksum (hash) of each migration file and stores it in the schema version table
2. **On Subsequent Runs**: MSR recalculates checksums and compares them with stored values
3. **On Mismatch**: Migration fails with `MIGRATED_FILE_MODIFIED` error, preventing execution

### Why It Matters

- **Audit Trail** - Guarantee migrations haven't changed since execution
- **Environment Consistency** - Ensure dev, staging, and production ran identical code
- **Security** - Detect unauthorized modifications
- **Debugging** - Know if a migration file was altered after deployment
- **Compliance** - Meet regulatory requirements for database change tracking

---

## Quick Start

### Enable Integrity Checking

```typescript
import { Config } from '@migration-script-runner/core';

const config = new Config();
config.folder = './migrations';

// Enable checksum validation (recommended for production)
config.validateMigratedFiles = true;
config.checksumAlgorithm = 'sha256';  // default

// Optionally allow missing files (for cleanup scenarios)
config.requireMigratedFilesExist = true;  // default
```

### What Gets Checked

```typescript
// Migrations that have already been executed
✅ Checksums are validated on every run
❌ Modification detected → Migration fails

// New migrations (not yet executed)
✅ No checksum check (they're new)
✅ Checksum calculated and stored on execution

// beforeMigrate script
⚠️  No checksum validation (by design - see note below)
```

{: .note }
**Why beforeMigrate has no checksum:** The `beforeMigrate` script is intentionally excluded from checksum validation because:
1. It's NOT registered in the schema version table (runs every time, not tracked as migration)
2. It's designed to be frequently modified (e.g., updating test snapshots, changing seed data)
3. It runs before the migration scanning phase, so it has no historical checksum to compare
4. Its purpose is often environment-specific setup that changes over time

If you need checksum validation for setup logic, create a regular migration file instead.

---

## Configuration

### validateMigratedFiles

**Type:** `boolean`
**Default:** `true`
**Introduced:** v0.3.0

Enable or disable checksum integrity checking for executed migrations.

```typescript
// Enable integrity checking (recommended)
config.validateMigratedFiles = true;

// Disable (not recommended for production)
config.validateMigratedFiles = false;
```

**When to Disable:**
- Local development when frequently modifying migrations
- Testing scenarios where you need to iterate on migrations
- Never disable in production unless you have a specific reason

---

### checksumAlgorithm

**Type:** `'md5' | 'sha1' | 'sha256' | 'sha512'`
**Default:** `'sha256'`
**Introduced:** v0.3.0

The hashing algorithm used to calculate file checksums.

```typescript
// SHA-256 (default - recommended)
config.checksumAlgorithm = 'sha256';

// MD5 (fastest, less secure)
config.checksumAlgorithm = 'md5';

// SHA-512 (most secure, slower)
config.checksumAlgorithm = 'sha512';
```

**Algorithm Comparison:**

| Algorithm | Speed | Security | Collision Resistance | Use Case |
|-----------|-------|----------|---------------------|----------|
| `md5` | Fastest | Low | Weak | Development only |
| `sha1` | Fast | Medium | Moderate | Legacy compatibility |
| `sha256` | Fast | High | Strong | **Recommended** |
| `sha512` | Slower | Highest | Strongest | High-security environments |

**Note:** Changing the algorithm after migrations have been executed will cause checksum mismatches. Stick with one algorithm for the lifetime of your project.

---

### requireMigratedFilesExist

**Type:** `boolean`
**Default:** `true`
**Introduced:** v0.3.0

Controls whether executed migration files must still exist in the filesystem.

```typescript
// Require files to exist (default)
config.requireMigratedFilesExist = true;

// Allow missing files (for cleanup scenarios)
config.requireMigratedFilesExist = false;
```

**Use Cases:**

**`true` (Strict Mode - Recommended)**
- Ensures complete audit trail
- All executed migrations remain in version control
- Best for compliance and debugging
- Detects accidental file deletion

**`false` (Permissive Mode)**
- Allows deleting old migrations after deployment
- Useful for reducing repository size over time
- Only validates checksum if file still exists
- Less strict audit trail

---

## How Checksums Are Calculated

MSR reads the entire migration file and calculates a cryptographic hash:

```typescript
import crypto from 'crypto';
import fs from 'fs';

// This is what MSR does internally
function calculateChecksum(filePath: string, algorithm: string): string {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const hash = crypto.createHash(algorithm);
    hash.update(fileContent);
    return hash.digest('hex');
}

// Example output
calculateChecksum('./migrations/V202501220100_create_users.ts', 'sha256');
// Returns: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6..."
```

**What Affects the Checksum:**
- ✅ Code changes (even whitespace)
- ✅ Comments added or removed
- ✅ Line ending changes (CRLF vs LF)
- ✅ File encoding changes
- ❌ File metadata (timestamps, permissions) - not included

---

## Checksum Storage

Checksums are stored in the schema version table alongside migration metadata:

### Database Schema

```sql
CREATE TABLE schema_version (
    timestamp BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ...
    checksum VARCHAR(128),           -- The calculated hash
    checksum_algorithm VARCHAR(20)   -- The algorithm used
);
```

### Example Row

| timestamp | name | checksum | checksum_algorithm |
|-----------|------|----------|-------------------|
| 202501220100 | V202501220100_create_users.ts | a1b2c3d4... | sha256 |
| 202501220200 | V202501220200_add_roles.ts | f9e8d7c6... | sha256 |

---

## Validation Errors

### MIGRATED_FILE_MODIFIED

**When:** A previously executed migration file has been changed

**Error Message:**
```
❌ Validation Error: MIGRATED_FILE_MODIFIED
   File: V202501220100_create_users.ts
   Expected checksum: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   Actual checksum:   z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4

   This migration was modified after execution.
   Modifications to executed migrations are not allowed.
```

**How to Fix:**

1. **Revert the changes** (recommended)
   ```bash
   git checkout HEAD -- migrations/V202501220100_create_users.ts
   ```

2. **Update the checksum in database** (dangerous!)
   ```sql
   UPDATE schema_version
   SET checksum = 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4'
   WHERE timestamp = 202501220100;
   ```
   ⚠️ Only do this if you're certain the change is intentional and safe

3. **Disable validation temporarily** (not recommended)
   ```typescript
   config.validateMigratedFiles = false;
   ```

---

### MIGRATED_FILE_MISSING

**When:** A previously executed migration file no longer exists

**Error Message:**
```
❌ Validation Error: MIGRATED_FILE_MISSING
   File: V202501220100_create_users.ts
   Timestamp: 202501220100

   This migration was executed but the file is missing.
   Cannot verify migration integrity.
```

**How to Fix:**

1. **Restore the file** (recommended)
   ```bash
   git checkout HEAD -- migrations/V202501220100_create_users.ts
   ```

2. **Allow missing files**
   ```typescript
   config.requireMigratedFilesExist = false;
   ```

---

## Common Scenarios

### Scenario 1: Local Development

**Problem:** You're iterating on a migration and keep modifying it

**Solution:** Disable validation during development

```typescript
const config = new Config();

if (process.env.NODE_ENV === 'development') {
    // Allow modifications during development
    config.validateMigratedFiles = false;
} else {
    // Strict checking in production
    config.validateMigratedFiles = true;
    config.requireMigratedFilesExist = true;
}
```

---

### Scenario 2: Line Ending Changes

**Problem:** Git changed line endings (CRLF ↔ LF) and checksums no longer match

**Solution:** Configure Git to handle line endings consistently

```bash
# .gitattributes
*.ts text eol=lf
*.js text eol=lf
```

Or disable autocrlf:
```bash
git config core.autocrlf false
```

---

### Scenario 3: Cleaning Up Old Migrations

**Problem:** You want to delete old migrations after they've been deployed everywhere

**Solution:** Allow missing files

```typescript
config.validateMigratedFiles = true;           // Still check existing files
config.requireMigratedFilesExist = false;      // Allow deletion
```

**When to do this:**
- ✅ Migrations deployed to all environments
- ✅ No rollback needed
- ✅ Database state is stable
- ❌ Never delete recent migrations

---

### Scenario 4: Migrating Between Checksum Algorithms

**Problem:** You want to change from MD5 to SHA256

**Solution:** Manual database update required

```sql
-- Step 1: Clear existing checksums
UPDATE schema_version SET checksum = NULL, checksum_algorithm = NULL;

-- Step 2: Update config
config.checksumAlgorithm = 'sha256';

-- Step 3: Run migrations (checksums will be recalculated)
```

⚠️ **Warning:** This loses your integrity history. Only do this during a maintenance window.

---

### Scenario 5: Multi-Environment Consistency

**Problem:** Ensure dev, staging, and production ran identical migrations

**Solution:** Always enable validation in all environments

```typescript
// Production config
config.validateMigratedFiles = true;
config.requireMigratedFilesExist = true;
config.checksumAlgorithm = 'sha256';

// If checksums match across environments → confidence that all ran identical code
// If checksums don't match → investigate immediately
```

---

## Best Practices

### 1. Always Enable in Production

```typescript
if (process.env.NODE_ENV === 'production') {
    config.validateMigratedFiles = true;
    config.requireMigratedFilesExist = true;
    config.checksumAlgorithm = 'sha256';
}
```

### 2. Never Modify Executed Migrations

Once a migration has run in any environment:
- ✅ Create a new migration to fix issues
- ❌ Don't modify the original migration

### 3. Use Strong Algorithms

```typescript
// ✅ Good - strong, fast, widely supported
config.checksumAlgorithm = 'sha256';

// ❌ Bad - weak, vulnerable to collisions
config.checksumAlgorithm = 'md5';
```

### 4. Keep Migration Files in Version Control

- ✅ Commit all migration files to Git
- ✅ Never .gitignore migration files
- ✅ Keep files even after execution
- ❌ Don't rely on "delete after deployment" unless necessary

### 5. Monitor Validation Errors

```typescript
try {
    await executor.migrate();
} catch (error) {
    if (error instanceof ValidationError) {
        // Log to monitoring system
        logger.error('Migration validation failed', {
            errors: error.validationResults,
            environment: process.env.NODE_ENV
        });

        // Alert team
        await sendAlert('Migration integrity check failed!');
    }
}
```

### 6. Document Checksum Algorithm Choice

```typescript
// config/migrations.ts
/**
 * Migration Configuration
 *
 * Checksum Algorithm: SHA-256
 * Rationale: Balance of security and performance
 * DO NOT CHANGE without team discussion and database update plan
 */
export const config = new Config();
config.checksumAlgorithm = 'sha256';
```

---

## Troubleshooting

### Checksum mismatch on fresh checkout

**Cause:** Git line ending conversion

**Fix:**
```bash
# Configure Git
git config core.autocrlf false

# Re-checkout files
git checkout HEAD -- migrations/
```

---

### All checksums suddenly invalid

**Cause:** Changed `checksumAlgorithm` in config

**Fix:**
1. Revert config to original algorithm, OR
2. Clear checksums and recalculate (see Scenario 4 above)

---

### False positive: File unchanged but checksum different

**Possible Causes:**
- File encoding changed (UTF-8 vs UTF-16)
- BOM (Byte Order Mark) added/removed
- Invisible Unicode characters
- Git line ending conversion

**Debug:**
```bash
# Compare file hashes manually
shasum -a 256 migrations/V202501220100_create_users.ts

# Check file encoding
file -I migrations/V202501220100_create_users.ts

# Check for BOM
xxd migrations/V202501220100_create_users.ts | head
```

---

## Security Considerations

### What Checksums Protect Against

- ✅ Accidental edits to executed migrations
- ✅ Unauthorized modifications by team members
- ✅ Merge conflicts that change migration code
- ✅ File corruption

### What Checksums Don't Protect Against

- ❌ Malicious database administrator modifying checksums in DB
- ❌ Attacker with write access to both files and database
- ❌ Migrations that were wrong from the start (checksum validates consistency, not correctness)

### Enhanced Security

For high-security environments, consider:

1. **Use SHA-512**
   ```typescript
   config.checksumAlgorithm = 'sha512';
   ```

2. **Store checksums externally**
   - Keep a separate audit log
   - Sign checksums with GPG
   - Use blockchain for tamper-proof history

3. **Monitor schema_version table**
   - Alert on any direct modifications
   - Use database triggers to log changes
   - Regular integrity audits

---

## Related Documentation

- [Built-in Validation](built-in-validation) - All validation rules including checksum errors
- [Configuration](../configuration) - Full config reference
- [Migration Lifecycle](../guides/migration-lifecycle) - When validation runs
- [Error Handling](../guides/error-handling) - Handling validation errors

---

## Next Steps

- **Understand validation** → [Built-in Validation Guide](built-in-validation)
- **Configure your project** → [Configuration Reference](../configuration)
- **Handle errors** → [Error Handling Guide](../guides/error-handling)
