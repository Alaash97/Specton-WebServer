"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    constructor(windowMs = 2000) {
        this.limits = new Map();
        this.windowMs = windowMs;
    }
    canPerformAction(ws) {
        const now = Date.now();
        const entry = this.limits.get(ws);
        if (!entry || now - entry.lastActionTime >= this.windowMs) {
            this.limits.set(ws, { lastActionTime: now });
            return true;
        }
        return false;
    }
    getRemainingCooldown(ws) {
        const entry = this.limits.get(ws);
        if (!entry)
            return 0;
        const elapsed = Date.now() - entry.lastActionTime;
        return Math.max(0, this.windowMs - elapsed);
    }
    removeClient(ws) {
        this.limits.delete(ws);
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rateLimiter.js.map