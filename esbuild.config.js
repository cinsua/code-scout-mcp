// esbuild configuration placeholder
// Will be configured in task 1.2
module.exports = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/index.js',
  minify: true,
};