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
const SEGMENT_BUTTON_PATTERN = /<button[^>]+data-usage-segment[^>]*>/g
const RESET_TIME_PATTERN = /data-time="([^"]*)"/g
const RESETS_IN_PATTERN = /Resets in\s+([^<]*)/gi

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Domain-specific error codes for quota fetch failures. */
enum QuotaError {
  MissingData = 'missing_data',
  Network = 'network',
  NoCookie = 'no_cookie',
  ParseError = 'parse_error',
  SignedOut = 'signed_out',
}

/** Level of visual emphasis for display state text. */
type DisplayLevel = 'default' | 'error' | 'muted' | 'success' | 'warning'

/** Resolved display state with text and color level. */
type DisplayState = { level: DisplayLevel; text: string }

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
}

type QuotaData = {
  fetchedAt: number
  models: ModelBreakdown
  plan: null | string
  premiumRequests: null | string
  resetTime: ResetTime
  session: null | number
  weekly: null | number
}

/** Discriminated result: either successful data or an error. */
type QuotaResult = (QuotaData & { ok: true }) | { error: QuotaError; fetchedAt: number; ok: false }

type ResetTime = {
  session: null | string
  sessionLabel: null | string
  weekly: null | string
  weeklyLabel: null | string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractModelSegments(html: string, sectionLabel: string): ModelSegment[] {
  const sectionStart = html.toLowerCase().indexOf(sectionLabel.toLowerCase())
  if (sectionStart === -1) return []

  const nextSectionLabel = sectionLabel.toLowerCase().includes('session') ? 'weekly usage' : null
  const sectionEnd = nextSectionLabel ? html.toLowerCase().indexOf(nextSectionLabel, sectionStart + 1) : html.length

  const sectionHtml = html.slice(sectionStart, sectionEnd === -1 ? html.length : sectionEnd)

  SEGMENT_BUTTON_PATTERN.lastIndex = 0
  const segments: ModelSegment[] = []
  let btnMatch: null | RegExpExecArray
  while ((btnMatch = SEGMENT_BUTTON_PATTERN.exec(sectionHtml)) !== null) {
    const btn = btnMatch[0]
    const model = /data-model="([^"]*)"/.exec(btn)?.[1] ?? ''
    const requests = parseInt(/data-requests="(\d+)"/.exec(btn)?.[1] ?? '0', 10)
    const styleMatch = /style="([^"]*)"/.exec(btn)
    const style = styleMatch?.[1] ?? ''
    const widthMatch = /width:\s*([0-9]+(?:\.[0-9]+)?)%/i.exec(style)
    const bgMatch = /background:\s*(#[0-9a-f]{3,8}|[a-z]+)/i.exec(style)
    const widthPercent = widthMatch ? parseFloat(widthMatch[1]) : 0
    const color = bgMatch ? bgMatch[1].trim() : ''
    if (model) {
      segments.push({ color, model, requests, widthPercent })
    }
  }
  return segments.sort((a, b) => b.requests - a.requests)
}

// ---------------------------------------------------------------------------
// HTML Parsing
// ---------------------------------------------------------------------------

/**
 * Extracts a percentage value found near the given label in the HTML.
 * Returns `null` when the label or percentage is not found.
 */
function extractPercentage(html: string, label: string): null | number {
  const idx = html.toLowerCase().indexOf(label.toLowerCase())
  if (idx === -1) return null
  const slice = html.slice(idx, idx + PERCENTAGE_SLICE_LENGTH)
  const m = slice.match(PERCENTAGE_PATTERN)
  return m ? parseFloat(m[1]) : null
}

function extractResetTimes(html: string): ResetTime {
  const sessionStart = html.toLowerCase().indexOf('session usage')
  const hourlyStart = sessionStart === -1 ? html.toLowerCase().indexOf('hourly usage') : sessionStart
  const weeklyStart = html.toLowerCase().indexOf('weekly usage')

  let session: null | string = null
  let sessionLabel: null | string = null
  let weekly: null | string = null
  let weeklyLabel: null | string = null

  RESET_TIME_PATTERN.lastIndex = 0
  const allTimes: { index: number; time: string }[] = []
  let m: null | RegExpExecArray
  while ((m = RESET_TIME_PATTERN.exec(html)) !== null) {
    allTimes.push({ index: m.index, time: m[1] })
  }

  if (allTimes.length >= 1) {
    const sessionTime = allTimes[0]
    if (
      hourlyStart !== -1 &&
      sessionTime.index > hourlyStart &&
      (weeklyStart === -1 || sessionTime.index < weeklyStart)
    ) {
      session = sessionTime.time
    }
    if (hourlyStart === -1 && weeklyStart !== -1 && sessionTime.index < weeklyStart) {
      session = sessionTime.time
    }
  }

  if (allTimes.length >= 2) {
    weekly = allTimes[1].time
  } else if (allTimes.length === 1 && weeklyStart !== -1 && allTimes[0].index > weeklyStart) {
    weekly = allTimes[0].time
    session = null
  }

  RESETS_IN_PATTERN.lastIndex = 0
  const allLabels: { index: number; label: string }[] = []
  while ((m = RESETS_IN_PATTERN.exec(html)) !== null) {
    allLabels.push({ index: m.index, label: m[1].trim() })
  }

  if (allLabels.length >= 1) {
    const sessionLabelMatch = allLabels[0]
    if (
      hourlyStart !== -1 &&
      sessionLabelMatch.index > hourlyStart &&
      (weeklyStart === -1 || sessionLabelMatch.index < weeklyStart)
    ) {
      sessionLabel = sessionLabelMatch.label
    }
    if (hourlyStart === -1 && weeklyStart !== -1 && sessionLabelMatch.index < weeklyStart) {
      sessionLabel = sessionLabelMatch.label
    }
  }

  if (allLabels.length >= 2) {
    weeklyLabel = allLabels[1].label
  } else if (allLabels.length === 1 && weeklyStart !== -1 && allLabels[0].index > weeklyStart) {
    weeklyLabel = allLabels[0].label
    sessionLabel = null
  }

  return { session, sessionLabel, weekly, weeklyLabel }
}

/** Fetches Ollama quota data from the settings page. */
async function fetchQuota(): Promise<QuotaResult> {
  const fetchedAt = Date.now()

  const cookie = process.env[ENV_COOKIE]
  if (!cookie) {
    return { error: QuotaError.NoCookie, fetchedAt, ok: false }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(SETTINGS_URL, {
      headers: { Cookie: cookie },
      signal: controller.signal,
    })
  } catch {
    clearTimeout(timeoutId)
    return { error: QuotaError.Network, fetchedAt, ok: false }
  }
  clearTimeout(timeoutId)

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
      case QuotaError.ParseError:
        return { level: 'error', text: 'Parse Error' }
      case QuotaError.SignedOut:
        return { level: 'muted', text: 'Signed Out' }
      default:
        return { level: 'error', text: 'Unknown Error' }
    }
  }

  const parts: string[] = []
  if (quota.session !== null) parts.push(`${quota.session}% session`)
  if (quota.weekly !== null) parts.push(`${quota.weekly}% weekly`)
  if (parts.length > 0) return { level: 'default', text: parts.join(' · ') }

  return { level: 'muted', text: 'Connect Ollama' }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/**
 * Parses raw HTML from the Ollama settings page into structured quota fields.
 * Returns `null` for any field that cannot be located.
 */
function parseQuotaHtml(html: string): ParsedQuota {
  const sessionUsage = extractPercentage(html, 'Session usage') ?? extractPercentage(html, 'Hourly usage')
  const weeklyUsage = extractPercentage(html, 'Weekly usage')

  let premiumRequests: null | string = null
  let plan: null | string = null

  const lines = html
    .split(/<[^>]+>/)
    .map(l => l.trim())
    .filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'Premium requests' && lines[i + 1]) {
      premiumRequests = lines[i + 1]
    }
  }

  for (const line of lines) {
    if (/^(Free|Pro|Enterprise|Team|Starter)\s*$/i.test(line) && !plan) {
      plan = line
    }
  }

  const sectionLabel = html.toLowerCase().includes('session usage') ? 'Session usage' : 'Hourly usage'
  const sessionModels = extractModelSegments(html, sectionLabel)
  const weeklyModels = extractModelSegments(html, 'Weekly usage')
  const resetTime = extractResetTimes(html)

  return {
    models: { session: sessionModels, weekly: weeklyModels },
    plan,
    premiumRequests,
    resetTime,
    session: sessionUsage,
    weekly: weeklyUsage,
  }
}

// ---------------------------------------------------------------------------
// Display
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
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const tui: (devMode?: boolean) => TuiPlugin =
  (devMode = false) =>
  async api => {
    const cached = api.kv.get<null | QuotaResult>(CACHE_KEY) ?? null

    const [quota, { refetch }] = createResource<QuotaResult>(fetchQuota, {
      initialValue: cached ?? undefined,
    })

    createEffect(() => {
      const q = quota()
      if (q?.ok) {
        api.kv.set(CACHE_KEY, q)
      }
    })

    const rawInterval = Number(process.env[ENV_REFRESH_INTERVAL] ?? '')
    const intervalMs = Number.isFinite(rawInterval) && rawInterval > 0 ? rawInterval : DEFAULT_REFRESH_INTERVAL_MS
    const id = setInterval(refetch, intervalMs)
    api.lifecycle.onDispose(() => clearInterval(id))

    const result = (): QuotaResult | undefined => {
      const q = quota()
      if (q === undefined) {
        return cached ?? undefined
      }
      return q
    }

    const printPluginHeader = () => `⚡Ollama Usage ${devMode ? '(DEV mode)' : ''}`

    const display = (): DisplayState => formatDisplayState(result())

    api.slots.register({
      order: 900,
      slots: {
        home_bottom(ctx: TuiSlotContext) {
          const theme = ctx.theme
          const d = display()

          return (
            <box paddingTop={2}>
              <text fg={resolveColor(d.level, theme.current)}>
                {printPluginHeader()}: {d.text}
              </text>
            </box>
          )
        },
      },
    })

    api.slots.register({
      order: 150,
      slots: {
        sidebar_content(ctx: TuiSlotContext) {
          const theme = ctx.theme
          const q = result()
          const d = display()

          if (!q?.ok || (q.ok && q.session === null && q.weekly === null)) {
            return (
              <box>
                <text fg={theme.current.text}>
                  <b>{printPluginHeader()}</b>
                </text>
                <text fg={resolveColor(d.level, theme.current)}>{d.text}</text>
              </box>
            )
          }

          const hasSessionData = q.session !== null
          const hasWeeklyData = q.weekly !== null
          const hasSessionModels = q.models.session.length > 0
          const hasWeeklyModels = q.models.weekly.length > 0

          return (
            <box>
              <text fg={theme.current.text}>
                <b>{printPluginHeader()}</b>
              </text>
              {hasSessionData && <text fg={theme.current.textMuted}>• {q.session}% Session</text>}
              {hasWeeklyData && <text fg={theme.current.textMuted}>• {q.weekly}% Weekly</text>}

              {hasSessionData && (
                <box>
                  <text fg={theme.current.textMuted} marginTop={1}>
                    ─── Session ───
                  </text>
                  {hasSessionModels ? (
                    <box>
                      {q.models.session.slice(0, MAX_MODELS_DISPLAY).map(seg => (
                        <text fg={theme.current.text}>
                          {seg.model}: {seg.requests} ({seg.widthPercent}%)
                        </text>
                      ))}
                      {q.models.session.length > MAX_MODELS_DISPLAY && (
                        <text fg={theme.current.textMuted}>+{q.models.session.length - MAX_MODELS_DISPLAY} more</text>
                      )}
                      {q.resetTime.sessionLabel && (
                        <text fg={theme.current.textMuted}>Resets in {q.resetTime.sessionLabel}</text>
                      )}
                    </box>
                  ) : q.resetTime.sessionLabel ? (
                    <text fg={theme.current.textMuted}>Resets in {q.resetTime.sessionLabel}</text>
                  ) : null}
                </box>
              )}

              {hasWeeklyData && (
                <box>
                  <text fg={theme.current.textMuted} marginTop={1}>
                    ─── Weekly ───
                  </text>
                  {hasWeeklyModels ? (
                    <box>
                      {q.models.weekly.slice(0, MAX_MODELS_DISPLAY).map(seg => (
                        <text fg={theme.current.text}>
                          {seg.model}: {seg.requests} ({seg.widthPercent}%)
                        </text>
                      ))}
                      {q.models.weekly.length > MAX_MODELS_DISPLAY && (
                        <text fg={theme.current.textMuted}>+{q.models.weekly.length - MAX_MODELS_DISPLAY} more</text>
                      )}
                      {q.resetTime.weeklyLabel && (
                        <text fg={theme.current.textMuted}>Resets in {q.resetTime.weeklyLabel}</text>
                      )}
                    </box>
                  ) : q.resetTime.weeklyLabel ? (
                    <text fg={theme.current.textMuted}>Resets in {q.resetTime.weeklyLabel}</text>
                  ) : null}
                </box>
              )}
            </box>
          )
        },
      },
    })
  }

const plugin: TuiPluginModule & { id: string } = {
  id: 'ollama.usage',
  tui: tui(),
}

export default plugin

export { extractModelSegments, extractResetTimes, formatDisplayState, parseQuotaHtml, tui }
export { QuotaError }
export type { DisplayLevel, DisplayState, ModelBreakdown, ModelSegment, ParsedQuota, QuotaData, QuotaResult, ResetTime }
