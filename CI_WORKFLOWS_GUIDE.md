# CI/CD Workflows Guide

This document describes the GitHub Actions workflows implemented for the VK→Telegram Crossposter project as part of the "Author CI workflows" ticket.

## 🎯 Overview

The CI/CD implementation provides automated quality gates and validation for Phase 2 of the development process, with workflows designed to gatekeep Phase 3-5 tasks.

## 📁 Workflow Files

### 1. `ci.yml` - Main CI Pipeline (Phase 2 Quality Gates)

**Triggers:**
- Pull requests to `main` branch
- Pushes to `main` branch

**Jobs:**

#### 🔍 Phase 2.1: Lint Code Quality
- Runs ESLint on all `.gs` files
- Fails fast on linting errors
- Uploads lint results as artifacts on failure

#### 🧩 Phase 2.2: Module Integrity Check
- Verifies server and client modules exist
- Checks file counts and basic structure
- Ensures no missing critical files

#### 🏗️ Phase 2.3: Build Verification
- Matrix strategy for server and client builds
- Validates bundle creation
- Reports bundle sizes and statistics
- Uploads build artifacts

#### 🧪 Phase 2.4: Test Suite with Coverage
- Runs complete test suite (lint + module-check)
- Generates coverage summary with statistics
- Uploads coverage artifacts

#### 🔗 Phase 2.5: Integration Check (PR only)
- Downloads and verifies all build artifacts
- Cross-validates server and client bundles
- Ensures integration readiness

#### 📋 Phase 2 Complete Summary
- Aggregates results from all jobs
- Provides clear pass/fail status
- Generates GitHub Step Summary

### 2. `quick-check.yml` - Fast Feedback

**Triggers:**
- Pushes to any branch except `main`
- Pull requests (for early feedback)

**Jobs:**
- ⚡ Quick Lint Check
- ⚡ Quick Module Check  
- ⚡ Quick Build Check

Provides rapid feedback for development branches without the full CI overhead.

### 3. `maintenance.yml` - Health & Maintenance

**Triggers:**
- Scheduled daily at 2 AM UTC
- Manual workflow dispatch

**Jobs:**
- 🏥 Project Health Check
- 🧹 Repository Cleanup
- 📦 Dependency Security Check

Monitors project health, identifies potential issues, and performs maintenance tasks.

### 4. `ci-validation.yml` - CI Configuration Validation

**Triggers:**
- Pull requests affecting workflows or package.json
- Manual workflow dispatch

**Jobs:**
- 🔧 Validate CI Configuration

Validates workflow syntax, npm scripts, build functionality, and overall CI configuration.

### 5. Legacy Workflows (Preserved)

- `deploy.yml` - Original deployment workflow
- `glasp-deploy.yml` - Production deployment with secrets

## 🔧 NPM Scripts

The workflows rely on these npm scripts in `glasp/package.json`:

```json
{
  "scripts": {
    "build:server": "node deploy-server.js",
    "build:client": "node deploy-client.js", 
    "build": "npm run build:server && npm run build:client",
    "lint": "eslint ../server/*.gs ../client/*.gs",
    "lint:fix": "eslint ../server/*.gs ../client/*.gs --fix",
    "test": "npm run lint && npm run module-check",
    "module-check": "node -e \"...module integrity validation...\"",
    "prepare": "npm run build"
  }
}
```

## 🎛️ Permissions

All workflows use minimal permissions:

```yaml
permissions:
  contents: read
  checks: write  # Only for ci.yml to upload check results
  actions: read  # Only for maintenance workflows
```

No secrets are required for CI workflows. Only deployment workflows need `CLASPRC_JSON` secret.

## 📊 Artifacts

### Build Artifacts
- `server-bundle` - Server build output (30 days retention)
- `client-bundle` - Client build output (30 days retention)

### Coverage Artifacts
- `coverage-summary` - Test coverage and statistics (30 days retention)

### Validation Artifacts
- `ci-validation-report` - CI configuration validation (30 days retention)

## 🚀 Usage Examples

### Running CI Locally

```bash
# Navigate to glasp directory
cd glasp

# Install dependencies
npm ci

# Run individual checks
npm run lint
npm run module-check
npm run build:server
npm run build:client

# Run full test suite
npm run test
```

### Triggering Workflows

1. **Automatic Triggers:**
   - Push to any branch → Quick Check
   - PR to main → Full CI + Quick Check
   - Push to main → Full CI
   - Daily at 2 AM UTC → Maintenance

2. **Manual Triggers:**
   - Go to Actions tab in GitHub
   - Select workflow (e.g., "Maintenance & Health Checks")
   - Click "Run workflow"

## 📈 Phase 2 Quality Gates

The CI enforces these quality gates:

| Gate | Description | Failure Impact |
|------|-------------|----------------|
| 🔍 Lint | Code style and quality | Blocks PR/merge |
| 🧩 Module Check | File structure integrity | Blocks PR/merge |
| 🏗️ Build | Bundle generation | Blocks PR/merge |
| 🧪 Test | Combined validation | Blocks PR/merge |

All gates must pass for Phase 2 completion and to enable Phase 3-5 tasks.

## 🔍 Monitoring and Debugging

### Viewing Results
1. **GitHub Checks:** View in PR checks tab
2. **Artifacts:** Download from Actions runs
3. **Logs:** Available in each job step
4. **Summaries:** GitHub Step Summaries for overviews

### Common Issues

#### Build Failures
- Check server/client module existence
- Verify deploy scripts are functional
- Review bundle generation logs

#### Lint Failures
- Run `npm run lint:fix` locally
- Review ESLint configuration
- Check .gs file syntax

#### Module Check Failures
- Verify server/ and client/ directories exist
- Check for .gs files in both directories
- Ensure no missing critical files

## 🛠️ Customization

### Adding New Checks
1. Update `glasp/package.json` scripts
2. Modify relevant workflow jobs
3. Update documentation

### Adjusting Triggers
- Edit `on:` sections in workflow files
- Consider branch protection rules
- Update workflow dispatch inputs as needed

### Modifying Permissions
- Review `permissions:` sections
- Follow principle of least privilege
- Test with minimal permissions first

## 📝 Maintenance

### Regular Tasks
- Review workflow performance
- Update Node.js versions in setup-node actions
- Monitor artifact storage usage
- Update dependency versions

### Troubleshooting
- Check action versions (setup-node@v4, checkout@v4, etc.)
- Verify npm cache configuration
- Review workflow syntax with YAML linter
- Test changes with ci-validation workflow

## 🔗 Related Documentation

- [Google Apps Script Development Guide](README.md)
- [Build Tooling Documentation](glasp/README.md)
- [Module Architecture](ARCHITECTURE.md)
- [Deployment Guide](READY_FOR_DEPLOYMENT.md)

---

**Note:** This CI/CD implementation provides automated gatekeeping for Phase 2 quality requirements while maintaining minimal permissions and providing comprehensive feedback for developers.