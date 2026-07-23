import {
  StrictMode,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useOptimistic,
  useRef,
  useState,
  type FormEvent
} from 'react'
import { createRoot } from 'react-dom/client'
import './dashboard.css'

type RotationStrategy = 'round-robin' | 'least-used' | 'random' | 'weighted-round-robin'
type LimitsConfidence = 'fresh' | 'stale' | 'error' | 'unknown'
type LimitStatus = 'idle' | 'queued' | 'running' | 'success' | 'error' | 'stopped'

type RateLimitWindow = {
  remaining?: number
  limit?: number
  resetAt?: number
  updatedAt?: number
}

type RateLimitHistoryEntry = {
  at: number
  fiveHour?: RateLimitWindow
  weekly?: RateLimitWindow
}

type DashboardAccount = {
  alias: string
  email?: string
  accountId?: string
  enabled?: boolean
  expiresAt?: number
  lastSeenAt?: number
  lastUsed?: number
  lastRefresh?: string
  usageCount?: number
  rateLimits?: {
    fiveHour?: RateLimitWindow
    weekly?: RateLimitWindow
  }
  rateLimitHistory?: RateLimitHistoryEntry[]
  limitsConfidence?: LimitsConfidence
  limitStatus?: LimitStatus
  limitError?: string
  tags?: string[]
  notes?: string
}

type LoginState = {
  alias?: string
  email?: string
  url?: string
  mode: 'manual' | 'auto'
  step?: string
  output?: string[]
}

type RefreshQueue = {
  running?: boolean
  stopped?: boolean
  completed: number
  total: number
  errors: number
  active?: number
  concurrency?: number
  currentAliases?: string[]
}

type AutoLoginAccount = {
  alias: string
  email: string
  enabled?: boolean
}

type ForceState = {
  active: boolean
  alias?: string | null
  forcedUntil?: number | null
  remainingMs?: number
  remainingTime?: string
}

type AntigravityModel = {
  modelId?: string
  label?: string
  remainingPercentage?: number
  resetTime?: string | number
  timeUntilResetFormatted?: string
}

type AntigravitySnapshot = {
  timestamp?: string | number
  email?: string
  promptCredits?: {
    available: number
    monthly: number
    remainingPercentage: number
  }
  models?: AntigravityModel[]
}

type AntigravityAccount = {
  index: number
  alias?: string
  projectId?: string
  managedProjectId?: string
  addedAt?: string | number
  lastUsed?: string | number
  hasRefreshToken?: boolean
  rateLimitResetTimes?: Record<string, string | number>
}

type AntigravityState = {
  path?: string
  error?: string
  activeIndex?: number
  readAt?: string | number
  accounts?: AntigravityAccount[]
  quota?: {
    status?: 'idle' | 'ok' | 'error' | 'disabled'
    scope?: 'active' | 'all'
    fetchedAt?: string | number
    error?: string
    snapshot?: AntigravitySnapshot
    perAccount?: Record<number, AntigravitySnapshot>
  }
}

type DashboardState = {
  authPath: string
  deviceAlias?: string | null
  accounts: DashboardAccount[]
  lastSyncAt?: number
  lastSyncError?: string | null
  lastSyncAlias?: string | null
  lastLoginError?: string | null
  authSummary?: { email?: string }
  storeStatus: {
    encrypted: boolean
    locked?: boolean
    error?: string
  }
  login?: LoginState | null
  queue?: RefreshQueue | null
  recommendedAlias?: string | null
  autoLogin?: {
    path?: string
    configured: boolean
    accounts: AutoLoginAccount[]
    error?: string
  }
  rotationStrategy?: RotationStrategy
  force?: ForceState
  antigravity?: AntigravityState
  featureFlags?: { antigravityEnabled?: boolean }
}

type LogsState = {
  path?: string
  lines?: string[]
}

type CreateAccountInput = {
  email: string
  password: string
  alias: string
  chatgptPassword: string
}

type TokenRefreshResponse = {
  results: Array<{ alias: string; updated: boolean; error?: string }>
}

const STRATEGY_HELP: Record<RotationStrategy, string> = {
  'round-robin': 'Cycle through enabled accounts in order.',
  'least-used': 'Prefer the enabled account with the lowest usage count.',
  random: 'Randomly pick from healthy accounts for each request.',
  'weighted-round-robin':
    'Split requests by account weights while skipping limited or disabled accounts.'
}

async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : String(payload || 'Request failed')
    throw new Error(message)
  }
  return payload as T
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatDate(value?: string | number | null): string {
  if (!value) return 'Unknown'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Unknown'
}

function formatRelative(value?: string | number | null): string {
  if (!value) return 'Unknown'
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'Unknown'
  const difference = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (difference < minute) return 'Just now'
  if (difference < hour) return `${Math.floor(difference / minute)}m ago`
  if (difference < day) return `${Math.floor(difference / hour)}h ago`
  return `${Math.floor(difference / day)}d ago`
}

function remainingPercent(window?: RateLimitWindow): number | null {
  if (
    !window ||
    typeof window.remaining !== 'number' ||
    typeof window.limit !== 'number' ||
    window.limit <= 0
  ) {
    return null
  }
  return Math.round((window.remaining / window.limit) * 100)
}

function sortAccounts(
  accounts: DashboardAccount[],
  mode: string,
  recommendedAlias?: string | null
): DashboardAccount[] {
  const result = [...accounts]
  const byAlias = (left: DashboardAccount, right: DashboardAccount) =>
    left.alias.localeCompare(right.alias)
  if (mode === 'fiveHour' || mode === 'weekly') {
    result.sort((left, right) => {
      const leftValue = remainingPercent(left.rateLimits?.[mode]) ?? -1
      const rightValue = remainingPercent(right.rateLimits?.[mode]) ?? -1
      return rightValue - leftValue
    })
  } else if (mode === 'expiry') {
    result.sort((left, right) => (left.expiresAt || 0) - (right.expiresAt || 0))
  } else if (mode === 'refresh') {
    result.sort((left, right) => {
      const leftTimestamp = Date.parse(left.lastRefresh || '')
      const rightTimestamp = Date.parse(right.lastRefresh || '')
      return (
        (Number.isFinite(rightTimestamp) ? rightTimestamp : 0) -
        (Number.isFinite(leftTimestamp) ? leftTimestamp : 0)
      )
    })
  } else if (mode === 'alias') {
    result.sort(byAlias)
  } else if (recommendedAlias) {
    result.sort((left, right) => {
      if (left.alias === recommendedAlias) return -1
      if (right.alias === recommendedAlias) return 1
      return byAlias(left, right)
    })
  }
  return result
}

function SwitchControl({
  checked,
  disabled,
  label,
  onChange
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`switch-control${checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden="true">
        <span />
      </span>
      <span className="switch-label">{label}</span>
    </button>
  )
}

function Sparkline({
  history,
  windowKey
}: {
  history?: RateLimitHistoryEntry[]
  windowKey: 'fiveHour' | 'weekly'
}) {
  const values = (history || [])
    .map((entry) => {
      const snapshot = entry[windowKey]
      const percent = remainingPercent(snapshot)
      return percent === null ? null : { at: entry.at, value: percent }
    })
    .filter((entry): entry is { at: number; value: number } => entry !== null)
    .slice(-20)

  if (values.length < 2) return <div className="sparkline empty">No history yet</div>

  const width = 120
  const height = 32
  const step = width / (values.length - 1)
  const points = values
    .map(
      (entry, index) =>
        `${(index * step).toFixed(1)},${(height - (entry.value / 100) * height).toFixed(1)}`
    )
    .join(' ')
  const current = values.at(-1)!
  const previous = values.at(-2)!
  const hours = (current.at - previous.at) / 3_600_000
  const rate = hours ? (current.value - previous.value) / hours : 0

  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <span>
        {rate > 0 ? '+' : ''}
        {rate.toFixed(1)}%/h
      </span>
    </div>
  )
}

function QuotaCard({
  label,
  window,
  history,
  windowKey,
  confidence
}: {
  label: string
  window?: RateLimitWindow
  history?: RateLimitHistoryEntry[]
  windowKey: 'fiveHour' | 'weekly'
  confidence?: LimitsConfidence
}) {
  const isKnown = Boolean(window) && confidence !== 'unknown'
  const percent = isKnown ? remainingPercent(window) : null
  const safePercent = Math.max(0, Math.min(100, percent || 0))
  const capacityClass =
    percent === null
      ? 'is-unknown'
      : safePercent <= 20
        ? 'is-critical'
        : safePercent <= 50
          ? 'is-warning'
          : 'is-healthy'
  const remaining =
    isKnown && window && typeof window.remaining === 'number'
      ? window.limit === 100
        ? `${window.remaining}%`
        : `${window.remaining} / ${window.limit ?? '-'}`
      : '--'

  return (
    <section className={`quota-card ${capacityClass}`} aria-label={`${label} quota`}>
      <div className="quota-heading">
        <span>{label}</span>
        {confidence && confidence !== 'fresh' && (
          <span className={`confidence confidence-${confidence}`}>{confidence}</span>
        )}
      </div>
      <div className="quota-value">
        <strong>{remaining}</strong>
        <span>remaining</span>
      </div>
      <div
        className="quota-meter"
        role="progressbar"
        aria-label={`${label} remaining`}
        aria-valuenow={percent === null ? undefined : safePercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${safePercent}%` }} />
      </div>
      <div className="quota-details">
        <span>
          Reset <strong>{formatDate(window?.resetAt)}</strong>
        </span>
        <span>
          Updated <strong>{formatRelative(window?.updatedAt)}</strong>
        </span>
      </div>
      <Sparkline history={history} windowKey={windowKey} />
    </section>
  )
}

function AccountCard({
  account,
  active,
  recommended,
  busyAction,
  onAction,
  onToggle,
  onSaveMeta
}: {
  account: DashboardAccount
  active: boolean
  recommended: boolean
  busyAction: string | null
  onAction: (
    alias: string,
    action: 'switch' | 'refresh-token' | 'refresh' | 'remove' | 'reauth'
  ) => Promise<void>
  onToggle: (alias: string, enabled: boolean) => Promise<void>
  onSaveMeta: (alias: string, tags: string, notes: string) => Promise<boolean>
}) {
  const enabled = account.enabled !== false
  const [optimisticEnabled, setOptimisticEnabled] = useOptimistic(
    enabled,
    (_current, next: boolean) => next
  )
  const [editing, setEditing] = useState(false)
  const [tags, setTags] = useState((account.tags || []).join(', '))
  const [notes, setNotes] = useState(account.notes || '')
  const headingId = useId()
  const status = account.limitStatus || 'idle'
  const monogram = account.alias.slice(0, 2).toUpperCase()
  const isBusy = (action: string) => busyAction === `${action}:${account.alias}`

  function toggleAccount(next: boolean) {
    startTransition(async () => {
      setOptimisticEnabled(next)
      await onToggle(account.alias, next)
    })
  }

  async function saveMetadata() {
    if (await onSaveMeta(account.alias, tags, notes)) setEditing(false)
  }

  function beginEditing() {
    setTags((account.tags || []).join(', '))
    setNotes(account.notes || '')
    setEditing(true)
  }

  return (
    <article
      className={`account-card${active ? ' is-active' : ''}${recommended ? ' is-recommended' : ''}${optimisticEnabled ? '' : ' is-disabled'}`}
      aria-labelledby={headingId}
    >
      <header className="account-header">
        <div className="account-identity">
          <span className="account-monogram" aria-hidden="true">
            {monogram}
          </span>
          <div>
            <h3 id={headingId}>{account.alias}</h3>
            <p title={account.email || account.accountId}>
              {account.email || account.accountId || 'Unknown account'}
            </p>
          </div>
        </div>
        <div className="badges">
          <span className={`badge ${active ? 'badge-active' : ''}`}>
            {active ? 'On device' : 'Stored'}
          </span>
          {recommended && <span className="badge badge-recommended">Recommended</span>}
          <span className={`badge badge-${status}`}>{status === 'success' ? 'OK' : status}</span>
        </div>
      </header>

      <dl className="account-facts">
        <div>
          <dt>Token expires</dt>
          <dd>{formatDate(account.expiresAt)}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{formatRelative(account.lastSeenAt || account.lastUsed)}</dd>
        </div>
        <div>
          <dt>Last refresh</dt>
          <dd>{formatRelative(account.lastRefresh)}</dd>
        </div>
        <div>
          <dt>Usage count</dt>
          <dd>{account.usageCount ?? 0}</dd>
        </div>
      </dl>

      {account.limitError && <div className="inline-alert">Limit error: {account.limitError}</div>}

      <div className="quota-grid">
        <QuotaCard
          label="5 hour"
          window={account.rateLimits?.fiveHour}
          history={account.rateLimitHistory}
          windowKey="fiveHour"
          confidence={account.limitsConfidence}
        />
        <QuotaCard
          label="Weekly"
          window={account.rateLimits?.weekly}
          history={account.rateLimitHistory}
          windowKey="weekly"
          confidence={account.limitsConfidence}
        />
      </div>

      <footer className="account-footer">
        <div className="tag-line">
          <div className="tags">
            {(account.tags || []).length > 0 ? (
              account.tags!.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))
            ) : (
              <span className="empty-copy">No tags</span>
            )}
          </div>
          <button
            type="button"
            className="button button-quiet button-small"
            disabled={busyAction !== null}
            onClick={() => (editing ? setEditing(false) : beginEditing())}
          >
            {editing ? 'Close editor' : 'Edit details'}
          </button>
        </div>

        {editing ? (
          <div className="meta-editor">
            <label>
              Tags
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="work, reserve"
              />
            </label>
            <label>
              Notes
              <textarea
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Account notes"
              />
            </label>
            <button
              type="button"
              className="button button-secondary"
              disabled={isBusy('meta')}
              onClick={() => void saveMetadata()}
            >
              {isBusy('meta') ? 'Saving...' : 'Save details'}
            </button>
          </div>
        ) : (
          <p className="account-notes">{account.notes || 'No notes yet.'}</p>
        )}

        <div className="account-control-row">
          <SwitchControl
            checked={optimisticEnabled}
            disabled={busyAction !== null}
            label={optimisticEnabled ? 'Enabled' : 'Disabled'}
            onChange={toggleAccount}
          />
          <button
            type="button"
            className="button button-secondary"
            aria-label={`Re-authenticate ${account.alias}`}
            disabled={!optimisticEnabled || busyAction !== null}
            onClick={() => void onAction(account.alias, 'reauth')}
          >
            {isBusy('reauth') ? 'Waiting for OAuth...' : 'Re-authenticate'}
          </button>
        </div>

        <div className="account-actions">
          <button
            type="button"
            className="button"
            aria-label={`Use ${account.alias} on device`}
            disabled={busyAction !== null}
            onClick={() => void onAction(account.alias, 'switch')}
          >
            {isBusy('switch') ? 'Switching...' : 'Use on device'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            aria-label={`Refresh token for ${account.alias}`}
            disabled={busyAction !== null}
            onClick={() => void onAction(account.alias, 'refresh-token')}
          >
            {isBusy('refresh-token') ? 'Refreshing...' : 'Refresh token'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            aria-label={`Refresh limits for ${account.alias}`}
            disabled={busyAction !== null}
            onClick={() => void onAction(account.alias, 'refresh')}
          >
            {isBusy('refresh') ? 'Queued...' : 'Refresh limits'}
          </button>
          <button
            type="button"
            className="button button-danger"
            aria-label={`Remove ${account.alias}`}
            disabled={busyAction !== null}
            onClick={() => void onAction(account.alias, 'remove')}
          >
            {isBusy('remove') ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </footer>
    </article>
  )
}

function Overview({ state }: { state: DashboardState }) {
  const storeLabel = state.storeStatus.encrypted
    ? state.storeStatus.locked
      ? 'Encrypted / locked'
      : 'Encrypted'
    : 'Plain'
  const autoLoginLabel = state.autoLogin?.configured
    ? `${state.autoLogin.accounts.length} configured`
    : state.autoLogin?.error || 'Not configured'
  const items = [
    ['Accounts', String(state.accounts.length)],
    ['On device', state.deviceAlias || 'None'],
    ['Recommended', state.recommendedAlias || 'Unavailable'],
    ['auth.json path', state.authPath],
    ['auth.json identity', state.authSummary?.email || 'Unknown'],
    ['Store', storeLabel],
    ['Last sync', state.lastSyncAt ? formatRelative(state.lastSyncAt) : 'Never'],
    ['Last synced alias', state.lastSyncAlias || 'None'],
    ['Auto-login', autoLoginLabel]
  ]

  return (
    <section className="overview-section" aria-labelledby="overview-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Fleet health</span>
          <h2 id="overview-title">Live account overview</h2>
        </div>
        <p>Local state, active identity, store health, and sync readiness.</p>
      </div>
      <div className="metric-grid">
        {items.map(([label, value], index) => (
          <article className={`metric-card metric-${index + 1}`} key={label} title={value}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

function QueueStatus({
  queue,
  onStop
}: {
  queue?: RefreshQueue | null
  onStop: () => Promise<unknown>
}) {
  if (!queue)
    return (
      <div className="command-status">
        <span className="status-dot" />
        No refresh activity
      </div>
    )
  const percent = queue.total > 0 ? Math.round((queue.completed / queue.total) * 100) : 0
  const current = queue.currentAliases?.length ? queue.currentAliases.join(', ') : 'None'
  return (
    <div className="queue-status">
      <div className="queue-copy">
        <strong>
          {queue.running
            ? 'Refreshing account limits'
            : queue.stopped
              ? 'Refresh stopped'
              : 'Refresh complete'}
        </strong>
        <span>
          {queue.completed}/{queue.total} complete / {queue.errors} errors / Parallel:{' '}
          {queue.active || 0}/{queue.concurrency || 0} / Current: {current}
        </span>
      </div>
      <div
        className="queue-progress"
        role="progressbar"
        aria-label="Limit refresh progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {queue.running && (
        <button
          type="button"
          className="button button-danger button-small"
          onClick={() => void onStop()}
        >
          Stop
        </button>
      )}
    </div>
  )
}

function CommandDeck({
  state,
  busyAction,
  onSync,
  onRefreshTokens,
  onRefreshLimits,
  onRefresh,
  onStartLogin,
  onStartAutoLogin,
  onStopQueue
}: {
  state: DashboardState
  busyAction: string | null
  onSync: () => Promise<unknown>
  onRefreshTokens: () => Promise<unknown>
  onRefreshLimits: () => Promise<unknown>
  onRefresh: () => Promise<unknown>
  onStartLogin: (alias: string) => Promise<unknown>
  onStartAutoLogin: (selector: string, force?: boolean) => Promise<unknown>
  onStopQueue: () => Promise<unknown>
}) {
  const [alias, setAlias] = useState('')
  const [selector, setSelector] = useState('')
  const autoAccounts = (state.autoLogin?.accounts || []).filter(
    (account) => account.enabled !== false
  )
  const loginBusy = Boolean(state.login)
  const selectorValid = autoAccounts.some((account) => account.email === selector)
  const controlsBusy = busyAction !== null || loginBusy

  return (
    <section className="panel command-panel" aria-labelledby="commands-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Command deck</span>
          <h2 id="commands-title">Sync and provision</h2>
        </div>
        <p>Bulk maintenance and local identity provisioning.</p>
      </div>
      <div className="command-actions">
        <button
          className="button"
          type="button"
          disabled={controlsBusy}
          onClick={() => void onSync()}
        >
          {busyAction === 'sync' ? 'Syncing...' : 'Sync auth.json'}
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={controlsBusy}
          onClick={() => void onRefreshTokens()}
        >
          {busyAction === 'tokens:all' ? 'Refreshing...' : 'Refresh all tokens'}
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={controlsBusy || Boolean(state.queue?.running)}
          onClick={() => void onRefreshLimits()}
        >
          {busyAction === 'limits:all' ? 'Queueing...' : 'Refresh all limits'}
        </button>
        <button
          className="button button-secondary"
          type="button"
          disabled={controlsBusy}
          onClick={() => void onRefresh()}
        >
          {busyAction === 'refresh' ? 'Refreshing...' : 'Refresh dashboard'}
        </button>
      </div>
      <form
        className="command-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onStartLogin(alias)
        }}
      >
        <label>
          <span>OAuth alias</span>
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="New account alias"
            disabled={loginBusy}
          />
        </label>
        <button className="button button-secondary" type="submit" disabled={controlsBusy}>
          {busyAction === 'login:start' ? 'Starting...' : 'Start OAuth'}
        </button>
      </form>
      <form
        className="command-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onStartAutoLogin(selector)
        }}
      >
        <label>
          <span>Saved credential</span>
          <select
            value={selectorValid ? selector : ''}
            onChange={(event) => setSelector(event.target.value)}
            disabled={!state.autoLogin?.configured || controlsBusy}
          >
            <option value="">Select auto-login account</option>
            {autoAccounts.map((account) => (
              <option value={account.email} key={account.email}>
                {account.alias} - {account.email}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button button-secondary"
          type="submit"
          disabled={!selectorValid || controlsBusy}
        >
          {busyAction === 'login:auto' ? 'Starting...' : 'Auto add'}
        </button>
        <button
          className="button button-quiet"
          type="button"
          disabled={!selectorValid || controlsBusy}
          onClick={() => void onStartAutoLogin(selector, true)}
        >
          Force update
        </button>
      </form>
      <QueueStatus queue={state.queue} onStop={onStopQueue} />
      {(state.lastSyncError || state.storeStatus.error) && (
        <div className="inline-alert">{state.lastSyncError || state.storeStatus.error}</div>
      )}
      {state.login && (
        <div className="login-progress">
          <span className="status-dot is-live" />
          <div>
            <strong>{state.login.mode === 'auto' ? 'Auto-login' : 'OAuth'} in progress</strong>
            <span>
              {state.login.email || state.login.alias || 'Account'} /{' '}
              {state.login.step || 'Waiting for authentication'}
            </span>
            {state.login.output && state.login.output.length > 0 && (
              <span className="login-output">{state.login.output.slice(-3).join(' / ')}</span>
            )}
          </div>
          {state.login.url && (
            <a href={state.login.url} target="_blank" rel="noreferrer">
              Open login
            </a>
          )}
        </div>
      )}
      {state.lastLoginError && !state.login && (
        <div className="inline-alert">Last login failed: {state.lastLoginError}</div>
      )}
    </section>
  )
}

function FilterBar({
  search,
  tags,
  sort,
  count,
  total,
  onSearch,
  onTags,
  onSort,
  onClear
}: {
  search: string
  tags: string
  sort: string
  count: number
  total: number
  onSearch: (value: string) => void
  onTags: (value: string) => void
  onSort: (value: string) => void
  onClear: () => void
}) {
  return (
    <section className="filter-bar" aria-label="Account filters">
      <label className="search-field">
        <span>Search</span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Alias, email, tags, notes"
        />
      </label>
      <label>
        <span>Tags</span>
        <input
          value={tags}
          onChange={(event) => onTags(event.target.value)}
          placeholder="primary, work"
        />
      </label>
      <label>
        <span>Sort</span>
        <select value={sort} onChange={(event) => onSort(event.target.value)}>
          <option value="recommended">Recommended first</option>
          <option value="fiveHour">5 hour remaining</option>
          <option value="weekly">Weekly remaining</option>
          <option value="expiry">Expiry soon</option>
          <option value="refresh">Last refresh</option>
          <option value="alias">Alias</option>
        </select>
      </label>
      <div className="filter-summary">
        <span>
          {count} visible / {total} total
        </span>
        <button type="button" className="button button-quiet" onClick={onClear}>
          Clear
        </button>
      </div>
    </section>
  )
}

function ForcePanel({
  state,
  busyAction,
  onActivate,
  onClear,
  onStrategy
}: {
  state: DashboardState
  busyAction: string | null
  onActivate: (alias: string) => Promise<boolean>
  onClear: () => Promise<boolean>
  onStrategy: (strategy: RotationStrategy) => Promise<boolean>
}) {
  const force = state.force || { active: false }
  const strategy = state.rotationStrategy || 'round-robin'
  const [arming, setArming] = useState(false)
  const [selectedAlias, setSelectedAlias] = useState('')
  const enabledAccounts = state.accounts.filter((account) => account.enabled !== false)

  async function toggleForce(next: boolean) {
    if (!next) {
      setArming(false)
      if (force.active && !(await onClear())) setArming(true)
      return
    }
    setArming(true)
  }

  async function activate(alias: string) {
    setSelectedAlias(alias)
    if (!alias) return
    if (await onActivate(alias)) {
      setArming(false)
      setSelectedAlias('')
    }
  }

  return (
    <section className="panel force-panel" aria-labelledby="force-title">
      <div className="force-copy">
        <span className="eyebrow">Routing override</span>
        <h2 id="force-title">Force Mode</h2>
        <p>
          {force.active
            ? `Pinned to ${force.alias || 'an account'} for ${force.remainingTime || 'the active window'}.`
            : 'Temporarily pin every request to one account for up to 24 hours.'}
        </p>
      </div>
      <div className="force-controls">
        <SwitchControl
          checked={force.active || arming}
          disabled={busyAction !== null}
          label={
            force.active
              ? `On / ${force.remainingTime || 'active'}`
              : arming
                ? 'Choose account'
                : 'Off'
          }
          onChange={(next) => void toggleForce(next)}
        />
        {arming && !force.active && (
          <select
            aria-label="Account to force"
            value={selectedAlias}
            onChange={(event) => void activate(event.target.value)}
            disabled={busyAction !== null}
          >
            <option value="">Select account</option>
            {enabledAccounts.map((account) => (
              <option value={account.alias} key={account.alias}>
                {account.alias}
              </option>
            ))}
          </select>
        )}
        <label>
          <span>Rotation strategy</span>
          <select
            value={strategy}
            disabled={busyAction !== null || force.active}
            onChange={(event) => void onStrategy(event.target.value as RotationStrategy)}
          >
            {Object.keys(STRATEGY_HELP).map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="strategy-note">
        <strong>{strategy}</strong>
        <span>
          {STRATEGY_HELP[strategy]}{' '}
          {force.active
            ? 'Paused; clearing Force Mode restores the pre-force strategy.'
            : 'Active now.'}
        </span>
      </div>
    </section>
  )
}

function AntigravityPanel({
  state,
  busyAction,
  onRefresh,
  onRefreshActive,
  onRefreshAll,
  onCopy
}: {
  state: DashboardState
  busyAction: string | null
  onRefresh: () => Promise<unknown>
  onRefreshActive: () => Promise<unknown>
  onRefreshAll: () => Promise<unknown>
  onCopy: (value: string, success: string) => Promise<void>
}) {
  if (!state.featureFlags?.antigravityEnabled) return null
  const antigravity = state.antigravity || {}
  const accounts = antigravity.accounts || []
  const quota = antigravity.quota || {}
  const active = accounts.find((account) => account.index === antigravity.activeIndex)
  const snapshot = quota.snapshot

  return (
    <section className="panel antigravity-panel" aria-labelledby="antigravity-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Experimental provider</span>
          <h2 id="antigravity-title">Antigravity accounts</h2>
          <p>{antigravity.path || 'Account path unavailable'}</p>
        </div>
        <div className="compact-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={busyAction !== null}
            onClick={() => void onRefresh()}
          >
            Refresh state
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={busyAction !== null}
            onClick={() => void onRefreshActive()}
          >
            Refresh active
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={busyAction !== null}
            onClick={() => void onRefreshAll()}
          >
            Refresh all
          </button>
          <button
            className="button button-quiet"
            type="button"
            onClick={() => void onCopy(antigravity.path || '', 'Path copied')}
          >
            Copy path
          </button>
          <button
            className="button button-quiet"
            type="button"
            onClick={() => void onCopy('opencode auth login', 'Command copied')}
          >
            Copy reauth
          </button>
        </div>
      </div>
      <div className="ag-metrics">
        <article>
          <span>Total</span>
          <strong>{accounts.length}</strong>
        </article>
        <article>
          <span>Active</span>
          <strong>{active?.alias || (active ? `#${active.index}` : 'None')}</strong>
        </article>
        <article>
          <span>Last read</span>
          <strong>{formatRelative(antigravity.readAt)}</strong>
        </article>
        <article>
          <span>Quota status</span>
          <strong>{quota.status || 'Idle'}</strong>
        </article>
      </div>
      {(antigravity.error || quota.error) && (
        <div className="inline-alert">{antigravity.error || quota.error}</div>
      )}
      {snapshot && (
        <div className="ag-quota-grid">
          {snapshot.promptCredits && (
            <QuotaSummary
              label="Prompt credits"
              value={`${snapshot.promptCredits.available} / ${snapshot.promptCredits.monthly}`}
              percent={snapshot.promptCredits.remainingPercentage}
            />
          )}
          {(snapshot.models || []).map((model) => {
            const percent =
              typeof model.remainingPercentage === 'number' ? model.remainingPercentage : undefined
            const reset =
              model.timeUntilResetFormatted ||
              (model.resetTime ? formatDate(model.resetTime) : 'Unknown reset')
            return (
              <QuotaSummary
                key={model.modelId || model.label}
                label={model.label || model.modelId || 'Model'}
                value={percent === undefined ? 'Unknown' : `${Math.round(percent)}%`}
                percent={percent}
                detail={reset}
              />
            )
          })}
        </div>
      )}
      <div className="ag-account-grid">
        {accounts.map((account) => {
          const accountQuota = quota.perAccount?.[account.index]
          return (
            <article
              className={`ag-account${account.index === antigravity.activeIndex ? ' is-active' : ''}`}
              key={account.index}
            >
              <header>
                <strong>{account.alias || `#${account.index}`}</strong>
                <span>
                  {account.index === antigravity.activeIndex
                    ? 'Active'
                    : account.hasRefreshToken
                      ? 'Stored'
                      : 'Missing token'}
                </span>
              </header>
              <dl>
                <div>
                  <dt>Project</dt>
                  <dd>{account.projectId || 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Managed</dt>
                  <dd>{account.managedProjectId || 'None'}</dd>
                </div>
                <div>
                  <dt>Added</dt>
                  <dd>{formatRelative(account.addedAt)}</dd>
                </div>
                <div>
                  <dt>Last used</dt>
                  <dd>{formatRelative(account.lastUsed)}</dd>
                </div>
                <div>
                  <dt>Quota update</dt>
                  <dd>{accountQuota ? formatRelative(accountQuota.timestamp) : 'Not loaded'}</dd>
                </div>
                {accountQuota?.promptCredits && (
                  <div>
                    <dt>Prompt credits</dt>
                    <dd>
                      {accountQuota.promptCredits.available} / {accountQuota.promptCredits.monthly}
                    </dd>
                  </div>
                )}
                {accountQuota?.models?.slice(0, 3).map((model) => (
                  <div key={model.modelId || model.label}>
                    <dt>{model.label || model.modelId || 'Model'}</dt>
                    <dd>
                      {typeof model.remainingPercentage === 'number'
                        ? `${Math.round(model.remainingPercentage)}%`
                        : 'Unknown'}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function QuotaSummary({
  label,
  value,
  percent,
  detail
}: {
  label: string
  value: string
  percent?: number
  detail?: string
}) {
  const safePercent = Math.max(0, Math.min(100, percent || 0))
  return (
    <article className="ag-quota">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
      <div
        role={percent === undefined ? undefined : 'progressbar'}
        aria-label={percent === undefined ? undefined : `${label} remaining`}
        aria-valuenow={percent === undefined ? undefined : safePercent}
        aria-valuemin={percent === undefined ? undefined : 0}
        aria-valuemax={percent === undefined ? undefined : 100}
      >
        <span style={{ width: `${safePercent}%` }} />
      </div>
    </article>
  )
}

function LogsPanel({ logs, onRefresh }: { logs: LogsState; onRefresh: () => Promise<void> }) {
  return (
    <section className="panel logs-panel" aria-labelledby="logs-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Runtime telemetry</span>
          <h2 id="logs-title">Logs</h2>
          <p>{logs.path || 'Log path unavailable'}</p>
        </div>
        <button type="button" className="button button-secondary" onClick={() => void onRefresh()}>
          Refresh logs
        </button>
      </div>
      <pre>{logs.lines?.join('\n') || 'No logs yet.'}</pre>
    </section>
  )
}

function CreateAccountModal({
  open,
  busy,
  login,
  lastError,
  trackedEmail,
  onClose,
  onSubmit
}: {
  open: boolean
  busy: boolean
  login?: LoginState | null
  lastError?: string | null
  trackedEmail: string
  onClose: () => void
  onSubmit: (input: CreateAccountInput) => Promise<boolean>
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alias, setAlias] = useState('')
  const [chatgptPassword, setChatgptPassword] = useState('')

  useEffect(() => {
    document.body.classList.toggle('modal-open', open)
    return () => document.body.classList.remove('modal-open')
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    dialog.showModal()
    emailRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])

  if (!open) return null

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password.trim()) return
    if (await onSubmit({ email: email.trim(), password, alias: alias.trim(), chatgptPassword })) {
      setPassword('')
      setChatgptPassword('')
    }
  }

  const status = login
    ? `${login.mode === 'auto' ? 'Auto-login' : 'OAuth'}: ${login.step || 'Waiting for authentication'}`
    : lastError && trackedEmail
      ? `Add failed: ${lastError}`
      : trackedEmail
        ? 'Account saved locally. Complete any verification in the browser.'
        : 'Credentials stay in the local auto-login configuration.'

  return (
    <dialog
      ref={dialogRef}
      className="modal-backdrop"
      aria-labelledby="create-account-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="modal">
        <header>
          <div>
            <span className="eyebrow">Local provisioning</span>
            <h2 id="create-account-title">Add account</h2>
          </div>
          <button type="button" className="button button-quiet" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>Login / email</span>
            <input
              ref={emailRef}
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              disabled={busy}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Account password"
              disabled={busy}
            />
          </label>
          <label>
            <span>Alias (optional)</span>
            <input
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              placeholder="Local alias"
              disabled={busy}
            />
          </label>
          <label>
            <span>ChatGPT password (optional)</span>
            <input
              type="password"
              value={chatgptPassword}
              onChange={(event) => setChatgptPassword(event.target.value)}
              placeholder="Password override"
              disabled={busy}
            />
          </label>
          <div className="modal-status">
            <span className={`status-dot${login ? ' is-live' : ''}`} />
            {status}
          </div>
          {login?.url && (
            <a href={login.url} target="_blank" rel="noreferrer">
              Open login manually
            </a>
          )}
          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="button"
              disabled={busy || !email.trim() || !password.trim()}
            >
              {busy ? 'Adding...' : 'Add and log in'}
            </button>
          </div>
        </form>
      </section>
    </dialog>
  )
}

function App() {
  const [state, setState] = useState<DashboardState | null>(null)
  const [logs, setLogs] = useState<LogsState>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [tags, setTags] = useState('')
  const [sort, setSort] = useState('recommended')
  const [modalOpen, setModalOpen] = useState(false)
  const [trackedEmail, setTrackedEmail] = useState('')
  const stateRequestId = useRef(0)
  const deferredSearch = useDeferredValue(search)
  const deferredTags = useDeferredValue(tags)
  const pollInterval = state?.queue?.running || state?.login ? 2_000 : 5_000

  async function requestDashboardState(): Promise<DashboardState | null> {
    const requestId = ++stateRequestId.current
    try {
      const nextState = await api<DashboardState>('/api/state')
      if (requestId !== stateRequestId.current) return null
      startTransition(() => {
        setState(nextState)
        setLoadError(null)
      })
      return nextState
    } catch (error) {
      if (requestId === stateRequestId.current) setLoadError(errorMessage(error))
      throw error
    }
  }

  const pollDashboard = useEffectEvent(async () => {
    if (document.hidden) return
    try {
      await requestDashboardState()
    } catch {
      // Keep the most recent successful state visible while the connection recovers.
    }
  })

  const loadLogsOnMount = useEffectEvent(async () => {
    try {
      setLogs(await api<LogsState>('/api/logs'))
    } catch {
      setLogs({ lines: ['No logs yet.'] })
    }
  })

  useEffect(() => {
    void pollDashboard()
    const timer = window.setInterval(() => void pollDashboard(), pollInterval)
    const onVisibility = () => {
      if (!document.hidden) void pollDashboard()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [pollInterval])

  useEffect(() => {
    void loadLogsOnMount()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2_600)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function refreshDashboard(): Promise<DashboardState | null> {
    return requestDashboardState()
  }

  async function refreshLogs(showConfirmation = true) {
    try {
      setLogs(await api<LogsState>('/api/logs'))
      if (showConfirmation) setToast('Logs refreshed')
    } catch (error) {
      setToast(`Logs: ${errorMessage(error)}`)
    }
  }

  async function runMutation(
    key: string,
    success: string,
    request: () => Promise<unknown>
  ): Promise<boolean> {
    setBusyAction(key)
    try {
      await request()
    } catch (error) {
      setToast(errorMessage(error))
      setBusyAction(null)
      return false
    }

    try {
      await refreshDashboard()
      setToast(success)
    } catch (error) {
      setToast(`${success}. State refresh failed: ${errorMessage(error)}`)
    } finally {
      setBusyAction(null)
    }
    return true
  }

  async function handleAccountAction(
    alias: string,
    action: 'switch' | 'refresh-token' | 'refresh' | 'remove' | 'reauth'
  ) {
    if (action === 'remove' && !window.confirm(`Remove ${alias} from the local account store?`))
      return
    if (action === 'reauth') {
      const previousRefresh = state?.accounts.find(
        (account) => account.alias === alias
      )?.lastRefresh
      const authWindow = window.open('about:blank', '_blank')
      if (authWindow) authWindow.opener = null
      setBusyAction(`reauth:${alias}`)
      try {
        const result = await api<{ url?: string }>(
          `/api/accounts/${encodeURIComponent(alias)}/reauth`,
          {
            method: 'POST',
            body: JSON.stringify({ actor: 'dashboard' })
          }
        )
        if (result.url && authWindow) authWindow.location.replace(result.url)
        else authWindow?.close()
        setToast('OAuth flow opened')
        for (let attempt = 0; attempt < 150; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2_000))
          const nextState = await refreshDashboard()
          if (!nextState) continue
          const refreshed = nextState.accounts.find(
            (account) => account.alias === alias
          )?.lastRefresh
          if (refreshed && refreshed !== previousRefresh) {
            setToast('Re-authentication complete')
            return
          }
        }
        setToast('Re-authentication timed out. Check logs.')
      } catch (error) {
        authWindow?.close()
        setToast(errorMessage(error))
      } finally {
        setBusyAction(null)
      }
      return
    }

    if (action === 'refresh-token') {
      await runMutation(`refresh-token:${alias}`, 'Token refreshed', async () => {
        const result = await api<TokenRefreshResponse>('/api/token/refresh', {
          method: 'POST',
          body: JSON.stringify({ alias })
        })
        const failure = result.results.find(
          (entry) => entry.alias === alias && (!entry.updated || entry.error)
        )
        if (failure) throw new Error(failure.error || `Token refresh failed for ${alias}`)
      })
      return
    }

    const endpoints = {
      switch: ['/api/switch', 'Using account on device'],
      refresh: ['/api/limits/refresh', 'Limit refresh queued'],
      remove: ['/api/remove', 'Account removed']
    } as const
    const [endpoint, success] = endpoints[action]
    await runMutation(`${action}:${alias}`, success, () =>
      api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ alias })
      })
    )
  }

  async function handleToggle(alias: string, enabled: boolean) {
    await runMutation(`toggle:${alias}`, enabled ? 'Account enabled' : 'Account disabled', () =>
      api(`/api/accounts/${encodeURIComponent(alias)}/enabled`, {
        method: 'PUT',
        body: JSON.stringify({ enabled })
      })
    )
  }

  async function handleSaveMeta(alias: string, nextTags: string, notes: string) {
    return runMutation(`meta:${alias}`, 'Account details saved', () =>
      api('/api/account/meta', {
        method: 'POST',
        body: JSON.stringify({ alias, tags: nextTags, notes })
      })
    )
  }

  async function handleCreateAccount(input: CreateAccountInput) {
    setTrackedEmail(input.email)
    return runMutation('account:create', 'Account add started', () =>
      api('/api/auto-login/add', {
        method: 'POST',
        body: JSON.stringify(input)
      })
    )
  }

  async function handleCopy(value: string, success: string) {
    if (!value) {
      setToast('Nothing to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setToast(success)
    } catch {
      setToast('Copy failed')
    }
  }

  if (!state) {
    return (
      <main className="loading-screen">
        <span className="loading-mark">CA</span>
        <div>
          <span className="eyebrow">Local control plane</span>
          <h1>Loading account fleet</h1>
          <p>{loadError || 'Reading local account and quota state...'}</p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void refreshDashboard()}
        >
          Retry
        </button>
      </main>
    )
  }

  const searchNeedle = deferredSearch.trim().toLowerCase()
  const tagNeedles = deferredTags
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
  const filteredAccounts = sortAccounts(
    state.accounts.filter((account) => {
      const accountTags = (account.tags || []).map((tag) => tag.toLowerCase())
      const haystack = [
        account.alias,
        account.email,
        account.accountId,
        account.notes,
        ...(account.tags || [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return (
        (!searchNeedle || haystack.includes(searchNeedle)) &&
        (tagNeedles.length === 0 || tagNeedles.some((tag) => accountTags.includes(tag)))
      )
    }),
    sort,
    state.recommendedAlias
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">CA</span>
          <div>
            <span className="eyebrow">Auth fleet / Local control</span>
            <h1>Codex account control</h1>
            <p>Quota, credentials, and routing without sending control data off-device.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span
            className={`local-status${loadError ? ' has-error' : ''}`}
            title={loadError || 'Connected to the local dashboard server'}
          >
            <span className={`status-dot${loadError ? '' : ' is-live'}`} />
            {loadError ? 'Connection interrupted' : 'Local only'}
          </span>
          <button
            type="button"
            className="button"
            disabled={Boolean(state.login)}
            onClick={() => {
              setTrackedEmail('')
              setModalOpen(true)
            }}
          >
            Add account
          </button>
        </div>
      </header>

      <main className="dashboard">
        {loadError && (
          <div className="connection-alert" role="alert">
            <strong>Dashboard updates paused.</strong>
            <span>{loadError}</span>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => void refreshDashboard()}
            >
              Retry
            </button>
          </div>
        )}
        <Overview state={state} />
        <CommandDeck
          state={state}
          busyAction={busyAction}
          onSync={() =>
            runMutation('sync', 'auth.json synced', () =>
              api('/api/sync', { method: 'POST', body: '{}' })
            )
          }
          onRefreshTokens={() =>
            runMutation('tokens:all', 'All tokens refreshed', async () => {
              const result = await api<TokenRefreshResponse>('/api/token/refresh', {
                method: 'POST',
                body: '{}'
              })
              const failures = result.results.filter((entry) => !entry.updated || entry.error)
              if (failures.length > 0)
                throw new Error(
                  `${failures.length} of ${result.results.length} token refreshes failed: ${failures[0].error || failures[0].alias}`
                )
            })
          }
          onRefreshLimits={() =>
            runMutation('limits:all', 'Limit refresh queued', () =>
              api('/api/limits/refresh', { method: 'POST', body: '{}' })
            )
          }
          onRefresh={() => runMutation('refresh', 'Dashboard refreshed', async () => undefined)}
          onStartLogin={(alias) =>
            runMutation('login:start', 'OAuth flow opened', async () => {
              const selectedAlias = alias.trim() || `account-${Date.now()}`
              const authWindow = window.open('about:blank', '_blank')
              if (authWindow) authWindow.opener = null
              try {
                const result = await api<{ url?: string }>('/api/auth/start', {
                  method: 'POST',
                  body: JSON.stringify({ alias: selectedAlias })
                })
                if (result.url && authWindow) authWindow.location.replace(result.url)
                else authWindow?.close()
              } catch (error) {
                authWindow?.close()
                throw error
              }
            })
          }
          onStartAutoLogin={(selector, force = false) =>
            runMutation(
              'login:auto',
              force ? 'Forced auto-login started' : 'Auto-login started',
              () =>
                api('/api/auto-login/start', {
                  method: 'POST',
                  body: JSON.stringify({ selector, force })
                })
            )
          }
          onStopQueue={() =>
            runMutation('queue:stop', 'Stopping refresh queue', () =>
              api('/api/limits/stop', { method: 'POST', body: '{}' })
            )
          }
        />

        <section className="accounts-section" aria-labelledby="accounts-title">
          <div className="section-heading accounts-heading">
            <div>
              <span className="eyebrow">Identity roster</span>
              <h2 id="accounts-title">Account fleet</h2>
            </div>
            <p>Inspect quota health and route work to the right identity.</p>
          </div>
          <FilterBar
            search={search}
            tags={tags}
            sort={sort}
            count={filteredAccounts.length}
            total={state.accounts.length}
            onSearch={setSearch}
            onTags={setTags}
            onSort={setSort}
            onClear={() => {
              setSearch('')
              setTags('')
              setSort('recommended')
            }}
          />
          <div className="account-grid">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((account) => (
                <AccountCard
                  key={account.alias}
                  account={account}
                  active={account.alias === state.deviceAlias}
                  recommended={account.alias === state.recommendedAlias}
                  busyAction={busyAction}
                  onAction={handleAccountAction}
                  onToggle={handleToggle}
                  onSaveMeta={handleSaveMeta}
                />
              ))
            ) : state.accounts.length === 0 ? (
              <div className="empty-state">
                <span>No accounts yet</span>
                <p>Add an account or sync auth.json to start managing the fleet.</p>
              </div>
            ) : (
              <div className="empty-state">
                <span>No matching accounts</span>
                <p>Adjust the search or tag filters to restore the roster.</p>
              </div>
            )}
          </div>
        </section>

        <ForcePanel
          state={state}
          busyAction={busyAction}
          onActivate={(alias) =>
            runMutation('force', `Force Mode enabled for ${alias}`, () =>
              api('/api/force', {
                method: 'POST',
                body: JSON.stringify({ alias, actor: 'dashboard' })
              })
            )
          }
          onClear={() =>
            runMutation('force', 'Force Mode disabled', () =>
              api('/api/force/clear', { method: 'POST' })
            )
          }
          onStrategy={(rotationStrategy) =>
            runMutation('strategy', `Strategy set to ${rotationStrategy}`, () =>
              api('/api/settings', {
                method: 'PUT',
                body: JSON.stringify({ rotationStrategy, actor: 'dashboard' })
              })
            )
          }
        />

        <AntigravityPanel
          state={state}
          busyAction={busyAction}
          onRefresh={refreshDashboard}
          onRefreshActive={() =>
            runMutation('ag:active', 'Antigravity quota refreshed', () =>
              api('/api/antigravity/refresh', { method: 'POST', body: '{}' })
            )
          }
          onRefreshAll={() =>
            runMutation('ag:all', 'All Antigravity quotas refreshed', () =>
              api('/api/antigravity/refresh-all', { method: 'POST', body: '{}' })
            )
          }
          onCopy={handleCopy}
        />

        <LogsPanel logs={logs} onRefresh={() => refreshLogs(true)} />
      </main>

      <CreateAccountModal
        open={modalOpen}
        busy={busyAction === 'account:create' || Boolean(state.login)}
        login={state.login}
        lastError={state.lastLoginError}
        trackedEmail={trackedEmail}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateAccount}
      />
      <div className={`toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Dashboard root element not found')
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
