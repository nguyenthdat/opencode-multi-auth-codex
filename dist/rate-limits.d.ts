import type { AccountRateLimits, RateLimitWindow } from './types.js';
type RateLimitUpdate = AccountRateLimits;
export declare function hasMeaningfulRateLimitWindow(window: RateLimitWindow | undefined): boolean;
export declare function hasMeaningfulRateLimits(rateLimits: AccountRateLimits | undefined | null): boolean;
export declare function extractRateLimitUpdate(headers: Headers): RateLimitUpdate | null;
export declare function mergeRateLimits(existing: AccountRateLimits | undefined, update: RateLimitUpdate): AccountRateLimits;
export declare function parseRetryAfterHeader(retryAfter: string | null, now?: number): number | undefined;
export declare function parseRateLimitResetFromError(text: string, now?: number): number | undefined;
export declare function isRateLimitErrorText(text: string): boolean;
export declare function getBlockingRateLimitResetAt(rateLimits: AccountRateLimits | undefined, now?: number, opts?: {
    conservativeWhenRemainingUnknown?: boolean;
}): number | undefined;
export {};
//# sourceMappingURL=rate-limits.d.ts.map