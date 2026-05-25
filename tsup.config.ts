import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['@opentui/core', '@opentui/solid', '@opencode-ai/plugin'],
  esbuildOptions: options => {
    options.jsx = 'preserve'
  },
})
