import { expect, mock, test } from 'bun:test'

// Mock @opentui/solid to avoid JSX parsing errors
mock.module('@opentui/solid/jsx-runtime', () => ({
  jsx: () => null,
  jsxs: () => null,
  jsxDEV: () => null,
  Fragment: () => null,
}))

test('exports default with tui property', async () => {
  const mod = await import('../index.tsx')
  expect(mod.default).toBeDefined()
  expect(typeof mod.default.tui).toBe('function')
})

test('exports default with id property', async () => {
  const mod = await import('../index.tsx')
  expect(mod.default.id).toBe('ollama.usage')
})

test('id is a non-empty string', async () => {
  const mod = await import('../index.tsx')
  expect(typeof mod.default.id).toBe('string')
  expect(mod.default.id.length).toBeGreaterThan(0)
})
