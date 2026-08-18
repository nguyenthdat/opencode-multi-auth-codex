import * as os from 'node:os'
import * as path from 'node:path'
import { getCodexAuthPath } from '../../src/codex-auth.js'

describe('Codex auth path', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it('resolves an auth file override set after module import', () => {
    process.env = {
      ...originalEnv,
      OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE: path.join(os.tmpdir(), 'codex-auth-first.json')
    }
    expect(getCodexAuthPath()).toBe(path.join(os.tmpdir(), 'codex-auth-first.json'))

    process.env.OPENCODE_MULTI_AUTH_CODEX_AUTH_FILE = path.join(
      os.tmpdir(),
      'codex-auth-second.json'
    )
    expect(getCodexAuthPath()).toBe(path.join(os.tmpdir(), 'codex-auth-second.json'))
  })
})
