import http from 'http';
import WebSocket from 'ws';
export declare function createServer(port: number, rateLimitWindowMs: number, heartbeatIntervalMs: number): {
    httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    wss: WebSocket.Server<typeof WebSocket, typeof http.IncomingMessage>;
};
//# sourceMappingURL=server.d.ts.map