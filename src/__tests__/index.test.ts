import { beforeAll, describe, expect, mock, test } from 'bun:test'

import type { ModelSegment, ParsedQuota, ResetTime } from '../index.tsx'

// Cspell:ignore jsxs

// Mock @opentui/solid to avoid JSX parsing errors
void mock.module('@opentui/solid/jsx-runtime', () => ({
  Fragment: () => null,
  jsx: () => null,
  jsxDEV: () => null,
  jsxs: () => null,
}))

let extractModelSegments: (html: string, sectionLabel: string) => ModelSegment[]
let extractResetTimes: (html: string) => ResetTime
let parseQuotaHtml: (html: string) => ParsedQuota

beforeAll(async () => {
  const mod = await import('../index.tsx')
  extractModelSegments = mod.extractModelSegments
  extractResetTimes = mod.extractResetTimes
  parseQuotaHtml = mod.parseQuotaHtml
})

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

// ---------------------------------------------------------------------------
// extractModelSegments
// ---------------------------------------------------------------------------

const SESSION_HTML = `
  <div>
    <div class="flex justify-between mb-2">
      <span class="text-sm ">Session usage</span>
      <span class="text-sm ">
        0.1% used
      </span>
    </div>
    <div class="relative group" data-usage-meter="">
      <div class="absolute bottom-6 left-[var(--usage-bubble-x,50%)] z-10 inline-flex max-w-[min(260px,100%)] -translate-x-1/2 flex-col items-start gap-0.5 rounded-xl border border-neutral-300 bg-white/95 px-2.5 pt-[7px] pb-2 text-neutral-900 opacity-0 pointer-events-none whitespace-nowrap backdrop-blur-md group-[.usage-meter--active]:opacity-100" data-usage-bubble="" aria-hidden="true">
        <span class="max-w-[190px] overflow-hidden text-ellipsis text-xs font-medium leading-[1.2]" data-usage-model=""></span>
        <span class="text-[11px] leading-[1.2] text-neutral-500" data-usage-requests=""></span>
      </div>
      <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Session usage 0.1% used">
        <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 0.1%; ">
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 100%; background: #007aff" data-usage-segment="" data-model="gemini-3-flash-preview" data-requests="1" aria-label="gemini-3-flash-preview: 1 request"></button>
        </div>
      </div>
    </div>
  </div>
`

const WEEKLY_HTML = `
  <div>
    <div class="flex justify-between mb-2">
      <span class="text-sm">Weekly usage</span>
      <span class="text-sm ">10.2% used</span>
    </div>
    <div class="relative group" data-usage-meter="">
      <div class="absolute bottom-6 left-[var(--usage-bubble-x,50%)] z-10 inline-flex max-w-[min(260px,100%)] -translate-x-1/2 flex-col items-start gap-0.5 rounded-xl border border-neutral-300 bg-white/95 px-2.5 pt-[7px] pb-2 text-neutral-900 opacity-0 pointer-events-none whitespace-nowrap backdrop-blur-md group-[.usage-meter--active]:opacity-100" data-usage-bubble="" aria-hidden="true">
        <span class="max-w-[190px] overflow-hidden text-ellipsis text-xs font-medium leading-[1.2]" data-usage-model=""></span>
        <span class="text-[11px] leading-[1.2] text-neutral-500" data-usage-requests=""></span>
      </div>
      <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Weekly usage 10.2% used">
        <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 10.2%">
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 66%; background: #8e8e93" data-usage-segment="" data-model="glm-5.1" data-requests="284" aria-label="glm-5.1: 284 requests"></button>
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 32.3%; background: #007aff" data-usage-segment="" data-model="minimax-m2.7" data-requests="519" aria-label="minimax-m2.7: 519 requests"></button>
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 1.1%; background: #007aff" data-usage-segment="" data-model="gemini-3-flash-preview" data-requests="10" aria-label="gemini-3-flash-preview: 10 requests"></button>
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 0.6%; background: #007aff" data-usage-segment="" data-model="rnj-1:8b" data-requests="11" aria-label="rnj-1:8b: 11 requests"></button>
        </div>
      </div>
    </div>
  </div>
`

describe('extractModelSegments', () => {
  test('extracts single model from session section', () => {
    const segments = extractModelSegments(SESSION_HTML, 'Session usage')
    expect(segments.length).toBe(1)
    expect(segments[0].model).toBe('gemini-3-flash-preview')
    expect(segments[0].requests).toBe(1)
    expect(segments[0].widthPercent).toBe(100)
    expect(segments[0].color).toBe('#007aff')
  })

  test('extracts multiple models from weekly section', () => {
    const segments = extractModelSegments(WEEKLY_HTML, 'Weekly usage')
    expect(segments.length).toBe(4)
    expect(segments[0].model).toBe('glm-5.1')
    expect(segments[0].requests).toBe(284)
    expect(segments[0].widthPercent).toBe(66)
    expect(segments[1].model).toBe('minimax-m2.7')
    expect(segments[1].requests).toBe(519)
    expect(segments[1].widthPercent).toBeCloseTo(32.3)
  })

  test('returns empty array when section label not found', () => {
    const segments = extractModelSegments('<div>No usage data here</div>', 'Session usage')
    expect(segments.length).toBe(0)
  })

  test('returns empty array when no segments in section', () => {
    const html =
      '<div>Session usage<div class="flex h-full overflow-hidden bg-neutral-950" style="width: 0%;"></div></div>'
    const segments = extractModelSegments(html, 'Session usage')
    expect(segments.length).toBe(0)
  })

  test('does not leak segments across sections', () => {
    const combined = SESSION_HTML + WEEKLY_HTML
    const sessionSegments = extractModelSegments(combined, 'Session usage')
    const weeklySegments = extractModelSegments(combined, 'Weekly usage')
    expect(sessionSegments.length).toBe(1)
    expect(weeklySegments.length).toBe(4)
  })

  test('supports Hourly usage as session label fallback', () => {
    const hourlyHtml = `
      <div>Hourly usage
        <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 50%; background: #ff0000"
          data-usage-segment="" data-model="test-model" data-requests="5" aria-label="test-model: 5 requests"></button>
      </div>
    `
    const segments = extractModelSegments(hourlyHtml, 'Hourly usage')
    expect(segments.length).toBe(1)
    expect(segments[0].model).toBe('test-model')
  })
})

// ---------------------------------------------------------------------------
// extractResetTimes
// ---------------------------------------------------------------------------

const FULL_RESET_HTML = `
  <div>
    <div class="flex justify-between mb-2">
      <span class="text-sm ">Session usage</span>
      <span class="text-sm ">
        0.1% used
      </span>
    </div>
    <div class="relative group" data-usage-meter="">
      <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Session usage 0.1% used">
        <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 0.1%; ">
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 100%; background: #007aff" data-usage-segment="" data-model="gemini-3-flash-preview" data-requests="1" aria-label="gemini-3-flash-preview: 1 request"></button>
        </div>
      </div>
    </div>
    <div class="text-xs text-neutral-500 mt-1 local-time" data-time="2026-05-28T21:00:00Z" title="Fri, May 29, 5:00 AM">
      Resets in 3 hours
    </div>
  </div>
  <div>
    <div class="flex justify-between mb-2">
      <span class="text-sm">Weekly usage</span>
      <span class="text-sm ">10.2% used</span>
    </div>
    <div class="relative group" data-usage-meter="">
      <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Weekly usage 10.2% used">
        <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 10.2%">
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 66%; background: #8e8e93" data-usage-segment="" data-model="glm-5.1" data-requests="284" aria-label="glm-5.1: 284 requests"></button>
          <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 32.3%; background: #007aff" data-usage-segment="" data-model="minimax-m2.7" data-requests="519" aria-label="minimax-m2.7: 519 requests"></button>
        </div>
      </div>
    </div>
    <div class="text-xs text-neutral-500 mt-1 local-time" data-time="2026-06-01T00:00:00Z" title="Mon, Jun 1, 8:00 AM">
      Resets in 3 days
    </div>
  </div>
`

describe('extractResetTimes', () => {
  test('extracts both session and weekly reset times', () => {
    const result = extractResetTimes(FULL_RESET_HTML)
    expect(result.session).toBe('2026-05-28T21:00:00Z')
    expect(result.sessionLabel).toBe('3 hours')
    expect(result.weekly).toBe('2026-06-01T00:00:00Z')
    expect(result.weeklyLabel).toBe('3 days')
  })

  test('returns nulls when no reset time data present', () => {
    const result = extractResetTimes('<div>No reset data</div>')
    expect(result.session).toBeNull()
    expect(result.sessionLabel).toBeNull()
    expect(result.weekly).toBeNull()
    expect(result.weeklyLabel).toBeNull()
  })

  test('handles session-only reset time', () => {
    const html = `
      <div>Session usage
        <div class="local-time" data-time="2026-05-28T21:00:00Z">
          Resets in 3 hours
        </div>
      </div>
    `
    const result = extractResetTimes(html)
    expect(result.session).toBe('2026-05-28T21:00:00Z')
    expect(result.sessionLabel).toBe('3 hours')
    expect(result.weekly).toBeNull()
    expect(result.weeklyLabel).toBeNull()
  })

  test('handles weekly-only correctly', () => {
    const html = `
      <div>Weekly usage
        <div class="local-time" data-time="2026-06-01T00:00:00Z">
          Resets in 3 days
        </div>
      </div>
    `
    const result = extractResetTimes(html)
    expect(result.weekly).toBe('2026-06-01T00:00:00Z')
    expect(result.weeklyLabel).toBe('3 days')
  })

  test('handles Hourly usage as session fallback', () => {
    const html = `
      <div>Hourly usage
        <div class="local-time" data-time="2026-05-28T22:00:00Z">
          Resets in 2 hours
        </div>
      </div>
      <div>Weekly usage
        <div class="local-time" data-time="2026-06-01T00:00:00Z">
          Resets in 3 days
        </div>
      </div>
    `
    const result = extractResetTimes(html)
    expect(result.session).toBe('2026-05-28T22:00:00Z')
    expect(result.sessionLabel).toBe('2 hours')
    expect(result.weekly).toBe('2026-06-01T00:00:00Z')
    expect(result.weeklyLabel).toBe('3 days')
  })
})

// ---------------------------------------------------------------------------
// parseQuotaHtml integration
// ---------------------------------------------------------------------------

describe('parseQuotaHtml integration', () => {
  test('extracts all fields including model breakdown and reset times', () => {
    const html = `
      <div>
        <span>Session usage</span><span>0.1% used</span>
        <div class="relative group" data-usage-meter="">
          <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Session usage 0.1% used">
            <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 0.1%;">
              <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 100%; background: #007aff"
                data-usage-segment="" data-model="gemini-3-flash-preview" data-requests="1" aria-label="gemini-3-flash-preview: 1 request"></button>
            </div>
          </div>
        </div>
        <div class="local-time" data-time="2026-05-28T21:00:00Z">Resets in 3 hours</div>
      </div>
      <div>
        <span>Weekly usage</span><span>10.2% used</span>
        <div class="relative group" data-usage-meter="">
          <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Weekly usage 10.2% used">
            <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 10.2%">
              <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 66%; background: #8e8e93" data-usage-segment="" data-model="glm-5.1"
                data-requests="284" aria-label="glm-5.1: 284 requests"></button>
              <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 32.3%; background: #007aff" data-usage-segment="" data-model="minimax-m2.7" data-requests="519" aria-label="minimax-m2.7: 519 requests"></button>
            </div>
          </div>
        </div>
        <div class="local-time" data-time="2026-06-01T00:00:00Z">Resets in 3 days</div>
      </div>
      <span>Free</span><span>Premium requests</span><span>100</span>
    `

    const result = parseQuotaHtml(html)
    expect(result.session).toBeCloseTo(0.1)
    expect(result.weekly).toBeCloseTo(10.2)
    expect(result.plan).toBe('Free')
    expect(result.premiumRequests).toBe('100')

    expect(result.models.session.length).toBe(1)
    expect(result.models.session[0].model).toBe('gemini-3-flash-preview')
    expect(result.models.session[0].requests).toBe(1)

    expect(result.models.weekly.length).toBe(2)
    expect(result.models.weekly[0].model).toBe('glm-5.1')
    expect(result.models.weekly[0].requests).toBe(284)

    expect(result.resetTime.session).toBe('2026-05-28T21:00:00Z')
    expect(result.resetTime.sessionLabel).toBe('3 hours')
    expect(result.resetTime.weekly).toBe('2026-06-01T00:00:00Z')
    expect(result.resetTime.weeklyLabel).toBe('3 days')
  })

  test('returns empty model arrays and null reset times when no data', () => {
    const html = '<div>No usage data</div>'
    const result = parseQuotaHtml(html)
    expect(result.models.session.length).toBe(0)
    expect(result.models.weekly.length).toBe(0)
    expect(result.resetTime.session).toBeNull()
    expect(result.resetTime.sessionLabel).toBeNull()
    expect(result.resetTime.weekly).toBeNull()
    expect(result.resetTime.weeklyLabel).toBeNull()
  })

  test('preserves backward compatibility for percentage extraction', () => {
    const html = `
      <div>Session usage</div><div>42.5% used</div>
      <div>Weekly usage</div><div>15% used</div>
    `
    const result = parseQuotaHtml(html)
    expect(result.session).toBeCloseTo(42.5)
    expect(result.weekly).toBe(15)
    expect(result.models.session.length).toBe(0)
    expect(result.models.weekly.length).toBe(0)
  })
})
