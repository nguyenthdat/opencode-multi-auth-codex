import { jsx as _jsx, jsxs as _jsxs } from "@opentui/solid/jsx-runtime";
import { loginAccount, refreshToken } from './auth.js';
import { resolveAliasForCurrentAuth, writeCodexAuthForAlias } from './codex-auth.js';
import { activateForce, clearForce, getForceState, isForceActive } from './force-mode.js';
import { refreshRateLimits } from './limits-refresh.js';
import { listAccounts, loadStore, removeAccount, updateAccount } from './store.js';
import { getTuiAccountSummary } from './tui-model.js';
const PLUGIN_ID = '@nguyenthdat/opencode-multi-auth-codex';
function replaceDialog(api, size, render) {
    api.ui.dialog.replace(render);
    api.ui.dialog.setSize(size);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function formatDate(value) {
    if (!value)
        return 'unknown';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
}
function BusyDialog(props) {
    return (_jsxs("box", { gap: 1, paddingLeft: 2, paddingRight: 2, paddingBottom: 1, flexDirection: "column", children: [_jsx("text", { fg: props.api.theme.current.text, children: _jsx("b", { children: props.title }) }), _jsx("text", { fg: props.api.theme.current.textMuted, wrapMode: "word", children: props.message })] }));
}
function showBusy(api, title, message) {
    replaceDialog(api, 'medium', () => _jsx(BusyDialog, { api: api, title: title, message: message }));
}
function notifyError(api, error) {
    api.ui.toast({
        variant: 'error',
        title: 'Multi-auth',
        message: errorMessage(error),
        duration: 5000
    });
}
function runOperation(api, title, message, operation) {
    showBusy(api, title, message);
    void operation()
        .then((result) => {
        api.ui.toast({ variant: 'success', title: 'Multi-auth', message: result });
        showAccounts(api);
    })
        .catch((error) => {
        notifyError(api, error);
        showAccounts(api);
    });
}
function showAddAccount(api) {
    const DialogPrompt = api.ui.DialogPrompt;
    replaceDialog(api, 'medium', () => (_jsx(DialogPrompt, { title: "Add OpenAI account", placeholder: "personal", description: () => (_jsx("text", { fg: api.theme.current.textMuted, wrapMode: "word", children: "Enter an alias. Your browser will open for OAuth authentication." })), onCancel: () => showAccounts(api), onConfirm: (value) => {
            const alias = value.trim();
            if (!alias || !/^[a-zA-Z0-9._-]+$/.test(alias)) {
                api.ui.toast({
                    variant: 'warning',
                    title: 'Multi-auth',
                    message: 'Alias must use letters, numbers, dot, underscore, or hyphen.'
                });
                showAddAccount(api);
                return;
            }
            runOperation(api, `Adding ${alias}`, 'Complete the OAuth flow in your browser. This dialog updates when authentication finishes.', async () => {
                const account = await loginAccount(alias);
                return `Added ${alias} (${account.email || 'unknown email'})`;
            });
        } })));
}
function refreshAccounts(api, alias) {
    const accounts = listAccounts();
    const selected = alias ? accounts.filter((account) => account.alias === alias) : accounts;
    const label = alias || 'all accounts';
    runOperation(api, 'Checking limits', `Refreshing usage and health for ${label}...`, async () => {
        const results = await refreshRateLimits(selected);
        const updated = results.filter((result) => result.updated).length;
        const failures = results.filter((result) => !result.updated);
        if (failures.length === results.length) {
            throw new Error(failures.map((result) => `${result.alias}: ${result.error || 'check failed'}`).join('; '));
        }
        return failures.length > 0
            ? `Updated ${updated}; ${failures.length} account check(s) failed`
            : `Updated ${updated} account${updated === 1 ? '' : 's'}`;
    });
}
function refreshAccessTokens(api, alias) {
    const accounts = listAccounts();
    const selected = alias ? accounts.filter((account) => account.alias === alias) : accounts;
    const deviceAlias = resolveAliasForCurrentAuth(loadStore());
    const label = alias || 'all accounts';
    runOperation(api, 'Refreshing OAuth tokens', `Refreshing ${label}...`, async () => {
        let updated = 0;
        const failures = [];
        for (const account of selected) {
            if (!account.refreshToken) {
                failures.push(`${account.alias}: no refresh token`);
                continue;
            }
            const refreshed = await refreshToken(account.alias);
            if (!refreshed) {
                failures.push(`${account.alias}: token refresh failed`);
                continue;
            }
            updated += 1;
            if (deviceAlias === account.alias) {
                try {
                    writeCodexAuthForAlias(account.alias);
                }
                catch (error) {
                    failures.push(`${account.alias}: refreshed, but auth.json sync failed (${errorMessage(error)})`);
                }
            }
        }
        if (updated === 0)
            throw new Error(failures.join('; ') || 'No accounts available to refresh');
        return failures.length > 0
            ? `Refreshed ${updated}; ${failures.length} warning(s)`
            : `Refreshed ${updated} OAuth token${updated === 1 ? '' : 's'}`;
    });
}
function reauthenticateAccount(api, account) {
    if (account.enabled === false) {
        notifyError(api, 'Enable this account before re-authenticating it');
        showAccountActions(api, account.alias);
        return;
    }
    runOperation(api, `Re-authenticating ${account.alias}`, 'Complete the OAuth flow in your browser. This dialog updates when authentication finishes.', async () => {
        const authenticated = await loginAccount(account.alias);
        return `Re-authenticated ${account.alias} (${authenticated.email || 'unknown email'})`;
    });
}
function useAccountOnDevice(api, alias) {
    try {
        writeCodexAuthForAlias(alias);
        api.ui.toast({
            variant: 'success',
            title: 'Multi-auth',
            message: `${alias} written to the device Codex auth.json`
        });
    }
    catch (error) {
        notifyError(api, error);
    }
    showAccountActions(api, alias);
}
function showEditNotes(api, alias, tagsValue) {
    const account = loadStore().accounts[alias];
    if (!account) {
        notifyError(api, `Account '${alias}' no longer exists`);
        showAccounts(api);
        return;
    }
    const DialogPrompt = api.ui.DialogPrompt;
    replaceDialog(api, 'large', () => (_jsx(DialogPrompt, { title: `Edit notes for ${alias}`, value: account.notes || '', placeholder: "Optional account notes", description: () => (_jsx("text", { fg: api.theme.current.textMuted, wrapMode: "word", children: "Step 2 of 2. Submit an empty value to clear the notes." })), onCancel: () => showAccountActions(api, alias), onConfirm: (notesValue) => {
            const tags = Array.from(new Set(tagsValue
                .split(',')
                .map((tag) => tag.trim().toLowerCase())
                .filter(Boolean)));
            const notes = notesValue.trim();
            updateAccount(alias, {
                tags: tags.length > 0 ? tags : undefined,
                notes: notes || undefined
            });
            api.ui.toast({
                variant: 'success',
                title: 'Multi-auth',
                message: `${alias} metadata updated`
            });
            showAccountActions(api, alias);
        } })));
}
function showEditMetadata(api, account) {
    const DialogPrompt = api.ui.DialogPrompt;
    replaceDialog(api, 'large', () => (_jsx(DialogPrompt, { title: `Edit tags for ${account.alias}`, value: (account.tags || []).join(', '), placeholder: "work, personal", description: () => (_jsx("text", { fg: api.theme.current.textMuted, wrapMode: "word", children: "Step 1 of 2. Separate tags with commas, or submit an empty value to clear them." })), onCancel: () => showAccountActions(api, account.alias), onConfirm: (tagsValue) => showEditNotes(api, account.alias, tagsValue) })));
}
function accountDetails(account) {
    const store = loadStore();
    const summary = getTuiAccountSummary(account, store);
    const details = [
        `Status: ${summary.status}`,
        `Email: ${account.email || 'unknown'}`,
        `Plan: ${account.planType || 'unknown'}`,
        `Enabled: ${account.enabled === false ? 'no' : 'yes'}`,
        `Uses: ${account.usageCount}`,
        `Token expires: ${formatDate(account.expiresAt)}`,
        `Last seen: ${formatDate(account.lastSeenAt || account.lastUsed)}`,
        `Last refresh: ${formatDate(account.lastRefresh)}`,
        `5-hour quota: ${summary.fiveHour}`,
        `Weekly quota: ${summary.weekly}`,
        `Last check: ${formatDate(account.lastLimitProbeAt)}`,
        `Tags: ${account.tags?.join(', ') || 'none'}`,
        `Notes: ${account.notes || 'none'}`
    ];
    if (account.limitError)
        details.push(`Last error: ${account.limitError}`);
    return details.join('\n');
}
function showDetails(api, alias) {
    const account = loadStore().accounts[alias];
    if (!account) {
        notifyError(api, `Account '${alias}' no longer exists`);
        showAccounts(api);
        return;
    }
    const DialogAlert = api.ui.DialogAlert;
    replaceDialog(api, 'large', () => (_jsx(DialogAlert, { title: `Account: ${alias}`, message: accountDetails(account), onConfirm: () => showAccountActions(api, alias) })));
}
function toggleAccount(api, account) {
    const disabling = account.enabled !== false;
    if (disabling) {
        const enabledCount = Object.values(loadStore().accounts).filter((candidate) => candidate.enabled !== false).length;
        if (enabledCount <= 1) {
            notifyError(api, 'Cannot disable the last enabled account');
            showAccountActions(api, account.alias);
            return;
        }
    }
    if (disabling && getForceState().forcedAlias === account.alias)
        clearForce();
    updateAccount(account.alias, disabling
        ? {
            enabled: false,
            disabledAt: Date.now(),
            disabledBy: 'tui',
            disableReason: 'Disabled from OpenCode TUI'
        }
        : {
            enabled: true,
            disabledAt: undefined,
            disabledBy: undefined,
            disableReason: undefined
        });
    api.ui.toast({
        variant: 'success',
        title: 'Multi-auth',
        message: `${account.alias} ${disabling ? 'disabled' : 'enabled'}`
    });
    showAccountActions(api, account.alias);
}
function toggleForce(api, alias) {
    const state = getForceState();
    if (isForceActive() && state.forcedAlias === alias) {
        clearForce();
        api.ui.toast({ variant: 'success', title: 'Multi-auth', message: 'Force Mode cleared' });
        showAccountActions(api, alias);
        return;
    }
    const result = activateForce(alias, 'tui');
    if (!result.success) {
        notifyError(api, result.error || 'Could not activate Force Mode');
    }
    else {
        api.ui.toast({
            variant: 'success',
            title: 'Multi-auth',
            message: `${alias} forced for up to 24 hours`
        });
    }
    showAccountActions(api, alias);
}
function confirmRemove(api, alias) {
    const DialogConfirm = api.ui.DialogConfirm;
    replaceDialog(api, 'medium', () => (_jsx(DialogConfirm, { title: `Remove ${alias}?`, message: "This removes the locally stored OAuth credentials for this alias.", onCancel: () => showAccountActions(api, alias), onConfirm: () => {
            if (getForceState().forcedAlias === alias)
                clearForce();
            removeAccount(alias);
            api.ui.toast({ variant: 'success', title: 'Multi-auth', message: `${alias} removed` });
            showAccounts(api);
        } })));
}
function showAccountActions(api, alias) {
    const store = loadStore();
    const account = store.accounts[alias];
    if (!account) {
        showAccounts(api);
        return;
    }
    const forced = isForceActive() && getForceState().forcedAlias === alias;
    const options = [
        {
            title: 'View details',
            value: 'details',
            description: 'Show email, plan, token expiry, quota, and last check result'
        },
        {
            title: 'Use on device',
            value: 'use-on-device',
            description: 'Write this account to the device Codex auth.json'
        },
        {
            title: 'Check usage and health',
            value: 'check',
            description: 'Refresh limits from the usage API/probe'
        },
        {
            title: 'Refresh OAuth token',
            value: 'refresh-token',
            description: account.refreshToken
                ? 'Exchange the refresh token for fresh credentials'
                : 'No refresh token available',
            disabled: !account.refreshToken
        },
        {
            title: 'Re-authenticate account',
            value: 'reauth',
            description: account.enabled === false
                ? 'Enable this account first'
                : 'Open browser OAuth for this alias',
            disabled: account.enabled === false
        },
        {
            title: 'Edit tags and notes',
            value: 'edit-meta',
            description: 'Update local account metadata'
        },
        {
            title: forced ? 'Clear Force Mode' : 'Force this account for 24h',
            value: 'force',
            description: forced ? 'Resume automatic rotation' : 'Pause rotation and pin this account'
        },
        {
            title: account.enabled === false ? 'Enable account' : 'Disable account',
            value: 'toggle',
            description: account.enabled === false
                ? 'Return this account to rotation'
                : 'Exclude this account from rotation'
        },
        {
            title: 'Remove account',
            value: 'remove',
            description: 'Delete local credentials for this alias'
        },
        { title: 'Back to accounts', value: 'back' }
    ];
    const DialogSelect = api.ui.DialogSelect;
    replaceDialog(api, 'large', () => (_jsx(DialogSelect, { title: `Manage ${alias}`, options: options, current: "details", onSelect: (option) => {
            switch (option.value) {
                case 'details':
                    showDetails(api, alias);
                    break;
                case 'use-on-device':
                    useAccountOnDevice(api, alias);
                    break;
                case 'check':
                    refreshAccounts(api, alias);
                    break;
                case 'refresh-token':
                    refreshAccessTokens(api, alias);
                    break;
                case 'reauth':
                    reauthenticateAccount(api, account);
                    break;
                case 'edit-meta':
                    showEditMetadata(api, account);
                    break;
                case 'force':
                    toggleForce(api, alias);
                    break;
                case 'toggle':
                    toggleAccount(api, account);
                    break;
                case 'remove':
                    confirmRemove(api, alias);
                    break;
                case 'back':
                    showAccounts(api);
                    break;
            }
        } })));
}
function showAccounts(api) {
    const store = loadStore();
    const accounts = Object.values(store.accounts).sort((a, b) => a.alias.localeCompare(b.alias));
    const options = [
        {
            title: 'Add account',
            value: { type: 'add' },
            category: 'Actions',
            description: 'Open browser-based OAuth login'
        },
        {
            title: 'Check all accounts',
            value: { type: 'check-all' },
            category: 'Actions',
            description: 'Refresh usage, quota, and health data',
            disabled: accounts.length === 0
        },
        {
            title: 'Refresh OAuth tokens',
            value: { type: 'refresh-tokens' },
            category: 'Actions',
            description: 'Refresh stored OAuth credentials for all accounts',
            disabled: !accounts.some((account) => account.refreshToken)
        },
        ...accounts.map((account) => {
            const summary = getTuiAccountSummary(account, store);
            return {
                title: account.alias,
                value: { type: 'account', alias: account.alias },
                category: 'Accounts',
                description: summary.description
            };
        })
    ];
    const DialogSelect = api.ui.DialogSelect;
    replaceDialog(api, 'xlarge', () => (_jsx(DialogSelect, { title: `Multi-auth accounts (${accounts.length})`, placeholder: "Filter accounts", options: options, onSelect: (option) => {
            if (option.value.type === 'add') {
                showAddAccount(api);
                return;
            }
            if (option.value.type === 'check-all') {
                refreshAccounts(api);
                return;
            }
            if (option.value.type === 'refresh-tokens') {
                refreshAccessTokens(api);
                return;
            }
            showAccountActions(api, option.value.alias);
        } })));
}
const tui = async (api, options) => {
    if (options?.enabled === false)
        return;
    api.keymap.registerLayer({
        commands: [
            {
                name: 'multi-auth.accounts',
                title: 'Codex accounts',
                desc: 'Manage Codex OAuth accounts and check quota/health',
                category: 'Codex Accounts',
                namespace: 'palette',
                suggested: true,
                slashName: 'codex',
                slashAliases: ['multi-auth'],
                run() {
                    showAccounts(api);
                }
            },
            {
                name: 'multi-auth.add',
                title: 'Add Codex account',
                desc: 'Add a Codex OAuth account using browser authentication',
                category: 'Codex Accounts',
                namespace: 'palette',
                slashName: 'codex-add',
                slashAliases: ['multi-auth-add'],
                run() {
                    showAddAccount(api);
                }
            }
        ],
        bindings: []
    });
};
const plugin = {
    id: PLUGIN_ID,
    tui
};
export default plugin;
//# sourceMappingURL=tui.js.map