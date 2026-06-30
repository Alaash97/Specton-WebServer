import WebSocket from 'ws';
import { SessionManager } from '../sessions/SessionManager';
import { JoinSessionMessage, LeaveSessionMessage, RenameSpectatorMessage, ListSessionsMessage, ActionMessage } from '../protocol/messages';
import { RateLimiter } from '../middleware/rateLimiter';
type SpectatorMessage = JoinSessionMessage | LeaveSessionMessage | RenameSpectatorMessage | ListSessionsMessage | ActionMessage;
export declare function handleSpectatorMessage(ws: WebSocket, message: SpectatorMessage, sessionManager: SessionManager, rateLimiter: RateLimiter): void;
export declare function handleSpectatorDisconnect(ws: WebSocket, sessionManager: SessionManager): void;
export {};
//# sourceMappingURL=spectatorHandler.d.ts.map