import WebSocket from 'ws';
import { SessionManager } from '../sessions/SessionManager';
import {
  JoinSessionMessage,
  LeaveSessionMessage,
  RenameSpectatorMessage,
  ListSessionsMessage,
  ActionMessage,
} from '../protocol/messages';
import { RateLimiter } from '../middleware/rateLimiter';

type SpectatorMessage =
  | JoinSessionMessage
  | LeaveSessionMessage
  | RenameSpectatorMessage
  | ListSessionsMessage
  | ActionMessage;

export function handleSpectatorMessage(
  ws: WebSocket,
  message: SpectatorMessage,
  sessionManager: SessionManager,
  rateLimiter: RateLimiter
): void {
  switch (message.type) {
    case 'list_sessions': {
      const sessions = sessionManager.getActiveSessions().map((s) => s.toListEntry());
      ws.send(JSON.stringify({ type: 'session_list', sessions }));
      break;
    }

    case 'join_session': {
      const result = sessionManager.addSpectatorToSession(
        message.sessionId,
        ws,
        message.spectatorName,
        message.spectatorToken,
      );
      if ('error' in result) {
        ws.send(JSON.stringify({ type: 'error', message: result.error }));
        return;
      }
      const { session } = result;
      const bootState = session.getBootState();

      ws.send(JSON.stringify({
        type: 'session_joined',
        sessionId: session.sessionId,
        spectatorCount: session.spectatorCount,
        bootPhase: bootState.bootPhase,
        bootMessage: bootState.bootMessage,
        routeReady: bootState.routeReady,
      }));
      session.replayCachedState(ws);
      console.log(`[Spectator] "${message.spectatorName}" joined session "${session.sessionId}" (${session.spectatorCount} spectators)`);
      break;
    }

    case 'leave_session': {
      sessionManager.removeSpectatorFromAll(ws);
      ws.send(JSON.stringify({ type: 'error', message: 'Left session.' }));
      break;
    }

    case 'rename_spectator': {
      const session = sessionManager.getSession(message.sessionId);
      const error = !session
        ? 'Session not found.'
        : !session.hasSpectator(ws)
          ? 'You are not in this session.'
          : session.renameSpectator(ws, message.spectatorName);
      ws.send(JSON.stringify({
        type: 'spectator_rename_result',
        requestId: message.requestId,
        accepted: !error,
        ...(error
          ? { error }
          : { spectatorName: session?.getSpectatorName(ws) ?? message.spectatorName }),
      }));
      break;
    }

    case 'action': {
      const session = sessionManager.getSession(message.sessionId);
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session not found.' }));
        return;
      }

      if (!session.hasSpectator(ws)) {
        ws.send(JSON.stringify({ type: 'error', message: 'You are not in this session.' }));
        return;
      }

      if (!session.hasCachedActionResult(ws, message.requestId) && !rateLimiter.canPerformAction(ws)) {
        session.rejectAction(ws, message.requestId, message.action, 'rate_limited', rateLimiter.getRemainingCooldown(ws));
        return;
      }

      const accepted = session.tryForwardAction(ws, message);
      console.log(`[Action] "${message.action}" by "${session.getSpectatorName(ws) ?? 'unknown'}" → session "${message.sessionId}"`);
      break;
    }
  }
}

export function handleSpectatorDisconnect(
  ws: WebSocket,
  sessionManager: SessionManager
): void {
  sessionManager.handleSpectatorDisconnect(ws);
}
