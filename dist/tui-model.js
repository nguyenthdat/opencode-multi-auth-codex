function isBlocked(until, now) {
    return typeof until === 'number' && until > now;
}
export function formatLimitWindow(window) {
    if (!window)
        return 'unknown';
    if (typeof window.remaining === 'number' &&
        typeof window.limit === 'number' &&
        window.limit > 0) {
        return `${Math.max(0, Math.min(100, Math.round((window.remaining / window.limit) * 100)))}% left`;
    }
    if (typeof window.remaining === 'number') {
        return `${Math.max(0, Math.round(window.remaining))} left`;
    }
    return 'unknown';
}
export function getTuiAccountSummary(account, store, now = Date.now()) {
    const forceActive = store.forcedAlias === account.alias && isBlocked(store.forcedUntil, now);
    let status = 'ready';
    if (account.enabled === false)
        status = 'disabled';
    else if (account.authInvalid)
        status = 'auth invalid';
    else if (isBlocked(account.workspaceDeactivatedUntil, now))
        status = 'workspace blocked';
    else if (isBlocked(account.rateLimitedUntil, now))
        status = 'rate limited';
    else if (isBlocked(account.modelUnsupportedUntil, now))
        status = 'model unsupported';
    else if (forceActive)
        status = 'forced';
    else if (store.activeAlias === account.alias)
        status = 'active';
    const fiveHour = formatLimitWindow(account.rateLimits?.fiveHour);
    const weekly = formatLimitWindow(account.rateLimits?.weekly);
    const identity = account.email || 'unknown email';
    const plan = account.planType || 'unknown plan';
    return {
        status,
        fiveHour,
        weekly,
        description: `${identity} | ${plan} | ${status} | 5h ${fiveHour} | week ${weekly}`
    };
}
//# sourceMappingURL=tui-model.js.map