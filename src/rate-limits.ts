import type { AccountRateLimits, RateLimitWindow } from './types.js'

type RateLimitUpdate = AccountRateLimits

const WINDOW_PATTERNS: Array<{ key: keyof AccountRateLimits; patterns: string[] }> = [
  { key: 'fiveHour', patterns: ['5h', '5hr', '5hour', '5hours', '5-hour'] },
  { key: 'weekly', patterns: ['week', 'weekly', '1w', '7d', '7day', '7days', '7-day', '1-week'] }
]

function parseNumber(value: string): number | undefined {
  const match = value.match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined
  const num = Number(match[0])
  if (Number.isNaN(num)) return undefined
  return num
}

function parseReset(value: string, now: number): number | undefined {
  const num = parseNumber(value)
  if (num === undefined) return undefined
  if (num > 1e12) return num
  if (num > 1e9) return num * 1000
  return now + num * 1000
}

function parseTimestamp(value: string): number | undefined {
  const num = parseNumber(value)
  if (num !== undefined) {
    if (num > 1e12) return num
    if (num > 1e9) return num * 1000
  }
  const parsed = Date.parse(value)
  if (!Number.isNaN(parsed)) return parsed
  return undefined
}

function parseHumanDate(value: string): number | undefined {
  const normalized = value
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .trim()
  const parsed = Date.parse(normalized)
  if (!Number.isNaN(parsed)) return parsed
  return undefined
}

function matchWindowKey(headerName: string): keyof AccountRateLimits | null {
  for (const entry of WINDOW_PATTERNS) {
    if (entry.patterns.some((pattern) => headerName.includes(pattern))) {
      return entry.key
    }
  }
  return null
}

function ensureWindow(update: RateLimitUpdate, key: keyof AccountRateLimits, now: number): RateLimitWindow {
  if (!update[key]) {
    update[key] = { updatedAt: now }
  } else if (!update[key]?.updatedAt) {
    update[key] = { ...update[key], updatedAt: now }
  }
  return update[key] as RateLimitWindow
}

export function hasMeaningfulRateLimitWindow(window: RateLimitWindow | undefined): boolean {
  if (!window) return false
  return (
    typeof window.remaining === 'number' ||
    typeof window.resetAt === 'number'
  )
}

export function hasMeaningfulRateLimits(rateLimits: AccountRateLimits | undefined | null): boolean {
  if (!rateLimits) return false
  return (
    hasMeaningfulRateLimitWindow(rateLimits.fiveHour) ||
    hasMeaningfulRateLimitWindow(rateLimits.weekly)
  )
}

export function extractRateLimitUpdate(headers: Headers): RateLimitUpdate | null {
  const update: RateLimitUpdate = {}
  const now = Date.now()

  for (const [rawName, value] of headers.entries()) {
    const name = rawName.toLowerCase()
    if (name.startsWith('x-codex-')) {
      if (name.startsWith('x-codex-primary-') || name.startsWith('x-codex-secondary-')) {
        const windowKey = name.startsWith('x-codex-primary-') ? 'fiveHour' : 'weekly'
        const window = ensureWindow(update, windowKey, now)

        if (name.endsWith('used-percent')) {
          const usedPercent = parseNumber(value)
          if (usedPercent !== undefined) {
            const remaining = Math.max(0, 100 - usedPercent)
            window.limit = 100
            window.remaining = remaining
          }
          continue
        }

        if (name.endsWith('reset-at')) {
          const resetAt = parseTimestamp(value)
          if (resetAt !== undefined) window.resetAt = resetAt
          continue
        }

        if (name.endsWith('window-minutes')) {
          // Window length is informational; not shown in UI yet.
          continue
        }
      }
      continue
    }

    if (name.startsWith('x-ratelimit-')) {
      const windowKey = matchWindowKey(name)
      if (!windowKey) continue

      const window = ensureWindow(update, windowKey, now)
      if (name.includes('limit')) {
        const limit = parseNumber(value)
        if (limit !== undefined) window.limit = limit
        continue
      }
      if (name.includes('remaining')) {
        const remaining = parseNumber(value)
        if (remaining !== undefined) window.remaining = remaining
        continue
      }
      if (name.includes('reset')) {
        const resetAt = parseReset(value, now)
        if (resetAt !== undefined) window.resetAt = resetAt
      }
    }
  }

  return hasMeaningfulRateLimits(update) ? update : null
}

export function mergeRateLimits(
  existing: AccountRateLimits | undefined,
  update: RateLimitUpdate
): AccountRateLimits {
  if (!hasMeaningfulRateLimits(update)) {
    return existing || {}
  }
  return {
    fiveHour: { ...(existing?.fiveHour || {}), ...(update.fiveHour || {}) },
    weekly: { ...(existing?.weekly || {}), ...(update.weekly || {}) }
  }
}

export function parseRetryAfterHeader(
  retryAfter: string | null,
  now: number = Date.now()
): number | undefined {
  if (!retryAfter) return undefined
  const trimmed = retryAfter.trim()
  if (!trimmed) return undefined

  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return now + asNumber * 1000
  }

  const asDate = Date.parse(trimmed)
  if (!Number.isNaN(asDate)) return asDate
  return undefined
}

export function parseRateLimitResetFromError(
  text: string,
  now: number = Date.now()
): number | undefined {
  if (!text) return undefined

  const retryAfterMatch = text.match(/(?:retry[\s-]*after|try again in)\s*(\d+)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)\b/i)
  if (retryAfterMatch) {
    const amount = Number(retryAfterMatch[1])
    const unit = retryAfterMatch[2].toLowerCase()
    if (Number.isFinite(amount) && amount >= 0) {
      if (unit.startsWith('h')) return now + amount * 60 * 60 * 1000
      if (unit.startsWith('m')) return now + amount * 60 * 1000
      return now + amount * 1000
    }
  }

  const tryAgainAtMatch = text.match(/try again at\s+([^\n.]+)/i)
  if (tryAgainAtMatch?.[1]) {
    const resetAt = parseHumanDate(tryAgainAtMatch[1])
    if (resetAt !== undefined) return resetAt
  }

  return undefined
}

export function isRateLimitErrorText(text: string): boolean {
  if (!text) return false
  const normalized = text.toLowerCase()
  return (
    normalized.includes('rate limit') ||
    normalized.includes('usage limit') ||
    normalized.includes("you've hit your usage limit") ||
    normalized.includes('too many requests') ||
    normalized.includes('try again at') ||
    normalized.includes('retry after')
  )
}

export function getBlockingRateLimitResetAt(
  rateLimits: AccountRateLimits | undefined,
  now: number = Date.now(),
  opts?: { conservativeWhenRemainingUnknown?: boolean }
): number | undefined {
  if (!rateLimits) return undefined

  const windows: Array<RateLimitWindow | undefined> = [
    rateLimits.fiveHour,
    rateLimits.weekly
  ]

  const exhaustedResets: number[] = []
  const futureResets: number[] = []
  let sawKnownRemaining = false

  for (const window of windows) {
    if (!window || typeof window.resetAt !== 'number' || window.resetAt <= now) {
      continue
    }
    futureResets.push(window.resetAt)
    if (typeof window.remaining === 'number') {
      sawKnownRemaining = true
      if (window.remaining <= 0) {
        exhaustedResets.push(window.resetAt)
      }
    }
  }

  if (exhaustedResets.length > 0) {
    // If multiple windows are exhausted, wait for the last one to reset.
    return Math.max(...exhaustedResets)
  }
  if (opts?.conservativeWhenRemainingUnknown && futureResets.length > 0 && !sawKnownRemaining) {
    // Conservative fallback when backend says limited but remaining counters are absent.
    return Math.max(...futureResets)
  }
  return undefined
}
