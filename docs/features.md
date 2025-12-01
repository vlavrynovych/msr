# Features

Migration Script Runner is a production-ready migration framework packed with powerful features for safe, reliable database migrations.

## Core Migration Features

| Feature | Description |
|---------|-------------|
| **🎯 Multi-File Format Support** | Run migrations written in TypeScript, JavaScript, or SQL - all in the same project |
| **📁 Flexible File Discovery** | Automatic discovery with customizable patterns, recursive scanning, and version-based ordering |
| **📊 Migration Tracking** | Built-in schema versioning with execution history, timestamps, and checksum validation |
| **⏱️ Execution Timing** | Track migration performance with millisecond-precision timing for each operation |
| **🔄 Up & Down Migrations** | Support for both forward (up) and reverse (down) migrations with flexible policies |
| **📦 Batch Operations** | Execute multiple migrations in a single batch with progress tracking |

## Safety & Rollback

| Feature | Description |
|---------|-------------|
| **💾 Automatic Backups** | Create database backups before migrations with customizable naming and retention |
| **🔙 Multiple Rollback Strategies** | Choose from backup restore, down() methods, both, or none based on your needs |
| **🛡️ Integrity Validation** | Checksum-based detection of modified migrations with configurable enforcement |
| **🧪 Dry Run Mode** | Test migrations in transactions without committing changes to verify safety |
| **🔐 Pre-Migration Validation** | Validate all migrations before execution to catch issues early |

## Transaction Management

| Feature | Description |
|---------|-------------|
| **🔒 Flexible Transaction Modes** | Run migrations per-migration, per-batch, or without transactions |
| **🎚️ Isolation Level Control** | Configure SQL transaction isolation from read uncommitted to serializable |
| **🔁 Automatic Retry Logic** | Built-in retry with exponential backoff for deadlocks and transient failures |
| **⏲️ Transaction Timeouts** | Configurable timeouts to prevent long-running transactions |
| **📈 Transaction Metrics** | Track retries, duration, and failures for monitoring and alerting |

## Validation & Quality

| Feature | Description |
|---------|-------------|
| **✅ Built-in Validators** | Validate structure, syntax, and conventions automatically |
| **🔍 Custom Validators** | Extend with your own validation rules for naming, documentation, or SQL safety |
| **⚠️ Strict Mode** | Treat warnings as errors in CI/CD for maximum quality enforcement |
| **📝 Down Method Policies** | Enforce, recommend, or make optional down() methods based on strategy |
| **🔎 Checksum Verification** | Detect unauthorized changes to executed migrations |

## Configuration & Flexibility

| Feature | Description |
|---------|-------------|
| **🌍 Environment Variables** | Configure via MSR_* environment variables following 12-factor app principles |
| **📄 Config Files** | Support for msr.config.js or msr.config.json with automatic discovery |
| **⚙️ Programmatic API** | Full TypeScript API for integration into your applications |
| **🔌 Extensible Loaders** | Add custom loaders for new file formats beyond TypeScript, JavaScript, SQL |
| **🎨 Custom Handlers** | Implement your own database handlers for any database system |

## Logging & Monitoring

| Feature | Description |
|---------|-------------|
| **📊 Execution Summaries** | Detailed JSON and text summaries of migration runs with all metrics |
| **🎭 Multiple Logger Support** | Console, file, silent, or custom loggers - use multiple simultaneously |
| **🪝 Lifecycle Hooks** | Hook into migration lifecycle for monitoring, alerting, or custom logic |
| **📈 Rich Metrics** | Track execution time, transaction metrics, retry attempts, and more |
| **🎨 Customizable Output** | ASCII tables, JSON, or silent rendering - choose your display format |

## Developer Experience

| Feature | Description |
|---------|-------------|
| **📘 TypeScript First** | Written in TypeScript with full type safety and IntelliSense support |
| **🎯 Zero Dependencies** | Minimal footprint - only database driver and your dependencies needed |
| **📚 Comprehensive Docs** | Detailed documentation with examples, guides, and API reference |
| **🧩 Modular Architecture** | Clean separation of concerns with dependency injection throughout |
| **🧪 100% Test Coverage** | Fully tested with unit, integration, and mutation testing |
| **🚀 Production Ready** | Battle-tested features for reliability, performance, and safety |

## Database Support

| Feature | Description |
|---------|-------------|
| **🗄️ SQL Databases** | PostgreSQL, MySQL, SQLite, SQL Server, and any SQL database |
| **📊 NoSQL Databases** | MongoDB, Cassandra, and other NoSQL systems via custom handlers |
| **🔄 Transaction Support** | Automatic detection and use of database transaction capabilities |
| **💾 Backup Support** | Flexible backup interface for any database backup strategy |

## Advanced Features

| Feature | Description |
|---------|-------------|
| **🔀 Migration Dependencies** | beforeMigrate hook for setup tasks that run once before migrations |
| **🎯 Selective Execution** | Target specific migrations, run up to a version, or skip certain files |
| **📊 Status Reporting** | View current schema version, pending migrations, and execution history |
| **🔍 Migration Discovery** | Smart detection of duplicate timestamps, naming conflicts, and missing files |
| **🎨 Custom Rendering** | Create custom renderers for integration with external systems |
| **🪝 Custom Hooks** | Implement custom lifecycle hooks for logging, metrics, or business logic |

## Security & Compliance

| Feature | Description |
|---------|-------------|
| **🔐 Checksum Validation** | Detect unauthorized modifications to executed migrations |
| **📜 Audit Trail** | Complete history of migrations with timestamps, checksums, and user tracking |
| **🔒 Strict Validation** | Enforce quality and security standards before execution |
| **🛡️ Safe Rollback** | Multiple safety mechanisms including backups and reversible migrations |

## Platform Support

| Feature | Description |
|---------|-------------|
| **🖥️ Cross-Platform** | Works on Linux, macOS, and Windows |
| **🐳 Docker Ready** | Environment variable configuration perfect for containers |
| **☸️ Kubernetes Compatible** | ConfigMaps and Secrets integration via environment variables |
| **📦 npm Package** | Easy installation from npm registry |
| **🔧 CLI & Programmatic** | Use as CLI tool or integrate into your Node.js application |

---

## Quick Feature Comparison

Compare MSR features across different use cases:

| Use Case | Key Features |
|----------|--------------|
| **Development** | Fast iteration, down() methods, flexible validation, dry run testing |
| **CI/CD** | Strict validation, checksum verification, automated testing, environment variables |
| **Production** | Automatic backups, transaction management, retry logic, execution summaries |
| **Enterprise** | Audit trails, custom validators, hooks for monitoring, comprehensive logging |
| **Multi-Database** | Custom handlers, flexible loaders, both SQL and NoSQL support |

---

## Getting Started

Ready to use these features? Start here:

- **[Getting Started Guide](./getting-started.md)** - Quick start in 5 minutes
- **[Configuration](./configuration/)** - Configure MSR for your needs
- **[User Guides](./user-guides/)** - In-depth guides for all features
- **[API Reference](./api/)** - Complete API documentation

---

## Feature Highlights by Version

### v0.5.0 (Current)
- ✨ **Transaction Management** - Full transaction control with retry logic
- ✨ **Environment Variables** - 12-factor app configuration support
- ✨ **Execution Summaries** - Detailed JSON/text summaries with metrics
- ✨ **Lifecycle Hooks** - Monitor and customize migration lifecycle

### v0.4.0
- ✨ **SQL Migrations** - Native .sql file support
- ✨ **Custom Validators** - Extensible validation framework
- ✨ **Checksum Validation** - Detect unauthorized changes

### v0.3.0
- ✨ **Backup & Restore** - Automatic database backups
- ✨ **Rollback Strategies** - Multiple rollback approaches
- ✨ **Custom Logging** - Flexible logger system

### v0.2.0
- ✨ **Migration Validation** - Pre-execution validation
- ✨ **Down Methods** - Reversible migrations
- ✨ **Schema Tracking** - Migration history management

### v0.1.0
- ✨ **Core Engine** - Basic migration execution
- ✨ **TypeScript Support** - Type-safe migrations
- ✨ **Version Control** - Timestamp-based versioning
