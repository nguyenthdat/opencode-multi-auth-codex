import type { AccountCredentials, AccountStore, RateLimitWindow } from './types.js'

export interface TuiAccountSummary {
  status: string
  description: string
  fiveHour: string
  weekly: string
}

function isBlocked(until: number | null | undefined, now: number): boolean {
  return typeof until === 'number' && until > now
}

export function formatLimitWindow(window: RateLimitWindow | undefined): string {
  if (!window) return 'unknown'
  if (
    typeof window.remaining === 'number' &&
    typeof window.limit === 'number' &&
    window.limit > 0
  ) {
    return `${Math.max(0, Math.min(100, Math.round((window.remaining / window.limit) * 100)))}% left`
  }
  if (typeof window.remaining === 'number') {
    return `${Math.max(0, Math.round(window.remaining))} left`
  }
  return 'unknown'
}

export function getTuiAccountSummary(
  account: AccountCredentials,
  store: AccountStore,
  now: number = Date.now()
): TuiAccountSummary {
  const forceActive = store.forcedAlias === account.alias && isBlocked(store.forcedUntil, now)
  let status = 'ready'

  if (account.enabled === false) status = 'disabled'
  else if (account.authInvalid) status = 'auth invalid'
  else if (isBlocked(account.workspaceDeactivatedUntil, now)) status = 'workspace blocked'
  else if (isBlocked(account.rateLimitedUntil, now)) status = 'rate limited'
  else if (isBlocked(account.modelUnsupportedUntil, now)) status = 'model unsupported'
  else if (forceActive) status = 'forced'
  else if (store.activeAlias === account.alias) status = 'active'

  const fiveHour = formatLimitWindow(account.rateLimits?.fiveHour)
  const weekly = formatLimitWindow(account.rateLimits?.weekly)
  const identity = account.email || 'unknown email'
  const plan = account.planType || 'unknown plan'

  return {
    status,
    fiveHour,
    weekly,
    description: `${identity} | ${plan} | ${status} | 5h ${fiveHour} | week ${weekly}`
  }
}
