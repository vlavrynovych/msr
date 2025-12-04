---
layout: default
title: Documentation Local Setup
parent: Development
nav_order: 6
---

# Documentation Local Setup
{: .no_toc }

How to set up and run Jekyll locally for testing documentation changes.
{: .fs-6 .fw-300 }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Overview

MSR documentation uses Jekyll with the Just the Docs theme and is automatically deployed to GitHub Pages. Before pushing documentation changes, you can test them locally to verify formatting, links, and layout.

**Documentation URL:**
- Production: https://migration-script-runner.github.io/msr-core
- Custom domain: https://core.msr.lavr.site

---

## Prerequisites

### Ruby Installation

Jekyll requires Ruby. macOS comes with system Ruby, but it's recommended to use a version manager to avoid permission issues.

#### Using rbenv (Recommended)

**Install rbenv:**
```bash
# Using Homebrew
brew install rbenv ruby-build

# Initialize rbenv
rbenv init
```

**Add to your shell profile** (`~/.zshrc` or `~/.bash_profile`):
```bash
eval "$(rbenv init - zsh)"
```

**Restart your terminal**, then install Ruby:
```bash
# Install Ruby 3.1.0 (or latest stable)
rbenv install 3.1.0

# Set as local version for this project
cd /path/to/msr
rbenv local 3.1.0

# Verify
ruby -v  # Should show: ruby 3.1.0
```

#### Alternative: Using System Ruby

If you prefer system Ruby, you'll need sudo access for gem installations:
```bash
ruby -v  # Check version (should be 2.6+)
```

---

## Initial Setup

### 1. Install Bundler

```bash
gem install bundler
```

If using system Ruby and you get permission errors:
```bash
sudo gem install bundler
```

### 2. Install Dependencies

**Option 1 - Using npm (Recommended):**
```bash
npm run docs:install
```

**Option 2 - Using bundler directly:**

Navigate to the docs folder:
```bash
cd /path/to/msr/docs
```

Install Jekyll and all dependencies:
```bash
bundle install
```

**If using system Ruby** and you encounter permission errors:
```bash
# Install gems to local vendor directory instead
bundle install --path vendor/bundle
```

This will install:
- Jekyll (~3.9.0)
- Just the Docs theme (0.4.0)
- kramdown-parser-gfm (GitHub Flavored Markdown)
- jekyll-seo-tag (SEO optimization)
- jekyll-sitemap (automatic sitemap.xml generation)
- jekyll-remote-theme (remote theme support)
- jekyll-include-cache (theme performance)
- webrick (Ruby 3.0+ compatibility)

**First-time setup takes 2-3 minutes** to download and compile all gems.

---

## Running Jekyll Locally

### Start the Development Server

**Option 1 - Using npm (Recommended):**
```bash
npm run docs:serve
```

**Option 2 - Using bundler directly:**
```bash
cd docs
bundle exec jekyll serve
```

**Output:**
```
Configuration file: /path/to/msr/docs/_config.yml
            Source: /path/to/msr/docs
       Destination: /path/to/msr/docs/_site
 Incremental build: disabled. Enable with --incremental
      Generating...
                    done in 2.341 seconds.
 Auto-regeneration: enabled for '/path/to/msr/docs'
    Server address: http://127.0.0.1:4000
  Server running... press ctrl-c to stop.
```

### Access the Documentation

Open your browser to: **http://localhost:4000**

**Key pages to check:**
- Homepage: http://localhost:4000
- Origin Story: http://localhost:4000/about/origin-story
- Philosophy: http://localhost:4000/about/philosophy
- API Docs: http://localhost:4000/api

### Live Reload

Jekyll watches for file changes and automatically rebuilds:
1. Edit a documentation file
2. Save the file
3. Refresh your browser (usually takes 1-2 seconds to rebuild)

**Note**: Changes to `_config.yml` require restarting the server.

---

## Common Options

### Run on Different Port

```bash
bundle exec jekyll serve --port 4001
```

### Enable Incremental Builds (Faster)

```bash
bundle exec jekyll serve --incremental
```

**Warning**: Incremental builds are faster but may miss some changes. Do a full rebuild if something looks wrong.

### Show Drafts

```bash
bundle exec jekyll serve --drafts
```

### Verbose Output (Debugging)

```bash
bundle exec jekyll serve --verbose
```

---

## Testing Checklist

When testing documentation changes locally, verify:

**Navigation:**
- [ ] Page appears in correct sidebar section
- [ ] `nav_order` is correct
- [ ] Parent/child relationships work
- [ ] Breadcrumbs display correctly

**Content:**
- [ ] All headings render correctly
- [ ] Table of contents generates properly
- [ ] Code blocks have syntax highlighting
- [ ] Links work (internal and external)
- [ ] Images display (if any)

**Formatting:**
- [ ] Callout boxes render (note, warning, tip)
- [ ] Tables are formatted correctly
- [ ] Lists render properly (ordered, unordered, nested)
- [ ] Bold/italic/code formatting works

**Mermaid Diagrams:**
- [ ] Diagrams render without errors
- [ ] Diagram is readable and properly sized
- [ ] Colors and styling work

**Search:**
- [ ] New content is searchable
- [ ] Search results link to correct pages

**Mobile:**
- [ ] Resize browser to mobile width
- [ ] Navigation menu works
- [ ] Content is readable

---

## Troubleshooting

### Error: "cannot load such file -- kramdown-parser-gfm"

**Solution**: Add to `Gemfile`:
```ruby
gem "kramdown-parser-gfm"
```

Then run:
```bash
bundle install
```

### Error: "cannot load such file -- jekyll-include-cache"

**Solution**: The Just the Docs theme requires this plugin.

Add to `Gemfile`:
```ruby
group :jekyll_plugins do
  gem "jekyll-include-cache"
end
```

Add to `_config.yml`:
```yaml
plugins:
  - jekyll-include-cache
```

Then run:
```bash
bundle install
```

### Error: "Permission denied" during bundle install

**Solution 1** - Use rbenv (recommended):
```bash
brew install rbenv ruby-build
rbenv install 3.1.0
rbenv local 3.1.0
bundle install
```

**Solution 2** - Install to local path:
```bash
bundle install --path vendor/bundle
```

### Error: "cannot load such file -- webrick"

**Solution**: Add to `Gemfile`:
```ruby
gem "webrick"
```

This is required for Ruby 3.0+.

### Port 4000 Already in Use

**Solution**: Use a different port:
```bash
bundle exec jekyll serve --port 4001
```

Or find and kill the process using port 4000:
```bash
lsof -ti:4000 | xargs kill -9
```

### Mermaid Diagrams Not Rendering

**Check**: Mermaid version in `_config.yml`:
```yaml
mermaid:
  version: "9.1.3"
```

MSR uses Mermaid 9.1.3 with specific syntax requirements. See [Documentation Writing Standards](documentation-writing-standards#mermaid-diagrams).

### Styles Not Loading (No Theme)

**Symptom**: Site runs but has no styling, looks like plain HTML.

**Solution**: Install the `jekyll-remote-theme` plugin.

Add to `Gemfile`:
```ruby
group :jekyll_plugins do
  gem "jekyll-seo-tag"
  gem "jekyll-remote-theme"
end
```

Add to `_config.yml`:
```yaml
plugins:
  - jekyll-seo-tag
  - jekyll-remote-theme
```

Then run:
```bash
bundle install
bundle exec jekyll serve
```

### Changes Not Appearing

**Solutions:**
1. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Clear Jekyll cache: `rm -rf _site .jekyll-cache`
3. Restart Jekyll server
4. Check for syntax errors in frontmatter

### Build Errors

**Check common issues:**
- YAML frontmatter syntax
- Unclosed code blocks (missing closing backticks)
- Invalid Markdown syntax
- Missing required frontmatter fields

---

## Project Structure

```
docs/
├── _config.yml           # Jekyll configuration
├── Gemfile               # Ruby dependencies
├── Gemfile.lock          # Locked dependency versions
├── CNAME                 # Custom domain configuration
├── index.md              # Homepage
├── getting-started.md    # Quick start guide
├── api/                  # API reference docs
├── guides/               # User guides
├── development/          # Contributor docs
├── about/                # Origin story & philosophy
├── assets/
│   └── css/
│       └── custom.css    # Custom styling
└── _site/                # Generated site (gitignored)
```

---

## Jekyll Configuration

Key settings in `_config.yml`:

```yaml
# Theme
remote_theme: just-the-docs/just-the-docs

# URLs
url: "https://core.msr.lavr.site"
baseurl: ""

# Mermaid diagrams
mermaid:
  version: "9.1.3"

# Search
search_enabled: true

# Code copy button
enable_copy_code_button: true
```

---

## Deployment

### How GitHub Pages Deploys

1. Changes pushed to `master` branch
2. GitHub Pages detects changes in `/docs` folder
3. Jekyll build runs automatically on GitHub servers
4. Site deploys in 1-2 minutes

**No manual deployment needed** - GitHub handles everything.

### Verify Deployment

After pushing to `master`:
1. Go to Repository → Settings → Pages
2. Check "Your site is live at..." message
3. Or check Actions tab for "pages build and deployment" workflow
4. Visit the live URL to verify changes

### Build Status

Check if GitHub Pages build succeeded:
- Repository → Actions tab
- Look for "pages build and deployment"
- Green checkmark = success
- Red X = build failed (check error logs)

---

## Tips for Documentation Authors

### Before Committing

1. **Test locally first**: Always run Jekyll locally before committing
2. **Check all links**: Verify internal links work
3. **Test search**: Make sure new content is searchable
4. **Review mobile**: Check responsive layout
5. **Validate Mermaid**: Ensure diagrams render correctly

### Writing Style

- Follow [Documentation Writing Standards](documentation-writing-standards)
- Use consistent terminology
- Keep sentences concise
- Add code examples
- Include links to related pages

### Mermaid Best Practices

- Keep diagrams simple (5-10 nodes max)
- Use Mermaid 9.1.3 compatible syntax
- No emojis, no dots in labels, no special characters
- Add caption below diagram
- Test rendering locally

---

## Further Reading

- **[Documentation Writing Standards](documentation-writing-standards)** - Style guide and standards
- **[Contributing Guide](contributing)** - How to contribute to MSR
- **[Jekyll Documentation](https://jekyllrb.com/docs/)** - Official Jekyll docs
- **[Just the Docs Theme](https://just-the-docs.github.io/just-the-docs/)** - Theme documentation

---

## Quick Reference

### Using npm scripts (Recommended)

```bash
# Install dependencies
npm run docs:install

# Start server
npm run docs:serve

# Build site (without serving)
npm run docs:build
```

### Using bundler directly

```bash
# Install dependencies
cd docs && bundle install

# Start server
cd docs && bundle exec jekyll serve

# Start on different port
cd docs && bundle exec jekyll serve --port 4001

# Start with incremental builds
cd docs && bundle exec jekyll serve --incremental

# Clean generated files
cd docs && rm -rf _site .jekyll-cache

# Update dependencies
cd docs && bundle update
```

**Local URL**: http://localhost:4000

**Production URL**: https://migration-script-runner.github.io/msr-core
