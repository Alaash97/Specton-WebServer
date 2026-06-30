"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const Session_1 = require("./Session");
class SessionManager {
    constructor(objectStorage) {
        this.objectStorage = objectStorage;
        this.sessions = new Map();
        this.playerToSession = new Map();
        this.spectatorToSession = new Map();
        this.spectatorDisconnectTimers = new Map();
    }
    createSession(playerName, level, playerWs) {
        const session = new Session_1.Session(playerName, level, playerWs, this.objectStorage);
        this.sessions.set(session.sessionId, session);
        this.playerToSession.set(playerWs, session.sessionId);
        console.log(`[Session] Created "${session.sessionId}" by ${playerName} (level: ${level})`);
        return session;
    }
    removeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.sendToSpectators({ type: 'session_ended', sessionId });
        this.playerToSession.delete(session.playerConnection);
        void session.clearCachedAssets().catch((error) => {
            console.warn(`[Session] Failed to clear cached assets for "${sessionId}": ${error?.message ?? error}`);
        });
        this.sessions.delete(sessionId);
        console.log(`[Session] Removed "${sessionId}"`);
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getSessionByPlayer(ws) {
        const sessionId = this.playerToSession.get(ws);
        return sessionId ? this.sessions.get(sessionId) : undefined;
    }
    getSessionBySpectator(ws) {
        const sessionId = this.spectatorToSession.get(ws);
        return sessionId ? this.sessions.get(sessionId) : undefined;
    }
    addSpectatorToSession(sessionId, ws, spectatorName, spectatorToken) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return { error: 'Session not found.' };
        if (session.isFinished && !spectatorToken) {
            return { error: 'This arena has already finished.' };
        }
        // Remove from any previous session first
        this.removeSpectatorFromAll(ws);
        const result = session.addSpectator(ws, spectatorName, spectatorToken);
        if (result === null) {
            return {
                error: session.isFinished
                    ? 'This arena has already finished.'
                    : 'Name already taken in this session.',
            };
        }
        if (result.replacedWs) {
            this.cancelSpectatorDisconnect(result.replacedWs);
            this.spectatorToSession.delete(result.replacedWs);
        }
        this.spectatorToSession.set(ws, sessionId);
        return { session };
    }
    removeSpectatorFromAll(ws) {
        this.cancelSpectatorDisconnect(ws);
        const sessionId = this.spectatorToSession.get(ws);
        if (sessionId) {
            const session = this.sessions.get(sessionId);
            session?.removeSpectator(ws);
            this.spectatorToSession.delete(ws);
        }
    }
    handlePlayerDisconnect(ws) {
        const session = this.getSessionByPlayer(ws);
        if (session) {
            this.removeSession(session.sessionId);
        }
    }
    handleSpectatorDisconnect(ws) {
        const session = this.getSessionBySpectator(ws);
        if (!session || !session.getSpectatorToken(ws)) {
            this.removeSpectatorFromAll(ws);
            return;
        }
        this.cancelSpectatorDisconnect(ws);
        const timer = setTimeout(() => {
            this.spectatorDisconnectTimers.delete(ws);
            this.removeSpectatorFromAll(ws);
        }, SessionManager.SPECTATOR_RECONNECT_GRACE_MS);
        timer.unref?.();
        this.spectatorDisconnectTimers.set(ws, timer);
    }
    cancelSpectatorDisconnect(ws) {
        const timer = this.spectatorDisconnectTimers.get(ws);
        if (!timer)
            return;
        clearTimeout(timer);
        this.spectatorDisconnectTimers.delete(ws);
    }
    getActiveSessions() {
        return Array.from(this.sessions.values()).filter((session) => !session.isFinished);
    }
}
exports.SessionManager = SessionManager;
SessionManager.SPECTATOR_RECONNECT_GRACE_MS = 60000;
//# sourceMappingURL=SessionManager.js.map