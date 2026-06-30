import WebSocket from 'ws';
import { Session } from './Session';
import { ObjectStorage } from '../storage/ObjectStorage';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private playerToSession: Map<WebSocket, string> = new Map();
  private spectatorToSession: Map<WebSocket, string> = new Map();
  private spectatorDisconnectTimers: Map<WebSocket, NodeJS.Timeout> = new Map();
  private static readonly SPECTATOR_RECONNECT_GRACE_MS = 60_000;

  constructor(private readonly objectStorage: ObjectStorage) {}

  createSession(playerName: string, level: string, playerWs: WebSocket): Session {
    const session = new Session(playerName, level, playerWs, this.objectStorage);
    this.sessions.set(session.sessionId, session);
    this.playerToSession.set(playerWs, session.sessionId);
    console.log(`[Session] Created "${session.sessionId}" by ${playerName} (level: ${level})`);
    return session;
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.sendToSpectators({ type: 'session_ended', sessionId });
    this.playerToSession.delete(session.playerConnection);
    void session.clearCachedAssets().catch((error) => {
      console.warn(`[Session] Failed to clear cached assets for "${sessionId}": ${error?.message ?? error}`);
    });
    this.sessions.delete(sessionId);
    console.log(`[Session] Removed "${sessionId}"`);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByPlayer(ws: WebSocket): Session | undefined {
    const sessionId = this.playerToSession.get(ws);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  getSessionBySpectator(ws: WebSocket): Session | undefined {
    const sessionId = this.spectatorToSession.get(ws);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  addSpectatorToSession(
    sessionId: string,
    ws: WebSocket,
    spectatorName: string,
    spectatorToken?: string,
  ): { session: Session; error?: undefined } | { session?: undefined; error: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'Session not found.' };
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

  removeSpectatorFromAll(ws: WebSocket): void {
    this.cancelSpectatorDisconnect(ws);
    const sessionId = this.spectatorToSession.get(ws);
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      session?.removeSpectator(ws);
      this.spectatorToSession.delete(ws);
    }
  }

  handlePlayerDisconnect(ws: WebSocket): void {
    const session = this.getSessionByPlayer(ws);
    if (session) {
      this.removeSession(session.sessionId);
    }
  }

  handleSpectatorDisconnect(ws: WebSocket): void {
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

  private cancelSpectatorDisconnect(ws: WebSocket): void {
    const timer = this.spectatorDisconnectTimers.get(ws);
    if (!timer) return;
    clearTimeout(timer);
    this.spectatorDisconnectTimers.delete(ws);
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((session) => !session.isFinished);
  }
}
