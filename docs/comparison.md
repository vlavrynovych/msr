---
layout: default
title: Comparison
nav_order: 8
---

# How MSR Compares

Migration Script Runner takes a unique approach to database migrations, combining the best ideas from across the ecosystem with some innovations of our own.

## Our Philosophy

MSR is designed for **production safety, developer experience, and flexibility**. We believe migration tools should:
- Provide multiple ways to accomplish tasks (TypeScript AND SQL)
- Give visibility into what's happening (dry run, execution summaries)
- Support both development and production workflows
- Stay out of your way when you don't need them

## Feature Highlights

### What Makes MSR Unique

| Feature | MSR | Typical Tools |
|---------|-----|---------------|
| **Hybrid Migrations** | ✅ Both TypeScript & SQL (v0.4.0) | Usually one or the other |
| **Dry Run Mode** | ✅ Built-in, free (v0.4.0) | Often paid/enterprise only |
| **Execution Summaries** | ✅ Detailed success/failure logs (v0.4.0) | Basic output only |
| **Lifecycle Hooks** | ✅ beforeMigrate, afterMigrate, onError | Rare |
| **Flexible Rendering** | ✅ Table, JSON, Silent modes | Fixed format |
| **TypeScript-First** | ✅ Full type safety | Varies |

### Core Capabilities

| Capability | MSR Status |
|------------|-----------|
| Up/Down Migrations | ✅ |
| SQL Migrations | ✅ v0.4.0 |
| Transaction Support | ✅ |
| Rollback | ✅ |
| Connection Validation | ✅ v0.4.0 |
| Programmatic API | ✅ |
| Multi-Database | ✅ PostgreSQL, MongoDB, MySQL, SQLite |
| Migration Tracking | ✅ |
| Backup Integration | ✅ |
| TypeScript Support | ✅ |

## Common Migration Tool Patterns

### JavaScript/TypeScript Ecosystem

**Knex.js** - Query builder with migrations
- Strengths: Mature, flexible, good locking mechanism
- Best for: Projects already using Knex for queries

**TypeORM** - ORM with migration support
- Strengths: Tight ORM integration, auto-generation
- Best for: TypeORM users who want unified tooling

**Prisma Migrate** - Schema-first migrations
- Strengths: Modern DX, schema drift detection
- Best for: New projects, Prisma users

**Sequelize** - ORM with migration CLI
- Strengths: Established ecosystem, multiple dialects
- Best for: Sequelize users

### Other Ecosystems

**Flyway** (Java) - SQL-first migrations
- Strengths: Simple, SQL-focused, enterprise features
- Best for: Java projects, teams that prefer SQL

**Liquibase** (Java) - Change tracking with multiple formats
- Strengths: Enterprise features, XML/YAML/SQL support
- Best for: Complex enterprise requirements

**Alembic** (Python) - SQLAlchemy migrations
- Strengths: Python integration, autogenerate
- Best for: Python/SQLAlchemy projects

**Rails Migrations** (Ruby) - Convention over configuration
- Strengths: Excellent conventions, schema dumping
- Best for: Rails applications

**golang-migrate** (Go) - Minimal migration library
- Strengths: Simple, no magic, multiple sources
- Best for: Go projects

## When to Choose MSR

MSR is a great fit when you:

- ✅ Want flexibility to use TypeScript OR SQL migrations
- ✅ Need production-ready safety features (dry run, summaries)
- ✅ Value developer experience and type safety
- ✅ Want lifecycle hooks for custom logic
- ✅ Need multi-database support in one tool
- ✅ Prefer programmatic control with optional CLI
- ✅ Want a tool that doesn't force you into an ORM

## When to Choose Something Else

Consider other tools if you:

- Already heavily invested in an ORM (TypeORM, Sequelize) and want tight integration
- Need automatic migration generation from schema changes
- Prefer pure SQL with no code (Flyway, Liquibase)
- Want a schema-first approach (Prisma)
- Need enterprise governance features (Liquibase Enterprise)

## Design Decisions

### Why Both TypeScript and SQL?

Different teams have different needs:
- **Development teams** often prefer TypeScript for type safety and IDE support
- **DBAs and ops teams** often prefer SQL for reviewability and control
- **MSR supports both** so you can choose what works best for each migration

### Why Dry Run Mode?

Testing migrations before production is critical but often requires:
- Cloning production databases
- Manual testing workflows
- Hoping things work the same

**MSR's dry run mode** (v0.4.0) shows exactly what will change before applying anything.

### Why Execution Summaries?

When migrations fail in production, you need to know:
- What succeeded before the failure?
- What was the exact error?
- How do I recover?

**MSR's execution summaries** (v0.4.0) provide a detailed trace of every step, making debugging and recovery straightforward.

## v0.4.0 Release

Version 0.4.0 brings significant new features:

- ✅ **SQL File Support** (#58) - Native .sql migration files with ISqlDB interface
- ✅ **Dry Run Mode** (#73) - Preview changes before applying
- ✅ **Execution Summary Logging** (#72) - Detailed success/failure traces with file rotation
- ✅ **Simplified API** (#81) - Industry-standard `up()`/`down()` pattern
- ✅ **Connection Validation** (#88) - Early connection checking with `checkConnection()`
- ✅ **Loader Architecture** - Extensible file type support

See the [v0.3.x → v0.4.0 Migration Guide](version-migration/v0.3-to-v0.4) for upgrade instructions.

## Future Roadmap

Upcoming features we're considering:

- **CLI Commands** (#59) - Full command-line interface
- **Template Generator** (#83) - Scaffold new migrations easily
- **Environment Variables** (#84) - Secure configuration
- **Migration Preview** - Visual diff of schema changes

See our [GitHub milestones](https://github.com/migration-script-runner/msr-core/milestones) for details.

## Contributing

MSR is open source and we welcome contributions! Whether you're:
- Reporting bugs or requesting features
- Improving documentation
- Contributing code
- Sharing your use case

Visit our [GitHub repository](https://github.com/migration-script-runner/msr-core) to get involved.

---

{: .note }
This comparison is based on publicly available information and our research as of November 2025. Tool capabilities change over time, so please verify current features with official documentation.
