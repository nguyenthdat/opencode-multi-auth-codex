import type { ExistingEmailPolicy } from './store.js';
import type { AccountCredentials } from './types.js';
interface AuthorizationFlow {
    pkce: {
        verifier: string;
        challenge: string;
    };
    state: string;
    url: string;
    redirectUri: string;
    port: number;
}
export interface LoginAccountOptions {
    timeoutMs?: number;
    existingEmailPolicy?: ExistingEmailPolicy;
    expectedEmail?: string;
}
export declare function createAuthorizationFlow(port?: number): Promise<AuthorizationFlow>;
export declare function loginAccount(alias: string, flow?: AuthorizationFlow, options?: LoginAccountOptions): Promise<AccountCredentials>;
export declare function refreshToken(alias: string): Promise<AccountCredentials | null>;
export declare function ensureValidToken(alias: string): Promise<string | null>;
export {};
//# sourceMappingURL=auth.d.ts.map