import WebSocket from 'ws';
import { Session } from './Session';
import { ObjectStorage } from '../storage/ObjectStorage';
export declare class SessionManager {
    private readonly objectStorage;
    private sessions;
    private playerToSession;
    private spectatorToSession;
    private spectatorDisconnectTimers;
    private static readonly SPECTATOR_RECONNECT_GRACE_MS;
    constructor(objectStorage: ObjectStorage);
    createSession(playerName: string, level: string, playerWs: WebSocket): Session;
    removeSession(sessionId: string): void;
    getSession(sessionId: string): Session | undefined;
    getSessionByPlayer(ws: WebSocket): Session | undefined;
    getSessionBySpectator(ws: WebSocket): Session | undefined;
    addSpectatorToSession(sessionId: string, ws: WebSocket, spectatorName: string, spectatorToken?: string): {
        session: Session;
        error?: undefined;
    } | {
        session?: undefined;
        error: string;
    };
    removeSpectatorFromAll(ws: WebSocket): void;
    handlePlayerDisconnect(ws: WebSocket): void;
    handleSpectatorDisconnect(ws: WebSocket): void;
    private cancelSpectatorDisconnect;
    getActiveSessions(): Session[];
}
//# sourceMappingURL=SessionManager.d.ts.map