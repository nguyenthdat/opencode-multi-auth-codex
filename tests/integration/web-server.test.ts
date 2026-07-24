import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type * as http from 'node:http'
import { once } from 'node:events'

const SANDBOX_ROOT = path.join(os.tmpdir(), 'oma-web-integration-sandbox')
const STORE_FILE = path.join(SANDBOX_ROOT, 'accounts.json')
const AUTH_FILE = path.join(SANDBOX_ROOT, 'auth.json')
const AUTO_LOGIN_CREDENTIALS_FILE = path.join(SANDBOX_ROOT, 'credentials.json')
const originalEnv = process.env

let startWebConsole: typeof import('../../src/web.js').startWebConsole
let getCodexAuthPath: typeof import('../../src/codex-auth.js').getCodexAuthPath

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to resolve free port'))
        return
      }
      const port = address.port
      server.close((err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(port)
      })
    })
    server.on('error', reject)
  })
}

async function closeServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

beforeAll(async () => {
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
  }
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ OPENAI_API_KEY: null, tokens: {} }, null, 2))
  fs.writeFileSync(
    AUTO_LOGIN_CREDENTIALS_FILE,
    JSON.stringify(
      {
        accounts: [
          { alias: 'saved-login', email: 'existing@example.com', chatgpt_password: 'placeholder' }
        ]
      },
      null,
      2
    )
  )
  fs.writeFileSync(
    STORE_FILE,
    JSON.stringify(
      {
        version: 2,
        accounts: {
          'codex-01': {
            alias: 'codex-01',
            email: 'existing@example.com',
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 60_000,
            usageCount: 0
          }
        },
        activeAlias: 'codex-01',
        rotationIndex: 0,
        lastRotation: Date.now()
      },
      null,
      2
    )
  )

  process.env = {
    ...originalEnv,
    OPENCODE_MULTI_AUTH_STORE_DIR: SANDBOX_ROOT,
    OPENCODE_MULTI_AUTH_STORE_FILE: STORE_FILE,
    OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE: AUTH_FILE,
    OPENCODE_MULTI_AUTH_AUTO_LOGIN_CREDENTIALS_FILE: AUTO_LOGIN_CREDENTIALS_FILE
  }

  ;({ startWebConsole } = await import('../../src/web.js'))
  ;({ getCodexAuthPath } = await import('../../src/codex-auth.js'))
})

afterAll(() => {
  try {
    if (getCodexAuthPath) {
      fs.unwatchFile(getCodexAuthPath())
    }
  } catch {
    // ignore
  }
  process.env = originalEnv
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true })
  }
})

describe('web server hardening', () => {
  it('rejects non-loopback host binding', () => {
    expect(() => startWebConsole({ host: '0.0.0.0', port: 4120 })).toThrow(
      /LOCALHOST_ONLY|localhost/i
    )
  })

  it('returns 400 for invalid JSON and keeps server alive', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')

      const invalidResponse = await fetch(`http://127.0.0.1:${port}/api/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json'
      })

      expect(invalidResponse.status).toBe(400)
      const invalidPayload = (await invalidResponse.json()) as { code?: string }
      expect(invalidPayload.code).toBe('INVALID_JSON')

      const healthyResponse = await fetch(`http://127.0.0.1:${port}/api/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })

      expect(healthyResponse.status).toBe(400)
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('rejects hostile Host and Origin headers', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')

      const hostResponse = await fetch(`http://127.0.0.1:${port}/`, {
        headers: { Host: `attacker.example:${port}` }
      })
      expect(hostResponse.status).toBe(403)

      const originResponse = await fetch(`http://127.0.0.1:${port}/api/limits/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://attacker.example'
        },
        body: '{}'
      })
      expect(originResponse.status).toBe(403)
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('skips dashboard auto-login when the email already exists', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/auto-login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector: 'EXISTING@example.com' })
      })

      expect(response.status).toBe(409)
      const payload = (await response.json()) as { code?: string; alias?: string; error?: string }
      expect(payload.code).toBe('AUTO_LOGIN_ACCOUNT_EXISTS')
      expect(payload.alias).toBe('codex-01')
      expect(payload.error).toContain('force')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('reports whether an account has a matching enabled auto-login credential', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/state`)

      expect(response.status).toBe(200)
      const payload = (await response.json()) as {
        accounts?: Array<{ alias?: string; autoLoginAvailable?: boolean }>
      }
      expect(payload.accounts?.find((account) => account.alias === 'codex-01')).toMatchObject({
        autoLoginAvailable: true
      })

      const serialized = JSON.stringify(payload)
      expect(serialized).not.toContain('chatgpt_password')
      expect(serialized).not.toContain('placeholder')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('does not rewrite saved credentials when auto-add email already exists', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })
    const before = fs.readFileSync(AUTO_LOGIN_CREDENTIALS_FILE, 'utf-8')

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/api/auto-login/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'EXISTING@example.com',
          password: 'replacement-password',
          alias: 'replacement-alias'
        })
      })

      expect(response.status).toBe(409)
      const payload = (await response.json()) as { code?: string }
      expect(payload.code).toBe('AUTO_LOGIN_ACCOUNT_EXISTS')
      expect(fs.readFileSync(AUTO_LOGIN_CREDENTIALS_FILE, 'utf-8')).toBe(before)
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })

  it('applies validated bulk account edits, lifecycle changes, and removals', async () => {
    const originalStore = fs.readFileSync(STORE_FILE, 'utf-8')
    const runtimeAuthFile = getCodexAuthPath()
    const originalAuth = fs.readFileSync(runtimeAuthFile, 'utf-8')
    const fixtureAccount = (alias: string) => ({
      alias,
      email: `${alias}@example.com`,
      accessToken: `${alias}-access`,
      refreshToken: `${alias}-refresh`,
      expiresAt: Date.now() + 60_000,
      usageCount: 0,
      tags: alias === 'alpha' ? ['existing'] : undefined
    })
    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify(
        {
          version: 2,
          accounts: {
            alpha: fixtureAccount('alpha'),
            beta: fixtureAccount('beta'),
            gamma: fixtureAccount('gamma'),
            delta: {
              ...fixtureAccount('delta'),
              enabled: false,
              disabledAt: 1760000000000,
              disabledBy: 'operator'
            }
          },
          activeAlias: 'alpha',
          rotationIndex: 0,
          lastRotation: Date.now()
        },
        null,
        2
      )
    )
    fs.writeFileSync(
      runtimeAuthFile,
      JSON.stringify(
        {
          OPENAI_API_KEY: null,
          tokens: {
            access_token: 'alpha-access',
            refresh_token: 'alpha-refresh'
          }
        },
        null,
        2
      )
    )

    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })
    const bulk = (body: Record<string, unknown>) =>
      fetch(`http://127.0.0.1:${port}/api/accounts/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

    try {
      await once(server, 'listening')

      const editResponse = await bulk({
        aliases: ['alpha', 'beta'],
        action: 'edit',
        tagOperation: 'add',
        tags: 'Work, Bulk',
        updateNotes: true,
        notes: 'Needs review'
      })
      expect(editResponse.status).toBe(200)

      const disableResponse = await bulk({ aliases: ['alpha', 'delta'], action: 'disable' })
      expect(disableResponse.status).toBe(200)

      const unknownResponse = await bulk({ aliases: ['alpha', 'missing'], action: 'enable' })
      expect(unknownResponse.status).toBe(404)

      const malformedResponse = await bulk({ aliases: ['alpha', 42], action: 'enable' })
      expect(malformedResponse.status).toBe(400)

      const inheritedAliasResponse = await bulk({
        aliases: ['alpha', 'constructor'],
        action: 'remove'
      })
      expect(inheritedAliasResponse.status).toBe(404)

      const removeResponse = await bulk({ aliases: ['beta'], action: 'remove' })
      expect(removeResponse.status).toBe(200)

      const activeRemoveResponse = await bulk({ aliases: ['alpha'], action: 'remove' })
      expect(activeRemoveResponse.status).toBe(200)

      const stateResponse = await fetch(`http://127.0.0.1:${port}/api/state`)
      const statePayload = (await stateResponse.json()) as {
        accounts: Array<{ alias: string }>
      }
      expect(statePayload.accounts.some((account) => account.alias === 'alpha')).toBe(false)

      const accountsResponse = await fetch(`http://127.0.0.1:${port}/api/accounts`)
      const accountsPayload = (await accountsResponse.json()) as {
        accounts: Array<{ alias: string; enabled?: boolean }>
      }
      const enabledAliases = accountsPayload.accounts
        .filter((account) => account.enabled !== false)
        .map((account) => account.alias)
      const disableLastResponse = await bulk({ aliases: enabledAliases, action: 'disable' })
      expect(disableLastResponse.status).toBe(409)

      const stored = JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as {
        accounts: Record<string, { enabled?: boolean; tags?: string[]; notes?: string }>
        activeAlias: string | null
      }
      expect(stored.accounts.alpha).toBeUndefined()
      expect(stored.accounts.beta).toBeUndefined()
      expect(stored.accounts.gamma.enabled).not.toBe(false)
      expect(stored.accounts.delta).toMatchObject({
        enabled: false,
        disabledAt: 1760000000000,
        disabledBy: 'operator'
      })
      expect(stored.activeAlias).toBe('gamma')
      expect(JSON.parse(fs.readFileSync(runtimeAuthFile, 'utf-8'))).toMatchObject({
        tokens: { access_token: 'gamma-access', refresh_token: 'gamma-refresh' }
      })
    } finally {
      await closeServer(server)
      fs.writeFileSync(STORE_FILE, originalStore)
      fs.writeFileSync(runtimeAuthFile, originalAuth)
      fs.unwatchFile(getCodexAuthPath())
    }
  })
})
