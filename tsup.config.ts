import fs from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
    'mcp/index': 'src/mcp/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  clean: true,
  dts: true,
  sourcemap: true,
  define: {
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
});
