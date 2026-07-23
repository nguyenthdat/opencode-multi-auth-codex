import type { AccountCredentials, AccountStore, RateLimitWindow } from './types.js';
export interface TuiAccountSummary {
    status: string;
    description: string;
    fiveHour: string;
    weekly: string;
}
export declare function formatLimitWindow(window: RateLimitWindow | undefined): string;
export declare function getTuiAccountSummary(account: AccountCredentials, store: AccountStore, now?: number): TuiAccountSummary;
//# sourceMappingURL=tui-model.d.ts.map