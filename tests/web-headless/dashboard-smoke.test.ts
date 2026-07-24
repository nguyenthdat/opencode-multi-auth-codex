import * as fs from 'node:fs'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import type * as http from 'node:http'
import { once } from 'node:events'

const SANDBOX_ROOT = path.join(os.tmpdir(), 'oma-web-headless-sandbox')
const STORE_FILE = path.join(SANDBOX_ROOT, 'accounts.json')
const AUTH_FILE = path.join(SANDBOX_ROOT, 'auth.json')
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

  process.env = {
    ...originalEnv,
    OPENCODE_MULTI_AUTH_STORE_DIR: SANDBOX_ROOT,
    OPENCODE_MULTI_AUTH_STORE_FILE: STORE_FILE,
    OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE: AUTH_FILE
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

describe('dashboard headless smoke', () => {
  it('serves parsable client script', async () => {
    const port = await getFreePort()
    const server = startWebConsole({ host: '127.0.0.1', port })

    try {
      await once(server, 'listening')
      const response = await fetch(`http://127.0.0.1:${port}/`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-security-policy')).toContain("script-src 'self'")

      const html = await response.text()
      expect(html).toContain('<div id="root"></div>')
      expect(html).toContain('<script type="module" src="/dashboard.js"></script>')
      expect(html).toContain('<link rel="stylesheet" href="/dashboard.css" />')

      const scriptResponse = await fetch(`http://127.0.0.1:${port}/dashboard.js`)
      expect(scriptResponse.status).toBe(200)
      expect(scriptResponse.headers.get('content-type')).toContain('text/javascript')
      const script = await scriptResponse.text()
      expect(script.length).toBeGreaterThan(10_000)
      expect(script).toContain('Dashboard root element not found')
      expect(script).toContain('Codex account control')
      expect(script).toContain('Force update')
      expect(script).toContain('Auto re-authentication started')
      expect(script).toContain('Authentication token is invalid')

      const styleResponse = await fetch(`http://127.0.0.1:${port}/dashboard.css`)
      expect(styleResponse.status).toBe(200)
      expect(styleResponse.headers.get('content-type')).toContain('text/css')
      const styles = await styleResponse.text()
      expect(styles).toContain('.account-card')
      expect(styles).not.toContain('fonts.googleapis.com')
    } finally {
      await closeServer(server)
      fs.unwatchFile(getCodexAuthPath())
    }
  })
})
