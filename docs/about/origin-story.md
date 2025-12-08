---
layout: default
title: Origin Story
parent: About
nav_order: 1
---

# The Origin Story of MSR
{: .no_toc }

How a small Firebase project in 2017 became a vision for the future of database migrations.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## The Story

### May 2017: The Problem That Started It All

It's hard to explain the constant low-level anxiety of working with production data before your product even launches.

I was leading a small team. We were building a mobile app with Firebase/Firestore. The app wasn't live yet, but we already had production data. Important data. Test data from our beta users, configuration that took hours to set up correctly, mock content we'd painstakingly crafted.

And we needed to migrate this data multiple times a week.

Every time we had to backup and restore, my heart rate would go up a little. One wrong command and we could lose everything. One accidental override of the good snapshot, one mistyped path, one forgotten step in the manual process.

**There was no Firebase migration tooling.** Nothing. Every operation was manual. Every migration was a script I wrote and then said a silent prayer before running.

The fear wasn't theoretical. We had production-grade data before we even had a product. We couldn't afford to corrupt it. But we also couldn't stop moving forward.

### The First Solution

So I built something. Nothing fancy - just a JavaScript tool that would:
- Automatically backup before every migration
- Track what migrations had run in Firebase itself
- Execute new migrations in order
- Automatically rollback if anything failed

The real innovation was simpler than I expected: make safety automatic, not optional.

I also built an `EntityService` - a helper that made migrations readable. Instead of writing raw Firebase SDK calls everywhere, you could write:

```javascript
await userService.updateAll(user => {
  if (!user.email) return null; // skip
  user.emailVerified = false;   // add field
  return user;
});
```

Clean. Declarative. You described *what* should change, not *how* to change it.

The anxiety went away. We ran migrations multiple times a week without fear. It just worked.

### December 2017: The End... Sort Of

The project never launched. Our client couldn't secure investment. The MVP we built stayed an MVP, and the team moved on to other things.

But that little migration tool? It stayed in my memory.

### 2017-2023: The Learning Years

Over the next six years, I worked on many projects, used different databases, saw different migration tools. And I saw their limitations:

**Flyway** was great... if you only used SQL and never needed complex logic.

**Database-specific tools** worked fine... until you switched databases or needed to support multiple platforms.

And almost nobody had automatic backups. You were supposed to handle that yourself. Which meant it often didn't happen, especially under deadline pressure.

I watched teams at work struggle with the same problems I'd solved back in 2017. We'd run SQL migrations for schema changes, then trigger Java-based "data migrations" via UI buttons because the migration tools couldn't handle complex logic. **Why couldn't one tool do both?**

### October 2023: "Why Should I Reinvent the Wheel?"

In late 2023, I started planning a new pet project. I don't even remember what it was anymore - it doesn't matter. What matters is that I needed database migrations again.

And then the thought hit me: "I already solved this problem in 2017. Why should I reinvent the wheel?"

I found the old code. It was messy, tightly coupled to Firebase, written in JavaScript without type safety. But the core concepts were solid.

**October 31, 2023**: I spent a few days extracting the core and reimagining it. What if the migration logic was completely separate from the database? What if you could use the same runner for Firebase, PostgreSQL, MongoDB, anything?

I rewrote everything in TypeScript with clean interfaces. Everything I'd learned about architecture in six years went into this redesign.

**November 2, 2023**: First commit to the Firebase adapter. I quickly validated it worked - the concepts transferred perfectly.

And then... I published it to npm and moved on to other projects. For two years, MSR sat there with virtually zero activity.

### 2025: The Renaissance

Two things changed everything:

**First**: I found a collaborator I never expected - AI. Claude Code meant I could implement ideas without sacrificing my personal time. I became the architect, the product manager, the reviewer. Claude became the developer. Suddenly, without impacting my life, I could actually build this thing.

**Second**: I needed PostgreSQL migrations for another project. And I realized MSR was the tool I'd always wanted. The tool that could handle SQL for schema changes *and* TypeScript for complex logic. The tool with automatic backups. The tool that didn't lock me into one database.

We started building. SQL migration support. Transaction management. Execution summaries for CI/CD. Custom validators. All the features I'd wished other tools had.

### The Vision: More Than a Tool

As we worked, I realized something: MSR isn't just a migration tool. It's the foundation for something bigger.

Imagine a platform - an ecosystem hub - where the developer community shares:
- **Migration templates**: "Add email verification to users", "Create audit log table", "Migrate password hashing to argon2"
- **Custom validators**: Best practices codified as reusable rules
- **Database adapters**: Official adapters maintained in the MSR organization
- **Best practices**: Knowledge about solving migration challenges

A place where teams can generate migrations from proven templates, validate against industry standards, and share knowledge about the hard problems.

**Public templates** anyone can use. **Private templates** for companies with their own standards.

Not just a tool - an ecosystem.

### Why This Story Matters

I didn't build MSR from theory. I built it from **scar tissue**.

From the fear of corrupting production data. From watching teams struggle with rigid tools that don't fit modern stacks. From the frustration of choosing between simple SQL migrations and powerful programmatic logic. From the realization that your tools should bend to your needs, not the other way around.

Every feature in MSR exists because someone (often me) hit a wall with existing tools and thought "there has to be a better way."

If you've ever thought "I wish my migration tool could do X" - there's a good chance MSR already does it. And if it doesn't, I'd love to hear about it.

### Today: Just Getting Started

MSR is still young. The community is just beginning to form. But the foundation is solid, tested across multiple projects and database types.

I'm not a native English speaker - I make mistakes in my writing. I don't have a marketing team or a big company behind this. What I have is:
- A real problem I solved in 2017
- Six years of learning what works and what doesn't
- A modern architecture that makes sense
- An AI collaborator that helps bring ideas to life
- A vision for what migration tooling could become

Whether you're proposing a new adapter for your database, creating templates for common migrations, writing validators for your team's rules, or just using MSR and sharing feedback - you're part of building something better.

Welcome to the journey.

---

## The Technical Evolution

For those who want to understand how MSR evolved technically, here's the detailed journey from prototype to production framework.

### The 2017 Prototype: Core Concepts

The original JavaScript implementation had several key innovations that survived into the modern version:

#### 1. Automatic Backup & Rollback

Every migration started with an automatic backup:

```javascript
// From the 2017 runner.js
migrate() {
  return Promise.all([
    this.dbUtil.backup(this.env),
    this.migrationService.getAll(),
    this.getAllMigrationScripts()
  ])
  .then(/* run migrations */)
  .catch(err => {
    console.info('-----------------> Failed');
    console.error(err);
    console.info('-----------------> Reverting DB');
    return this.dbUtil.restore(this.env, this.backupFile);
  })
}
```

This pattern - backup first, rollback on failure - eliminated the fear of running migrations.

#### 2. Migration Tracking

Migrations were tracked in Firebase with full execution history:

```javascript
// Migration file naming pattern
V201712051400_PROJ-462_add_email_verification.js

// Tracked in Firebase:
{
  timestamp: "201712051400",
  name: "V201712051400_PROJ-462_add_email_verification.js",
  username: "developer",
  startedAt: 1512486000000,
  finishedAt: 1512486045000,
  result: { status: "ok", updated: 156, skipped: 2 }
}
```

The tool compared executed migrations against local files to find new ones to run, then executed them sequentially in timestamp order.

#### 3. EntityService Pattern

The breakthrough was abstracting database operations into a service layer:

```javascript
// 2017: Clean, declarative migrations
class EntityService extends FirebaseService {
  constructor(db, root) {
    super(db);
    this.root = root;
  }

  updateAll(callback) {
    return this.getAll().then(entities => {
      let tasks = entities.map(entity => {
        let updated = callback(entity);
        if (!updated) return { key: entity.$key, status: 'skipped' };

        return this.save(updated).then(() => ({
          key: entity.$key,
          status: 'updated'
        }));
      });

      return Promise.all(tasks).then(results => {
        // Returns: { updated: [ids], skipped: [ids] }
      });
    });
  }
}
```

Migrations became readable and maintainable:

```javascript
const userService = new EntityService(db, '/users');
await userService.updateAll(user => {
  if (!user.email) return null;
  user.emailVerified = false;
  user.emailLowercase = user.email.toLowerCase();
  return user;
});
```

This pattern proved so valuable it became core to MSR's architecture as the handler pattern.

### The 2023 Rewrite: Architectural Transformation

#### From Monolith to Clean Architecture

**2017**: Everything was coupled to Firebase
```javascript
// Tightly coupled
let runner = new Runner(firebase.database(), environment);
runner.migrate();
```

**2023**: Clean separation of concerns
```typescript
// Database-agnostic core
interface IDatabaseMigrationHandler {
  db: IDB;
  schemaVersion: ISchemaVersion;
  backup?: IBackup;
  getName(): string;
}

// Plug in any database
const executor = new MigrationScriptExecutor({ handler , config });
```

#### From JavaScript to TypeScript

Type safety transformed the codebase:

```typescript
// 2023: Full type safety
interface IMigrationScript {
  name: string;
  timestamp: string;
  up(db: IDB, info: IMigrationInfo): Promise<string>;
  down?(db: IDB): Promise<string>;
}

interface IMigrationContext {
  handler: IDatabaseMigrationHandler;
  config: Config;
  logger: ILogger;
}
```

#### From Firebase-Only to Database-Agnostic

The key insight: separate *what* migrations do from *how* they talk to databases.

```
MSR Core (2023)
├── Migration discovery and ordering
├── Execution workflow
├── Validation and tracking
├── Rollback strategies
└── Interface: IDatabaseMigrationHandler
         ↓
    ┌────┴─────────┬──────────────┬─────────────┐
    │              │              │             │
Firebase      PostgreSQL      MongoDB    Your Custom
Adapter         Adapter        Adapter      Adapter
```

This architecture means:
- Same migration runner works with any database
- Easy to add new database adapters
- Core improvements benefit all databases
- Database-specific optimizations stay in adapters

### Key Architectural Decisions

#### 1. Polyglot Migrations

Mix SQL, TypeScript, and JavaScript in one project:

```
migrations/
  ├─ V202501010001_create_users_table.up.sql
  ├─ V202501010001_create_users_table.down.sql
  ├─ V202501020001_migrate_user_data.ts
  └─ V202501030001_add_indexes.up.sql
```

**Why?** Because SQL is perfect for schema changes, but TypeScript is better for complex data transformations.

#### 2. Library-First Design

Return results instead of calling `process.exit()`:

```typescript
const result = await executor.up();

if (result.success) {
  console.log(`✅ Executed ${result.executed.length} migrations`);
  // Continue running your application
} else {
  console.error('❌ Migration failed:', result.errors);
  // Handle error based on your context
  if (isProduction) alertOpsTeam(result.errors);
  if (isCLI) process.exit(1);
}
```

**Why?** Web servers, serverless functions, and test suites need to handle migration results gracefully, not have the process killed.

#### 3. Multiple Rollback Strategies

Different projects have different safety requirements:

```typescript
enum RollbackStrategy {
  BACKUP,  // Automatic backup/restore
  DOWN,    // Use down() methods
  BOTH,    // Belt and suspenders
  NONE     // For append-only systems
}
```

**Why?** One size doesn't fit all. Let teams choose the right trade-off between safety and speed.

#### 4. Custom Validators

Enforce team-specific rules before migrations run:

```typescript
class RequireJiraTicketValidator implements IMigrationValidator {
  validate(script: IMigrationScript): ValidationResult {
    const hasTicket = /PROJ-\d+/.test(script.name);
    if (!hasTicket) {
      return {
        valid: false,
        message: `Migration ${script.name} must reference a Jira ticket`
      };
    }
    return { valid: true };
  }
}
```

**Why?** Catch mistakes in development, not production.

#### 5. Execution Summary

Structured output for CI/CD pipelines:

```typescript
{
  "success": true,
  "migrationsRun": 3,
  "duration": 4521,
  "schemaVersion": "202501040001",
  "migrations": [
    {
      "name": "V202501010001_create_users",
      "status": "completed",
      "duration": 1200
    }
  ]
}
```

**Why?** CI/CD systems need structured data, not console output.

### Evolution Timeline

**October 31, 2023**: First commit to `migration-script-runner`
- Extracted core from 2017 prototype
- Reimagined architecture with TypeScript
- Database-agnostic interfaces

**November 2, 2023**: First commit to `msr-firebase`
- Validated architecture with Firebase adapter
- Proved separation of concerns worked

**2023-2025**: Dormant period
- Published to npm
- No active development
- Waiting for the right moment

**2025**: Active development resumes
- SQL migration support added
- Transaction management implemented
- Custom validators framework
- Execution summary for CI/CD
- Enhanced documentation
- Vision for ecosystem hub

### What Makes MSR Different Today

**vs Flyway**
- ✅ Works with NoSQL databases
- ✅ Mix SQL and programmatic migrations
- ✅ Inject your own services and business logic

**vs Database-Specific Tools**
- ✅ One tool for multiple databases
- ✅ Portable migration patterns
- ✅ Built-in backup/restore

**vs Traditional Migration Tools**
- ✅ Library-first design (safe for web servers)
- ✅ Structured execution results
- ✅ Custom validation framework
- ✅ Polyglot migrations (SQL + TS + JS)
- ✅ Injectable services for business logic

### The Road Ahead

#### Near-Term Goals

**Database Adapters**
- PostgreSQL (in progress)
- MySQL
- MongoDB
- SQL Server
- Oracle

**Migration Templates** ([#83](https://github.com/migration-script-runner/msr-core/issues/83))
- Generate migrations from templates
- "Add UUID to users"
- "Create audit log table"
- "Migrate to argon2 passwords"

**Enhanced Validation**
- More built-in validators
- Validator composition
- Warning vs error levels

#### Long-Term Vision: The Migration Hub

An online platform where the community shares:

**Templates**
- Public templates for common migrations
- Private templates for company standards
- Versioned and tested
- Search and discovery

**Validators**
- Best practices as code
- Industry standards (GDPR, SOC2, etc.)
- Custom rules sharing

**Adapters**
- Official database adapters maintained in the Migration Script Runner organization
- Community contributions through the standardized development process
- Quality standards and comprehensive testing
- Documentation and examples

**Knowledge Base**
- Migration patterns
- Case studies
- Troubleshooting guides
- Performance optimization

### Join the Journey

MSR is built from real needs, real problems, real production experience. Every feature exists because someone needed it.

**How you can help:**
- Propose or contribute to database adapters (all adapters live in the Migration Script Runner org)
- Create templates for common migrations
- Write validators for your industry
- Share your migration patterns
- Report bugs and suggest features
- Contribute to documentation

The migration ecosystem is just beginning. All database adapters are developed and maintained under the [Migration Script Runner organization](https://github.com/migration-script-runner) to ensure consistency, quality standards, and recognition as part of the official ecosystem. Whether you're using MSR in production, contributing to an adapter, or just exploring - you're part of shaping what database migration tooling becomes.

---

**Started**: October 31, 2023
**Community**: Growing
**License**: MIT
**Status**: Production-ready, actively developed

Welcome to MSR.
