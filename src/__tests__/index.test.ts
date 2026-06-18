import { beforeAll, describe, expect, mock, test } from 'bun:test'

import type {
  extractModelSegments as extractModelSegmentsFunction,
  extractPercentageFromAriaLabel as extractPercentageFromAriaLabelFunction,
  extractPercentage as extractPercentageFunction,
  extractResetTimes as extractResetTimesFunction,
  fetchQuota as fetchQuotaFunction,
  formatDisplayState as formatDisplayStateFunction,
  parseQuotaHtml as parseQuotaHtmlFunction,
  QuotaError,
  QuotaResult,
  resolveColor as resolveColorFunction,
  resolveRefreshInterval as resolveRefreshIntervalFunction,
  shouldShowFallback as shouldShowFallbackFunction,
  TuiThemeCurrent,
} from '../index'

// Cspell:ignore jsxs qwen

// Mock @opentui/solid to avoid JSX parsing errors
void mock.module('@opentui/solid/jsx-runtime', () => ({
  Fragment: () => null,
  jsx: () => null,
  jsxDEV: () => null,
  jsxs: () => null,
}))

let extractModelSegments: typeof extractModelSegmentsFunction
let extractPercentage: typeof extractPercentageFunction
let extractPercentageFromAriaLabel: typeof extractPercentageFromAriaLabelFunction
let extractResetTimes: typeof extractResetTimesFunction
let fetchQuota: typeof fetchQuotaFunction
let formatDisplayState: typeof formatDisplayStateFunction
let parseQuotaHtml: typeof parseQuotaHtmlFunction
let quotaError: typeof QuotaError
let resolveColor: typeof resolveColorFunction
let resolveRefreshInterval: typeof resolveRefreshIntervalFunction
let shouldShowFallback: typeof shouldShowFallbackFunction

beforeAll(async () => {
  const mod = await import('../index')
  extractModelSegments = mod.extractModelSegments
  extractPercentage = mod.extractPercentage
  extractPercentageFromAriaLabel = mod.extractPercentageFromAriaLabel
  extractResetTimes = mod.extractResetTimes
  fetchQuota = mod.fetchQuota
  formatDisplayState = mod.formatDisplayState
  parseQuotaHtml = mod.parseQuotaHtml
  quotaError = mod.QuotaError
  resolveColor = mod.resolveColor
  resolveRefreshInterval = mod.resolveRefreshInterval
  shouldShowFallback = mod.shouldShowFallback
})

test('exports default with tui property', async () => {
  const mod = await import('../index')
  expect(mod.default).toBeDefined()
  expect(typeof mod.default.tui).toBe('function')
})

test('exports default with id property', async () => {
  const mod = await import('../index')
  expect(mod.default.id).toBe('ollama.usage')
})

test('id is a non-empty string', async () => {
  const mod = await import('../index')
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

const NO_USAGE_HTML = `
  <div>
    <div class="flex justify-between mb-2">
      <span class="text-sm ">Session usage</span>
      <span class="text-sm ">
        0% used
      </span>
    </div>
    <div class="relative group" data-usage-meter="">
      <div class="absolute bottom-6 left-[var(--usage-bubble-x,50%)] z-10 inline-flex max-w-[min(260px,100%)] -translate-x-1/2 flex-col items-start gap-0.5 rounded-xl border border-neutral-300 bg-white/95 px-2.5 pt-[7px] pb-2 text-neutral-900 opacity-0 pointer-events-none whitespace-nowrap backdrop-blur-md group-[.usage-meter--active]:opacity-100" data-usage-bubble="" aria-hidden="true">
        <span class="max-w-[190px] overflow-hidden text-ellipsis text-xs font-medium leading-[1.2]" data-usage-model=""></span>
        <span class="text-[11px] leading-[1.2] text-neutral-500" data-usage-requests=""></span>
      </div>
      <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Session usage 0% used">
        <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 0%; ">
        </div>
      </div>
    </div>
    <div class="text-xs text-neutral-500 mt-1 local-time" data-time="2026-05-29T17:00:00Z" title="Sat, May 30, 1:00 AM">
      Resets in 4 hours
    </div>

  </div>
`

const NO_SESSION_WITH_WEEKLY_HTML = `
  <div>
    <div class="flex justify-between mb-2">
      <span class="text-sm ">Session usage</span>
      <span class="text-sm ">
        0% used
      </span>
    </div>
    <div class="relative group" data-usage-meter="">
      <div class="absolute bottom-6 left-[var(--usage-bubble-x,50%)] z-10 inline-flex max-w-[min(260px,100%)] -translate-x-1/2 flex-col items-start gap-0.5 rounded-xl border border-neutral-300 bg-white/95 px-2.5 pt-[7px] pb-2 text-neutral-900 opacity-0 pointer-events-none whitespace-nowrap backdrop-blur-md group-[.usage-meter--active]:opacity-100" data-usage-bubble="" aria-hidden="true">
        <span class="max-w-[190px] overflow-hidden text-ellipsis text-xs font-medium leading-[1.2]" data-usage-model=""></span>
        <span class="text-[11px] leading-[1.2] text-neutral-500" data-usage-requests=""></span>
      </div>
      <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track="" aria-label="Session usage 0% used">
        <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 0%; ">
        </div>
      </div>
    </div>
    <div class="text-xs text-neutral-500 mt-1 local-time" data-time="2026-05-29T17:00:00Z" title="Sat, May 30, 1:00 AM">
      Resets in 4 hours
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

describe('extractModelSegments', () => {
  test('extracts single model from session section', () => {
    const segments = extractModelSegments(SESSION_HTML, 'Session usage')
    expect(segments.length).toBe(1)
    expect(segments[0].model).toBe('gemini-3-flash-preview')
    expect(segments[0].requests).toBe(1)
    expect(segments[0].widthPercent).toBe(100)
    expect(segments[0].color).toBe('#007aff')
  })

  test('extracts multiple models from weekly section sorted by request count descending', () => {
    const segments = extractModelSegments(WEEKLY_HTML, 'Weekly usage')
    expect(segments.length).toBe(4)
    expect(segments[0].model).toBe('minimax-m2.7')
    expect(segments[0].requests).toBe(519)
    expect(segments[0].widthPercent).toBeCloseTo(32.3)
    expect(segments[1].model).toBe('glm-5.1')
    expect(segments[1].requests).toBe(284)
    expect(segments[1].widthPercent).toBe(66)
    expect(segments[2].model).toBe('rnj-1:8b')
    expect(segments[2].requests).toBe(11)
    expect(segments[3].model).toBe('gemini-3-flash-preview')
    expect(segments[3].requests).toBe(10)
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

  test('returns empty array for 0% usage with no model segments', () => {
    const segments = extractModelSegments(NO_USAGE_HTML, 'Session usage')
    expect(segments.length).toBe(0)
  })

  test('extracts weekly models from mixed HTML with 0% session and weekly data sorted by requests', () => {
    const sessionSegments = extractModelSegments(NO_SESSION_WITH_WEEKLY_HTML, 'Session usage')
    const weeklySegments = extractModelSegments(NO_SESSION_WITH_WEEKLY_HTML, 'Weekly usage')
    expect(sessionSegments.length).toBe(0)
    expect(weeklySegments.length).toBe(2)
    expect(weeklySegments[0].model).toBe('minimax-m2.7')
    expect(weeklySegments[0].requests).toBe(519)
    expect(weeklySegments[1].model).toBe('glm-5.1')
    expect(weeklySegments[1].requests).toBe(284)
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

  test('does not leak weekly segments into hourly section', () => {
    const hourlyHtml = `
      <div>Hourly usage
        <button type="button" class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none" style="width: 100%; background: #007aff"
          data-usage-segment="" data-model="hourly-model" data-requests="1" aria-label="hourly-model: 1 request"></button>
      </div>
    `
    const combined = hourlyHtml + WEEKLY_HTML
    const hourlySegments = extractModelSegments(combined, 'Hourly usage')
    const weeklySegments = extractModelSegments(combined, 'Weekly usage')
    expect(hourlySegments.length).toBe(1)
    expect(hourlySegments[0].model).toBe('hourly-model')
    expect(weeklySegments.length).toBe(4)
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

  test('extracts session reset time from 0% usage HTML', () => {
    const result = extractResetTimes(NO_USAGE_HTML)
    expect(result.session).toBe('2026-05-29T17:00:00Z')
    expect(result.sessionLabel).toBe('4 hours')
    expect(result.weekly).toBeNull()
    expect(result.weeklyLabel).toBeNull()
  })

  test('extracts both reset times from mixed 0% session and weekly usage', () => {
    const result = extractResetTimes(NO_SESSION_WITH_WEEKLY_HTML)
    expect(result.session).toBe('2026-05-29T17:00:00Z')
    expect(result.sessionLabel).toBe('4 hours')
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

  test('assigns first item as weekly when both items are after weekly section', () => {
    const html = `
      <div>Weekly usage
        <div class="local-time" data-time="2026-06-01T00:00:00Z">
          Resets in 3 days
        </div>
      </div>
      <div>Weekly usage
        <div class="local-time" data-time="2026-06-08T00:00:00Z">
          Resets in 1 day
        </div>
      </div>
    `
    const result = extractResetTimes(html)
    expect(result.session).toBeNull()
    expect(result.weekly).toBe('2026-06-01T00:00:00Z')
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
    expect(result.models.weekly[0].model).toBe('minimax-m2.7')
    expect(result.models.weekly[0].requests).toBe(519)
    expect(result.models.weekly[1].model).toBe('glm-5.1')
    expect(result.models.weekly[1].requests).toBe(284)

    expect(result.resetTime.session).toBe('2026-05-28T21:00:00Z')
    expect(result.resetTime.sessionLabel).toBe('3 hours')
    expect(result.resetTime.weekly).toBe('2026-06-01T00:00:00Z')
    expect(result.resetTime.weeklyLabel).toBe('3 days')
  })

  test('parses 0% session usage with no model segments and valid reset time', () => {
    const result = parseQuotaHtml(NO_USAGE_HTML)
    expect(result.session).toBe(0)
    expect(result.weekly).toBeNull()
    expect(result.models.session.length).toBe(0)
    expect(result.models.weekly.length).toBe(0)
    expect(result.plan).toBeNull()
    expect(result.premiumRequests).toBeNull()
    expect(result.resetTime.session).toBe('2026-05-29T17:00:00Z')
    expect(result.resetTime.sessionLabel).toBe('4 hours')
    expect(result.resetTime.weekly).toBeNull()
    expect(result.resetTime.weeklyLabel).toBeNull()
  })

  test('parses 0% session with weekly models and both reset times', () => {
    const result = parseQuotaHtml(NO_SESSION_WITH_WEEKLY_HTML)
    expect(result.session).toBe(0)
    expect(result.weekly).toBeCloseTo(10.2)
    expect(result.models.session.length).toBe(0)
    expect(result.models.weekly.length).toBe(2)
    expect(result.models.weekly[0].model).toBe('minimax-m2.7')
    expect(result.models.weekly[1].model).toBe('glm-5.1')
    expect(result.resetTime.session).toBe('2026-05-29T17:00:00Z')
    expect(result.resetTime.sessionLabel).toBe('4 hours')
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

  test('extracts weekly percentage from aria-label when visible text lacks "X% used"', () => {
    const padding = 'x'.repeat(220)
    const html = `
      <div>Session usage</div><div>0.1% used</div>
      <div>Weekly usage</div><div>Weekly limit reached</div>
      <div>${padding}</div>
      <div aria-label="Weekly usage 100% used"></div>
    `
    const result = parseQuotaHtml(html)
    expect(result.session).toBeCloseTo(0.1)
    expect(result.weekly).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// formatDisplayState
// ---------------------------------------------------------------------------

describe('formatDisplayState', () => {
  const baseQuota: QuotaResult = {
    fetchedAt: Date.now(),
    models: { session: [], weekly: [] },
    ok: true,
    plan: null,
    premiumRequests: null,
    resetTime: { session: null, sessionLabel: null, weekly: null, weeklyLabel: null },
    session: null,
    weekly: null,
    weeklyLimitReached: false,
  }

  test('returns Connect Ollama when quota is undefined', () => {
    const result = formatDisplayState(undefined)
    expect(result.level).toBe('muted')
    expect(result.text).toBe('Connect Ollama')
  })

  test('returns 0% session when session usage is 0', () => {
    const result = formatDisplayState({ ...baseQuota, session: 0 })
    expect(result.level).toBe('default')
    expect(result.text).toBe('0% session')
  })

  test('returns 0% session · 0% weekly when both are 0', () => {
    const result = formatDisplayState({ ...baseQuota, session: 0, weekly: 0 })
    expect(result.level).toBe('default')
    expect(result.text).toBe('0% session · 0% weekly')
  })

  test('returns weekly-only text when session is null and weekly has data', () => {
    const result = formatDisplayState({ ...baseQuota, weekly: 10.2 })
    expect(result.level).toBe('default')
    expect(result.text).toBe('10.2% weekly')
  })

  test('returns 0% session with weekly when session is 0 and weekly has data', () => {
    const result = formatDisplayState({ ...baseQuota, session: 0, weekly: 10.2 })
    expect(result.level).toBe('default')
    expect(result.text).toBe('0% session · 10.2% weekly')
  })

  test('returns error text for NoCookie error', async () => {
    const noCookieQuota: QuotaResult = { error: quotaError.NoCookie, fetchedAt: Date.now(), ok: false }
    const result = formatDisplayState(noCookieQuota)
    expect(result.level).toBe('muted')
    expect(result.text).toBe('No Cookie')
  })

  test('returns warning text for MissingData error', () => {
    const missingDataQuota: QuotaResult = {
      error: quotaError.MissingData,
      fetchedAt: Date.now(),
      ok: false,
    }
    const result = formatDisplayState(missingDataQuota)
    expect(result.level).toBe('warning')
    expect(result.text).toBe('Missing Data')
  })

  test('returns error text for Network error', () => {
    const networkQuota: QuotaResult = { error: quotaError.Network, fetchedAt: Date.now(), ok: false }
    const result = formatDisplayState(networkQuota)
    expect(result.level).toBe('error')
    expect(result.text).toBe('Network Error')
  })

  test('returns muted text for SignedOut error', () => {
    const signedOutQuota: QuotaResult = {
      error: quotaError.SignedOut,
      fetchedAt: Date.now(),
      ok: false,
    }
    const result = formatDisplayState(signedOutQuota)
    expect(result.level).toBe('muted')
    expect(result.text).toBe('Signed Out')
  })

  test('returns default level for normal usage', () => {
    const result = formatDisplayState({ ...baseQuota, session: 45.5, weekly: 12.3 })
    expect(result.level).toBe('default')
    expect(result.text).toBe('45.5% session · 12.3% weekly')
  })

  test('returns warning level and limit reached text when weeklyLimitReached is true', () => {
    const result = formatDisplayState({ ...baseQuota, session: 29.8, weekly: 100, weeklyLimitReached: true })
    expect(result.level).toBe('warning')
    expect(result.text).toBe('Limit reached · 100% weekly')
  })

  test('returns warning level with limit reached when only weekly is present', () => {
    const result = formatDisplayState({ ...baseQuota, weekly: 100, weeklyLimitReached: true })
    expect(result.level).toBe('warning')
    expect(result.text).toBe('Limit reached · 100% weekly')
  })

  test('returns warning level with limit reached when session is null', () => {
    const result = formatDisplayState({ ...baseQuota, session: null, weekly: 100, weeklyLimitReached: true })
    expect(result.level).toBe('warning')
    expect(result.text).toBe('Limit reached · 100% weekly')
  })
})

// ---------------------------------------------------------------------------
// Weekly limit reached HTML fixture
// ---------------------------------------------------------------------------

const WEEKLY_LIMIT_REACHED_HTML = `
<div>
  <div class="flex justify-between mb-2">
    <span class="text-sm text-neutral-400">Session usage</span>
    <span class="text-sm text-neutral-500">
      Weekly limit reached
    </span>
  </div>
  <div class="relative group" data-usage-meter>
    <div
      class="absolute bottom-6 left-[var(--usage-bubble-x,50%)] z-10 inline-flex max-w-[min(260px,100%)] -translate-x-1/2 flex-col items-start gap-0.5 rounded-xl border border-neutral-300 bg-white/95 px-2.5 pt-[7px] pb-2 text-neutral-900 opacity-0 pointer-events-none whitespace-nowrap backdrop-blur-md group-[.usage-meter--active]:opacity-100"
      data-usage-bubble aria-hidden="true">
      <span class="max-w-[190px] overflow-hidden text-ellipsis text-xs font-medium leading-[1.2]"
        data-usage-model></span>
      <span class="text-[11px] leading-[1.2] text-neutral-500" data-usage-requests></span>
    </div>
    <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track
      aria-label="Session usage 29.8% used">
      <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 100%; background: #d4d4d4;">

      </div>
    </div>
  </div>

  <div class="text-xs text-neutral-500 mt-1 local-time" data-time="2026-06-08T00:00:00Z">
    Sessions resume in 1 day.
  </div>

</div>

<div>
  <div class="flex justify-between mb-2">
    <span class="text-sm">Weekly usage</span>
    <span class="text-sm text-red-500">100% used</span>
  </div>
  <div class="relative group" data-usage-meter>
    <div
      class="absolute bottom-6 left-[var(--usage-bubble-x,50%)] z-10 inline-flex max-w-[min(260px,100%)] -translate-x-1/2 flex-col items-start gap-0.5 rounded-xl border border-neutral-300 bg-white/95 px-2.5 pt-[7px] pb-2 text-neutral-900 opacity-0 pointer-events-none whitespace-nowrap backdrop-blur-md group-[.usage-meter--active]:opacity-100"
      data-usage-bubble aria-hidden="true">
      <span class="max-w-[190px] overflow-hidden text-ellipsis text-xs font-medium leading-[1.2]"
        data-usage-model></span>
      <span class="text-[11px] leading-[1.2] text-neutral-500" data-usage-requests></span>
    </div>
    <div class="relative h-3 overflow-hidden rounded-full bg-neutral-200" data-usage-track
      aria-label="Weekly usage 100% used">
      <div class="flex h-full overflow-hidden bg-neutral-950" style="width: 100%">


        <button type="button"
          class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none"
          style="width: 2.6%; background: #f97316" data-usage-segment data-model="qwen3.5:397b" data-requests="53"
          aria-label="qwen3.5:397b: 53 requests"></button>

        <button type="button"
          class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none"
          style="width: 0.7%; background: #22c55e" data-usage-segment data-model="gemini-3-flash-preview"
          data-requests="53" aria-label="gemini-3-flash-preview: 53 requests"></button>

        <button type="button"
          class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none"
          style="width: 0%; background: #22c55e" data-usage-segment data-model="gemma4:31b" data-requests="4"
          aria-label="gemma4:31b: 4 requests"></button>

        <button type="button"
          class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none"
          style="width: 86.4%; background: #3b82f6" data-usage-segment data-model="glm-5.1" data-requests="3222"
          aria-label="glm-5.1: 3222 requests"></button>

        <button type="button"
          class="relative h-full min-w-[2px] flex-none overflow-hidden border-r border-white p-0 last:border-r-0 focus-visible:outline-none"
          style="width: 10.4%; background: #ef4461" data-usage-segment data-model="minimax-m2.7" data-requests="2123"
          aria-label="minimax-m2.7: 2123 requests"></button>

      </div>
    </div>
  </div>

  <div class="text-xs text-neutral-500 mt-1 local-time" data-time="2026-06-08T00:00:00Z">
    Resets in 1 day.
  </div>
</div>
`

// ---------------------------------------------------------------------------
// extractPercentageFromAriaLabel
// ---------------------------------------------------------------------------

describe('extractPercentageFromAriaLabel', () => {
  test('extracts percentage from aria-label matching label', () => {
    const html = '<div aria-label="Session usage 29.8% used"></div>'
    const result = extractPercentageFromAriaLabel(html, 'Session usage')
    expect(result).toBeCloseTo(29.8)
  })

  test('extracts percentage from aria-label for Hourly usage', () => {
    const html = '<div aria-label="Hourly usage 50% used"></div>'
    const result = extractPercentageFromAriaLabel(html, 'Hourly usage')
    expect(result).toBe(50)
  })

  test('returns null when no aria-label matches the label', () => {
    const html = '<div aria-label="Weekly usage 100% used"></div>'
    const result = extractPercentageFromAriaLabel(html, 'Session usage')
    expect(result).toBeNull()
  })

  test('returns null when aria-label exists but has no percentage', () => {
    const html = '<div aria-label="Session usage"></div>'
    const result = extractPercentageFromAriaLabel(html, 'Session usage')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractResetTimes with "Sessions resume in"
// ---------------------------------------------------------------------------

describe('extractResetTimes with resume pattern', () => {
  test('extracts "Sessions resume in" label for session reset', () => {
    const html = `
      <div>Session usage
        <div class="local-time" data-time="2026-06-08T00:00:00Z">
          Sessions resume in 1 day.
        </div>
      </div>
    `
    const result = extractResetTimes(html)
    expect(result.session).toBe('2026-06-08T00:00:00Z')
    expect(result.sessionLabel).toBe('1 day.')
  })

  test('extracts "Session resumes in" (singular verb form) label for session reset', () => {
    const html = `
      <div>Session usage
        <div class="local-time" data-time="2026-06-08T00:00:00Z">
          Session resumes in 1 day.
        </div>
      </div>
    `
    const result = extractResetTimes(html)
    expect(result.session).toBe('2026-06-08T00:00:00Z')
    expect(result.sessionLabel).toBe('1 day.')
  })

  test('extracts both "Sessions resume in" for session and "Resets in" for weekly', () => {
    const result = extractResetTimes(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.session).toBe('2026-06-08T00:00:00Z')
    expect(result.sessionLabel).toBe('1 day.')
    expect(result.weekly).toBe('2026-06-08T00:00:00Z')
    expect(result.weeklyLabel).toBe('1 day.')
  })

  test('preserves "Resets in" extraction for backward compatibility', () => {
    const result = extractResetTimes(FULL_RESET_HTML)
    expect(result.session).toBe('2026-05-28T21:00:00Z')
    expect(result.sessionLabel).toBe('3 hours')
    expect(result.weekly).toBe('2026-06-01T00:00:00Z')
    expect(result.weeklyLabel).toBe('3 days')
  })
})

// ---------------------------------------------------------------------------
// parseQuotaHtml with weekly limit reached
// ---------------------------------------------------------------------------

describe('parseQuotaHtml with weekly limit reached', () => {
  test('detects weeklyLimitReached flag', () => {
    const result = parseQuotaHtml(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.weeklyLimitReached).toBe(true)
  })

  test('extracts session percentage from aria-label when text says "Weekly limit reached"', () => {
    const result = parseQuotaHtml(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.session).toBeCloseTo(29.8)
  })

  test('extracts weekly percentage as 100', () => {
    const result = parseQuotaHtml(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.weekly).toBe(100)
  })

  test('extracts session models as empty (no model segments in limit-reached bar)', () => {
    const result = parseQuotaHtml(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.models.session.length).toBe(0)
  })

  test('extracts weekly models correctly', () => {
    const result = parseQuotaHtml(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.models.weekly.length).toBe(5)
  })

  test('extracts session reset time with "Sessions resume in" label', () => {
    const result = parseQuotaHtml(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.resetTime.session).toBe('2026-06-08T00:00:00Z')
    expect(result.resetTime.sessionLabel).toBe('1 day.')
  })

  test('extracts weekly reset time', () => {
    const result = parseQuotaHtml(WEEKLY_LIMIT_REACHED_HTML)
    expect(result.resetTime.weekly).toBe('2026-06-08T00:00:00Z')
    expect(result.resetTime.weeklyLabel).toBe('1 day.')
  })

  test('backward compat: normal HTML has weeklyLimitReached false', () => {
    const result = parseQuotaHtml(FULL_RESET_HTML)
    expect(result.weeklyLimitReached).toBe(false)
  })

  test('backward compat: 0% session HTML has weeklyLimitReached false', () => {
    const result = parseQuotaHtml(NO_USAGE_HTML)
    expect(result.weeklyLimitReached).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveRefreshInterval
// ---------------------------------------------------------------------------

describe('resolveRefreshInterval', () => {
  test('returns the parsed value when a positive number is provided', () => {
    expect(resolveRefreshInterval('60000')).toBe(60000)
  })

  test('returns the parsed value for a decimal number', () => {
    expect(resolveRefreshInterval('1.5')).toBe(1.5)
  })

  test('falls back to default when value is zero', () => {
    expect(resolveRefreshInterval('0')).toBe(300_000)
  })

  test('falls back to default when value is negative', () => {
    expect(resolveRefreshInterval('-1000')).toBe(300_000)
  })

  test('falls back to default when value is NaN (non-numeric string)', () => {
    expect(resolveRefreshInterval('abc')).toBe(300_000)
  })

  test('falls back to default when value is empty string', () => {
    expect(resolveRefreshInterval('')).toBe(300_000)
  })

  test('falls back to default when value is Infinity', () => {
    expect(resolveRefreshInterval('Infinity')).toBe(300_000)
  })
})

// ---------------------------------------------------------------------------
// QuotaError enum
// ---------------------------------------------------------------------------

describe('QuotaError enum', () => {
  test('exposes all expected error codes', () => {
    expect(String(quotaError.MissingData)).toBe('missing_data')
    expect(String(quotaError.Network)).toBe('network')
    expect(String(quotaError.NoCookie)).toBe('no_cookie')
    expect(String(quotaError.SignedOut)).toBe('signed_out')
  })
})

// ---------------------------------------------------------------------------
// resolveColor
// ---------------------------------------------------------------------------

describe('resolveColor', () => {
  const theme = {
    error: 'err',
    success: 'ok',
    text: 'txt',
    textMuted: 'mut',
    warning: 'warn',
  } as unknown as TuiThemeCurrent

  test('maps default level to theme.text', () => {
    expect(resolveColor('default', theme)).toBe(theme.text)
  })

  test('maps error level to theme.error', () => {
    expect(resolveColor('error', theme)).toBe(theme.error)
  })

  test('maps muted level to theme.textMuted', () => {
    expect(resolveColor('muted', theme)).toBe(theme.textMuted)
  })

  test('maps success level to theme.success', () => {
    expect(resolveColor('success', theme)).toBe(theme.success)
  })

  test('maps warning level to theme.warning', () => {
    expect(resolveColor('warning', theme)).toBe(theme.warning)
  })
})

// ---------------------------------------------------------------------------
// shouldShowFallback
// ---------------------------------------------------------------------------

describe('shouldShowFallback', () => {
  const okQuota: QuotaResult = {
    fetchedAt: Date.now(),
    models: { session: [], weekly: [] },
    ok: true,
    plan: null,
    premiumRequests: null,
    resetTime: { session: null, sessionLabel: null, weekly: null, weeklyLabel: null },
    session: 10,
    weekly: 20,
    weeklyLimitReached: false,
  }

  test('returns true when quota is undefined', () => {
    expect(shouldShowFallback(undefined)).toBe(true)
  })

  test('returns true when quota is an error result', () => {
    const errQuota: QuotaResult = { error: quotaError.Network, fetchedAt: Date.now(), ok: false }
    expect(shouldShowFallback(errQuota)).toBe(true)
  })

  test('returns true when ok but both session and weekly are null', () => {
    const nullQuota: QuotaResult = { ...okQuota, session: null, weekly: null }
    expect(shouldShowFallback(nullQuota)).toBe(true)
  })

  test('returns false when ok and session has a value', () => {
    expect(shouldShowFallback({ ...okQuota, session: 0, weekly: null })).toBe(false)
  })

  test('returns false when ok and weekly has a value', () => {
    expect(shouldShowFallback({ ...okQuota, session: null, weekly: 0 })).toBe(false)
  })

  test('returns false when ok and both have values', () => {
    expect(shouldShowFallback(okQuota)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseQuotaHtml edge cases
// ---------------------------------------------------------------------------

describe('parseQuotaHtml edge cases', () => {
  test('extracts plan-only HTML without usage sections', () => {
    const html = '<div><span>Pro</span></div>'
    const result = parseQuotaHtml(html)
    expect(result.plan).toBe('Pro')
    expect(result.session).toBeNull()
    expect(result.weekly).toBeNull()
    expect(result.premiumRequests).toBeNull()
    expect(result.models.session.length).toBe(0)
    expect(result.models.weekly.length).toBe(0)
  })

  test('extracts premium requests from HTML without usage sections', () => {
    const html = '<div><span>Premium requests</span><span>250</span></div>'
    const result = parseQuotaHtml(html)
    expect(result.premiumRequests).toBe('250')
    expect(result.plan).toBeNull()
    expect(result.session).toBeNull()
    expect(result.weekly).toBeNull()
  })

  test('returns all nulls for empty string', () => {
    const result = parseQuotaHtml('')
    expect(result.session).toBeNull()
    expect(result.weekly).toBeNull()
    expect(result.plan).toBeNull()
    expect(result.premiumRequests).toBeNull()
    expect(result.weeklyLimitReached).toBe(false)
    expect(result.models.session.length).toBe(0)
    expect(result.models.weekly.length).toBe(0)
  })

  test('detects weeklyLimitReached flag from text marker', () => {
    const html = '<div>Weekly limit reached</div>'
    const result = parseQuotaHtml(html)
    expect(result.weeklyLimitReached).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// fetchQuota
// ---------------------------------------------------------------------------

describe('fetchQuota', () => {
  const VALID_HTML = `
    <div>Session usage</div><div>0.1% used</div>
    <div>Weekly usage</div><div>10.2% used</div>
  `
  const SIGNED_OUT_HTML = '<form action="/api/auth/signin"><input type="password" name="password" /></form>'

  function mockFetchResponse(html: string, ok = true): Response {
    return {
      ok,
      text: () => Promise.resolve(html),
    } as Response
  }

  function withMockedFetch(impl: (req: Request) => Promise<Response>, fn: () => Promise<void>) {
    const original = globalThis.fetch
    globalThis.fetch = mock(impl) as unknown as typeof globalThis.fetch
    return fn().finally(() => {
      globalThis.fetch = original
    })
  }

  test('returns NoCookie when cookie is undefined', async () => {
    const result = await fetchQuota(undefined)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(quotaError.NoCookie)
  })

  test('returns NoCookie when cookie is empty string', async () => {
    const result = await fetchQuota('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe(quotaError.NoCookie)
  })

  test('returns Network when fetch throws', async () => {
    await withMockedFetch(
      () => Promise.reject(new Error('network down')),
      async () => {
        const result = await fetchQuota('session=abc')
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe(quotaError.Network)
      },
    )
  })

  test('returns Network when response is not ok', async () => {
    await withMockedFetch(
      () => Promise.resolve(mockFetchResponse('', false)),
      async () => {
        const result = await fetchQuota('session=abc')
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe(quotaError.Network)
      },
    )
  })

  test('returns SignedOut when HTML contains signin markers', async () => {
    await withMockedFetch(
      () => Promise.resolve(mockFetchResponse(SIGNED_OUT_HTML)),
      async () => {
        const result = await fetchQuota('session=abc')
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe(quotaError.SignedOut)
      },
    )
  })

  test('returns MissingData when HTML has no quota fields', async () => {
    await withMockedFetch(
      () => Promise.resolve(mockFetchResponse('<div>nothing useful</div>')),
      async () => {
        const result = await fetchQuota('session=abc')
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe(quotaError.MissingData)
      },
    )
  })

  test('returns ok with parsed data for valid HTML', async () => {
    await withMockedFetch(
      () => Promise.resolve(mockFetchResponse(VALID_HTML)),
      async () => {
        const result = await fetchQuota('session=abc')
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.session).toBeCloseTo(0.1)
          expect(result.weekly).toBeCloseTo(10.2)
        }
      },
    )
  })

  test('sanitizes CRLF from cookie before sending', async () => {
    let capturedCookie: string | undefined
    await withMockedFetch(
      (_url: RequestInfo | URL, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string> | undefined
        capturedCookie = headers?.['Cookie']
        return Promise.resolve(mockFetchResponse(VALID_HTML))
      },
      async () => {
        await fetchQuota('session=abc\r\nX-Injected: evil')
      },
    )
    expect(capturedCookie).toBe('session=abcX-Injected: evil')
  })
})

// ---------------------------------------------------------------------------
// extractPercentage
// ---------------------------------------------------------------------------

describe('extractPercentage', () => {
  test('extracts percentage near the label', () => {
    const html = '<div>Session usage</div><div>29.8% used</div>'
    expect(extractPercentage(html, 'Session usage')).toBeCloseTo(29.8)
  })

  test('returns null when label is not found', () => {
    expect(extractPercentage('<div>no label here</div>', 'Session usage')).toBeNull()
  })

  test('returns null when no percentage pattern is within the slice window', () => {
    const padding = 'x'.repeat(220)
    const html = `<div>Session usage</div>${padding}<div>29.8% used</div>`
    expect(extractPercentage(html, 'Session usage')).toBeNull()
  })

  test('falls back to aria-label percentage within the slice window', () => {
    const html = '<div>Session usage</div><div aria-label="Session usage 50% used"></div>'
    expect(extractPercentage(html, 'Session usage')).toBe(50)
  })
})
