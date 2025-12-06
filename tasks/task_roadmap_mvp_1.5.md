# Task 1.5: Setup Code Quality Tools (ESLint, Prettier)

## Overview

Configure comprehensive code quality tools including ESLint with TypeScript support and Prettier for consistent code formatting across the entire codebase.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, you must check it off in this markdown file by changing `- [ ]` to `- [x]`. This helps track progress and ensures you don't skip any steps.

Example:

- `- [ ] 1.1 Read file` → `- [x] 1.1 Read file` (after completing)

Update the file after completing each sub-task, not just after completing an entire parent task.

## Requirements from Documentation

### Technology Stack Requirements (from CORE - technology_stack.md)

- **ESLint**: ^9.39.1 - Code linting (latest version)
- **Prettier**: ^3.7.1 - Code formatting (latest version)
- **@typescript-eslint/eslint-plugin**: ^8.30.1 - TypeScript-specific rules
- **@typescript-eslint/parser**: ^8.30.1 - TypeScript parser for ESLint
- **@eslint/js**: ^9.39.1 - ESLint JavaScript configuration

### Package.json Scripts (from package.json)

```json
{
  "lint": "eslint src/**/*.ts",
  "format": "prettier --write src/**/*.ts",
  "pretest": "npm run lint && npm run typecheck"
}
```

### Current Configuration Status

- ESLint config exists but incomplete (`eslint.config.js`)
- Prettier config exists with basic settings (`.prettierrc`)
- Dependencies already installed in package.json
- Scripts already configured in package.json

## Implementation Checklist

### 1.5.1 Configure ESLint Rules and Settings

- [x] Review current ESLint configuration in `eslint.config.js`
- [x] Add comprehensive TypeScript-specific rules
- [x] Configure import/export rules for ES modules
- [x] Add code quality and consistency rules
- [x] Setup error prevention rules
- [x] Configure formatting-related rules (to work with Prettier)

### 1.5.2 Optimize Prettier Configuration

- [x] Review current `.prettierrc` settings
- [x] Ensure Prettier settings align with project conventions
- [x] Add `.prettierignore` file for exclusion patterns
- [x] Test Prettier formatting on sample TypeScript files

### 1.5.3 Create Editor Integration Files

- [x] Create `.vscode/settings.json` for VSCode integration
- [x] Add recommended extensions for VSCode
- [x] Configure format-on-save settings
- [x] Setup linting integration in editor

### 1.5.4 Add Pre-commit Hooks (Optional Enhancement)

- [ ] Consider adding husky for git hooks
- [ ] Setup lint-staged for pre-commit linting
- [ ] Configure automatic formatting on commit

### 1.5.5 Validate and Test Configuration

- [x] Run ESLint on existing source files
- [x] Run Prettier formatting on existing source files
- [x] Test lint script from package.json
- [x] Test format script from package.json
- [x] Verify no conflicts between ESLint and Prettier

## Code Templates

### Enhanced ESLint Configuration Template

```javascript
// eslint.config.js
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-const': 'error',
      '@typescript-eslint/no-var-requires': 'error',

      // Import/Export rules
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',

      // Code quality rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Code style rules (complementary to Prettier)
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],

      // Error prevention
      'no-undef': 'error',
      'no-unused-vars': 'off', // Handled by TypeScript
      'no-unreachable': 'error',
      'no-constant-condition': 'warn',
      'no-empty': 'warn',
      'no-extra-semi': 'error',

      // Best practices
      'consistent-return': 'error',
      'default-case': 'error',
      'dot-notation': 'error',
      'no-else-return': 'error',
      'no-empty-function': 'warn',
      'no-magic-numbers': ['warn', { ignore: [-1, 0, 1, 2] }],
      'no-multi-spaces': 'error',
      'no-return-assign': 'error',
      'no-return-await': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unused-expressions': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'prefer-promise-reject-errors': 'error',
      radix: 'error',
      'require-await': 'error',
      yoda: 'error',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // JavaScript specific rules
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
];
```

### VSCode Settings Template

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "eslint.validate": ["typescript", "javascript"],
  "eslint.workingDirectories": ["."],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  }
}
```

### VSCode Extensions Template

```json
// .vscode/extensions.json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json"
  ]
}
```

### Prettier Ignore Template

```
# .prettierignore
dist/
node_modules/
coverage/
*.log
*.lock
package-lock.json
yarn.lock
pnpm-lock.yaml
```

## File Structure

```
project-root/
├── eslint.config.js          # Enhanced ESLint configuration
├── .prettierrc               # Prettier configuration (existing)
├── .prettierignore           # Prettier ignore patterns
├── .vscode/
│   ├── settings.json         # VSCode workspace settings
│   └── extensions.json       # Recommended extensions
└── package.json              # Scripts already configured
```

## Integration Points

### Build Process Integration

- **Pre-build Hook**: ESLint runs automatically before build (`prebuild` script)
- **Pre-test Hook**: ESLint runs automatically before tests (`pretest` script)
- **Development**: Format-on-save in editor maintains consistency

### CI/CD Pipeline Integration

- **GitHub Actions**: ESLint and Prettier checks in CI pipeline
- **Pre-commit Hooks**: Optional local validation before commits
- **Quality Gates**: Fail build if linting errors exist

## Validation Criteria

### ESLint Validation

- [x] All TypeScript files in `src/` pass linting without errors
- [x] No conflicts with Prettier formatting rules
- [x] Import/export rules work with ES modules
- [x] TypeScript-specific rules catch potential issues
- [x] Configuration works with existing codebase

### Prettier Validation

- [x] Formatting is consistent across all files
- [x] Integration with VSCode format-on-save works
- [x] Ignore patterns exclude build artifacts correctly
- [x] Settings align with project conventions

### Editor Integration Validation

- [x] VSCode settings load correctly
- [x] Format-on-save works without conflicts
- [x] ESLint errors show in editor
- [x] Auto-fix works for applicable issues

## Acceptance Tests

### Linting Tests

- [x] Run `npm run lint` on existing source files
- [x] Verify all linting rules are enforced
- [x] Test auto-fix functionality with `eslint --fix`
- [x] Confirm no false positives for valid code patterns

### Formatting Tests

- [x] Run `npm run format` on existing source files
- [x] Verify consistent formatting across files
- [x] Test format-on-save in VSCode
- [x] Confirm no formatting conflicts with ESLint

### Integration Tests

- [x] Test pre-build linting hook
- [x] Test pre-test linting hook
- [x] Verify editor integration works
- [x] Test CI pipeline integration (if applicable)

## Quality Gates

### Code Quality Standards

- [x] Zero ESLint errors in source code
- [x] Consistent Prettier formatting across all files
- [x] All TypeScript-specific rules enabled
- [x] Import/export rules enforce module consistency

### Developer Experience

- [x] Clear error messages for linting violations
- [x] Helpful suggestions for code improvements
- [x] Fast feedback during development
- [x] Minimal false positives

### Performance Considerations

- [x] Linting completes quickly on large codebases
- [x] Prettier formatting is fast
- [x] Editor integration doesn't impact performance
- [x] CI pipeline checks complete efficiently

## Troubleshooting Guide

### Common ESLint Issues

- **Parser Errors**: Ensure TypeScript parser is correctly configured
- **Import/Export Issues**: Verify `sourceType: 'module'` setting
- **TypeScript Rules**: Check `@typescript-eslint` plugin configuration
- **Ignore Patterns**: Verify files are correctly excluded

### Common Prettier Issues

- **Conflicting Rules**: Disable ESLint rules that conflict with Prettier
- **Ignore Patterns**: Ensure `.prettierignore` covers all build artifacts
- **Editor Integration**: Verify VSCode Prettier extension is enabled

### Integration Issues

- **Pre-commit Hooks**: Ensure husky and lint-staged are properly configured
- **CI Pipeline**: Verify Node.js version and dependency installation
- **VSCode Settings**: Check workspace vs user settings conflicts

## Success Metrics

### Code Quality Metrics

- [ ] 100% of source files pass ESLint checks
- [ ] Consistent formatting across entire codebase
- [ ] Zero high-priority linting violations
- [ ] Developer adoption of formatting standards

### Developer Experience Metrics

- [ ] Fast feedback during development (<2 seconds for linting)
- [ ] Minimal configuration required for new developers
- [ ] Clear error messages and actionable suggestions
- [ ] Seamless integration with existing workflow

This task ensures the codebase maintains high quality standards and consistency across all development activities, providing a solid foundation for the entire project.
