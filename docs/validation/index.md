---
layout: default
title: Validation
nav_order: 6
has_children: true
---

# Migration Validation
{: .no_toc }

Ensure migration quality with built-in and custom validation
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Migration Script Runner includes a comprehensive validation system that checks migration scripts **before** they execute. Validation catches common errors early, preventing failed migrations and reducing rollback scenarios.

### Why Validation Matters

- **Fast Failure** - Detect issues before database changes or backup creation
- **Safety** - Prevent malformed scripts from corrupting your database
- **Consistency** - Enforce project-specific standards and conventions
- **Debugging** - Clear error messages with line numbers and specific issues
- **Confidence** - Know your migrations are correct before deployment

---

## Quick Start

### Basic Validation (Enabled by Default)

Validation is enabled by default and runs automatically:

```typescript
import { MigrationScriptExecutor, Config } from '@migration-script-runner/core';

const config = new Config();
config.folder = './migrations';

// Validation is enabled by default (validateBeforeRun = true)
const executor = new MigrationScriptExecutor(handler, config);

try {
    await executor.migrate();
} catch (error) {
    if (error.name === 'ValidationError') {
        // Handle validation failure
        console.error(`Validation failed with ${error.errorCount} errors`);
        error.validationResults.forEach(result => {
            if (!result.valid) {
                console.error(`${result.script.name}:`);
                result.issues.forEach(issue => {
                    console.error(`  - ${issue.message}`);
                });
            }
        });
    }
}
```

---

## Validation Types

### Built-in Validation

MSR performs these checks automatically:

1. **Structural Validation**
   - File exports a default class
   - Class can be instantiated without errors
   - Class implements `up()` method
   - `up()` method signature is correct

2. **Interface Validation**
   - `up()` method has correct parameters (db, info, handler)
   - `up()` method returns Promise<string>
   - `down()` method (if present) has correct signature

3. **down() Method Validation**
   - Checks for missing `down()` based on policy
   - Configurable via `downMethodPolicy` setting

4. **Integrity Validation** (for already-migrated scripts)
   - File checksums match database records
   - Detects unauthorized modifications to executed migrations

### Custom Validation

Extend validation with project-specific rules:

```typescript
import { IMigrationValidator, ValidationIssueType } from '@migration-script-runner/core';

class NamingValidator implements IMigrationValidator {
    async validate(script, config) {
        // Enforce snake_case naming
        const hasUpperCase = /[A-Z]/.test(script.name);

        if (hasUpperCase) {
            return {
                valid: false,
                issues: [{
                    type: ValidationIssueType.ERROR,
                    code: 'INVALID_NAMING',
                    message: `Migration name must be snake_case: ${script.name}`
                }],
                script
            };
        }

        return { valid: true, issues: [], script };
    }
}

// Add to config
config.customValidators = [new NamingValidator()];
```

---

## Configuration Options

### validateBeforeRun

**Type:** `boolean`
**Default:** `true`

Enable or disable validation. **Not recommended to disable in production.**

```typescript
// Validation enabled (default)
config.validateBeforeRun = true;

// Disable validation (dangerous!)
config.validateBeforeRun = false;
```

### strictValidation

**Type:** `boolean`
**Default:** `false`

Treat warnings as errors. When enabled, migrations fail if any warnings are found.

```typescript
// Allow warnings (default)
config.strictValidation = false;

// Warnings block execution
config.strictValidation = true;
```

### downMethodPolicy

**Type:** `DownMethodPolicy`
**Default:** `DownMethodPolicy.AUTO`

Controls how missing `down()` methods are handled:

| Policy | Behavior |
|--------|----------|
| `AUTO` | Error for `DOWN` strategy, warning for `BOTH`, silent for `BACKUP`/`NONE` |
| `REQUIRED` | Always error if `down()` is missing |
| `RECOMMENDED` | Always warn if `down()` is missing |
| `OPTIONAL` | Never check for `down()` |

```typescript
import { DownMethodPolicy } from '@migration-script-runner/core';

// Auto-detect based on rollback strategy (default)
config.downMethodPolicy = DownMethodPolicy.AUTO;

// Require down() in all migrations
config.downMethodPolicy = DownMethodPolicy.REQUIRED;
```

### customValidators

**Type:** `IMigrationValidator[]`
**Default:** `[]`

Array of custom validators to run after built-in validation.

```typescript
config.customValidators = [
    new NamingValidator(),
    new DocumentationValidator(),
    new SqlInjectionValidator()
];
```

---

## Validation Results

### ValidationError

When validation fails, MSR throws a `ValidationError`:

```typescript
import { ValidationError } from '@migration-script-runner/core';

try {
    await executor.migrate();
} catch (error) {
    if (error instanceof ValidationError) {
        console.error(`Validation failed!`);
        console.error(`Errors: ${error.errorCount}`);
        console.error(`Warnings: ${error.warningCount}`);

        // Access detailed results
        error.validationResults.forEach(result => {
            console.log(`\n${result.script.name}:`);
            result.issues.forEach(issue => {
                const icon = issue.type === 'ERROR' ? '❌' : '⚠️';
                console.log(`  ${icon} [${issue.code}] ${issue.message}`);
            });
        });
    }
}
```

### IValidationResult

Each migration has a validation result:

```typescript
interface IValidationResult {
    valid: boolean;              // true if no errors
    issues: IValidationIssue[];  // Array of errors/warnings
    script: MigrationScript;     // The validated script
}
```

### IValidationIssue

Individual validation problems:

```typescript
interface IValidationIssue {
    type: ValidationIssueType;  // 'ERROR' or 'WARNING'
    code: string;               // Error code (e.g., 'MISSING_UP_METHOD')
    message: string;            // Human-readable description
}
```

---

## When Validation Runs

Validation executes at these points:

1. **Before Migration** (if `validateBeforeRun = true`)
   - After scanning for migration files
   - After loading migration classes
   - **Before** database initialization
   - **Before** backup creation
   - **Before** any migrations execute

2. **Integrity Check** (if enabled)
   - After scanning for migration files
   - Checks already-migrated scripts for changes
   - Compares file checksums with database records

---

## Common Validation Errors

### MISSING_UP_METHOD

**Cause:** Migration class doesn't have an `up()` method

**Fix:**
```typescript
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        // Add the up method
        return 'Migration completed';
    }
}
```

### INVALID_UP_SIGNATURE

**Cause:** `up()` method has wrong parameters or return type

**Fix:**
```typescript
// Wrong ❌
async up(): Promise<void> { }

// Correct ✅
async up(db: IDB, info: IMigrationInfo, handler: IDatabaseMigrationHandler): Promise<string> {
    return 'Success';
}
```

### MISSING_DOWN_METHOD

**Cause:** `down()` method is missing and policy requires it

**Fix:**
```typescript
export default class MyMigration {
    async up(db, info, handler): Promise<string> {
        await db.execute('CREATE TABLE users (id INT)');
        return 'Table created';
    }

    async down(db, info, handler): Promise<string> {
        await db.execute('DROP TABLE users');
        return 'Table dropped';
    }
}
```

### INSTANTIATION_FAILED

**Cause:** Migration class constructor throws an error

**Fix:**
```typescript
// Wrong ❌
export default class MyMigration {
    constructor() {
        throw new Error('Oops!');
    }
}

// Correct ✅
export default class MyMigration {
    constructor() {
        // No-arg constructor should not throw
    }
}
```

### MIGRATED_FILE_MISSING

**Cause:** A previously executed migration file was deleted

**Fix:** Restore the missing migration file from version control

### MIGRATED_FILE_MODIFIED

**Cause:** A previously executed migration file was changed

**Fix:** Revert changes to the migration file. Never modify executed migrations.

---

## Best Practices

### 1. Keep Validation Enabled

Always run with validation in production:

```typescript
// ✅ Good
config.validateBeforeRun = true;

// ❌ Bad - only disable for debugging
config.validateBeforeRun = false;
```

### 2. Use Strict Mode in CI/CD

Enable strict validation in continuous integration:

```typescript
if (process.env.CI) {
    config.strictValidation = true;
    config.downMethodPolicy = DownMethodPolicy.REQUIRED;
}
```

### 3. Test Migrations Before Deployment

Validate migrations in development:

```bash
# Run migrations with validation
npm run migrate

# Validation errors will prevent execution
```

### 4. Write Custom Validators

Enforce project standards:

```typescript
const validators = [
    new NamingConventionValidator(),
    new RequiredCommentsValidator(),
    new SqlSafetyValidator()
];

config.customValidators = validators;
```

### 5. Handle ValidationError Gracefully

```typescript
try {
    const result = await executor.migrate();
    if (!result.success) {
        process.exit(1);
    }
} catch (error) {
    if (error instanceof ValidationError) {
        logger.error('Migration validation failed');
        // Log details, send alerts, etc.
        process.exit(2);
    }
    throw error;
}
```

---

## Related Documentation

- [Built-in Validation](built-in-validation) - Detailed guide to built-in validation rules
- [Custom Validation](custom-validation) - Creating custom validators with examples
- [Configuration](../configuration) - All configuration options
- [Error Handling](../guides/error-handling) - Handling validation and migration errors

---

## Next Steps

- **Learn about built-in validation** → [Built-in Validation Guide](built-in-validation)
- **Create custom validators** → [Custom Validation Guide](custom-validation)
- **Configure validation** → [Configuration Reference](../configuration)
