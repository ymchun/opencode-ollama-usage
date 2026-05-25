// CSpell:ignore opentui
import { defineConfig } from 'tsup'
import { solidPlugin } from 'esbuild-plugin-solid'

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['@opentui/core', '@opentui/solid', '@opencode-ai/plugin', 'solid-js'],
  esbuildPlugins: [
    solidPlugin({
      solid: {
        moduleName: '@opentui/solid',
        generate: 'universal',
      },
    }),
  ],
})
