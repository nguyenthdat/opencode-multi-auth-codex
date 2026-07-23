import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import plugin from '../../src/tui.js'
import { addAccount, loadStore } from '../../src/store.js'

interface TestCommand {
  name: string
  slashName?: string
  slashAliases?: string[]
  run?: () => void
}

interface SelectOption {
  title: string
  value: unknown
}

interface SelectDialogProps {
  options: SelectOption[]
  onSelect: (option: SelectOption) => void
}

describe('OpenCode TUI plugin', () => {
  it('registers account management slash commands', async () => {
    const layers: Array<{ mode?: string; commands?: TestCommand[] }> = []
    const api = {
      keymap: {
        registerLayer(layer: { mode?: string; commands?: TestCommand[] }) {
          layers.push(layer)
          return () => undefined
        }
      }
    }

    await plugin.tui(api as never, undefined, {} as never)

    expect(plugin.id).toBe('@nguyenthdat/opencode-multi-auth-codex')
    expect(layers).toHaveLength(1)
    expect(layers[0].mode).toBeUndefined()
    expect(layers[0].commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'multi-auth.accounts',
        title: 'Codex accounts',
        suggested: true,
        slashName: 'codex',
        slashAliases: ['multi-auth']
      }),
      expect.objectContaining({
        name: 'multi-auth.add',
        title: 'Add Codex account',
        slashName: 'codex-add',
        slashAliases: ['multi-auth-add']
      })
    ]))
  })

  it('renders account lifecycle actions and protects the last enabled account', async () => {
    const storeDir = mkdtempSync(path.join(tmpdir(), 'multi-auth-tui-'))
    const previousStoreDir = process.env.OPENCODE_MULTI_AUTH_STORE_DIR
    const previousStoreFile = process.env.OPENCODE_MULTI_AUTH_STORE_FILE
    process.env.OPENCODE_MULTI_AUTH_STORE_DIR = storeDir
    process.env.OPENCODE_MULTI_AUTH_STORE_FILE = path.join(storeDir, 'accounts.json')

    try {
      addAccount('personal', {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 60_000,
        email: 'person@example.com',
        enabled: true
      })

      const layers: Array<{ commands?: TestCommand[] }> = []
      const dialogs: SelectDialogProps[] = []
      const toasts: Array<{ variant?: string; message?: string }> = []
      const api = {
        keymap: {
          registerLayer(layer: { commands?: TestCommand[] }) {
            layers.push(layer)
            return () => undefined
          }
        },
        ui: {
          dialog: {
            replace(render: () => unknown) {
              render()
            },
            setSize() {}
          },
          DialogSelect(props: SelectDialogProps) {
            dialogs.push(props)
            return null
          },
          toast(value: { variant?: string; message?: string }) {
            toasts.push(value)
          }
        }
      }

      await plugin.tui(api as never, undefined, {} as never)
      layers[0].commands?.find((command) => command.name === 'multi-auth.accounts')?.run?.()

      const accountOption = dialogs[0].options.find((option) => option.title === 'personal')
      expect(accountOption).toBeDefined()
      dialogs[0].onSelect(accountOption!)

      const actionTitles = dialogs[1].options.map((option) => option.title)
      expect(actionTitles).toEqual(expect.arrayContaining([
        'Use on device',
        'Refresh OAuth token',
        'Re-authenticate account',
        'Edit tags and notes',
        'Check usage and health',
        'Disable account',
        'Remove account'
      ]))

      const disableOption = dialogs[1].options.find((option) => option.title === 'Disable account')
      expect(disableOption).toBeDefined()
      dialogs[1].onSelect(disableOption!)

      expect(loadStore().accounts.personal.enabled).toBe(true)
      expect(toasts).toContainEqual(expect.objectContaining({
        variant: 'error',
        message: 'Cannot disable the last enabled account'
      }))
    } finally {
      if (previousStoreDir === undefined) delete process.env.OPENCODE_MULTI_AUTH_STORE_DIR
      else process.env.OPENCODE_MULTI_AUTH_STORE_DIR = previousStoreDir
      if (previousStoreFile === undefined) delete process.env.OPENCODE_MULTI_AUTH_STORE_FILE
      else process.env.OPENCODE_MULTI_AUTH_STORE_FILE = previousStoreFile
      rmSync(storeDir, { recursive: true, force: true })
    }
  })
})
