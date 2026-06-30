import WebSocket from 'ws';

interface RateLimitEntry {
  lastActionTime: number;
}

export class RateLimiter {
  private limits: Map<WebSocket, RateLimitEntry> = new Map();
  private windowMs: number;

  constructor(windowMs: number = 2000) {
    this.windowMs = windowMs;
  }

  canPerformAction(ws: WebSocket): boolean {
    const now = Date.now();
    const entry = this.limits.get(ws);

    if (!entry || now - entry.lastActionTime >= this.windowMs) {
      this.limits.set(ws, { lastActionTime: now });
      return true;
    }

    return false;
  }

  getRemainingCooldown(ws: WebSocket): number {
    const entry = this.limits.get(ws);
    if (!entry) return 0;

    const elapsed = Date.now() - entry.lastActionTime;
    return Math.max(0, this.windowMs - elapsed);
  }

  removeClient(ws: WebSocket): void {
    this.limits.delete(ws);
  }
}
