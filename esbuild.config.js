/**
 * esbuild Configuration
 * Fast TypeScript compilation and bundling for Code-Scout MCP Server
 */

import esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const isWatchMode = process.argv.includes('--watch');

// Path aliases matching tsconfig.json
const aliases = {
  '@': resolve('./src'),
  '@/features': resolve('./src/features'),
  '@/shared': resolve('./src/shared'),
  '@/config': resolve('./src/config'),
  '@/api': resolve('./src/api'),
};

// Base configuration
const baseConfig = {
  entryPoints: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
  outdir: 'dist',
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
    'tree-sitter-python',
  ],
  define: {
    'process.env.NODE_ENV': `"${process.env.NODE_ENV || 'development'}"`,
    global: 'globalThis',
  },
  alias: aliases,
  logLevel: isProduction ? 'error' : 'info',
};

// Development configuration
const devConfig = {
  ...baseConfig,
  sourcemap: true,
  minify: false,
  define: {
    ...baseConfig.define,
    'process.env.NODE_ENV': '"development"',
  },
};

// Production configuration
const prodConfig = {
  ...baseConfig,
  sourcemap: false,
  minify: true,
  define: {
    ...baseConfig.define,
    'process.env.NODE_ENV': '"production"',
  },
};

// Choose configuration based on environment
const config = isProduction ? prodConfig : devConfig;

// Build function
async function build() {
  try {
    console.log(
      `Building in ${isProduction ? 'production' : 'development'} mode...`
    );

    // Ensure dist directory exists
    const distDir = join(process.cwd(), 'dist');
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }

    // Build with esbuild
    const result = await esbuild.build(config);

    if (result.errors.length > 0) {
      console.error('\n❌ Build failed with errors:');
      result.errors.forEach((error, index) => {
        console.error(`\n${index + 1}. ${error.text}`);
        console.error(
          `   Location: ${error.location?.file || 'unknown'}:${error.location?.line || 'unknown'}:${error.location?.column || 'unknown'}`
        );
        if (error.detail) console.error(`   Details: ${error.detail}`);
        if (error.notes && error.notes.length > 0) {
          error.notes.forEach((note) => console.error(`   Note: ${note.text}`));
        }
      });

      // Provide helpful suggestions based on common error types
      const errorTexts = result.errors.map((e) => e.text.toLowerCase());
      if (errorTexts.some((text) => text.includes('cannot find module'))) {
        console.error(
          '\n💡 Suggestion: Check if all dependencies are installed with "npm install"'
        );
      }
      if (errorTexts.some((text) => text.includes('typescript'))) {
        console.error(
          '\n💡 Suggestion: Run "npm run typecheck" to identify TypeScript issues'
        );
      }
      if (errorTexts.some((text) => text.includes('permission'))) {
        console.error('\n💡 Suggestion: Check file permissions and disk space');
      }

      process.exit(1);
    }

    if (result.warnings.length > 0) {
      console.warn('\n⚠️  Build warnings:');
      result.warnings.forEach((warning, index) => {
        console.warn(`\n${index + 1}. ${warning.text}`);
        console.warn(
          `   Location: ${warning.location?.file || 'unknown'}:${warning.location?.line || 'unknown'}:${warning.location?.column || 'unknown'}`
        );
        if (warning.detail) console.warn(`   Details: ${warning.detail}`);
      });
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

    // Print build stats for all modes
    console.log('📊 Build Statistics:');
    console.log(`   - Mode: ${isProduction ? 'Production' : 'Development'}`);
    console.log(
      `   - Source Maps: ${config.sourcemap ? 'Enabled' : 'Disabled'}`
    );
    console.log(`   - Minification: ${config.minify ? 'Enabled' : 'Disabled'}`);
    console.log(`   - Bundle: ${config.bundle ? 'Enabled' : 'Disabled'}`);
    console.log(
      `   - Tree Shaking: ${config.treeShaking ? 'Enabled' : 'Disabled'}`
    );

    if (isProduction) {
      console.log('   - Optimization: Production Ready');
    } else {
      console.log('   - Optimization: Development Mode');
    }
  } catch (error) {
    console.error('\n❌ Build failed with unexpected error:');

    // Handle different error types
    if (error.code === 'ENOENT') {
      console.error(`File not found: ${error.path}`);
      console.error(
        '💡 Suggestion: Check if all source files exist and paths are correct'
      );
    } else if (error.code === 'EACCES') {
      console.error('Permission denied during build');
      console.error(
        '💡 Suggestion: Check file permissions and try running with appropriate access'
      );
    } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
      console.error('Too many open files');
      console.error(
        '💡 Suggestion: Close other applications or increase file descriptor limit'
      );
    } else if (error.code === 'ENOMEM') {
      console.error('Out of memory during build');
      console.error(
        '💡 Suggestion: Try closing other applications or increase available memory'
      );
    } else if (error.message) {
      console.error(`Error message: ${error.message}`);

      // Provide specific suggestions for common error messages
      if (error.message.includes('plugin')) {
        console.error('💡 Suggestion: Check esbuild plugin configuration');
      }
      if (error.message.includes('resolve')) {
        console.error(
          '💡 Suggestion: Check module resolution and external dependencies'
        );
      }
      if (error.message.includes('syntax')) {
        console.error(
          '💡 Suggestion: Run "npm run typecheck" to identify syntax issues'
        );
      }
    } else {
      console.error('Unknown error occurred during build');
      console.error('Error details:', error);
    }

    // Show esbuild-specific errors if available
    if (error.errors && Array.isArray(error.errors)) {
      console.error('\nesbuild errors:');
      error.errors.forEach((err, index) => {
        console.error(`${index + 1}. ${err.text || err}`);
      });
    }

    if (error.warnings && Array.isArray(error.warnings)) {
      console.error('\nesbuild warnings:');
      error.warnings.forEach((warning, index) => {
        console.error(`${index + 1}. ${warning.text || warning}`);
      });
    }

    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Run "npm run typecheck" to check for TypeScript errors');
    console.error('2. Ensure all dependencies are installed: "npm install"');
    console.error('3. Check if source files exist and are accessible');
    console.error('4. Verify esbuild configuration is correct');
    console.error('5. Try cleaning the build directory: "npm run clean"');

    process.exit(1);
  }
}

// Watch mode function
async function watch() {
  console.log('👀 Starting watch mode...');

  try {
    const context = await esbuild.context({
      ...config,
      plugins: [
        {
          name: 'on-rebuild',
          setup(build) {
            build.onEnd((result) => {
              if (result.errors.length === 0) {
                console.log('🔄 Rebuild completed successfully!');
                if (result.warnings.length > 0) {
                  console.warn('⚠️  Rebuild warnings:');
                  result.warnings.forEach((warning, index) => {
                    console.warn(`  ${index + 1}. ${warning.text}`);
                  });
                }
              } else {
                console.error('\n❌ Rebuild failed with errors:');
                result.errors.forEach((error, index) => {
                  console.error(`\n${index + 1}. ${error.text}`);
                  console.error(
                    `   Location: ${error.location?.file || 'unknown'}:${error.location?.line || 'unknown'}:${error.location?.column || 'unknown'}`
                  );
                  if (error.detail)
                    console.error(`   Details: ${error.detail}`);
                });
                console.error(
                  '\n💡 Fix the errors above and the rebuild will automatically retry.'
                );
              }
            });
          },
        },
      ],
    });

    await context.watch();
    console.log('📺 Watching for changes...');
    console.log('💡 Press Ctrl+C to stop watching');
  } catch (error) {
    console.error('\n❌ Failed to start watch mode:');

    if (error.code === 'ENOENT') {
      console.error(`Entry point not found: ${error.path}`);
      console.error('💡 Suggestion: Check if source files exist');
    } else if (error.message) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error:', error);
    }

    console.error('\n🔧 Try these steps:');
    console.error('1. Run "npm run typecheck" to check for errors');
    console.error('2. Ensure source files exist');
    console.error('3. Check esbuild configuration');

    process.exit(1);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  if (isWatchMode) {
    watch();
  } else {
    build();
  }
}

export { build, watch, config };
