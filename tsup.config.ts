import { defineConfig } from 'tsup';

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
});
