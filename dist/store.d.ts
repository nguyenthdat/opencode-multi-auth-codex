import type { AccountStore, AccountCredentials } from './types.js';
export declare function loadStore(): AccountStore;
export declare function saveStore(store: AccountStore): void;
export declare function withWriteLock<T>(fn: () => T): Promise<T>;
export declare function getStoreDiagnostics(): {
    storeDir: string;
    storeFile: string;
    locked: boolean;
    encrypted: boolean;
    error: string | null;
};
export declare function addAccount(alias: string, creds: Omit<AccountCredentials, 'alias' | 'usageCount'>): AccountStore;
export type ExistingEmailPolicy = 'allow' | 'reject' | 'update';
export declare class AccountEmailExistsError extends Error {
    readonly alias: string;
    readonly code = "AUTO_LOGIN_ACCOUNT_EXISTS";
    constructor(alias: string);
}
export declare class AccountEmailMismatchError extends Error {
    readonly code = "AUTO_LOGIN_EMAIL_MISMATCH";
    constructor();
}
export declare function saveAuthenticatedAccount(alias: string, creds: Omit<AccountCredentials, 'alias' | 'usageCount'>, existingEmailPolicy?: ExistingEmailPolicy, expectedEmail?: string): AccountStore;
export declare function removeAccount(alias: string): AccountStore;
export declare function updateAccount(alias: string, updates: Partial<AccountCredentials>): AccountStore;
export declare function setActiveAlias(alias: string | null): AccountStore;
export declare function getActiveAccount(): AccountCredentials | null;
export declare function listAccounts(): AccountCredentials[];
export declare function getStorePath(): string;
export declare function getStoreStatus(): {
    locked: boolean;
    encrypted: boolean;
    error: string | null;
};
//# sourceMappingURL=store.d.ts.map