# Task 1.2: Configure TypeScript and Build System with esbuild

## Overview
Configure TypeScript compiler settings and esbuild build system to enable fast, efficient compilation and bundling of the Code-Scout MCP server with proper type checking, source maps, and development workflow optimization.

## Requirements from Documentation

### TypeScript Configuration Requirements (from CORE - technology_stack.md)
- **Target**: ES2022 for modern JavaScript features
- **Module System**: ESNext for modern module handling
- **Module Resolution**: Node.js compatible resolution
- **Strict Mode**: Enabled for maximum type safety
- **Declaration Files**: Generated for library usage
- **Output Directory**: `dist/` for compiled output
- **Root Directory**: `src/` for source files
- **JSON Module Support**: Enabled for configuration files

### Build System Requirements (from CORE - technology_stack.md)
- **esbuild ^0.19.0**: Fast compilation and bundling
- **Performance**: 10-100x faster than webpack/tsc
- **Native TypeScript Support**: Direct TypeScript compilation
- **Simple Configuration**: Minimal setup required
- **Node.js Platform**: Target server environment
- **Node.js 18+ Target**: Compatibility requirement

### Build Script Requirements (from package.json)
```json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js --minify",
    "dev": "nodemon --exec tsx src/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

### Development Workflow Requirements
- **Fast Development**: Hot reloading with tsx
- **Type Checking**: Separate TypeScript compilation for validation
- **Production Build**: Minified, bundled output for distribution
- **CLI Support**: Separate build for CLI entry point
- **Source Maps**: Development debugging support

## Implementation Checklist

### 1.2.1 Configure TypeScript Compiler
- [ ] Create comprehensive `tsconfig.json` with all required options
- [ ] Set target to ES2022 for modern JavaScript features
- [ ] Configure module system as ESNext with Node.js resolution
- [ ] Enable strict mode and all type checking options
- [ ] Set up proper source and output directories
- [ ] Configure include/exclude patterns for optimal compilation
- [ ] Enable declaration file generation for library usage
- [ ] Add JSON module support for configuration files

### 1.2.2 Setup esbuild Configuration
- [ ] Create `esbuild.config.js` with build configuration
- [ ] Configure main entry point build (index.ts)
- [ ] Configure CLI entry point build (cli.ts)
- [ ] Set up development build with source maps
- [ ] Configure production build with minification
- [ ] Add external dependencies handling for Node.js modules
- [ ] Configure platform and target settings
- [ ] Set up proper output directory structure

### 1.2.3 Optimize Build Performance
- [ ] Configure esbuild for maximum compilation speed
- [ ] Set up incremental builds for development
- [ ] Add proper external package handling
- [ ] Configure tree-shaking for optimal bundle size
- [ ] Set up code splitting if needed
- [ ] Add build caching mechanisms
- [ ] Optimize for Node.js runtime environment

### 1.2.4 Update Package Scripts
- [ ] Update build script to use esbuild configuration
- [ ] Ensure development script uses tsx for hot reloading
- [ ] Add type checking script with TypeScript compiler
- [ ] Add clean script to remove build artifacts
- [ ] Configure pre/post build hooks
- [ ] Add watch mode for development
- [ ] Set up production build optimization

### 1.2.5 Validate Build System
- [ ] Test TypeScript compilation with `npm run typecheck`
- [ ] Test development build with `npm run dev`
- [ ] Test production build with `npm run build`
- [ ] Verify CLI binary is properly built
- [ ] Test source map generation
- [ ] Validate bundle size and performance
- [ ] Test error handling in build process

## Code Templates

### tsconfig.json Template
```json
{
  "compilerOptions": {
    // Target and Module Configuration
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    
    // Module Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    
    // Type Checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    
    // Emit Configuration
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "removeComments": false,
    "importHelpers": false,
    
    // Module Resolution
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/features/*": ["src/features/*"],
      "@/shared/*": ["src/shared/*"],
      "@/config/*": ["src/config/*"],
      "@/api/*": ["src/api/*"]
    },
    
    // Additional Options
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": false,
    "checkJs": false,
    
    // Experimental
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  
  "include": [
    "src/**/*"
  ],
  
  "exclude": [
    "node_modules",
    "dist",
    "tests",
    "**/*.test.ts",
    "**/*.spec.ts"
  ],
  
  "ts-node": {
    "esm": true
  }
}
```

### esbuild.config.js Template
```javascript
/**
 * esbuild Configuration
 * Fast TypeScript compilation and bundling for Code-Scout MCP Server
 */

import esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isWatchMode = process.argv.includes('--watch');

// Base configuration
const baseConfig = {
  entryPoints: {
    index: 'src/index.ts',
    cli: 'src/cli.ts'
  },
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
  external: [
    // Node.js built-in modules
    'fs',
    'path',
    'os',
    'crypto',
    'events',
    'stream',
    'util',
    'worker_threads',
    // Native addons
    'better-sqlite3',
    // Tree-sitter modules
    'tree-sitter',
    'tree-sitter-typescript',
    'tree-sitter-python'
  ],
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
    'global': 'globalThis'
  },
  logLevel: isProduction ? 'error' : 'info'
};

// Development configuration
const devConfig = {
  ...baseConfig,
  sourcemap: true,
  minify: false,
  define: {
    ...baseConfig.define,
    'process.env.NODE_ENV': '"development"'
  }
};

// Production configuration
const prodConfig = {
  ...baseConfig,
  sourcemap: false,
  minify: true,
  define: {
    ...baseConfig.define,
    'process.env.NODE_ENV': '"production"'
  }
};

// Choose configuration based on environment
const config = isProduction ? prodConfig : devConfig;

// Build function
async function build() {
  try {
    console.log(`Building in ${isProduction ? 'production' : 'development'} mode...`);
    
    // Ensure dist directory exists
    const distDir = join(process.cwd(), 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    
    // Build with esbuild
    const result = await esbuild.build(config);
    
    if (result.errors.length > 0) {
      console.error('Build errors:', result.errors);
      process.exit(1);
    }
    
    if (result.warnings.length > 0) {
      console.warn('Build warnings:', result.warnings);
    }
    
    // Copy package.json to dist for distribution
    copyFileSync(
      join(process.cwd(), 'package.json'),
      join(process.cwd(), 'dist', 'package.json')
    );
    
    // Copy .gitignore to dist for npm packaging
    if (existsSync(join(process.cwd(), '.gitignore'))) {
      copyFileSync(
        join(process.cwd(), '.gitignore'),
        join(process.cwd(), 'dist', '.gitignore')
      );
    }
    
    console.log('✅ Build completed successfully!');
    
    // Print build stats
    if (!isProduction) {
      console.log('📊 Build Statistics:');
      console.log(`   - Mode: ${isProduction ? 'Production' : 'Development'}`);
      console.log(`   - Source Maps: ${config.sourcemap ? 'Enabled' : 'Disabled'}`);
      console.log(`   - Minification: ${config.minify ? 'Enabled' : 'Disabled'}`);
      console.log(`   - Bundle: ${config.bundle ? 'Enabled' : 'Disabled'}`);
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Watch mode function
async function watch() {
  console.log('👀 Starting watch mode...');
  
  const context = await esbuild.context({
    ...config,
    plugins: [
      {
        name: 'on-rebuild',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length === 0) {
              console.log('🔄 Rebuild completed successfully!');
            } else {
              console.error('❌ Rebuild failed:', result.errors);
            }
          });
        }
      }
    ]
  });
  
  await context.watch();
  console.log('📺 Watching for changes...');
}

// CLI interface
if (require.main === module) {
  if (isWatchMode) {
    watch();
  } else {
    build();
  }
}

export { build, watch, config };
```

### Updated package.json Scripts
```json
{
  "scripts": {
    "build": "node esbuild.config.js",
    "build:prod": "NODE_ENV=production node esbuild.config.js",
    "build:dev": "NODE_ENV=development node esbuild.config.js",
    "dev": "nodemon --exec tsx src/index.ts",
    "dev:watch": "node esbuild.config.js --watch",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "clean": "rimraf dist",
    "prebuild": "npm run typecheck",
    "postbuild": "node -e \"console.log('✅ Build process completed')\"",
    "size": "npm run build && du -sh dist/*"
  }
}
```

### Development Configuration (.env.development)
```env
# Development environment variables
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_SOURCE_MAPS=true
DISABLE_MINIFICATION=true
```

### Production Configuration (.env.production)
```env
# Production environment variables
NODE_ENV=production
LOG_LEVEL=error
ENABLE_SOURCE_MAPS=false
ENABLE_MINIFICATION=true
```

## File Structure After Implementation
```
code-scout-mcp/
├── src/                        # Source files (from task 1.1)
├── dist/                       # Build output
│   ├── index.js               # Main application bundle
│   ├── index.js.map           # Source map (development only)
│   ├── cli.js                 # CLI bundle
│   ├── cli.js.map             # CLI source map (development only)
│   ├── package.json           # Copied for distribution
│   └── .gitignore             # Copied for npm packaging
├── tsconfig.json              # New file
├── esbuild.config.js          # New file
├── .env.development           # New file
├── .env.production            # New file
└── package.json               # Updated with new scripts
```

## Integration Points
- **Task 1.1**: Uses the project structure and package.json from previous task
- **Task 1.3**: Testing framework will use TypeScript configuration
- **Task 1.4**: Configuration management will use path aliases
- **Task 1.5**: Code quality tools will integrate with TypeScript
- **All Future Tasks**: TypeScript compilation and type checking will be available

## Validation Criteria
- [ ] `npm run typecheck` completes without TypeScript errors
- [ ] `npm run build` produces output in `dist/` directory
- [ ] `npm run build:prod` creates minified production build
- [ ] `npm run build:dev` creates development build with source maps
- [ ] `npm run dev:watch` starts watch mode successfully
- [ ] CLI binary `dist/cli.js` is executable and functional
- [ ] Source maps are generated correctly for debugging
- [ ] Bundle size is optimized for production
- [ ] Path aliases work correctly in imports
- [ ] External dependencies are properly excluded

## Acceptance Tests
- [ ] Verify TypeScript compilation with existing source files
- [ ] Test build process with both development and production modes
- [ ] Validate source map generation and functionality
- [ ] Test CLI binary execution and basic functionality
- [ ] Verify bundle contains all necessary dependencies
- [ ] Test path alias resolution in imports
- [ ] Validate external package exclusion from bundle
- [ ] Test build performance and speed
- [ ] Verify error handling in build process
- [ ] Test watch mode functionality

## Quality Gates
- [ ] TypeScript configuration follows best practices
- [ ] esbuild configuration is optimized for performance
- [ ] Build process is reliable and reproducible
- [ ] Source maps are properly generated for debugging
- [ ] Bundle size is optimized for distribution
- [ ] Development workflow is efficient and fast
- [ ] Error handling is comprehensive and user-friendly
- [ ] Configuration is maintainable and extensible

## Performance Requirements
- **Build Time**: < 2 seconds for incremental builds
- **Full Build**: < 10 seconds for complete project
- **Watch Mode**: < 500ms rebuild time for file changes
- **Bundle Size**: < 5MB for production build (excluding native addons)
- **Type Checking**: < 5 seconds for full project validation

## Troubleshooting Guide

### Common Issues and Solutions
1. **TypeScript Path Aliases Not Working**
   - Ensure baseUrl and paths are configured in tsconfig.json
   - Verify esbuild external configuration
   - Check import statements in source code

2. **Native Addon Issues**
   - Verify better-sqlite3 is in external dependencies
   - Check platform target is set to 'node'
   - Ensure Node.js version compatibility

3. **Source Map Issues**
   - Verify sourcemap is enabled in development mode
   - Check source map files are generated in dist/
   - Test debugging with source maps

4. **Bundle Size Issues**
   - Verify external dependencies are properly excluded
   - Check tree-shaking is enabled
   - Review minification settings for production

## Prerequisites for Next Tasks
This task must be completed before:
- **Task 1.3**: Testing framework setup requires TypeScript configuration
- **Task 1.4**: Configuration management benefits from path aliases
- **Task 1.5**: Code quality tools integrate with TypeScript
- **All subsequent development tasks**: Require working build system