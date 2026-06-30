import WebSocket from 'ws';
import { SessionManager } from '../sessions/SessionManager';
import { ClientMessage } from '../protocol/messages';
export declare function handlePlayerMessage(ws: WebSocket, message: ClientMessage, sessionManager: SessionManager): Promise<void>;
export declare function handlePlayerDisconnect(ws: WebSocket, sessionManager: SessionManager): void;
//# sourceMappingURL=playerHandler.d.ts.map