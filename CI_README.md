# Apps Script CI Setup

This project includes automated syntax checking for Google Apps Script files to catch errors before they reach production.

## What's Included

- **GitHub Actions workflow** (`.github/workflows/syntax-check.yml`) - Runs on every push and PR
- **Syntax checker** (`scripts/syntax-check.js`) - Validates JavaScript syntax using Espree
- **ESLint configuration** - Catches common JavaScript errors and duplicate declarations
- **Pre-commit hook** (`scripts/pre-commit`) - Local development checks

## Usage

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run syntax check:
   ```bash
   npm run syntax-check
   ```

3. Run ESLint (optional):
   ```bash
   npm run lint:check
   ```

4. Install pre-commit hooks:
   ```bash
   npm run install-hooks
   ```

### CI/CD Pipeline

The GitHub Actions workflow automatically:
- Runs on pushes to `main`, `master`, and `develop` branches
- Runs on pull requests targeting these branches
- Fails the build if syntax errors are found
- Reports ESLint issues but doesn't fail the build for them

## What Gets Checked

### Syntax Check (Critical)
- JavaScript parsing errors
- Invalid syntax
- Missing brackets, parentheses, etc.
- Orphaned code blocks (like the try-catch without function)

### ESLint (Important)
- Duplicate function declarations (`no-redeclare`)
- Undefined variables (`no-undef`) 
- Invalid lexical declarations in case blocks (`no-case-declarations`)
- Unreachable code (`no-unreachable`)

## Example Errors Caught

This setup would catch errors like:
- Orphaned `try {` blocks without function declarations
- Duplicate function names
- Missing closing brackets
- Invalid variable declarations

## Configuration

- **Node.js version**: 18
- **ESLint**: Configured for Google Apps Script with all GAS globals predefined
- **Espree**: ECMAScript 2021 support for modern JavaScript features
- **Files checked**: `*.gs` files (server.gs, client.gs)

## Troubleshooting

If you get syntax errors:
1. Run `npm run syntax-check` locally to see detailed error messages
2. Check for orphaned code blocks, missing brackets, or duplicate declarations
3. Fix errors and commit again

The syntax checker provides line numbers and detailed error messages to help you locate and fix issues quickly.