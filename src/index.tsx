/** @jsxImportSource @opentui/solid */

import type { TuiPlugin, TuiPluginModule, TuiSlotContext, TuiThemeCurrent } from '@opencode-ai/plugin/tui'
import { createEffect, createResource } from 'solid-js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default refresh interval for quota data (5 minutes). */
const DEFAULT_REFRESH_INTERVAL_MS = 300_000

/** Network request timeout (3 seconds). */
const FETCH_TIMEOUT_MS = 3_000

/** Slice length used when extracting percentage from HTML. */
const PERCENTAGE_SLICE_LENGTH = 200

/** Ollama settings page URL. */
const SETTINGS_URL = 'https://ollama.com/settings'

/** Environment variable names. */
const ENV_COOKIE = 'OLLAMA_SESSION_COOKIE'
const ENV_REFRESH_INTERVAL = 'OLLAMA_QUOTA_REFRESH_INTERVAL'

/** Cache key for persisting the last successful quota result. */
const CACHE_KEY = 'ollama_quota.last'

/** Maximum number of models to display per usage section. */
const MAX_MODELS_DISPLAY = 5

/** HTML markers that indicate the user is signed out. */
const SIGNED_OUT_MARKERS = ['<form>', '/api/auth/signin', 'type="password"']

const PERCENTAGE_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*%\s*used/i
const ARIA_PERCENTAGE_PATTERN = /aria-label="[^"]*?([0-9]+(?:\.[0-9]+)?)\s*%\s*used[^"]*"/i
const SEGMENT_BUTTON_PATTERN = /<button[^>]+data-usage-segment[^>]*>/g
const RESET_TIME_PATTERN = /data-time="([^"]*)"/g
const RESETS_IN_PATTERN = /Resets in\s+([^<]*)/gi
const RESUMES_IN_PATTERN = /Sessions? resumes? in\s+([^<]*)/gi
const WEEKLY_LIMIT_REACHED_PATTERN = /Weekly limit reached/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Domain-specific error codes for quota fetch failures. */
enum QuotaError {
  MissingData = 'missing_data',
  Network = 'network',
  NoCookie = 'no_cookie',
  SignedOut = 'signed_out',
}

type DetailCtx = {
  isLimitReached: boolean
  models: ModelSegment[]
  resetLabel: null | string
  theme: TuiThemeCurrent
}

/** Level of visual emphasis for display state text. */
type DisplayLevel = 'default' | 'error' | 'muted' | 'success' | 'warning'

/** Resolved display state with text and color level. */
type DisplayState = { level: DisplayLevel; text: string }

type IndexedValue = { index: number; value: string }

type ModelBreakdown = {
  session: ModelSegment[]
  weekly: ModelSegment[]
}

type ModelSegment = {
  color: string
  model: string
  requests: number
  widthPercent: number
}

type ParsedQuota = {
  models: ModelBreakdown
  plan: null | string
  premiumRequests: null | string
  resetTime: ResetTime
  session: null | number
  weekly: null | number
  weeklyLimitReached: boolean
}

type QuotaData = {
  fetchedAt: number
  models: ModelBreakdown
  plan: null | string
  premiumRequests: null | string
  resetTime: ResetTime
  session: null | number
  weekly: null | number
  weeklyLimitReached: boolean
}

/** Discriminated result: either successful data or an error. */
type QuotaResult = (QuotaData & { ok: true }) | { error: QuotaError; fetchedAt: number; ok: false }

type ResetTime = {
  session: null | string
  sessionLabel: null | string
  weekly: null | string
  weeklyLabel: null | string
}

/**
 * Assigns session/weekly values from position-sorted items based on section markers.
 * The first item before the weekly section becomes session; the next becomes weekly.
 * If only one item exists and it's after the weekly section, it becomes weekly only.
 */
function assignSessionWeekly(
  items: IndexedValue[],
  hourlyStart: number,
  weeklyStart: number,
): { session: null | string; weekly: null | string } {
  if (items.length === 0) return { session: null, weekly: null }

  const first = items[0]
  const isAfterHourly = hourlyStart !== -1 && first.index > hourlyStart
  const beforeWeekly = weeklyStart === -1 || first.index < weeklyStart

  let session: null | string = null
  let weekly: null | string = null

  if (isAfterHourly && beforeWeekly) session = first.value

  const firstAfterWeekly = weeklyStart !== -1 && first.index > weeklyStart
  if (firstAfterWeekly) {
    weekly = first.value
    session = null
  } else if (items.length >= 2) {
    weekly = items[1].value
  }

  return { session, weekly }
}

function extractModelSegments(html: string, sectionLabel: string): ModelSegment[] {
  const sectionStart = html.toLowerCase().indexOf(sectionLabel.toLowerCase())
  if (sectionStart === -1) return []

  const isSessionLike = sectionLabel.toLowerCase().includes('session') || sectionLabel.toLowerCase().includes('hourly')
  const nextSectionLabel = isSessionLike ? 'weekly usage' : null
  const sectionEnd = nextSectionLabel ? html.toLowerCase().indexOf(nextSectionLabel, sectionStart + 1) : html.length

  const sectionHtml = html.slice(sectionStart, sectionEnd === -1 ? html.length : sectionEnd)

  const segments: ModelSegment[] = []
  for (const btnMatch of sectionHtml.matchAll(SEGMENT_BUTTON_PATTERN)) {
    const segment = parseSegmentButton(btnMatch[0])
    if (segment) segments.push(segment)
  }
  return segments.sort((a, b) => b.requests - a.requests)
}

/**
 * Extracts a percentage value found near the given label in the HTML.
 * Returns `null` when the label or percentage is not found.
 * Falls back to aria-label percentage when the text label doesn't contain "X% used".
 */
function extractPercentage(html: string, label: string): null | number {
  const idx = html.toLowerCase().indexOf(label.toLowerCase())
  if (idx === -1) return null
  const slice = html.slice(idx, idx + PERCENTAGE_SLICE_LENGTH)

  // Try the standard "X% used" pattern first (e.g. "29.8% used")
  const m = slice.match(PERCENTAGE_PATTERN)
  if (m) return parseFloat(m[1])

  // Fallback: extract from aria-label (e.g. aria-label="Session usage 29.8% used")
  // This handles the "Weekly limit reached" case where the visible text says
  // "Weekly limit reached" instead of "X% used" but the aria-label still has the percentage.
  const ariaMatch = slice.match(ARIA_PERCENTAGE_PATTERN)
  if (ariaMatch) return parseFloat(ariaMatch[1])

  return null
}

/**
 * Extracts a percentage value from an aria-label attribute in the HTML.
 * Used as a fallback when the visible text doesn't contain "X% used"
 * (e.g. "Weekly limit reached" instead of "29.8% used").
 * Searches for aria-label="Session usage X% used" or aria-label="Hourly usage X% used".
 */
function extractPercentageFromAriaLabel(html: string, label: string): null | number {
  const lowerLabel = label.toLowerCase()
  for (const match of html.matchAll(/aria-label="([^"]+)"/gi)) {
    const ariaText = match[1]
    if (ariaText.toLowerCase().startsWith(lowerLabel)) {
      const pctMatch = ariaText.match(PERCENTAGE_PATTERN)
      if (pctMatch) return parseFloat(pctMatch[1])
    }
  }
  return null
}

/** Extracts the plan name (Free/Pro/Enterprise/Team/Starter) from tag-stripped lines. */
function extractPlan(lines: string[]): null | string {
  for (const line of lines) {
    if (/^(Free|Pro|Enterprise|Team|Starter)\s*$/i.test(line)) {
      return line
    }
  }
  return null
}

/** Extracts the premium requests value from tag-stripped lines. */
function extractPremiumRequests(lines: string[]): null | string {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'Premium requests' && lines[i + 1]) {
      return lines[i + 1]
    }
  }
  return null
}

function extractResetTimes(html: string): ResetTime {
  const sessionStart = html.toLowerCase().indexOf('session usage')
  const hourlyStart = sessionStart === -1 ? html.toLowerCase().indexOf('hourly usage') : sessionStart
  const weeklyStart = html.toLowerCase().indexOf('weekly usage')

  const allTimes: IndexedValue[] = []
  for (const m of html.matchAll(RESET_TIME_PATTERN)) {
    allTimes.push({ index: m.index, value: m[1] })
  }

  const times = assignSessionWeekly(allTimes, hourlyStart, weeklyStart)

  const allLabels: IndexedValue[] = []
  for (const m of html.matchAll(RESETS_IN_PATTERN)) {
    allLabels.push({ index: m.index, value: m[1].trim() })
  }
  for (const m of html.matchAll(RESUMES_IN_PATTERN)) {
    allLabels.push({ index: m.index, value: m[1].trim() })
  }
  allLabels.sort((a, b) => a.index - b.index)

  const labels = assignSessionWeekly(allLabels, hourlyStart, weeklyStart)

  return {
    session: times.session,
    sessionLabel: labels.session,
    weekly: times.weekly,
    weeklyLabel: labels.weekly,
  }
}

/** Fetches Ollama quota data from the settings page. */
async function fetchQuota(cookie: string | undefined): Promise<QuotaResult> {
  const fetchedAt = Date.now()

  if (!cookie) {
    return { error: QuotaError.NoCookie, fetchedAt, ok: false }
  }

  const sanitizedCookie = cookie.replace(/[\r\n]/g, '')

  let response: Response
  try {
    response = await fetchSettingsPage(sanitizedCookie)
  } catch {
    return { error: QuotaError.Network, fetchedAt, ok: false }
  }

  if (!response.ok) {
    return { error: QuotaError.Network, fetchedAt, ok: false }
  }

  let html: string
  try {
    html = await response.text()
  } catch {
    return { error: QuotaError.Network, fetchedAt, ok: false }
  }

  const signedOut = SIGNED_OUT_MARKERS.some(marker => html.toLowerCase().includes(marker.toLowerCase()))
  if (signedOut) {
    return { error: QuotaError.SignedOut, fetchedAt, ok: false }
  }

  const parsed = parseQuotaHtml(html)

  if (parsed.session === null && parsed.weekly === null && parsed.plan === null && parsed.premiumRequests === null) {
    return { error: QuotaError.MissingData, fetchedAt, ok: false }
  }

  return {
    fetchedAt,
    models: parsed.models,
    ok: true,
    plan: parsed.plan,
    premiumRequests: parsed.premiumRequests,
    resetTime: parsed.resetTime,
    session: parsed.session,
    weekly: parsed.weekly,
    weeklyLimitReached: parsed.weeklyLimitReached,
  }
}

/** Fetches the Ollama settings page HTML with a timeout-bounded request. */
async function fetchSettingsPage(cookie: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(SETTINGS_URL, {
      headers: { Cookie: cookie },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Formats a quota result into a display-ready state for the sidebar/home. */
function formatDisplayState(quota?: QuotaResult): DisplayState {
  if (!quota) return { level: 'muted', text: 'Connect Ollama' }

  if (!quota.ok) {
    switch (quota.error) {
      case QuotaError.MissingData:
        return { level: 'warning', text: 'Missing Data' }
      case QuotaError.Network:
        return { level: 'error', text: 'Network Error' }
      case QuotaError.NoCookie:
        return { level: 'muted', text: 'No Cookie' }
      case QuotaError.SignedOut:
        return { level: 'muted', text: 'Signed Out' }
      default:
        return { level: 'error', text: 'Unknown Error' }
    }
  }

  if (quota.weeklyLimitReached) {
    const parts: string[] = []
    parts.push('Limit reached')
    if (quota.weekly !== null) parts.push(`${quota.weekly}% weekly`)
    return { level: 'warning', text: parts.join(' · ') }
  }

  const parts: string[] = []
  if (quota.session !== null) parts.push(`${quota.session}% session`)
  if (quota.weekly !== null) parts.push(`${quota.weekly}% weekly`)
  if (parts.length > 0) return { level: 'default', text: parts.join(' · ') }

  return { level: 'muted', text: 'Connect Ollama' }
}

/**
 * Parses raw HTML from the Ollama settings page into structured quota fields.
 * Returns `null` for any field that cannot be located.
 */
function parseQuotaHtml(html: string): ParsedQuota {
  const sessionLabel = html.toLowerCase().includes('session usage') ? 'Session usage' : 'Hourly usage'
  const sessionUsage = extractPercentage(html, sessionLabel) ?? extractPercentageFromAriaLabel(html, sessionLabel)
  const weeklyUsage = extractPercentage(html, 'Weekly usage') ?? extractPercentageFromAriaLabel(html, 'Weekly usage')

  const lines = html
    .split(/<[^>]+>/)
    .map(l => l.trim())
    .filter(Boolean)

  const premiumRequests = extractPremiumRequests(lines)
  const plan = extractPlan(lines)

  const sessionModels = extractModelSegments(html, sessionLabel)
  const weeklyModels = extractModelSegments(html, 'Weekly usage')
  const resetTime = extractResetTimes(html)

  const weeklyLimitReached = WEEKLY_LIMIT_REACHED_PATTERN.test(html)

  return {
    models: { session: sessionModels, weekly: weeklyModels },
    plan,
    premiumRequests,
    resetTime,
    session: sessionUsage,
    weekly: weeklyUsage,
    weeklyLimitReached,
  }
}

/** Parses a single segment button HTML string into a ModelSegment, or null if no model. */
function parseSegmentButton(btn: string): ModelSegment | null {
  const model = /data-model="([^"]*)"/.exec(btn)?.[1] ?? ''
  if (!model) return null

  const requests = parseInt(/data-requests="(\d+)"/.exec(btn)?.[1] ?? '0', 10)
  const style = /style="([^"]*)"/.exec(btn)?.[1] ?? ''
  const widthMatch = /width:\s*([0-9]+(?:\.[0-9]+)?)%/i.exec(style)
  const bgMatch = /background:\s*(#[0-9a-f]{3,8}|[a-z]+)/i.exec(style)

  return {
    color: bgMatch ? bgMatch[1].trim() : '',
    model,
    requests,
    widthPercent: widthMatch ? parseFloat(widthMatch[1]) : 0,
  }
}

// ---------------------------------------------------------------------------
// JSX Helpers (early-return pattern — no nested ternaries)
// ---------------------------------------------------------------------------

/** Renders a detail section (session or weekly) using early returns. */
function renderDetailSection(label: string, ctx: DetailCtx) {
  const { isLimitReached, models, resetLabel, theme } = ctx

  if (isLimitReached) {
    return (
      <box>
        <text fg={theme.warning}>Limit Reached</text>
        {resetLabel && <text fg={theme.textMuted}>Resumes in {resetLabel}</text>}
      </box>
    )
  }

  if (models.length > 0) {
    return (
      <box>
        {models.slice(0, MAX_MODELS_DISPLAY).map(seg => (
          <text fg={theme.text}>
            {seg.model}: {seg.requests} ({seg.widthPercent}%)
          </text>
        ))}
        {models.length > MAX_MODELS_DISPLAY && (
          <text fg={theme.textMuted}>+{models.length - MAX_MODELS_DISPLAY} more</text>
        )}
        {resetLabel && <text fg={theme.textMuted}>Resets in {resetLabel}</text>}
      </box>
    )
  }

  if (resetLabel) {
    return <text fg={theme.textMuted}>Resets in {resetLabel}</text>
  }

  return <></>
}

/** Renders the home bottom slot: a single header line with the current display state. */
function renderHomeBottom(ctx: TuiSlotContext, display: DisplayState, header: string) {
  const theme = ctx.theme
  const d = display
  return (
    <box paddingTop={2}>
      <text fg={resolveColor(d.level, theme.current)}>
        {header}: {d.text}
      </text>
    </box>
  )
}

/** Renders the sidebar content slot: header, usage lines, and detail sections. */
function renderSidebarContent(ctx: TuiSlotContext, q: QuotaResult | undefined, display: DisplayState, header: string) {
  const theme = ctx.theme
  const d = display

  if (shouldShowFallback(q)) {
    return (
      <box>
        <text fg={theme.current.text}>
          <b>{header}</b>
        </text>
        <text fg={resolveColor(d.level, theme.current)}>{d.text}</text>
      </box>
    )
  }

  const sectionColor = q.weeklyLimitReached ? theme.current.warning : theme.current.textMuted

  return (
    <box>
      <text fg={theme.current.text}>
        <b>{header}</b>
      </text>
      {renderUsageLines(q, theme.current)}

      {q.session !== null && (
        <box>
          <text fg={theme.current.textMuted} marginTop={1}>
            ─── Session ───
          </text>
          {renderDetailSection('Session', {
            isLimitReached: q.weeklyLimitReached,
            models: q.models.session,
            resetLabel: q.resetTime.sessionLabel,
            theme: theme.current,
          })}
        </box>
      )}

      {q.weekly !== null && (
        <box>
          <text fg={sectionColor} marginTop={1}>
            ─── Weekly ───
          </text>
          {renderDetailSection('Weekly', {
            isLimitReached: false,
            models: q.models.weekly,
            resetLabel: q.resetTime.weeklyLabel,
            theme: theme.current,
          })}
        </box>
      )}
    </box>
  )
}

/** Renders a usage summary line (limit-reached vs normal). */
function renderUsageLines(q: QuotaData & { ok: true }, theme: TuiThemeCurrent) {
  if (q.weeklyLimitReached) {
    return (
      <>
        {q.session !== null && <text fg={theme.warning}>• Limit reached</text>}
        {q.weekly !== null && <text fg={theme.warning}>• {q.weekly}% Weekly</text>}
      </>
    )
  }
  return (
    <>
      {q.session !== null && <text fg={theme.textMuted}>• {q.session}% Session</text>}
      {q.weekly !== null && <text fg={theme.textMuted}>• {q.weekly}% Weekly</text>}
    </>
  )
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/** Maps a display level to the corresponding theme color. */
function resolveColor(level: DisplayLevel, theme: TuiThemeCurrent) {
  switch (level) {
    case 'default':
      return theme.text
    case 'error':
      return theme.error
    case 'muted':
      return theme.textMuted
    case 'success':
      return theme.success
    case 'warning':
      return theme.warning
    default:
      return theme.text
  }
}

/** Resolves the refresh interval from the raw env string, falling back to the default. */
function resolveRefreshInterval(rawEnvValue: string): number {
  const parsed = Number(rawEnvValue)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REFRESH_INTERVAL_MS
}

/** Whether the quota result should show the fallback (non-data) view. */
function shouldShowFallback(
  q: QuotaResult | undefined,
): q is
  | (QuotaData & { ok: true; session: null; weekly: null })
  | undefined
  | { error: QuotaError; fetchedAt: number; ok: false } {
  if (!q) return true
  if (!q.ok) return true
  if (q.session === null && q.weekly === null) return true
  return false
}

function tui(devMode = false): TuiPlugin {
  return async api => {
    const cookie = process.env[ENV_COOKIE]
    const refreshIntervalMs = resolveRefreshInterval(process.env[ENV_REFRESH_INTERVAL] ?? '')

    const cached = api.kv.get<null | QuotaResult>(CACHE_KEY) ?? null

    const [quota, { refetch }] = createResource<QuotaResult>(() => fetchQuota(cookie), {
      initialValue: cached ?? undefined,
    })

    createEffect(() => {
      const q = quota()
      if (q?.ok) {
        api.kv.set(CACHE_KEY, q)
      }
    })

    const id = setInterval(refetch, refreshIntervalMs)
    api.lifecycle.onDispose(() => clearInterval(id))

    const result = (): QuotaResult | undefined => {
      const q = quota()
      if (q === undefined) {
        return cached ?? undefined
      }
      return q
    }

    const header = () => `⚡Ollama Usage ${devMode ? '(DEV mode)' : ''}`

    const display = (): DisplayState => formatDisplayState(result())

    api.slots.register({
      order: 900,
      slots: {
        home_bottom(ctx: TuiSlotContext) {
          return renderHomeBottom(ctx, display(), header())
        },
      },
    })

    api.slots.register({
      order: 150,
      slots: {
        sidebar_content(ctx: TuiSlotContext) {
          return renderSidebarContent(ctx, result(), display(), header())
        },
      },
    })
  }
}

const plugin: TuiPluginModule & { id: string } = {
  id: 'ollama.usage',
  tui: tui(),
}

export default plugin

export {
  extractModelSegments,
  extractPercentage,
  extractPercentageFromAriaLabel,
  extractResetTimes,
  fetchQuota,
  formatDisplayState,
  parseQuotaHtml,
  resolveColor,
  resolveRefreshInterval,
  shouldShowFallback,
  tui,
}
export { QuotaError }
export type {
  DisplayLevel,
  DisplayState,
  ModelBreakdown,
  ModelSegment,
  ParsedQuota,
  QuotaData,
  QuotaResult,
  ResetTime,
  TuiThemeCurrent,
}
