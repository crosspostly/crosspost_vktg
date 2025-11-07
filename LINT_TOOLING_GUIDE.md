# Lint Tooling Configuration

This document describes the complete lint and test tooling setup for the VK→Telegram Crossposter project.

## Overview

The project now has comprehensive linting, testing, and build automation configured to support CI/CD workflows while maintaining backward compatibility with existing development processes.

## Configuration Files

### Root Configuration

- **`package.json`** - Root package configuration with workspace setup
- **`jest.config.js`** - Jest testing configuration for .gs files
- **`babel.config.js`** - Babel configuration for transpiling .gs files
- **`jest.setup.js`** - Global mocks for Google Apps Script services
- **`.eslintrc.js`** - ESLint configuration with Apps Script globals
- **`.eslintignore`** - Files and directories to exclude from linting

### Tool Scripts

- **`tools/module-check.js`** - Module integrity checker for VK refactoring

## Available Scripts

From the repository root, you can run:

### Development Scripts
```bash
npm run lint              # Run ESLint on all .gs files
npm run lint:fix          # Auto-fix ESLint issues
npm run test              # Run Jest tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
```

### Build Scripts
```bash
npm run build:server      # Build server bundle
npm run build:client      # Build client bundle
npm run build             # Build both server and client
```

### Integrity Scripts
```bash
npm run module-check      # Verify VK module refactoring integrity
```

### CI Pipeline
```bash
npm run ci                # Complete CI pipeline (lint + test + module-check + build)
```

## ESLint Configuration

### Google Apps Script Globals

The ESLint configuration includes comprehensive globals for Google Apps Script:

- **SpreadsheetApp, Session, Utilities, Logger** - Core GAS services
- **PropertiesService, CacheService, UrlFetchApp** - Storage and network services
- **HtmlService, ContentService, ScriptApp** - Web app services
- **doGet, doPost, onOpen, onEdit, onInstall** - Global functions
- **Jest globals** - describe, it, test, expect, etc.

### File-Specific Rules

- **.gs files** - More relaxed rules for GAS compatibility (allows `var`)
- **Test files** - Allow unused variables and console logging
- **Tool files** - Node.js environment with CommonJS modules

## Jest Configuration

### Test Environment

- **Node.js environment** with Google Apps Script mocks
- **Babel transformation** for .gs files to CommonJS
- **Coverage collection** from server/ and client/ directories
- **Global setup** with comprehensive GAS service mocks

### Mocked Services

The `jest.setup.js` file provides mocks for:

```javascript
// Core services
SpreadsheetApp, PropertiesService, UrlFetchApp, Logger

// Global functions
doGet, doPost, onOpen

// Full mock implementations with default return values
```

## Module Integrity Checker

The `tools/module-check.js` script validates:

### Required VK Modules
- **vk-api.gs** - API calls and screen name resolution
- **vk-posts.gs** - Post formatting and deduplication  
- **vk-media.gs** - Media extraction and processing

### Validation Checks
- File existence in server/ directory
- Required function exports present
- Line count limits (≤500 lines per module)
- Documentation presence
- Function extraction and analysis

### Example Output
```
🔍 Checking vk-api.gs...
✓ File exists: vk-api.gs
📊 Stats: 539 lines, 21 KB
⚠️  WARN: 539 lines exceeds recommended 500 lines
🔧 Functions found: 6
✓ All required exports present: handleGetVkPosts, handlePublishLastPost, resolveVkScreenName
```

## Babel Configuration

### .gs File Transformation

- **CommonJS modules** - Converts .gs files to Node-compatible modules
- **Modern JavaScript** - Supports ES2021+ features
- **Optional chaining and nullish coalescing** - Enhanced syntax support

## Development Workflow

### Local Development

1. **Install dependencies**: `npm install`
2. **Run linting**: `npm run lint`
3. **Run tests**: `npm run test`
4. **Check modules**: `npm run module-check`
5. **Build bundles**: `npm run build`

### Pre-commit Checks

The CI pipeline runs: `lint → test → module-check → build`

### Continuous Integration

The `npm run ci` command provides a complete pipeline:

```bash
npm run ci  # Runs all validation and build steps
```

## Backward Compatibility

### Existing Development

- **glasp/ scripts** remain unchanged - all existing `npm run --prefix glasp` commands work
- **Clasp deployment** - No changes to deployment workflows
- **Local development** - All existing development patterns preserved

### Migration Path

- **Optional adoption** - Can use root scripts or continue with glasp/ scripts
- **Gradual transition** - Teams can adopt new tooling incrementally
- **CI integration** - Root scripts designed for CI/CD pipelines

## Coverage Thresholds

Initial setup uses **0% thresholds** to allow gradual test adoption:

```javascript
coverageThreshold: {
  global: {
    branches: 0,
    functions: 0, 
    lines: 0,
    statements: 0
  }
}
```

These can be increased as test coverage improves.

## Troubleshooting

### Common Issues

1. **Jest "no tests found"** - Check testMatch patterns in jest.config.js
2. **ESLint globals not recognized** - Verify .eslintrc.js globals configuration
3. **Module check failures** - Ensure VK modules have required function exports
4. **Build failures** - Check that all required server/ files exist

### Node Options

For large codebases, you may need:

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

## Next Steps

This configuration enables:

- **Phase 2 CI automation** - Ready for GitHub Actions setup
- **Phase 3 test authoring** - Framework in place for comprehensive testing
- **Enhanced development** - Improved tooling and validation
- **Quality gates** - Automated checks for code quality and integrity