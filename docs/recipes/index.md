---
layout: default
title: Recipes
nav_order: 7
has_children: true
---

# Recipes
{: .no_toc }

Practical, copy-paste-ready recipes for common migration scenarios.
{: .fs-6 .fw-300 }

---

## What are Recipes?

Recipes are complete, working code examples that solve common real-world migration challenges. Unlike API documentation, recipes show you the full implementation including setup, configuration, error handling, and testing.

Each recipe includes:
- **Complete code** - Copy-paste ready implementation
- **Explanation** - What the code does and why
- **Testing guide** - How to verify it works
- **Common issues** - Troubleshooting tips

---

## Available Recipes

### Database Implementations

- **[PostgreSQL with Backup](postgres-with-backup)** - Complete PostgreSQL handler with pg_dump/restore backup
- **[MongoDB Migrations](mongodb-migrations)** - NoSQL migrations with MongoDB
- **[Testing Migrations](testing-migrations)** - Unit and integration testing patterns

### Advanced Patterns

- **[Multi-Database Migrations](multi-database)** - Coordinate migrations across multiple databases
- **[Custom Validation](custom-validation)** - Extend the validation system with custom rules

---

## Recipe Categories

### By Database Type
- **SQL**: PostgreSQL, MySQL, SQL Server
- **NoSQL**: MongoDB, Firebase/Firestore
- **In-Memory**: Redis (for caching/session management)
- **Multi-Database**: Coordinating across different databases

### By Use Case
- **Backup & Recovery**: Custom backup implementations
- **Testing**: Unit tests, integration tests, mocks
- **CI/CD**: Pipeline integration, automated deployments
- **Validation**: Custom rules, pre-migration checks
- **Performance**: Large-scale migrations, batch processing

---

## How to Use Recipes

1. **Find** the recipe that matches your use case
2. **Read** the complete example to understand the pattern
3. **Copy** the code into your project
4. **Adapt** the implementation to your specific needs
5. **Test** thoroughly before deploying

{: .tip }
> Recipes are designed to be customized. Use them as starting points and adapt them to your specific requirements.

---

## Contributing Recipes

Have a useful migration pattern to share? We welcome recipe contributions!

See the [Contributing Guide](../development/contributing) for how to submit recipes.

---

## Next Steps

- [User Guides](../user-guides/) - Learn core MSR concepts
- [API Reference](../api/) - Detailed API documentation
- [Customization](../customization/) - Extend MSR with custom loggers, renderers, and more
