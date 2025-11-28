---
layout: default
title: Custom Validation
parent: Validation
nav_order: 2
---

# Custom Validation
{: .no_toc }

Create custom validators to enforce project-specific rules
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

Custom validators allow you to enforce project-specific validation rules beyond MSR's built-in checks. Use custom validators to ensure:

- Naming conventions
- Documentation requirements
- Database-specific patterns
- Security standards
- Team best practices

Custom validators implement the `IMigrationValidator` interface and run **after** built-in validation passes.

---

## Quick Start

### Basic Custom Validator

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

        // Check for uppercase letters in name
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

// Add to config
config.customValidators = [new NamingValidator()];
```

---

## IMigrationValidator Interface

### Interface Definition

```typescript
interface IMigrationValidator {
    validate(
        script: MigrationScript,
        config: Config
    ): Promise<IValidationResult>;
}
```

### Method Parameters

#### script: MigrationScript

The migration script being validated:

```typescript
{
    timestamp: number;         // e.g., 202501220100
    name: string;             // e.g., "V202501220100_create_users.ts"
    filepath: string;         // Full path to the file
    script: IRunnableScript;  // The loaded class instance
}
```

#### config: Config

The migration configuration (access to all settings):

```typescript
{
    folder: string;
    filePattern: RegExp;
    rollbackStrategy: RollbackStrategy;
    downMethodPolicy: DownMethodPolicy;
    // ... all other config options
}
```

### Return Value: IValidationResult

```typescript
interface IValidationResult {
    valid: boolean;              // true if no errors
    issues: IValidationIssue[];  // Array of errors/warnings
    script: MigrationScript;     // The validated script
}
```

### IValidationIssue

```typescript
interface IValidationIssue {
    type: ValidationIssueType;  // ERROR or WARNING
    code: string;               // Custom error code (e.g., "INVALID_NAMING")
    message: string;            // Human-readable description
}
```

---

## Example Validators

### 1. Naming Convention Validator

Enforce snake_case naming:

```typescript
class SnakeCaseValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        // Extract the descriptive part after timestamp
        const match = script.name.match(/^V\d+_(.+)\.ts$/);
        if (match) {
            const description = match[1];

            // Check for invalid characters
            if (!/^[a-z0-9_]+$/.test(description)) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'INVALID_SNAKE_CASE',
                    message: `Migration name must be snake_case (lowercase with underscores): ${script.name}`
                });
            }

            // Check for consecutive underscores
            if (/__/.test(description)) {
                issues.push({
                    type: ValidationIssueType.WARNING,
                    code: 'CONSECUTIVE_UNDERSCORES',
                    message: `Avoid consecutive underscores in migration name: ${script.name}`
                });
            }
        }

        return {
            valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0,
            issues,
            script
        };
    }
}
```

**Usage:**
```typescript
config.customValidators = [new SnakeCaseValidator()];
```

---

### 2. Class Name Validator

Ensure class name matches file name:

```typescript
class ClassNameValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        // Get the class name
        const className = script.script.constructor.name;

        // Convert file name to expected class name
        // V202501220100_create_users_table.ts -> CreateUsersTable
        const match = script.name.match(/^V\d+_(.+)\.ts$/);
        if (match) {
            const expectedClassName = this.toClassName(match[1]);

            if (className !== expectedClassName) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'CLASS_NAME_MISMATCH',
                    message: `Class name "${className}" doesn't match expected "${expectedClassName}" from file name "${script.name}"`
                });
            }
        }

        return {
            valid: issues.length === 0,
            issues,
            script
        };
    }

    private toClassName(snakeCase: string): string {
        // create_users_table -> CreateUsersTable
        return snakeCase
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
}
```

**Usage:**
```typescript
config.customValidators = [new ClassNameValidator()];
```

---

### 3. Documentation Validator

Require JSDoc comments on migrations:

```typescript
import * as fs from 'fs';

class DocumentationValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        // Read the source file
        const source = fs.readFileSync(script.filepath, 'utf-8');

        // Check for JSDoc comment above class
        const hasClassDoc = /\/\*\*[\s\S]*?\*\/\s*export\s+default\s+class/.test(source);
        if (!hasClassDoc) {
            issues.push({
                type: ValidationIssueType.WARNING,
                code: 'MISSING_CLASS_DOCUMENTATION',
                message: `Migration class should have JSDoc documentation: ${script.name}`
            });
        }

        // Check for JSDoc comment above up() method
        const hasUpDoc = /\/\*\*[\s\S]*?\*\/\s*async\s+up\s*\(/.test(source);
        if (!hasUpDoc) {
            issues.push({
                type: ValidationIssueType.WARNING,
                code: 'MISSING_UP_DOCUMENTATION',
                message: `up() method should have JSDoc documentation: ${script.name}`
            });
        }

        return {
            valid: true,  // Warnings don't fail validation unless strictValidation is enabled
            issues,
            script
        };
    }
}
```

**Example Migration with Documentation:**
```typescript
/**
 * Creates the users table with basic authentication fields.
 *
 * Adds columns for:
 * - id (primary key)
 * - email (unique)
 * - password_hash
 * - created_at
 */
export default class CreateUsersTable {
    /**
     * Creates the users table.
     *
     * @param db - Database connection
     * @param info - Migration info
     * @param handler - Database handler
     * @returns Success message
     */
    async up(db, info, handler): Promise<string> {
        await db.execute(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        return 'Users table created';
    }
}
```

---

### 4. SQL Safety Validator

Detect potentially dangerous SQL patterns:

```typescript
class SqlSafetyValidator implements IMigrationValidator {
    private dangerousPatterns = [
        { pattern: /DROP\s+DATABASE/i, message: 'DROP DATABASE is not allowed' },
        { pattern: /TRUNCATE\s+TABLE/i, message: 'TRUNCATE TABLE should be used with caution' },
        { pattern: /DELETE\s+FROM\s+\w+\s*;/i, message: 'DELETE without WHERE clause detected' },
        { pattern: /UPDATE\s+\w+\s+SET\s+.*\s*;/i, message: 'UPDATE without WHERE clause detected' }
    ];

    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        // Read source file
        const source = fs.readFileSync(script.filepath, 'utf-8');

        // Check for dangerous patterns
        for (const { pattern, message } of this.dangerousPatterns) {
            if (pattern.test(source)) {
                issues.push({
                    type: ValidationIssueType.WARNING,
                    code: 'DANGEROUS_SQL_PATTERN',
                    message: `${message} in ${script.name}`
                });
            }
        }

        // Check for SQL injection vulnerabilities
        if (/\$\{.*\}/.test(source)) {
            issues.push({
                type: ValidationIssueType.WARNING,
                code: 'POSSIBLE_SQL_INJECTION',
                message: `Template literals in SQL detected. Use parameterized queries: ${script.name}`
            });
        }

        return {
            valid: true,  // Warnings only
            issues,
            script
        };
    }
}
```

---

### 5. Rollback Validator

Ensure down() properly reverses up():

```typescript
class RollbackValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        // Read source file
        const source = fs.readFileSync(script.filepath, 'utf-8');

        // Extract operations from up() method
        const createTableMatch = /CREATE\s+TABLE\s+(\w+)/i.exec(source);
        const hasDown = /async\s+down\s*\(/.test(source);

        if (createTableMatch && hasDown) {
            const tableName = createTableMatch[1];

            // Check if down() drops the table
            const dropTablePattern = new RegExp(`DROP\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?${tableName}`, 'i');
            if (!dropTablePattern.test(source)) {
                issues.push({
                    type: ValidationIssueType.WARNING,
                    code: 'INCOMPLETE_ROLLBACK',
                    message: `up() creates table "${tableName}" but down() may not drop it: ${script.name}`
                });
            }
        }

        return {
            valid: true,
            issues,
            script
        };
    }
}
```

---

### 6. Timestamp Validator

Validate migration timestamps are recent and reasonable:

```typescript
class TimestampValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        const oneMonthFromNow = now + (30 * 24 * 60 * 60 * 1000);

        // Parse timestamp from script
        // Assuming format: V202501220100 -> 2025-01-22 01:00
        const timestampStr = String(script.timestamp);
        const year = parseInt(timestampStr.substr(0, 4));
        const month = parseInt(timestampStr.substr(4, 2)) - 1;
        const day = parseInt(timestampStr.substr(6, 2));
        const hour = parseInt(timestampStr.substr(8, 2));
        const minute = parseInt(timestampStr.substr(10, 2));

        const scriptDate = new Date(year, month, day, hour, minute).getTime();

        // Check if timestamp is in the future
        if (scriptDate > oneMonthFromNow) {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: 'FUTURE_TIMESTAMP',
                message: `Migration timestamp is too far in the future: ${script.name}`
            });
        }

        // Check if timestamp is very old
        if (scriptDate < oneYearAgo) {
            issues.push({
                type: ValidationIssueType.WARNING,
                code: 'OLD_TIMESTAMP',
                message: `Migration timestamp is older than 1 year: ${script.name}. Consider if this is correct.`
            });
        }

        return {
            valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0,
            issues,
            script
        };
    }
}
```

---

### 7. Environment-Specific Validator

Different rules for different environments:

```typescript
class EnvironmentValidator implements IMigrationValidator {
    constructor(private environment: string) {}

    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];
        const source = fs.readFileSync(script.filepath, 'utf-8');

        if (this.environment === 'production') {
            // Stricter rules for production

            // Require down() method in production
            if (!script.script.down) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'PRODUCTION_REQUIRES_DOWN',
                    message: `Production migrations must have down() method: ${script.name}`
                });
            }

            // Block certain operations
            if (/DROP\s+TABLE/i.test(source)) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'PRODUCTION_DROP_TABLE',
                    message: `DROP TABLE is not allowed in production migrations: ${script.name}`
                });
            }

            // Require documentation
            if (!/\/\*\*/.test(source)) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'PRODUCTION_REQUIRES_DOCS',
                    message: `Production migrations must be documented: ${script.name}`
                });
            }
        }

        return {
            valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0,
            issues,
            script
        };
    }
}

// Usage
const env = process.env.NODE_ENV || 'development';
config.customValidators = [new EnvironmentValidator(env)];
```

---

## Combining Multiple Validators

### Sequential Validation

All validators run in order:

```typescript
config.customValidators = [
    new SnakeCaseValidator(),          // 1. Check naming
    new ClassNameValidator(),          // 2. Check class name
    new DocumentationValidator(),      // 3. Check docs
    new SqlSafetyValidator(),          // 4. Check SQL safety
    new RollbackValidator(),           // 5. Check rollback completeness
    new TimestampValidator()           // 6. Check timestamp
];
```

### Conditional Validators

Add validators based on configuration:

```typescript
const validators: IMigrationValidator[] = [];

// Always validate naming
validators.push(new SnakeCaseValidator());
validators.push(new ClassNameValidator());

// Production-specific validators
if (process.env.NODE_ENV === 'production') {
    validators.push(new DocumentationValidator());
    validators.push(new SqlSafetyValidator());
    validators.push(new RollbackValidator());
}

// CI-specific validators
if (process.env.CI === 'true') {
    validators.push(new TimestampValidator());
}

config.customValidators = validators;
```

---

## Advanced Patterns

### 1. Stateful Validator

Track validation state across multiple scripts:

```typescript
class UniqueTableNameValidator implements IMigrationValidator {
    private seenTables = new Set<string>();

    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];
        const source = fs.readFileSync(script.filepath, 'utf-8');

        // Find CREATE TABLE statements
        const createMatches = source.matchAll(/CREATE\s+TABLE\s+(\w+)/gi);

        for (const match of createMatches) {
            const tableName = match[1].toLowerCase();

            if (this.seenTables.has(tableName)) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'DUPLICATE_TABLE_CREATION',
                    message: `Table "${tableName}" is created in multiple migrations`
                });
            }

            this.seenTables.add(tableName);
        }

        return {
            valid: issues.length === 0,
            issues,
            script
        };
    }
}
```

---

### 2. Async External Validation

Validate against external services:

```typescript
class SchemaRegistryValidator implements IMigrationValidator {
    constructor(private registryUrl: string) {}

    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        try {
            // Call external schema registry
            const response = await fetch(`${this.registryUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    migration: script.name,
                    timestamp: script.timestamp
                })
            });

            const result = await response.json();

            if (!result.valid) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'SCHEMA_REGISTRY_REJECTION',
                    message: `Schema registry rejected migration: ${result.reason}`
                });
            }
        } catch (error) {
            issues.push({
                type: ValidationIssueType.WARNING,
                code: 'SCHEMA_REGISTRY_UNAVAILABLE',
                message: `Could not validate with schema registry: ${error.message}`
            });
        }

        return {
            valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0,
            issues,
            script
        };
    }
}
```

---

### 3. Configurable Validator

Accept configuration options:

```typescript
interface NamingValidatorConfig {
    allowUpperCase: boolean;
    allowNumbers: boolean;
    minLength: number;
    maxLength: number;
}

class ConfigurableNamingValidator implements IMigrationValidator {
    constructor(private config: NamingValidatorConfig) {}

    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];

        const match = script.name.match(/^V\d+_(.+)\.ts$/);
        if (match) {
            const description = match[1];

            // Check uppercase
            if (!this.config.allowUpperCase && /[A-Z]/.test(description)) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'UPPERCASE_NOT_ALLOWED',
                    message: `Uppercase letters not allowed: ${script.name}`
                });
            }

            // Check numbers
            if (!this.config.allowNumbers && /\d/.test(description)) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'NUMBERS_NOT_ALLOWED',
                    message: `Numbers not allowed in migration name: ${script.name}`
                });
            }

            // Check length
            if (description.length < this.config.minLength) {
                issues.push({
                    type: ValidationIssueType.WARNING,
                    code: 'NAME_TOO_SHORT',
                    message: `Migration name is too short (min ${this.config.minLength}): ${script.name}`
                });
            }

            if (description.length > this.config.maxLength) {
                issues.push({
                    type: ValidationIssueType.ERROR,
                    code: 'NAME_TOO_LONG',
                    message: `Migration name is too long (max ${this.config.maxLength}): ${script.name}`
                });
            }
        }

        return {
            valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0,
            issues,
            script
        };
    }
}

// Usage
config.customValidators = [
    new ConfigurableNamingValidator({
        allowUpperCase: false,
        allowNumbers: true,
        minLength: 10,
        maxLength: 50
    })
];
```

---

## Error vs Warning

### When to Use ERROR

Use `ValidationIssueType.ERROR` for:

- **Critical issues** that will cause migration failure
- **Security vulnerabilities**
- **Naming convention violations** (if enforced)
- **Missing required documentation** (in production)
- **Dangerous operations** (DROP DATABASE, etc.)

**Example:**
```typescript
issues.push({
    type: ValidationIssueType.ERROR,
    code: 'DROP_DATABASE_NOT_ALLOWED',
    message: 'DROP DATABASE is not allowed'
});
```

### When to Use WARNING

Use `ValidationIssueType.WARNING` for:

- **Best practice violations**
- **Style guide recommendations**
- **Optional documentation**
- **Potentially dangerous but allowed operations**
- **Informational messages**

**Example:**
```typescript
issues.push({
    type: ValidationIssueType.WARNING,
    code: 'MISSING_DOCUMENTATION',
    message: 'Consider adding JSDoc comments'
});
```

### Strict Mode

When `config.strictValidation = true`, warnings become errors:

```typescript
// With strictValidation = false (default)
// This warning allows execution:
{
    type: ValidationIssueType.WARNING,
    code: 'MISSING_DOCS',
    message: 'No documentation'
}

// With strictValidation = true
// The same warning blocks execution
```

---

## Testing Custom Validators

### Unit Testing

```typescript
import { expect } from 'chai';
import { MigrationScript, Config, ValidationIssueType } from '@migration-script-runner/core';

describe('SnakeCaseValidator', () => {
    const validator = new SnakeCaseValidator();
    const config = new Config();

    it('should pass for valid snake_case name', async () => {
        const script = {
            name: 'V202501220100_create_users_table.ts',
            timestamp: 202501220100,
            filepath: '/path/to/file.ts',
            script: {} as any
        } as MigrationScript;

        const result = await validator.validate(script, config);

        expect(result.valid).to.be.true;
        expect(result.issues).to.have.lengthOf(0);
    });

    it('should fail for uppercase letters', async () => {
        const script = {
            name: 'V202501220100_CreateUsers.ts',
            timestamp: 202501220100,
            filepath: '/path/to/file.ts',
            script: {} as any
        } as MigrationScript;

        const result = await validator.validate(script, config);

        expect(result.valid).to.be.false;
        expect(result.issues).to.have.lengthOf(1);
        expect(result.issues[0].code).to.equal('INVALID_SNAKE_CASE');
        expect(result.issues[0].type).to.equal(ValidationIssueType.ERROR);
    });

    it('should warn for consecutive underscores', async () => {
        const script = {
            name: 'V202501220100_create__users.ts',
            timestamp: 202501220100,
            filepath: '/path/to/file.ts',
            script: {} as any
        } as MigrationScript;

        const result = await validator.validate(script, config);

        expect(result.valid).to.be.true;  // Still valid (warning only)
        expect(result.issues).to.have.lengthOf(1);
        expect(result.issues[0].code).to.equal('CONSECUTIVE_UNDERSCORES');
        expect(result.issues[0].type).to.equal(ValidationIssueType.WARNING);
    });
});
```

---

## Best Practices

### 1. Return Detailed Error Messages

```typescript
// ❌ Bad - vague message
message: 'Invalid migration'

// ✅ Good - specific message
message: `Migration name "${script.name}" must be snake_case (lowercase with underscores only)`
```

### 2. Use Meaningful Error Codes

```typescript
// ❌ Bad - generic code
code: 'ERROR_001'

// ✅ Good - descriptive code
code: 'INVALID_SNAKE_CASE'
```

### 3. Always Return a Result

```typescript
// ❌ Bad - throws exception
throw new Error('Validation failed');

// ✅ Good - returns result
return {
    valid: false,
    issues: [{ type: ValidationIssueType.ERROR, code: 'ERROR', message: 'Failed' }],
    script
};
```

### 4. Handle Async Operations Safely

```typescript
async validate(script, config): Promise<IValidationResult> {
    const issues = [];

    try {
        // Async operation
        const result = await someAsyncCheck(script);

        if (!result.ok) {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: 'ASYNC_CHECK_FAILED',
                message: result.error
            });
        }
    } catch (error) {
        // Don't let exceptions escape
        issues.push({
            type: ValidationIssueType.WARNING,
            code: 'VALIDATOR_ERROR',
            message: `Validation check failed: ${error.message}`
        });
    }

    return { valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0, issues, script };
}
```

### 5. Keep Validators Focused

```typescript
// ✅ Good - single responsibility
class SnakeCaseValidator implements IMigrationValidator { }
class DocumentationValidator implements IMigrationValidator { }
class SqlSafetyValidator implements IMigrationValidator { }

// ❌ Bad - doing too much
class EverythingValidator implements IMigrationValidator {
    // Checks naming, docs, SQL, rollback, etc.
}
```

---

## Troubleshooting

### Custom Validator Not Running

**Problem:** Custom validator doesn't execute

**Solutions:**
1. Check `validateBeforeRun` is enabled:
   ```typescript
   config.validateBeforeRun = true;
   ```

2. Verify validator is added to config:
   ```typescript
   config.customValidators = [new MyValidator()];
   ```

3. Ensure validator implements interface correctly:
   ```typescript
   class MyValidator implements IMigrationValidator {
       async validate(script, config): Promise<IValidationResult> {
           // Implementation
       }
   }
   ```

### Validation Always Passes

**Problem:** Validator returns `valid: true` even with issues

**Solution:** Check that you're setting `valid: false` when there are errors:
```typescript
return {
    valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0,
    issues,
    script
};
```

### TypeScript Errors

**Problem:** Type errors when implementing validator

**Solution:** Import all required types:
```typescript
import {
    IMigrationValidator,
    IValidationResult,
    ValidationIssueType,
    MigrationScript,
    Config
} from '@migration-script-runner/core';
```

---

## Related Documentation

- [Built-in Validation](built-in-validation) - MSR's built-in validation rules
- [Validation Overview](index) - Validation system overview
- [Configuration](../configuration) - Configuration options
- [API Reference](../api/) - Complete API documentation

---

## Complete Example

Production-ready custom validator setup:

```typescript
import {
    IMigrationValidator,
    IValidationResult,
    ValidationIssueType,
    MigrationScript,
    Config,
    MigrationScriptExecutor
} from '@migration-script-runner/core';
import * as fs from 'fs';

// 1. Define validators
class NamingValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];
        const match = script.name.match(/^V\d+_(.+)\.ts$/);

        if (match && !/^[a-z0-9_]+$/.test(match[1])) {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: 'INVALID_SNAKE_CASE',
                message: `Use snake_case: ${script.name}`
            });
        }

        return { valid: issues.length === 0, issues, script };
    }
}

class DocumentationValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];
        const source = fs.readFileSync(script.filepath, 'utf-8');

        if (!/\/\*\*[\s\S]*?\*\//.test(source)) {
            issues.push({
                type: ValidationIssueType.WARNING,
                code: 'MISSING_DOCS',
                message: `Add JSDoc: ${script.name}`
            });
        }

        return { valid: true, issues, script };
    }
}

class SqlSafetyValidator implements IMigrationValidator {
    async validate(script: MigrationScript, config: Config): Promise<IValidationResult> {
        const issues = [];
        const source = fs.readFileSync(script.filepath, 'utf-8');

        if (/DROP\s+DATABASE/i.test(source)) {
            issues.push({
                type: ValidationIssueType.ERROR,
                code: 'DROP_DATABASE_NOT_ALLOWED',
                message: `DROP DATABASE forbidden: ${script.name}`
            });
        }

        return { valid: issues.filter(i => i.type === ValidationIssueType.ERROR).length === 0, issues, script };
    }
}

// 2. Configure validators
const config = new Config();
config.folder = './migrations';
config.validateBeforeRun = true;

// Environment-specific validators
const validators: IMigrationValidator[] = [new NamingValidator()];

if (process.env.NODE_ENV === 'production') {
    config.strictValidation = true;
    validators.push(new DocumentationValidator());
    validators.push(new SqlSafetyValidator());
}

config.customValidators = validators;

// 3. Run migrations
const executor = new MigrationScriptExecutor(handler, config);

try {
    const result = await executor.migrate();
    if (result.success) {
        console.log('✅ Migration successful');
    }
} catch (error) {
    if (error.name === 'ValidationError') {
        console.error('❌ Validation failed');
        console.error(`Errors: ${error.errorCount}, Warnings: ${error.warningCount}`);
    }
    process.exit(1);
}
```
