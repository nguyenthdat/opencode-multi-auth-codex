import { formatLimitWindow, getTuiAccountSummary } from '../../src/tui-model.js'
import type { AccountCredentials, AccountStore } from '../../src/types.js'

const now = 1_700_000_000_000

function account(overrides: Partial<AccountCredentials> = {}): AccountCredentials {
  return {
    alias: 'personal',
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: now + 60_000,
    usageCount: 3,
    email: 'person@example.com',
    planType: 'plus',
    enabled: true,
    ...overrides
  }
}

function store(value: AccountCredentials, overrides: Partial<AccountStore> = {}): AccountStore {
  return {
    accounts: { [value.alias]: value },
    activeAlias: value.alias,
    rotationIndex: 0,
    lastRotation: now,
    ...overrides
  }
}

describe('TUI account summaries', () => {
  it('formats quota remaining as a percentage', () => {
    expect(formatLimitWindow({ limit: 100, remaining: 73 })).toBe('73% left')
    expect(formatLimitWindow(undefined)).toBe('unknown')
  })

  it('shows active account and quota details', () => {
    const value = account({
      rateLimits: {
        fiveHour: { limit: 100, remaining: 80 },
        weekly: { limit: 100, remaining: 45 }
      }
    })
    const summary = getTuiAccountSummary(value, store(value), now)

    expect(summary.status).toBe('active')
    expect(summary.description).toContain('person@example.com')
    expect(summary.description).toContain('5h 80% left')
    expect(summary.description).toContain('week 45% left')
  })

  it('prioritizes blocked and disabled states over active state', () => {
    const blocked = account({ rateLimitedUntil: now + 10_000 })
    expect(getTuiAccountSummary(blocked, store(blocked), now).status).toBe('rate limited')

    const disabled = account({ enabled: false, rateLimitedUntil: now + 10_000 })
    expect(getTuiAccountSummary(disabled, store(disabled), now).status).toBe('disabled')
  })

  it('shows Force Mode when the account is pinned', () => {
    const value = account()
    const summary = getTuiAccountSummary(
      value,
      store(value, {
        forcedAlias: value.alias,
        forcedUntil: now + 60_000
      }),
      now
    )

    expect(summary.status).toBe('forced')
  })
})
