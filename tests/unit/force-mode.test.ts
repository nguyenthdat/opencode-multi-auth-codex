import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  getForceState,
  isForceActive,
  activateForce,
  clearForce,
  checkAndAutoClearForce,
  getRemainingForceTimeMs,
  formatForceDuration
} from '../../src/force-mode.js'
import { loadStore, saveStore, getStorePath } from '../../src/store.js'
import type { AccountStore, AccountCredentials } from '../../src/types.js'

const TEST_DIR = path.join(os.tmpdir(), 'oma-force-mode-test-' + Date.now())
const TEST_STORE_FILE = path.join(TEST_DIR, 'accounts.json')

// Mock store environment
const originalEnv = process.env

describe('Force Mode', () => {
  beforeEach(() => {
    // Setup test environment
    process.env = {
      ...originalEnv,
      OPENCODE_MULTI_AUTH_STORE_DIR: TEST_DIR,
      OPENCODE_MULTI_AUTH_STORE_FILE: TEST_STORE_FILE
    }

    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true })
    }

    // Initialize empty store with version 2 by writing directly to file
    const emptyStore = {
      version: 2,
      accounts: {},
      activeAlias: null,
      rotationIndex: 0,
      lastRotation: Date.now(),
      forcedAlias: null,
      forcedUntil: null,
      previousRotationStrategy: null,
      forcedBy: null,
      rotationStrategy: 'round-robin'
    }
    fs.writeFileSync(TEST_STORE_FILE, JSON.stringify(emptyStore, null, 2), { mode: 0o600 })
  })

  afterEach(() => {
    // Cleanup
    process.env = originalEnv
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  describe('getForceState', () => {
    it('should return null state when no force is active', () => {
      const state = getForceState()
      expect(state.forcedAlias).toBeNull()
      expect(state.forcedUntil).toBeNull()
      expect(state.previousRotationStrategy).toBeNull()
      expect(state.forcedBy).toBeNull()
    })

    it('should return stored force state', () => {
      const now = Date.now()
      const store = loadStore()
      store.forcedAlias = 'test-account'
      store.forcedUntil = now + 24 * 60 * 60 * 1000
      store.previousRotationStrategy = 'round-robin'
      store.forcedBy = 'test-user'
      saveStore(store)

      const state = getForceState()
      expect(state.forcedAlias).toBe('test-account')
      expect(state.forcedUntil).toBe(now + 24 * 60 * 60 * 1000)
      expect(state.previousRotationStrategy).toBe('round-robin')
      expect(state.forcedBy).toBe('test-user')
    })
  })

  describe('isForceActive', () => {
    it('should return false when no force is set', () => {
      expect(isForceActive()).toBe(false)
    })

    it('should return true when force is active and valid', () => {
      const now = Date.now()
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      store.forcedAlias = 'test-account'
      store.forcedUntil = now + 24 * 60 * 60 * 1000
      saveStore(store)

      expect(isForceActive()).toBe(true)
    })

    it('should return false when force has expired', () => {
      const now = Date.now()
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      store.forcedAlias = 'test-account'
      store.forcedUntil = now - 1000 // Expired 1 second ago
      saveStore(store)

      expect(isForceActive()).toBe(false)
    })

    it('should return false when forced account is disabled', () => {
      const now = Date.now()
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account', { enabled: false })
      store.forcedAlias = 'test-account'
      store.forcedUntil = now + 24 * 60 * 60 * 1000
      saveStore(store)

      expect(isForceActive()).toBe(false)
    })

    it('should return false when forced account does not exist', () => {
      const now = Date.now()
      const store = loadStore()
      store.forcedAlias = 'non-existent'
      store.forcedUntil = now + 24 * 60 * 60 * 1000
      saveStore(store)

      expect(isForceActive()).toBe(false)
    })
  })

  describe('activateForce', () => {
    it('should activate force mode for valid account', () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      const result = activateForce('test-account', 'test-actor')

      expect(result.success).toBe(true)
      expect(result.state?.forcedAlias).toBe('test-account')
      expect(result.state?.forcedBy).toBe('test-actor')
      expect(result.state?.forcedUntil).toBeGreaterThan(Date.now())
    })

    it('should store previous rotation strategy', () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      store.rotationStrategy = 'least-used'
      saveStore(store)

      activateForce('test-account')

      const state = getForceState()
      expect(state.previousRotationStrategy).toBe('least-used')
    })

    it('should return error for non-existent account', () => {
      const result = activateForce('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should return error for disabled account', () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account', { enabled: false })
      saveStore(store)

      const result = activateForce('test-account')

      expect(result.success).toBe(false)
      expect(result.error).toContain('disabled')
    })

    it('should overwrite existing force when activating new force', () => {
      const store = loadStore()
      store.accounts['account1'] = createTestAccount('account1')
      store.accounts['account2'] = createTestAccount('account2')
      saveStore(store)

      activateForce('account1', 'actor1')
      const result = activateForce('account2', 'actor2')

      expect(result.success).toBe(true)
      expect(result.state?.forcedAlias).toBe('account2')
      expect(result.state?.forcedBy).toBe('actor2')
    })

    it('should keep original TTL when re-activating same alias', async () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      const first = activateForce('test-account', 'actor1')
      await new Promise((resolve) => setTimeout(resolve, 25))
      const second = activateForce('test-account', 'actor2')

      expect(first.success).toBe(true)
      expect(second.success).toBe(true)
      expect(second.state?.forcedUntil).toBe(first.state?.forcedUntil)
    })
  })

  describe('clearForce', () => {
    it('should clear force mode and return previous strategy', () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      store.rotationStrategy = 'weighted-round-robin'
      saveStore(store)

      activateForce('test-account')
      const result = clearForce()

      expect(result.success).toBe(true)
      expect(result.restoredStrategy).toBe('weighted-round-robin')
      expect(isForceActive()).toBe(false)
    })

    it('should clear all force fields', () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      activateForce('test-account', 'test-actor')
      clearForce()

      const state = getForceState()
      expect(state.forcedAlias).toBeNull()
      expect(state.forcedUntil).toBeNull()
      expect(state.previousRotationStrategy).toBeNull()
      expect(state.forcedBy).toBeNull()
    })

    it('restores previous rotation strategy in store on clear', () => {
      let store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      store.rotationStrategy = 'least-used'
      saveStore(store)

      activateForce('test-account', 'test-actor')

      store = loadStore()
      store.rotationStrategy = 'random'
      saveStore(store)

      clearForce()
      const updatedStore = loadStore()
      expect(updatedStore.rotationStrategy).toBe('least-used')
    })
  })

  describe('checkAndAutoClearForce', () => {
    it('should not clear active valid force', () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      activateForce('test-account')
      const result = checkAndAutoClearForce()

      expect(result.wasCleared).toBe(false)
      expect(isForceActive()).toBe(true)
    })

    it('should auto-clear expired force', () => {
      const now = Date.now()
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      store.forcedAlias = 'test-account'
      store.forcedUntil = now - 1000 // Expired
      saveStore(store)

      const result = checkAndAutoClearForce()

      expect(result.wasCleared).toBe(true)
      expect(result.reason).toBe('expired')
    })

    it('should auto-clear force when account is removed', () => {
      let store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      activateForce('test-account')

      // Reload store to get updated force state
      store = loadStore()

      // Remove the account
      delete store.accounts['test-account']
      saveStore(store)

      const result = checkAndAutoClearForce()

      expect(result.wasCleared).toBe(true)
      expect(result.reason).toBe('account_removed')
    })

    it('should auto-clear force when account is disabled', () => {
      let store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      activateForce('test-account')

      // Reload store to get updated force state
      store = loadStore()

      // Disable the account
      store.accounts['test-account'].enabled = false
      saveStore(store)

      const result = checkAndAutoClearForce()

      expect(result.wasCleared).toBe(true)
      expect(result.reason).toBe('account_disabled')
    })

    it('should keep force when account is rate-limited', () => {
      const now = Date.now()
      let store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      activateForce('test-account')

      // Reload store to get updated force state
      store = loadStore()

      // Rate limit the account
      store.accounts['test-account'].rateLimitedUntil = now + 60 * 60 * 1000
      saveStore(store)

      const result = checkAndAutoClearForce()

      expect(result.wasCleared).toBe(false)
      expect(result.reason).toBeUndefined()
    })

    it('should keep force when account auth is invalid', () => {
      let store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      activateForce('test-account')

      // Reload store to get updated force state
      store = loadStore()

      // Invalidate auth
      store.accounts['test-account'].authInvalid = true
      saveStore(store)

      const result = checkAndAutoClearForce()

      expect(result.wasCleared).toBe(false)
      expect(result.reason).toBeUndefined()
    })
  })

  describe('getRemainingForceTimeMs', () => {
    it('should return 0 when no force is active', () => {
      expect(getRemainingForceTimeMs()).toBe(0)
    })

    it('should return remaining time for active force', () => {
      const store = loadStore()
      store.accounts['test-account'] = createTestAccount('test-account')
      saveStore(store)

      activateForce('test-account')
      const remaining = getRemainingForceTimeMs()

      // Allow for some time passage during test execution
      expect(remaining).toBeGreaterThanOrEqual(0)
      expect(remaining).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
    })
  })

  describe('formatForceDuration', () => {
    it('should format hours and minutes', () => {
      expect(formatForceDuration(24 * 60 * 60 * 1000)).toBe('24h 0m')
      expect(formatForceDuration(25 * 60 * 60 * 1000)).toBe('25h 0m')
      expect(formatForceDuration(90 * 60 * 1000)).toBe('1h 30m')
    })

    it('should format minutes only', () => {
      expect(formatForceDuration(30 * 60 * 1000)).toBe('30m')
      expect(formatForceDuration(5 * 60 * 1000)).toBe('5m')
    })

    it('should handle zero', () => {
      expect(formatForceDuration(0)).toBe('0m')
    })
  })
})

// Helper function to create test accounts
function createTestAccount(
  alias: string,
  overrides: Partial<AccountCredentials> = {}
): AccountCredentials {
  return {
    alias,
    accessToken: 'test-token',
    refreshToken: 'test-refresh',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    usageCount: 0,
    enabled: true,
    ...overrides
  }
}
