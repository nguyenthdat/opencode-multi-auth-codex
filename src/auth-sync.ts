import type { Auth } from '@opencode-ai/sdk'
import { addAccount, loadStore, updateAccount } from './store.js'
import { decodeJwtPayload, getAccountIdFromClaims, getEmailFromClaims } from './codex-auth.js'

const OPENAI_ISSUER = 'https://auth.openai.com'
const AUTH_SYNC_COOLDOWN_MS = 10_000

let lastSyncedAccess: string | null = null
let lastSyncAt = 0

async function fetchEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch(`${OPENAI_ISSUER}/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) return undefined
    const user = (await res.json()) as { email?: string }
    return user.email
  } catch {
    return undefined
  }
}

function findAccountAliasByToken(access: string, refresh?: string): string | null {
  const store = loadStore()
  for (const account of Object.values(store.accounts)) {
    if (account.accessToken === access) return account.alias
    if (refresh && account.refreshToken === refresh) return account.alias
  }
  return null
}

function findAccountAliasByEmail(
  email: string,
  store: ReturnType<typeof loadStore>
): string | null {
  for (const account of Object.values(store.accounts)) {
    if (account.email && account.email === email) return account.alias
  }
  return null
}

function buildAlias(email: string | undefined, existingAliases: Set<string>): string {
  const base = email ? email.split('@')[0] : 'account'
  let candidate = base || 'account'
  let suffix = 1
  while (existingAliases.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

export async function syncAuthFromOpenCode(getAuth: () => Promise<Auth>): Promise<void> {
  const now = Date.now()
  if (now - lastSyncAt < AUTH_SYNC_COOLDOWN_MS) return
  lastSyncAt = now

  let auth: Auth | null = null
  try {
    auth = await getAuth()
  } catch {
    return
  }

  if (!auth || auth.type !== 'oauth') return
  if (!auth.access) return
  if (auth.access === lastSyncedAccess) return

  lastSyncedAccess = auth.access

  const existingAlias = findAccountAliasByToken(auth.access, auth.refresh)
  const accessClaims = decodeJwtPayload(auth.access)
  const derivedEmail = getEmailFromClaims(accessClaims)
  const derivedAccountId = getAccountIdFromClaims(accessClaims)
  if (existingAlias) {
    updateAccount(existingAlias, {
      accessToken: auth.access,
      refreshToken: auth.refresh,
      expiresAt: auth.expires,
      email: derivedEmail,
      accountId: derivedAccountId
    })
    return
  }

  const store = loadStore()
  const email = (await fetchEmail(auth.access)) || derivedEmail
  if (email) {
    const existingByEmail = findAccountAliasByEmail(email, store)
    if (existingByEmail) {
      updateAccount(existingByEmail, {
        accessToken: auth.access,
        refreshToken: auth.refresh,
        expiresAt: auth.expires,
        email
      })
      return
    }
  }
  const alias = buildAlias(email, new Set(Object.keys(store.accounts)))

  addAccount(alias, {
    accessToken: auth.access,
    refreshToken: auth.refresh,
    expiresAt: auth.expires,
    email,
    accountId: derivedAccountId,
    source: 'opencode'
  })
}
