import * as esbuild from 'esbuild';
const WT = '/home/user/wt-rev';
await esbuild.build({
  entryPoints: ['entry.jsx'], bundle: true, outdir: 'out', format: 'esm', jsx: 'automatic', loader: { '.js': 'jsx' },
  absWorkingDir: process.cwd(), nodePaths: [WT + '/node_modules'],
  alias: { '@': WT, 'next/navigation': './stubs/navigation.js', 'next/link': './stubs/link.js' },
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'warning',
});
