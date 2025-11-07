# 🚀 GitHub Actions CI/CD Setup Guide

**Version:** 7.0 (Phase 2 Complete)  
**Last Updated:** 2025-11-07  
**Author:** f_den

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Workflow Inventory](#workflow-inventory)
3. [NPM Scripts Mapping](#npm-scripts-mapping)
4. [Caching Strategy](#caching-strategy)
5. [Quality Gates & Enforcement](#quality-gates--enforcement)
6. [Extending for New Environments](#extending-for-new-environments)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Local Reproduction](#local-reproduction)
9. [Configuration Reference](#configuration-reference)

---

## 🎯 Overview

The VK→Telegram Crossposter uses a **multi-workflow CI/CD pipeline** designed for fast feedback, comprehensive quality checks, and automated deployment to Google Apps Script. The pipeline is organized into **6 specialized workflows** that run at different stages of the development lifecycle.

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Feature Branch                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │   quick-check.yml (Fast Feedback ~2 min)          │  │
│  │   ├─ Lint                                          │  │
│  │   ├─ Module Check                                  │  │
│  │   └─ Quick Build                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Pull Request → main                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │   ci.yml (Comprehensive ~4-6 min)                 │  │
│  │   ├─ Phase 2.1: Lint                              │  │
│  │   ├─ Phase 2.2: Module Integrity Check            │  │
│  │   ├─ Phase 2.3: Build Verification (matrix)       │  │
│  │   ├─ Phase 2.4: Test Suite + Coverage             │  │
│  │   ├─ Phase 2.5: Integration Check                 │  │
│  │   └─ Summary Report                               │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │   ci-validation.yml (Config Validation ~3 min)    │  │
│  │   (Triggered only when CI config changes)         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Merge to main                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │   glasp-deploy.yml (Conditional Deploy ~5 min)    │  │
│  │   ├─ Server deployment ([server] in commit msg)   │  │
│  │   └─ Client deployment ([client] in commit msg)   │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │   deploy.yml (Legacy Build & Artifacts ~3 min)    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Scheduled Daily                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │   maintenance.yml (Health & Cleanup ~4 min)       │  │
│  │   ├─ Health Check                                 │  │
│  │   ├─ Cleanup Tasks                                │  │
│  │   └─ Dependency Security Check                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 Workflow Inventory

### 1. **ci.yml** - Main CI Pipeline (Phase 2 Quality Gates)

**Location:** `.github/workflows/ci.yml`

**Triggers:**
- `pull_request` targeting `main` branch
- `push` to `main` branch

**Jobs:**

#### Phase 2.1: Lint Code Quality
- **Purpose:** Enforce code style and detect syntax errors
- **Commands:** `npm ci` → `npm run lint` (in glasp directory)
- **Failure handling:** Uploads `.eslintcache` for debugging
- **Duration:** ~1-2 min

#### Phase 2.2: Module Integrity Check
- **Purpose:** Verify VK module refactoring (Phase 1) is intact
- **Commands:** `npm ci` → `npm run module-check`
- **Validation:**
  - `vk-api.gs`, `vk-posts.gs`, `vk-media.gs` exist
  - Required exports present in each module
  - Files under 500 lines (maintainability)
- **Duration:** ~30 sec

#### Phase 2.3: Build Verification
- **Purpose:** Test build process for server and client
- **Strategy:** Matrix build (`component: [server, client]`)
- **Commands:**
  - `npm ci`
  - `npm run build:server` OR `npm run build:client`
- **Verification:**
  - Checks `dist/server-bundle.gs` or `dist/client-bundle.gs` exists
  - Reports bundle size (lines of code)
- **Artifacts:** Uploads bundles for 30 days
- **Dependencies:** Requires lint + module-check to pass
- **Duration:** ~2 min (parallel execution)

#### Phase 2.4: Test Suite with Coverage
- **Purpose:** Run Jest tests and generate coverage report
- **Commands:**
  - `npm ci`
  - `npm run test`
- **Outputs:**
  - Test results
  - Module statistics summary
  - Coverage summary (Markdown format)
- **Artifacts:** Uploads `coverage-summary.md`
- **Dependencies:** Requires lint + module-check to pass
- **Duration:** ~1-2 min

#### Phase 2.5: Integration Check
- **Purpose:** Verify all artifacts are compatible
- **Trigger:** Only on pull requests
- **Commands:**
  - Downloads all artifacts from previous jobs
  - Verifies server and client bundles present
  - Displays bundle previews (first 10 lines)
- **Dependencies:** Requires build + test to pass
- **Duration:** ~30 sec

#### Summary Phase
- **Purpose:** Generate Phase 2 completion report
- **Outputs:** GitHub Step Summary with status table
- **Always runs:** Even if previous jobs fail (for reporting)

**Permissions:**
- `contents: read` - Read repository code
- `checks: write` - Write check results
- `actions: read` - Read workflow metadata

---

### 2. **quick-check.yml** - Fast Feedback Loop

**Location:** `.github/workflows/quick-check.yml`

**Triggers:**
- `push` to any branch EXCEPT `main` (feature branches)
- `pull_request` targeting `main` (early feedback)

**Purpose:** Provide rapid feedback (~2 min) on feature branches before opening PR

**Jobs:**

#### Quick Lint Check
- **Commands:** `npm ci` → `npm run lint`
- **Duration:** ~1 min

#### Quick Module Check
- **Commands:** `npm ci` → `npm run module-check`
- **Duration:** ~30 sec

#### Quick Build Check
- **Commands:** `npm ci` → `npm run build` (both server & client)
- **Verification:** Checks both bundles exist
- **Dependencies:** Requires quick-lint + quick-module-check
- **Duration:** ~1-2 min

**Total Duration:** ~2-3 minutes (significantly faster than full ci.yml)

**Permissions:**
- `contents: read` - Minimal permissions for fast execution

---

### 3. **ci-validation.yml** - CI Configuration Validator

**Location:** `.github/workflows/ci-validation.yml`

**Triggers:**
- `pull_request` when modifying:
  - `.github/workflows/**`
  - `glasp/package.json`
- `workflow_dispatch` (manual trigger)

**Purpose:** Validate CI configuration itself (meta-validation)

**Jobs:**

#### Validate Workflows
- **Workflow syntax validation:**
  - Uses Python's `yaml.safe_load()` to validate YAML syntax
  - Checks all `.github/workflows/*.yml` files
  
- **NPM scripts validation:**
  - Verifies all required scripts defined in `glasp/package.json`:
    - `lint`, `module-check`, `build:server`, `build:client`, `build`, `test`
  
- **Module integrity test:**
  - Runs `npm run module-check` to ensure script works
  
- **Build scripts dry run:**
  - Tests `build:server` and `build:client`
  - Verifies bundles are created
  
- **Workflow triggers validation:**
  - Checks `ci.yml` has `pull_request` and `push` triggers
  - Checks `quick-check.yml` has `push` trigger
  
- **Permissions validation:**
  - Reviews workflow permissions
  - Warns if excessive `write` permissions detected

- **Validation report:**
  - Generates summary report
  - Uploads as artifact (30 days retention)

**Duration:** ~3-4 min

**Use Case:** Run after modifying CI configuration to ensure changes are valid

---

### 4. **glasp-deploy.yml** - Automated Deployment

**Location:** `.github/workflows/glasp-deploy.yml`

**Triggers:**
- `push` to `main` branch when:
  - Commit message contains `[server]` OR
  - Commit message contains `[client]` OR
  - Manual trigger via `workflow_dispatch`
- Changes in: `server/**`, `client/**`, `glasp/**`

**Purpose:** Deploy built bundles to Google Apps Script production

**Jobs:**

#### Deploy Server
- **Condition:** `contains(github.event.head_commit.message, '[server]') || workflow_dispatch`
- **Commands:**
  ```bash
  npm install                              # Install dependencies
  npm install -g @google/clasp             # Install clasp globally
  node glasp/deploy-server.js              # Build server bundle
  clasp push --force                       # Deploy to Apps Script
  ```
- **Configuration:**
  - Server Script ID: `1swkg5t74hsAma2H6KevvHNATgYVQ0L1WZx6jZH-FUC45EXxhXXXsjvC9`
  - Credentials: `${{ secrets.CLASPRC_JSON }}`
- **Duration:** ~3-4 min

#### Deploy Client
- **Condition:** `contains(github.event.head_commit.message, '[client]') || workflow_dispatch`
- **Commands:** Similar to server deployment
- **Configuration:**
  - Client Script ID: `1QkeuN2Fa47W06HGJRPUVzHmWJV_vZ2xk3lwJKetDnH049YFxV9aGrO9h`
  - Credentials: `${{ secrets.CLASPRC_JSON }}`
- **Duration:** ~3-4 min

**Secrets Required:**
- `CLASPRC_JSON`: Google Apps Script authentication credentials (from `~/.clasprc.json`)

**Example Commit Messages:**
```bash
git commit -m "[server] Fix VK API error handling"
git commit -m "[client] Update UI labels"
git commit -m "[server][client] Sync API changes"
```

---

### 5. **deploy.yml** - Legacy Build & Artifacts

**Location:** `.github/workflows/deploy.yml`

**Triggers:**
- `push` to `main` or `refactor-split-client-server-modules-limit-500-lines-glasp-apps-script`
- `pull_request` targeting `main`
- `workflow_dispatch` (manual trigger)

**Purpose:** Legacy workflow for building and uploading artifacts (no clasp deployment)

**Jobs:**

#### Build and Deploy
- **Commands:**
  ```bash
  npm ci                        # Install dependencies
  node glasp/deploy-server.js   # Build server
  node glasp/deploy-client.js   # Build client
  eslint server/*.gs client/*.gs --quiet  # Lint check
  ```
- **Artifacts:** Uploads `dist/` directory as `dist-apps-script`
- **Summary:** Lists modules and build info
- **Duration:** ~3 min

**Note:** This workflow is maintained for compatibility and artifact generation. Consider deprecating after full migration to `glasp-deploy.yml`.

---

### 6. **maintenance.yml** - Scheduled Health Checks

**Location:** `.github/workflows/maintenance.yml`

**Triggers:**
- `schedule`: Daily at 2 AM UTC (`0 2 * * *`)
- `workflow_dispatch` with options:
  - `run_cleanup`: Run cleanup tasks (boolean)
  - `run_health_check`: Run health checks (boolean, default: true)

**Purpose:** Proactive monitoring and maintenance

**Jobs:**

#### Health Check
- **Checks:**
  - Essential files exist (server.gs, client-core.gs, etc.)
  - Module counts (server/client)
  - Large files detection (>500 lines)
  - Bundle size reporting
- **Output:** Health check summary
- **Duration:** ~2-3 min

#### Cleanup
- **Runs:** On schedule OR when `run_cleanup=true`
- **Checks:**
  - Temporary files (*.tmp, *.log, *.bak, *~, .DS_Store)
  - .gitignore effectiveness
- **Output:** Cleanup recommendations
- **Duration:** ~1 min

#### Dependency Security Check
- **Commands:**
  ```bash
  npm outdated                      # Check outdated packages
  npm audit --audit-level moderate  # Security vulnerabilities
  ```
- **Duration:** ~1-2 min

**Permissions:**
- `contents: read` - Read repository
- `actions: read` - Read workflow metadata

---

## 🔧 NPM Scripts Mapping

### Root-Level Scripts (`package.json`)

Located in project root, delegates to workspace:

```json
{
  "scripts": {
    "build:server": "npm run --prefix glasp build:server",
    "build:client": "npm run --prefix glasp build:client", 
    "build": "npm run build:server && npm run build:client",
    "lint": "npm run --prefix glasp lint",
    "lint:fix": "npm run --prefix glasp lint:fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "module-check": "node tools/module-check.js",
    "prepare": "npm run build",
    "ci": "npm run lint && npm run test && npm run module-check && npm run build"
  }
}
```

**Workflow Usage:**
- ✅ **CI workflows**: Run scripts from `glasp/` directory using `working-directory: ./glasp`
- ✅ **Local development**: Run from root using `npm run <script>`

### Glasp Scripts (`glasp/package.json`)

Build tools and validation:

```json
{
  "scripts": {
    "build:server": "node deploy-server.js",
    "build:client": "node deploy-client.js",
    "build": "npm run build:server && npm run build:client",
    "lint": "eslint ../server/*.gs ../client/*.gs --quiet",
    "lint:fix": "eslint ../server/*.gs ../client/*.gs --fix",
    "test": "npm run lint && npm run module-check",
    "module-check": "node -e \"...(inline module check)...\""
  }
}
```

### Script-to-Workflow Mapping

| NPM Script | Used in Workflows | Purpose | Duration |
|------------|-------------------|---------|----------|
| `lint` | ci.yml, quick-check.yml, ci-validation.yml | ESLint code quality check | 30-60s |
| `lint:fix` | _(Manual only)_ | Auto-fix ESLint issues | 30-60s |
| `module-check` | ci.yml, quick-check.yml, ci-validation.yml | Phase 1 module validation | 15-30s |
| `build:server` | ci.yml, glasp-deploy.yml, deploy.yml | Build server bundle | 30-60s |
| `build:client` | ci.yml, glasp-deploy.yml, deploy.yml | Build client bundle | 30-60s |
| `build` | quick-check.yml, maintenance.yml | Build both bundles | 60-90s |
| `test` | ci.yml | Run Jest tests | 30-60s |
| `test:coverage` | _(Manual only)_ | Generate coverage report | 60-90s |
| `ci` | _(Manual only)_ | Full CI locally | 3-4 min |

---

## 💾 Caching Strategy

All workflows use **Node.js dependency caching** for faster builds.

### Cache Configuration

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'
    cache-dependency-path: glasp/package.json
```

### How It Works

1. **Cache Key:** Generated from `glasp/package-lock.json` hash
2. **Cache Location:** `~/.npm` directory on GitHub runners
3. **Cache Hit:** Dependencies restored in ~5-10 seconds
4. **Cache Miss:** Full `npm ci` takes ~30-60 seconds

### Cache Invalidation

Cache is automatically invalidated when:
- `glasp/package.json` changes
- `glasp/package-lock.json` changes
- Dependencies are added/removed/updated

### Benefits

- ⚡ **50-80% faster** dependency installation on cache hit
- 💰 **Reduced network usage** and GitHub Actions minutes
- 🔄 **Consistent environments** (cache is per branch)

---

## 🔒 Quality Gates & Enforcement

### Module Integrity Check (Phase 1 Enforcement)

**Enforced by:** `tools/module-check.js`

**Validates:**

1. **VK Module Split:** Ensures Phase 1 refactoring is intact
   - `vk-api.gs` - VK API calls and screen name resolution
   - `vk-posts.gs` - Post formatting and deduplication  
   - `vk-media.gs` - Media extraction and processing

2. **Required Exports:** Each module must expose specific functions
   ```javascript
   // vk-api.gs required exports
   ['handleGetVkPosts', 'handlePublishLastPost', 'resolveVkScreenName']
   
   // vk-posts.gs required exports
   ['formatVkPostForTelegram', 'checkPostAlreadySent', 'createMediaSummary']
   
   // vk-media.gs required exports
   ['getVkMediaUrls', 'getBestPhotoUrl', 'getVkVideoDirectUrl']
   ```

3. **File Size Limit:** Each module must be ≤ 500 lines (maintainability)

4. **Server Integrity:** At least 8 server modules must exist

**Failure Impact:**
- ❌ **Blocks PR merge** if module check fails
- 🚫 **Prevents deployment** to production
- 📋 **Detailed error report** shows missing functions/modules

**Run Locally:**
```bash
npm run module-check
```

### ESLint Configuration (Code Quality)

**Configuration:** `.eslintrc.js` (root level)

**Key Rules:**

```javascript
{
  env: { es2021: true, node: true },
  extends: ['eslint:recommended'],
  
  // Google Apps Script globals
  globals: {
    SpreadsheetApp: 'readonly',
    UrlFetchApp: 'readonly',
    Logger: 'readonly',
    // ... all GAS globals
  },
  
  rules: {
    'no-unused-vars': 'warn',       // Warn on unused variables
    'no-console': 'off',            // Allow console.log
    'semi': 'warn',                 // Warn on missing semicolons
    'quotes': ['warn', 'single'],   // Prefer single quotes
    'no-var': 'warn',               // Prefer const/let
    'prefer-const': 'warn',         // Prefer const when possible
  },
  
  // Special rules for .gs files (GAS compatibility)
  overrides: [{
    files: ['**/*.gs'],
    rules: {
      'no-var': 'off'  // Allow var in .gs for compatibility
    }
  }]
}
```

**Workflow Enforcement:**
- ✅ **Runs on every PR** (ci.yml Phase 2.1)
- ⚡ **Quick feedback** on feature branches (quick-check.yml)
- 🔧 **Auto-fix available** locally via `npm run lint:fix`

**Run Locally:**
```bash
# Check linting
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Jest Test Coverage

**Configuration:** `jest.config.js`

**Current Thresholds:**
```javascript
coverageThreshold: {
  global: {
    branches: 0,    // 0% minimum (Phase 2 baseline)
    functions: 0,   // 0% minimum
    lines: 0,       // 0% minimum
    statements: 0   // 0% minimum
  }
}
```

**⚠️ Note:** Thresholds set to 0% in Phase 2 for baseline establishment.

**Adjusting Thresholds for Phase 3+:**

Edit `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 50,   // Require 50% branch coverage
    functions: 60,  // Require 60% function coverage
    lines: 70,      // Require 70% line coverage
    statements: 70  // Require 70% statement coverage
  }
}
```

**Coverage Collection:**
```javascript
collectCoverageFrom: [
  'server/**/*.gs',
  'client/**/*.gs',
  '!**/node_modules/**',
  '!**/dist/**'
]
```

**Run Locally:**
```bash
# Run tests with coverage
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

---

## 🌍 Extending for New Environments

### Adding Staging Environment

**1. Create new workflow:** `.github/workflows/deploy-staging.yml`

```yaml
name: Deploy to Staging

on:
  push:
    branches: [staging]
  workflow_dispatch:

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging  # GitHub environment protection
    
    steps:
    - name: Checkout
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: glasp/package.json
        
    - name: Install dependencies
      working-directory: ./glasp
      run: npm ci
      
    - name: Build bundles
      run: npm run build
      
    - name: Deploy to staging
      env:
        CLASPRC_JSON: ${{ secrets.STAGING_CLASPRC_JSON }}
      run: |
        echo "$CLASPRC_JSON" > ~/.clasprc.json
        cd dist
        echo '{"scriptId": "${{ vars.STAGING_SERVER_SCRIPT_ID }}"}' > .clasp.json
        clasp push --force
```

**2. Add GitHub secrets:**
- `STAGING_CLASPRC_JSON` - Staging Google account credentials
- `STAGING_SERVER_SCRIPT_ID` - Staging server script ID
- `STAGING_CLIENT_SCRIPT_ID` - Staging client script ID

**3. Configure GitHub environment:**
- Settings → Environments → New environment "staging"
- Add protection rules (e.g., required reviewers)
- Add environment-specific secrets

### Adding Development Environment

**1. Update `quick-check.yml`** to include deployment:

```yaml
- name: Deploy to dev (optional)
  if: github.event_name == 'push' && contains(github.event.head_commit.message, '[dev-deploy]')
  env:
    CLASPRC_JSON: ${{ secrets.DEV_CLASPRC_JSON }}
  run: |
    npm install -g @google/clasp
    echo "$CLASPRC_JSON" > ~/.clasprc.json
    cd dist
    echo '{"scriptId": "${{ vars.DEV_SCRIPT_ID }}"}' > .clasp.json
    clasp push --force
```

**2. Use commit message trigger:**
```bash
git commit -m "[dev-deploy] Test new feature"
git push origin feature-branch
```

### Adding Integration Tests

**1. Create test workflow:** `.github/workflows/integration-tests.yml`

```yaml
name: Integration Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  integration-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: glasp/package.json
        
    - name: Install dependencies
      working-directory: ./glasp
      run: npm ci
      
    - name: Run integration tests
      env:
        VK_API_TOKEN: ${{ secrets.VK_API_TOKEN }}
        TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
      run: npm run test:integration
```

**2. Add `test:integration` script to `package.json`:
```json
{
  "scripts": {
    "test:integration": "jest --testMatch='**/*.integration.test.js' --runInBand"
  }
}
```

---

## 🐛 Troubleshooting Guide

### Common CI Failures

#### 1. Lint Rule Violations

**Symptom:**
```
Error: ESLint found 15 problems (3 errors, 12 warnings)
```

**Cause:** Code doesn't conform to `.eslintrc.js` rules

**Solution:**
```bash
# View issues
npm run lint

# Auto-fix most issues
npm run lint:fix

# Review remaining issues manually
```

**Common Issues:**
- Missing semicolons: Add `;` at end of statements
- Unused variables: Remove or prefix with `_` (e.g., `_unused`)
- `no-undef`: Add to `.eslintrc.js` globals section
- Quote style: Use single quotes `'` instead of double `"`

**CI-Specific Note:**
- Lint runs with `--quiet` flag in workflows (suppresses warnings)
- Only **errors** will fail the build
- **Warnings** are shown but don't block PR

#### 2. Module Integrity Check Failures

**Symptom:**
```
❌ FAIL: vk-api.gs not found in server/
❌ FAIL: Missing required exports: handleGetVkPosts
⚠️  WARN: 612 lines exceeds recommended 500 lines
```

**Cause:** Phase 1 VK module refactoring was modified incorrectly

**Solutions:**

**Missing Module File:**
```bash
# Verify module exists
ls -la server/vk-api.gs

# Check if accidentally moved/renamed
git status

# Restore from git if needed
git checkout main -- server/vk-api.gs
```

**Missing Required Exports:**
```bash
# Search for function in codebase
grep -r "function handleGetVkPosts" server/

# If function exists but not detected, check naming:
# - Must be: function handleGetVkPosts() { }
# - Not: const handleGetVkPosts = () => { }  (use 'const' pattern)
```

**File Too Large:**
```bash
# Check line count
wc -l server/vk-api.gs

# If over 500 lines, refactor:
# 1. Identify sub-modules (e.g., parsing, validation)
# 2. Extract to new file (e.g., vk-api-utils.gs)
# 3. Import/reference in original file
```

**Run Check Locally:**
```bash
npm run module-check
```

#### 3. Build Script Errors

**Symptom:**
```
Error: ENOENT: no such file or directory, open 'server/vk-service.gs'
```

**Cause:** Build script references outdated file paths

**Solutions:**

**Check Module List:**
```bash
# Edit glasp/deploy-server.js
# Verify MODULE_ORDER array matches actual files

const MODULE_ORDER = [
  '../server/server.gs',
  '../server/vk-api.gs',      // Not vk-service.gs
  '../server/vk-posts.gs',
  '../server/vk-media.gs',
  // ... rest
];
```

**Verify Files Exist:**
```bash
ls -la server/*.gs
ls -la client/*.gs
```

**Test Build Locally:**
```bash
# Test server build
npm run build:server

# Test client build  
npm run build:client

# Check output
ls -la dist/
cat dist/server-bundle.gs | head -20
```

**Common Build Issues:**
- Module not found: Update `MODULE_ORDER` in deploy script
- Syntax error: Run `npm run lint` first
- Memory error: Reduce bundle size (split modules)

#### 4. Jest Environment Issues

**Symptom:**
```
ReferenceError: SpreadsheetApp is not defined
```

**Cause:** Google Apps Script globals not mocked in Jest

**Solutions:**

**Check `jest.setup.js`:**
```javascript
// Should contain global mocks
global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
  // ... other methods
};

global.UrlFetchApp = {
  fetch: jest.fn()
};
```

**Add Missing Globals:**
```javascript
// In jest.setup.js
global.Logger = {
  log: jest.fn()
};

global.Utilities = {
  formatDate: jest.fn(),
  sleep: jest.fn()
};
```

**Test-Specific Mocks:**
```javascript
// In your test file
describe('VK API', () => {
  beforeEach(() => {
    global.UrlFetchApp.fetch.mockReturnValue({
      getContentText: () => '{"response": []}'
    });
  });
  
  it('should fetch posts', () => {
    // ... test
  });
});
```

**Babel Transform Issues:**
```bash
# Check babel.config.js exists
cat babel.config.js

# Should contain:
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }]
  ]
};
```

#### 5. Deployment Failures

**Symptom:**
```
Error: User has not enabled the Google Apps Script API
Error: Invalid credentials
```

**Cause:** Missing or invalid `CLASPRC_JSON` secret

**Solutions:**

**Generate `.clasprc.json`:**
```bash
# On your local machine
clasp login

# Copy credentials
cat ~/.clasprc.json

# Should look like:
{
  "token": {
    "access_token": "...",
    "refresh_token": "...",
    "scope": "...",
    "token_type": "Bearer",
    "expiry_date": ...
  },
  "oauth2ClientSettings": {
    "clientId": "...",
    "clientSecret": "...",
    "redirectUri": "..."
  },
  "isLocalCreds": false
}
```

**Add to GitHub Secrets:**
1. GitHub Repository → Settings → Secrets and variables → Actions
2. New repository secret: `CLASPRC_JSON`
3. Paste entire `.clasprc.json` content
4. Save

**Enable Apps Script API:**
1. Go to https://script.google.com/home/usersettings
2. Enable "Google Apps Script API"
3. Retry workflow

**Script ID Issues:**
```bash
# Verify Script IDs in glasp-deploy.yml
# Server: 1swkg5t74hsAma2H6KevvHNATgYVQ0L1WZx6jZH-FUC45EXxhXXXsjvC9
# Client: 1QkeuN2Fa47W06HGJRPUVzHmWJV_vZ2xk3lwJKetDnH049YFxV9aGrO9h

# Get Script ID from URL:
# https://script.google.com/home/projects/YOUR_SCRIPT_ID/edit
```

#### 6. Cache Issues

**Symptom:**
```
Warning: dependencies were updated but cache wasn't invalidated
Error: Module not found after npm ci
```

**Cause:** Stale npm cache

**Solutions:**

**Clear Cache Manually:**
```yaml
# Add to workflow (temporary)
- name: Clear npm cache
  run: npm cache clean --force
  
- name: Install dependencies
  run: npm ci
```

**Disable Cache Temporarily:**
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    # cache: 'npm'  # Commented out
```

**Force Cache Invalidation:**
```bash
# Update package-lock.json
npm install --package-lock-only

# Commit change
git add package-lock.json
git commit -m "chore: force cache invalidation"
```

---

## 🏠 Local Reproduction

All CI checks can be reproduced locally for faster debugging.

### Full CI Suite (Local)

```bash
# Run complete CI pipeline locally
npm run ci

# Equivalent to:
npm run lint && \
npm run test && \
npm run module-check && \
npm run build
```

**Duration:** ~3-4 minutes (matches CI time)

### Individual Checks

```bash
# 1. Lint check
npm run lint
# Auto-fix: npm run lint:fix

# 2. Module integrity
npm run module-check

# 3. Build verification
npm run build:server
npm run build:client
# Or both: npm run build

# 4. Test suite
npm run test

# 5. Coverage report
npm run test:coverage
open coverage/lcov-report/index.html
```

### Quick Pre-Commit Check

```bash
# Minimal checks before committing (~1 min)
npm run lint && npm run module-check
```

### Pre-Push Check

```bash
# Comprehensive checks before pushing (~3 min)
npm run ci
```

### Testing Deployment Locally

```bash
# Build bundles
npm run build

# Manual clasp push (requires authentication)
cd dist

# Server deployment
echo '{"scriptId": "YOUR_SERVER_SCRIPT_ID"}' > .clasp.json
clasp push --force

# Client deployment  
echo '{"scriptId": "YOUR_CLIENT_SCRIPT_ID"}' > .clasp.json
clasp push --force
```

### Docker-Based CI Simulation

For **exact** CI environment matching:

```bash
# Create Dockerfile
cat > Dockerfile <<EOF
FROM ubuntu-latest
RUN apt-get update && apt-get install -y nodejs npm
WORKDIR /workspace
COPY . .
RUN cd glasp && npm ci
CMD ["npm", "run", "ci"]
EOF

# Build and run
docker build -t vk-telegram-ci .
docker run --rm vk-telegram-ci
```

---

## ⚙️ Configuration Reference

### Required Secrets

| Secret | Purpose | How to Get | Used In |
|--------|---------|------------|---------|
| `CLASPRC_JSON` | Google Apps Script authentication | `clasp login` → copy `~/.clasprc.json` | glasp-deploy.yml |

### Environment Variables

| Variable | Default | Override | Description |
|----------|---------|----------|-------------|
| `NODE_VERSION` | `18` | Edit workflow `node-version` | Node.js version for builds |
| `CACHE_DEPENDENCY_PATH` | `glasp/package.json` | Edit workflow `cache-dependency-path` | NPM cache key path |

### Workflow Paths Filters

**glasp-deploy.yml** triggers on changes to:
```yaml
paths:
  - 'server/**'
  - 'client/**'
  - 'glasp/**'
```

**ci-validation.yml** triggers on changes to:
```yaml
paths:
  - '.github/workflows/**'
  - 'glasp/package.json'
```

### Artifact Retention

| Artifact | Retention | Workflow | Size |
|----------|-----------|----------|------|
| `server-bundle` | 30 days | ci.yml | ~50-100 KB |
| `client-bundle` | 30 days | ci.yml | ~30-50 KB |
| `coverage-summary` | 30 days | ci.yml | ~5 KB |
| `lint-results` | 7 days | ci.yml (on failure) | ~1-5 KB |
| `ci-validation-report` | 30 days | ci-validation.yml | ~2 KB |
| `dist-apps-script` | 30 days | deploy.yml | ~100-150 KB |

### Permissions Matrix

| Workflow | contents | checks | actions | Reason |
|----------|----------|--------|---------|--------|
| ci.yml | read | write | read | Write check results |
| quick-check.yml | read | - | - | Minimal read-only |
| ci-validation.yml | read | - | read | Read workflow metadata |
| glasp-deploy.yml | read | - | - | Deploy only |
| deploy.yml | read | - | - | Build artifacts |
| maintenance.yml | read | - | read | Health monitoring |

---

## 📚 Related Documentation

- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
- **[GAS_COMPATIBILITY.md](GAS_COMPATIBILITY.md)** - Google Apps Script compatibility rules
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture overview
- **[README.md](README.md)** - Main project documentation
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes

---

## 🎯 Quick Reference

### Common Commands

```bash
# Development
npm run lint              # Check code quality
npm run lint:fix          # Auto-fix issues
npm run test              # Run tests
npm run module-check      # Verify modules
npm run build             # Build bundles

# CI Simulation
npm run ci                # Full CI locally

# Deployment
npm run build:server      # Build server
npm run build:client      # Build client
clasp push --force        # Deploy to GAS
```

### Commit Message Triggers

```bash
# Trigger server deployment
git commit -m "[server] Update VK API"

# Trigger client deployment
git commit -m "[client] Fix UI bug"

# Trigger both
git commit -m "[server][client] Sync changes"

# Trigger dev deployment (if configured)
git commit -m "[dev-deploy] Test feature"
```

### Workflow Status Badges

Add to README.md:

```markdown
![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)
![Quick Check](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/quick-check.yml/badge.svg)
![Deploy](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/glasp-deploy.yml/badge.svg)
```

---

## ✅ Phase 2 Complete Checklist

- ✅ **6 workflows implemented** (ci, quick-check, ci-validation, glasp-deploy, deploy, maintenance)
- ✅ **Module integrity enforcement** (vk-api, vk-posts, vk-media validation)
- ✅ **ESLint integration** (code quality gates)
- ✅ **Jest test suite** (with coverage reporting)
- ✅ **Automated deployment** (clasp integration)
- ✅ **Caching strategy** (npm dependencies)
- ✅ **Matrix builds** (parallel server/client builds)
- ✅ **Artifact management** (30-day retention)
- ✅ **Documentation complete** (this guide)

---

**Last Updated:** 2025-11-07  
**Maintained By:** VK→Telegram Crossposter Team  
**Questions?** See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or open an issue.
