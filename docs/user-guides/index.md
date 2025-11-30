---
layout: default
title: User Guides
nav_order: 5
has_children: true
---

# User Guides

Comprehensive guides for using Migration Script Runner effectively.

## Core Usage

### [Writing Migrations](writing-migrations)
Best practices for creating migration scripts:
- Migration file structure
- up() and down() methods
- Database operations
- Error handling

### [SQL Migrations](sql-migrations)
Complete guide to SQL migration files (v0.4.0+):
- Using .up.sql and .down.sql files
- ISqlDB interface implementation
- Mixing TypeScript and SQL migrations
- Database-specific SQL features

### [Version Control](version-control)
Controlled migrations and rollbacks:
- up() for specific versions
- down() for rollbacks
- Version targeting strategies
- Migration workflows

### [Backup & Restore Workflows](backup-restore-workflows)
Database backup and restore operations:
- Environment synchronization
- Disaster recovery
- Database cloning
- Production to staging workflows

---

## Related Documentation

- [Configuration](../configuration/) - Configure migration behavior
- [API Reference](../api/) - Complete API documentation
- [Customization](../customization/) - Extend MSR with custom implementations
