---
layout: default
title: Version Migration
nav_order: 7
has_children: true
---

# Version Migration

This section contains guides for upgrading between major versions of MSR. Each guide includes detailed instructions, breaking changes, and examples to help you migrate smoothly.

## Available Upgrade Guides

- [**v0.3 to v0.4**](v0.3-to-v0.4.md) - **Breaking:** SQL migrations, API method renames (`up()`/`down()`), `filePatterns` array, `checkConnection()` required
- [**v0.2 to v0.3**](v0.2-to-v0.3.md) - **Breaking:** `migrate()` now returns `IMigrationResult`, no longer calls `process.exit()`
- [**v0.1 to v0.2**](v0.1-to-v0.2.md) - Package rename from `migration-script-runner` to `@migration-script-runner/core`

## Migration Policy

### When We Create Migration Guides

We create migration guides for:
- **Major version changes** (e.g., v1 to v2) - Always includes migration guide
- **Breaking changes** in minor versions (e.g., v0.1 to v0.2) - Includes migration guide
- **Package renames** or structural changes - Includes migration guide

### What's In a Migration Guide

Each guide includes:
- ✅ Summary of changes
- ✅ Breaking changes list
- ✅ Step-by-step migration instructions
- ✅ Before/after code examples
- ✅ Troubleshooting tips
- ✅ Automated migration tools (when applicable)

## Semantic Versioning

MSR follows [Semantic Versioning](https://semver.org/):

- **MAJOR version** (x.0.0) - Incompatible API changes
- **MINOR version** (0.x.0) - New features, backward compatible
- **PATCH version** (0.0.x) - Bug fixes, backward compatible

During **v0.x development**, minor versions may include breaking changes (we'll always provide migration guides).

## Need Help?

If you encounter issues during migration:
1. Check the specific migration guide for your version
2. Search [GitHub Issues](https://github.com/migration-script-runner/msr-core/issues)
3. Review the [API documentation](../api/) for detailed reference
4. Create a new issue if your problem isn't covered

## Stay Updated

To stay informed about new versions and breaking changes:
- Watch the [GitHub repository](https://github.com/migration-script-runner/msr-core)
- Check the [Changelog](https://github.com/migration-script-runner/msr-core/releases)
- Follow the [npm package](https://www.npmjs.com/package/@migration-script-runner/core)
