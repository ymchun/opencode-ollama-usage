/** @jsxImportSource @opentui/solid */
// CSpell:ignore ollama opencode opentui

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

/** HTML markers that indicate the user is signed out. */
const SIGNED_OUT_MARKERS = ['<form>', '/api/auth/signin', 'type="password"']

/** Regex to extract a percentage value (e.g. "42.5% used"). */
const PERCENTAGE_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*%\s*used/i

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Level of visual emphasis for display state text. */
type DisplayLevel = 'success' | 'warning' | 'error' | 'muted' | 'default'

/** Resolved display state with text and color level. */
type DisplayState = { level: DisplayLevel; text: string }

/** Domain-specific error codes for quota fetch failures. */
enum QuotaError {
  MissingData = 'missing_data',
  Network = 'network',
  NoCookie = 'no_cookie',
  ParseError = 'parse_error',
  SignedOut = 'signed_out',
}

/** Quota data extracted from the Ollama settings page. */
type QuotaData = {
  fetchedAt: number
  plan: string | null
  premiumRequests: string | null
  session: number | null
  weekly: number | null
}

/** Discriminated result: either successful data or an error. */
type QuotaResult = ({ ok: true } & QuotaData) | { ok: false; error: QuotaError; fetchedAt: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a display level to the corresponding theme color. */
function resolveColor(level: DisplayLevel, theme: TuiThemeCurrent) {
  switch (level) {
    case 'success':
      return theme.success
    case 'warning':
      return theme.warning
    case 'error':
      return theme.error
    case 'muted':
      return theme.textMuted
    case 'default':
      return theme.text
  }
}

// ---------------------------------------------------------------------------
// HTML Parsing
// ---------------------------------------------------------------------------

/**
 * Extracts a percentage value found near the given label in the HTML.
 * Returns `null` when the label or percentage is not found.
 */
function extractPercentage(html: string, label: string): number | null {
  const idx = html.toLowerCase().indexOf(label.toLowerCase())
  if (idx === -1) return null
  const slice = html.slice(idx, idx + PERCENTAGE_SLICE_LENGTH)
  const m = slice.match(PERCENTAGE_PATTERN)
  return m ? parseFloat(m[1]) : null
}

/**
 * Parses raw HTML from the Ollama settings page into structured quota fields.
 * Returns `null` for any field that cannot be located.
 */
function parseQuotaHtml(html: string): {
  plan: string | null
  premiumRequests: string | null
  session: number | null
  weekly: number | null
} {
  const sessionUsage = extractPercentage(html, 'Session usage') ?? extractPercentage(html, 'Hourly usage')
  const weeklyUsage = extractPercentage(html, 'Weekly usage')

  let premiumRequests: string | null = null
  let plan: string | null = null

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

  return { plan, premiumRequests, session: sessionUsage, weekly: weeklyUsage }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

/** Fetches Ollama quota data from the settings page. */
async function fetchQuota(): Promise<QuotaResult> {
  const fetchedAt = Date.now()

  const cookie = process.env[ENV_COOKIE]
  if (!cookie) {
    return { ok: false, error: QuotaError.NoCookie, fetchedAt }
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
    return { ok: false, error: QuotaError.Network, fetchedAt }
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    return { ok: false, error: QuotaError.Network, fetchedAt }
  }

  let html: string
  try {
    html = await response.text()
  } catch {
    return { ok: false, error: QuotaError.Network, fetchedAt }
  }

  const signedOut = SIGNED_OUT_MARKERS.some(marker => html.toLowerCase().includes(marker.toLowerCase()))
  if (signedOut) {
    return { ok: false, error: QuotaError.SignedOut, fetchedAt }
  }

  const parsed = parseQuotaHtml(html)

  if (parsed.session === null && parsed.weekly === null && parsed.plan === null && parsed.premiumRequests === null) {
    return { ok: false, error: QuotaError.MissingData, fetchedAt }
  }

  return {
    ok: true,
    fetchedAt,
    plan: parsed.plan,
    premiumRequests: parsed.premiumRequests,
    session: parsed.session,
    weekly: parsed.weekly,
  }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Formats a quota result into a display-ready state for the sidebar/home. */
function formatDisplayState(quota?: QuotaResult): DisplayState {
  if (!quota) return { level: 'muted', text: 'Connect Ollama' }

  if (!quota.ok) {
    switch (quota.error) {
      case QuotaError.NoCookie:
        return { level: 'muted', text: 'No Cookie' }
      case QuotaError.SignedOut:
        return { level: 'muted', text: 'Signed Out' }
      case QuotaError.MissingData:
        return { level: 'warning', text: 'Missing Data' }
      case QuotaError.ParseError:
        return { level: 'error', text: 'Parse Error' }
      case QuotaError.Network:
        return { level: 'error', text: 'Network Error' }
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
// Plugin
// ---------------------------------------------------------------------------

const tui: TuiPlugin = async api => {
  const cached = api.kv.get<QuotaResult | null>(CACHE_KEY) ?? null

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

  const display = (): DisplayState => formatDisplayState(result())

  api.slots.register({
    order: 900,
    slots: {
      home_bottom(ctx: TuiSlotContext) {
        const theme = ctx.theme
        const d = display()

        return (
          <box paddingTop={2}>
            <text fg={resolveColor(d.level, theme.current)}>⚡Ollama Usage: {d.text}</text>
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
                <b>⚡Ollama Usage</b>
              </text>
              <text fg={resolveColor(d.level, theme.current)}>{d.text}</text>
            </box>
          )
        }

        return (
          <box>
            <text fg={theme.current.text}>
              <b>⚡Ollama Usage</b>
            </text>
            {q.session !== null && <text fg={theme.current.textMuted}>• {q.session}% Session</text>}
            {q.weekly !== null && <text fg={theme.current.textMuted}>• {q.weekly}% Weekly</text>}
          </box>
        )
      },
    },
  })
}

/** OpenCode TUI plugin that displays Ollama quota usage. */
const plugin: TuiPluginModule & { id: string } = {
  id: 'ollama.usage',
  tui,
}

export default plugin
