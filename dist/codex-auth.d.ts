import { loadStore } from './store.js';
export interface CodexAuthTokens {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
}
export interface CodexAuthFile {
    OPENAI_API_KEY?: string | null;
    tokens?: CodexAuthTokens;
    last_refresh?: string;
}
export declare function getCodexAuthPath(): string;
export interface CodexAuthSummary {
    email?: string;
    accountId?: string;
    accountUserId?: string;
    userId?: string;
    planType?: string;
    expiresAt?: number;
    lastRefresh?: string;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    hasIdToken: boolean;
}
export declare function loadCodexAuthFile(): CodexAuthFile | null;
export declare function writeCodexAuthFile(auth: CodexAuthFile): void;
export declare function decodeJwtPayload(token: string): Record<string, any> | null;
export declare function getEmailFromClaims(claims: Record<string, any> | null): string | undefined;
export declare function getAccountIdFromClaims(claims: Record<string, any> | null): string | undefined;
export declare function getPlanTypeFromClaims(claims: Record<string, any> | null): string | undefined;
export declare function getExpiryFromClaims(claims: Record<string, any> | null): number | undefined;
export declare function getCodexAuthSummary(): CodexAuthSummary;
export declare function resolveAliasForCurrentAuth(store?: ReturnType<typeof loadStore>): string | null;
export declare function syncCodexAuthFile(): {
    alias: string | null;
    added: boolean;
    updated: boolean;
    authEmail?: string;
    authAccountId?: string;
};
export declare function getCodexAuthStatus(): {
    error: string | null;
};
export declare function writeCodexAuthForAlias(alias: string): void;
//# sourceMappingURL=codex-auth.d.ts.map