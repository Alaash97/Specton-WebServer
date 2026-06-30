import WebSocket from 'ws';
export declare class RateLimiter {
    private limits;
    private windowMs;
    constructor(windowMs?: number);
    canPerformAction(ws: WebSocket): boolean;
    getRemainingCooldown(ws: WebSocket): number;
    removeClient(ws: WebSocket): void;
}
//# sourceMappingURL=rateLimiter.d.ts.map