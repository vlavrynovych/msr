---
layout: default
title: Guides
nav_order: 5
has_children: true
---

# Guides

Comprehensive guides and practical examples for using Migration Script Runner effectively.

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

## Practical Examples

### [Recipes](recipes/)
Complete, copy-paste-ready implementations for common scenarios:
- PostgreSQL with backup/restore
- MongoDB migrations
- Testing patterns
- Multi-database coordination
- Custom validation

---

