// ESLint flat configuration
// ES module format
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import securityPlugin from 'eslint-plugin-security';
import unicornPlugin from 'eslint-plugin-unicorn';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd(),
      },
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
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      security: securityPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      // TypeScript specific rules
       '@typescript-eslint/no-unused-vars': [
         'error',
         { argsIgnorePattern: '^_' },
       ],
       '@typescript-eslint/explicit-function-return-type': 'off',
       '@typescript-eslint/explicit-module-boundary-types': 'off',
       '@typescript-eslint/no-explicit-any': 'off', // Relaxed: allow any type for flexibility
       '@typescript-eslint/no-non-null-assertion': 'off', // Relaxed: allow non-null assertions
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Import/Export rules
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',

      // Code quality rules
      'no-console': 'error',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Security rules
      'security/detect-object-injection': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-unsafe-regex': 'error',

      // Unicorn rules for code quality
      'unicorn/better-regex': 'error',
      'unicorn/catch-error-name': 'error',
      'unicorn/error-message': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/no-empty-file': 'error',

      // Code style rules (complementary to Prettier)
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'comma-dangle': 'off', // Let Prettier handle trailing commas
      'object-curly-spacing': 'off', // Let Prettier handle spacing
      'array-bracket-spacing': 'off', // Let Prettier handle spacing

       // Error prevention
       'no-undef': 'error',
       'no-unused-vars': 'off', // Handled by TypeScript
       'no-unreachable': 'error',
       'no-constant-condition': 'warn',
       'no-empty': 'warn',
       'no-extra-semi': 'error',

       // Import/Export rules
       'import/order': [
         'error',
         {
           groups: [
             'builtin',
             'external',
             'internal',
             'parent',
             'sibling',
             'index',
           ],
           'newlines-between': 'always',
         },
       ],
       'import/no-unused-modules': 'error',
       'import/no-deprecated': 'warn',

       // Best practices
       'consistent-return': 'error',
       'default-case': 'error',
       'dot-notation': 'error',
       'no-else-return': 'error',
       'no-empty-function': 'warn',
       'no-magic-numbers': ['off', { ignore: [-1, 0, 1, 2] }], // Relaxed: allow magic numbers
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

       // Complexity monitoring - relaxed for development flexibility
       complexity: ['off', 7], // Disabled: allow complex functions
       'max-lines-per-function': ['off', 50], // Disabled: allow long functions
       'max-params': ['off', 4], // Disabled: allow more parameters
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
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
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      // JavaScript specific rules
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off', // Configuration system uses controlled property access
    },
  },
  {
    files: ['src/config/manual-test.ts', 'src/cli.ts'],
    rules: {
      'no-console': 'off',
      'no-magic-numbers': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd(),
      },
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
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        NodeJS: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      security: securityPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      // Allow console statements in tests
      'no-console': 'off',
      // Allow magic numbers in tests
      'no-magic-numbers': 'off',
      // Relax some rules for tests
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
      complexity: 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: process.cwd(),
      },
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...Object.fromEntries(
          Object.entries({
            console: 'readonly',
            process: 'readonly',
            Buffer: 'readonly',
            __dirname: 'readonly',
            __filename: 'readonly',
            global: 'readonly',
            module: 'readonly',
            require: 'readonly',
            exports: 'readonly',
            setTimeout: 'readonly',
            clearTimeout: 'readonly',
            setInterval: 'readonly',
            clearInterval: 'readonly',
            NodeJS: 'readonly',
            describe: 'readonly',
            it: 'readonly',
            test: 'readonly',
            expect: 'readonly',
            beforeEach: 'readonly',
            afterEach: 'readonly',
            beforeAll: 'readonly',
            afterAll: 'readonly',
            jest: 'readonly',
          }).map(([key, value]) => [key, value]),
        ),
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
      security: securityPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      // Allow console statements in tests
      'no-console': 'off',
      // Allow magic numbers in tests
      'no-magic-numbers': 'off',
      // Relax some rules for tests
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
      complexity: 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.mjs', // Be specific about our config file
    ],
  },
];
