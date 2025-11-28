---
layout: default
title: Validation Settings
parent: Configuration
nav_order: 2
---

# Validation Settings
{: .no_toc }

Configure migration validation behavior
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Validation settings control how MSR validates migration scripts before execution. These settings allow you to:

- Enable or disable validation
- Treat warnings as errors
- Control down() method requirements
- Add custom validation rules

See [Validation Documentation](../customization/validation/) for complete validation guides.

---

## validateBeforeRun

**Type:** `boolean`
**Default:** `true`

Enable validation of migration scripts before execution.

```typescript
// Validation enabled (default, recommended)
config.validateBeforeRun = true;

// Disable validation (not recommended for production)
config.validateBeforeRun = false;
```

### What Gets Validated

When enabled, MSR validates all pending migrations checking for:
- **Structural validation** - exports, instantiation, methods
- **Interface validation** - up/down signatures
- **down() method validation** - based on policy
- **Custom validation** - if customValidators are provided

### Validation Timing

Validation runs **before**:
- Database initialization
- Backup creation
- Any migrations execute

This allows fast failure if scripts have issues.

### Impact of Disabling

When `false`:
- ❌ No structural validation - malformed scripts may cause runtime errors
- ❌ No interface validation - incorrect signatures may crash migrations
- ❌ No integrity validation - modified migrations won't be detected
- ❌ No custom validation - project rules not enforced

{: .warning }
Disabling validation removes important safety checks. Only disable for local debugging.

### Examples

```typescript
// Production - always validate
if (process.env.NODE_ENV === 'production') {
    config.validateBeforeRun = true;
}

// Development - validate by default
config.validateBeforeRun = true;

// Debugging specific migration - temporarily disable
config.validateBeforeRun = false;  // Re-enable after debugging!
```

### See Also

- [Validation Overview](../customization/validation/) - Complete validation guide
- [Built-in Validation](../customization/validation/built-in-validation) - Built-in validation rules

---

## strictValidation

**Type:** `boolean`
**Default:** `false`

Treat validation warnings as errors (strict mode).

```typescript
// Allow warnings (default)
config.strictValidation = false;

// Block execution if any warnings exist
config.strictValidation = true;
```

### Behavior

**When `false` (default):**
- Warnings are logged but don't prevent execution
- Only errors block migration execution
- More flexible for development

**When `true` (strict mode):**
- Both warnings and errors block execution
- All issues must be resolved before migrations run
- Enforces stricter quality standards

### Impact

Warnings affected by strict mode:
- `MISSING_DOWN_METHOD` (when policy is RECOMMENDED)
- Custom validator warnings
- Other warning-level validation issues

### Use Cases

```typescript
// Development - allow warnings for faster iteration
config.strictValidation = false;

// CI/CD - enforce strict quality
if (process.env.CI === 'true') {
    config.strictValidation = true;
}

// Production - decision depends on team standards
config.strictValidation = process.env.STRICT_VALIDATION === 'true';
```

### Example Impact

```typescript
// Migration with warning:
// - Missing down() method (policy is RECOMMENDED)

// With strictValidation = false:
// ⚠️  Warning logged, migration executes

// With strictValidation = true:
// ❌ Error thrown, migration blocked
```

### Environment-Specific

<details>
<summary>Advanced: Environment-based strict validation</summary>

```typescript
const config = new Config();

// Strict in CI/CD
if (process.env.CI) {
    config.strictValidation = true;
    config.downMethodPolicy = DownMethodPolicy.REQUIRED;
}

// Relaxed in development
if (process.env.NODE_ENV === 'development') {
    config.strictValidation = false;
}

// Configurable in production
config.strictValidation = process.env.STRICT_MODE === 'true';
```

</details>

### See Also

- [Validation Overview](../customization/validation/) - Understanding validation
- [Custom Validation](../customization/validation/custom-validation) - Creating validators

---

## downMethodPolicy

**Type:** `DownMethodPolicy`
**Default:** `DownMethodPolicy.AUTO`

Policy for handling missing `down()` methods during validation.

```typescript
import { DownMethodPolicy } from '@migration-script-runner/core';

// Auto-detect based on rollbackStrategy (default)
config.downMethodPolicy = DownMethodPolicy.AUTO;

// Always error if down() is missing
config.downMethodPolicy = DownMethodPolicy.REQUIRED;

// Always warn if down() is missing
config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

// Never check for down() method
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
```

### Policy Behavior

How each policy handles missing `down()` methods:

| Policy | DOWN Strategy | BOTH Strategy | BACKUP/NONE Strategy |
|--------|---------------|---------------|----------------------|
| `AUTO` | ❌ ERROR | ⚠️  WARNING | Silent |
| `REQUIRED` | ❌ ERROR | ❌ ERROR | ❌ ERROR |
| `RECOMMENDED` | ⚠️  WARNING | ⚠️  WARNING | ⚠️  WARNING |
| `OPTIONAL` | Silent | Silent | Silent |

### AUTO (Default)

Adapts based on `rollbackStrategy`:

```typescript
config.downMethodPolicy = DownMethodPolicy.AUTO;

// With RollbackStrategy.DOWN
// → Missing down() = ERROR (down() is required)

// With RollbackStrategy.BOTH
// → Missing down() = WARNING (down() is recommended)

// With RollbackStrategy.BACKUP or NONE
// → Missing down() = Silent (down() is optional)
```

### REQUIRED

Always enforces `down()` methods:

```typescript
config.downMethodPolicy = DownMethodPolicy.REQUIRED;

// Regardless of rollback strategy:
// → Missing down() = ERROR
```

**Use when:**
- Team policy requires reversible migrations
- CI/CD enforces down() methods
- All migrations must be rollback-capable

### RECOMMENDED

Always warns about missing `down()` methods:

```typescript
config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;

// Regardless of rollback strategy:
// → Missing down() = WARNING
```

**Use when:**
- You want to encourage down() methods
- Not ready to strictly enforce
- Warnings are acceptable in your workflow

### OPTIONAL

Never checks for `down()` methods:

```typescript
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;

// Regardless of rollback strategy:
// → Missing down() = Silent (no check)
```

**Use when:**
- Only using BACKUP strategy
- down() methods not part of workflow
- Validation overhead not desired

### Policy Selection Guide

<details>
<summary>Advanced: Choosing the right down() method policy</summary>

Choose based on your workflow:

| Workflow | Recommended Policy |
|----------|-------------------|
| Backup-only rollback | `AUTO` or `OPTIONAL` |
| Down-only rollback | `AUTO` or `REQUIRED` |
| Hybrid rollback | `AUTO` or `RECOMMENDED` |
| Strict team standards | `REQUIRED` |
| Flexible team standards | `RECOMMENDED` |

</details>

### Examples

**Development:**
```typescript
// Flexible - allow missing down()
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
```

**CI/CD:**
```typescript
// Strict - require down()
config.downMethodPolicy = DownMethodPolicy.REQUIRED;
config.strictValidation = true;  // Treat warnings as errors
```

**Production:**
```typescript
// Smart - adapt to rollback strategy
config.downMethodPolicy = DownMethodPolicy.AUTO;
```

**Environment-Specific:**
```typescript
if (process.env.CI) {
    config.downMethodPolicy = DownMethodPolicy.REQUIRED;
    config.strictValidation = true;
} else {
    config.downMethodPolicy = DownMethodPolicy.AUTO;
    config.strictValidation = false;
}
```

### Interaction with Rollback Strategy

```typescript
// Example 1: DOWN strategy + AUTO policy
config.rollbackStrategy = RollbackStrategy.DOWN;
config.downMethodPolicy = DownMethodPolicy.AUTO;
// Result: Missing down() = ERROR

// Example 2: BACKUP strategy + REQUIRED policy
config.rollbackStrategy = RollbackStrategy.BACKUP;
config.downMethodPolicy = DownMethodPolicy.REQUIRED;
// Result: Missing down() = ERROR (overrides strategy)

// Example 3: BOTH strategy + OPTIONAL policy
config.rollbackStrategy = RollbackStrategy.BOTH;
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
// Result: Missing down() = Silent (overrides strategy)
```

### See Also

- [Rollback Settings](rollback-settings) - Rollback strategies
- [Built-in Validation](../customization/validation/built-in-validation) - MISSING_DOWN_METHOD error

---

## validateMigratedFiles

**Type:** `boolean`
**Default:** `true`
**Introduced:** v0.3.0

Enable checksum integrity checking for previously executed migrations.

```typescript
// Enable integrity checking (recommended)
config.validateMigratedFiles = true;

// Disable (not recommended for production)
config.validateMigratedFiles = false;
```

### What It Does

When enabled, MSR:
1. **Calculates checksums** when migrations execute
2. **Stores checksums** in the schema version table
3. **Validates checksums** on subsequent runs
4. **Fails migration** if a previously executed file was modified

### How It Works

```typescript
// First run:
// 1. V202501220100_create_users.ts executes
// 2. MSR calculates checksum: a1b2c3d4e5f6...
// 3. Checksum stored in database

// Second run:
// 1. MSR recalculates checksum of V202501220100_create_users.ts
// 2. Compares with stored checksum
// 3. If different → throws MIGRATED_FILE_MODIFIED error
```

### Error Example

```
❌ Validation Error: MIGRATED_FILE_MODIFIED
   File: V202501220100_create_users.ts
   Expected checksum: a1b2c3d4e5f6g7h8i9j0
   Actual checksum:   z9y8x7w6v5u4t3s2r1q0

   This migration was modified after execution.
```

### Use Cases

**Enable When:**
- ✅ Production environments
- ✅ Need audit trail of migrations
- ✅ Multi-environment consistency required
- ✅ Compliance requirements

**Disable When:**
- ⚠️  Local development (iterating on migrations)
- ⚠️  Testing scenarios
- ❌ Never disable in production

### Environment-Specific

```typescript
if (process.env.NODE_ENV === 'development') {
    // Allow modifications during development
    config.validateMigratedFiles = false;
} else {
    // Strict checking in staging/production
    config.validateMigratedFiles = true;
}
```

### See Also

- [Checksum & Integrity Guide](../customization/validation/checksum-integrity) - Complete integrity checking guide
- [Built-in Validation](../customization/validation/built-in-validation) - MIGRATED_FILE_MODIFIED error details

---

## checksumAlgorithm

**Type:** `'md5' | 'sha1' | 'sha256' | 'sha512'`
**Default:** `'sha256'`
**Introduced:** v0.3.0

The hashing algorithm used to calculate file checksums.

```typescript
// SHA-256 (recommended default)
config.checksumAlgorithm = 'sha256';

// MD5 (fastest, less secure)
config.checksumAlgorithm = 'md5';

// SHA-512 (most secure, slower)
config.checksumAlgorithm = 'sha512';
```

### Algorithm Comparison

| Algorithm | Speed | Security | Recommendation |
|-----------|-------|----------|----------------|
| `md5` | Fastest | Low | Development only |
| `sha1` | Fast | Medium | Legacy systems |
| `sha256` | Fast | High | **Recommended** |
| `sha512` | Slower | Highest | High-security |

### Important Notes

{: .warning }
**Never change the algorithm** after migrations have been executed. This will cause all checksum validations to fail. If you must change it, you'll need to clear existing checksums from the database.

### Migration Between Algorithms

```sql
-- If you must change algorithms (e.g., md5 → sha256)
-- Step 1: Clear existing checksums
UPDATE schema_version
SET checksum = NULL, checksum_algorithm = NULL;

-- Step 2: Update config
config.checksumAlgorithm = 'sha256';

-- Step 3: Run migrations (new checksums will be calculated)
```

### See Also

- [Checksum & Integrity Guide](../customization/validation/checksum-integrity) - Algorithm selection guide

---

## requireMigratedFilesExist

**Type:** `boolean`
**Default:** `true`
**Introduced:** v0.3.0

Controls whether previously executed migration files must still exist in the filesystem.

```typescript
// Require files to exist (strict mode - recommended)
config.requireMigratedFilesExist = true;

// Allow missing files (permissive mode)
config.requireMigratedFilesExist = false;
```

### Behavior

**When `true` (strict mode - default):**
- Missing executed migration file → `MIGRATED_FILE_MISSING` error
- Ensures complete audit trail
- All migrations remain in version control

**When `false` (permissive mode):**
- Missing executed migration file → No error
- Only validates checksum if file exists
- Allows deletion of old migrations

### Use Cases

**Set to `true` When:**
- ✅ Need complete migration history
- ✅ Compliance requires audit trail
- ✅ Debugging may need old migrations
- ✅ Team policy: never delete migrations

**Set to `false` When:**
- ⚠️  Cleaning up very old migrations
- ⚠️  Reducing repository size
- ⚠️  Migrations deployed everywhere
- ❌ Not recommended for most projects

### Example: Cleanup Strategy

```typescript
// Production: Keep all files
config.requireMigratedFilesExist = true;

// After deployment to all environments,
// you MAY delete very old migrations:
config.requireMigratedFilesExist = false;
config.validateMigratedFiles = true;  // Still validate if file exists
```

### Error Example

```
❌ Validation Error: MIGRATED_FILE_MISSING
   File: V202501220100_create_users.ts
   Timestamp: 202501220100

   This migration was executed but the file is missing.
   Cannot verify migration integrity.
```

### See Also

- [Checksum & Integrity Guide](../customization/validation/checksum-integrity) - Missing file handling

---

## customValidators

**Type:** `IMigrationValidator[]`
**Default:** `[]`

Array of custom validators to run in addition to built-in validation.

```typescript
import { IMigrationValidator } from '@migration-script-runner/core';

// Add custom validators
config.customValidators = [
    new NamingValidator(),
    new DocumentationValidator(),
    new SqlSafetyValidator()
];
```

### Creating a Custom Validator

```typescript
import {
    IMigrationValidator,
    IValidationResult,
    ValidationIssueType,
    MigrationScript,
    Config
} from '@migration-script-runner/core';

class NamingValidator implements IMigrationValidator {
    async validate(
        script: MigrationScript,
        config: Config
    ): Promise<IValidationResult> {
        const issues = [];

        // Check for uppercase in migration name
        if (/[A-Z]/.test(script.name)) {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: 'INVALID_NAMING',
                message: `Migration name must be lowercase: ${script.name}`
            });
        }

        return {
            valid: issues.length === 0,
            issues,
            script
        };
    }
}

// Use the validator
config.customValidators = [new NamingValidator()];
```

### Multiple Validators

Validators run sequentially:

```typescript
config.customValidators = [
    new NamingValidator(),        // 1. Check naming
    new DocumentationValidator(), // 2. Check docs
    new SqlSafetyValidator()      // 3. Check SQL safety
];
```

### Conditional Validators

Add validators based on environment:

```typescript
const validators: IMigrationValidator[] = [];

// Always validate naming
validators.push(new NamingValidator());

// Production-specific
if (process.env.NODE_ENV === 'production') {
    validators.push(new DocumentationValidator());
    validators.push(new SqlSafetyValidator());
}

// CI-specific
if (process.env.CI === 'true') {
    validators.push(new TimestampValidator());
}

config.customValidators = validators;
```

### Execution Order

1. Built-in validation runs first
2. If built-in validation passes, custom validators run
3. Custom validators run in array order
4. All custom validators run (even if one fails)

```typescript
Validation flow:
  1. Built-in structural validation
  2. Built-in interface validation
  3. Built-in down() validation
  4. Custom validator 1 (NamingValidator)
  5. Custom validator 2 (DocumentationValidator)
  6. Custom validator 3 (SqlSafetyValidator)
```

### Common Custom Validators

**Naming Convention:**
```typescript
class SnakeCaseValidator implements IMigrationValidator {
    async validate(script, config): Promise<IValidationResult> {
        // Enforce snake_case naming
    }
}
```

**Documentation Required:**
```typescript
class DocumentationValidator implements IMigrationValidator {
    async validate(script, config): Promise<IValidationResult> {
        // Require JSDoc comments
    }
}
```

**SQL Safety:**
```typescript
class SqlSafetyValidator implements IMigrationValidator {
    async validate(script, config): Promise<IValidationResult> {
        // Detect dangerous SQL patterns
    }
}
```

**Class Name Matching:**
```typescript
class ClassNameValidator implements IMigrationValidator {
    async validate(script, config): Promise<IValidationResult> {
        // Ensure class name matches file name
    }
}
```

### See Also

- [Custom Validation Guide](../customization/validation/custom-validation) - Complete guide with examples
- [Validation Overview](../customization/validation/) - Validation system overview

---

## Complete Example

```typescript
import {
    Config,
    DownMethodPolicy,
    MigrationScriptExecutor
} from '@migration-script-runner/core';
import {
    NamingValidator,
    DocumentationValidator,
    SqlSafetyValidator
} from './validators';

const config = new Config();

// Validation settings
config.validateBeforeRun = true;

// Strict mode in CI/CD
config.strictValidation = process.env.CI === 'true';

// Smart down() policy
config.downMethodPolicy = DownMethodPolicy.AUTO;

// Custom validators
const validators = [new NamingValidator()];

if (process.env.NODE_ENV === 'production') {
    validators.push(new DocumentationValidator());
    validators.push(new SqlSafetyValidator());
}

config.customValidators = validators;

// Run migrations
const executor = new MigrationScriptExecutor(handler, config);
await executor.migrate();
```

---

## Validation Patterns

### Development Configuration

Fast iteration with basic validation:

```typescript
config.validateBeforeRun = true;
config.strictValidation = false;
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;
config.customValidators = [];
```

### CI/CD Configuration

Strict validation for quality assurance:

```typescript
config.validateBeforeRun = true;
config.strictValidation = true;
config.downMethodPolicy = DownMethodPolicy.REQUIRED;
config.customValidators = [
    new NamingValidator(),
    new DocumentationValidator(),
    new SqlSafetyValidator(),
    new TimestampValidator()
];
```

### Production Configuration

Safety-focused with reasonable strictness:

```typescript
config.validateBeforeRun = true;
config.strictValidation = false;  // Allow warnings
config.downMethodPolicy = DownMethodPolicy.RECOMMENDED;
config.customValidators = [
    new NamingValidator(),
    new SqlSafetyValidator()
];
```

---

## Best Practices

### 1. Always Keep Validation Enabled

```typescript
// ✅ Good
config.validateBeforeRun = true;

// ❌ Bad (except for debugging)
config.validateBeforeRun = false;
```

### 2. Use Strict Mode in CI

```typescript
// ✅ Good
if (process.env.CI) {
    config.strictValidation = true;
}
```

### 3. Match Policy to Strategy

```typescript
// ✅ Good - AUTO adapts to strategy
config.rollbackStrategy = RollbackStrategy.DOWN;
config.downMethodPolicy = DownMethodPolicy.AUTO;  // Will require down()

// ❌ Mismatch - OPTIONAL with DOWN strategy
config.rollbackStrategy = RollbackStrategy.DOWN;
config.downMethodPolicy = DownMethodPolicy.OPTIONAL;  // Won't check for down()
```

### 4. Add Validators Gradually

```typescript
// ✅ Good - start simple, add more over time
const validators = [new NamingValidator()];

if (team.isReady) {
    validators.push(new DocumentationValidator());
}

config.customValidators = validators;
```

---

## Related Documentation

- [Validation Overview](../customization/validation/) - Complete validation guide
- [Built-in Validation](../customization/validation/built-in-validation) - Built-in rules
- [Custom Validation](../customization/validation/custom-validation) - Creating validators
- [Configuration Overview](index) - All configuration options
- [Rollback Settings](rollback-settings) - Rollback strategies
