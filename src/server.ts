import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { SessionManager } from './sessions/SessionManager';
import { describeInvalidMessage, validateMessage } from './middleware/validator';
import { handlePlayerMessage, handlePlayerDisconnect } from './handlers/playerHandler';
import { handleSpectatorMessage, handleSpectatorDisconnect } from './handlers/spectatorHandler';
import { createObjectStorage } from './storage/ObjectStorage';
import { RateLimiter } from './middleware/rateLimiter';

type ClientRole = 'player' | 'spectator' | 'unknown';

interface ClientState {
  role: ClientRole;
  isAlive: boolean;
  messageQueue: Promise<void>;
}

export function createServer(port: number, rateLimitWindowMs: number, heartbeatIntervalMs: number) {
  const objectStorage = createObjectStorage();
  const sessionManager = new SessionManager(objectStorage);
  const clientStates = new Map<WebSocket, ClientState>();
  const spectatorRateLimiter = new RateLimiter(rateLimitWindowMs);

  if (['1', 'true', 'yes', 'on'].includes((process.env.CLEANUP_SESSION_ASSETS_ON_STARTUP || '').toLowerCase())) {
    void objectStorage.deletePrefix('sessions/').then(() => {
      console.log('[Storage] Cleared stale session map assets on startup.');
    }).catch((error) => {
      console.warn(`[Storage] Failed to clear stale session map assets on startup: ${error?.message ?? error}`);
    });
  }

  const httpServer = http.createServer(async (_req, res) => {
    const url = new URL(_req.url ?? '/', `http://${_req.headers.host ?? 'localhost'}`);

    // Debug endpoint: list all sessions with tile manifest info
    if (url.pathname === '/debug/sessions' && _req.method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      const sessions = sessionManager.getActiveSessions().map((s) => s.getDebugInfo());
      res.end(JSON.stringify({ sessions }));
      return;
    }

    const assetMatch = url.pathname.match(/^\/session-assets\/([^/]+)\/map-tiles\/(.+)$/);
    if (assetMatch) {
      const [, sessionId, assetPath] = assetMatch;
      res.setHeader('Access-Control-Allow-Origin', '*');
      let asset;
      try {
        const session = sessionManager.getSession(sessionId);
        const useRedirects = ['1', 'true', 'yes', 'on'].includes((process.env.SESSION_ASSET_REDIRECTS || '').toLowerCase());
        const downloadUrl = useRedirects ? await session?.getMapTileDownloadUrl(assetPath) : null;
        if (downloadUrl) {
          if (['1', 'true', 'yes', 'on'].includes((process.env.LOG_SESSION_ASSET_REQUESTS || '').toLowerCase())) {
            console.log(`[Assets] Redirecting tile ${sessionId}/${assetPath} to object storage.`);
          }
          res.writeHead(302, {
            Location: downloadUrl,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'private, max-age=60',
          });
          res.end();
          return;
        }

        asset = await session?.getMapTileAsset(assetPath);
      } catch (error: any) {
        console.warn(`[Server] Failed to read tile "${assetPath}" for session "${sessionId}": ${error?.message ?? error}`);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Tile storage error');
        return;
      }

      if (!asset) {
        console.warn(`[Assets] Tile not found ${sessionId}/${assetPath}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Tile not found');
        return;
      }

      if (['1', 'true', 'yes', 'on'].includes((process.env.LOG_SESSION_ASSET_REQUESTS || '').toLowerCase())) {
        console.log(`[Assets] Serving tile ${sessionId}/${assetPath} (${asset.data.length} bytes)`);
      }
      res.writeHead(200, {
        'Content-Type': asset.mimeType,
        'Cache-Control': 'private, max-age=60',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(asset.data);
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('LinkAttack WebSocket Server');
  });

  const wss = new WebSocketServer({ server: httpServer });

  // Heartbeat: detect dead connections
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const state = clientStates.get(ws);
      if (!state || !state.isAlive) {
        ws.terminate();
        continue;
      }
      state.isAlive = false;
      ws.ping();
    }
  }, heartbeatIntervalMs);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: WebSocket) => {
    const state: ClientState = { role: 'unknown', isAlive: true, messageQueue: Promise.resolve() };
    clientStates.set(ws, state);

    ws.on('pong', () => {
      state.isAlive = true;
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      state.isAlive = true;

      const message = validateMessage(raw.toString());
      if (!message) {
        const rawText = raw.toString();
        const reason = describeInvalidMessage(rawText);
        let parsedType = 'unknown';
        let parsedRequestId = '';
        try {
          const parsed = JSON.parse(rawText);
          parsedType = String(parsed?.type ?? 'unknown');
          parsedRequestId = typeof parsed?.requestId === 'string'
            ? parsed.requestId.slice(0, 96)
            : '';
        } catch {}
        console.warn(`[Server] Rejected ${parsedType}: ${reason}`);
        if (parsedType === 'rename_spectator') {
          ws.send(JSON.stringify({
            type: 'spectator_rename_result',
            requestId: parsedRequestId,
            accepted: false,
            error: reason,
          }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: `Invalid message format: ${reason}` }));
        }
        return;
      }

      // Determine role from first meaningful message
      if (state.role === 'unknown') {
        if (message.type === 'create_session') {
          state.role = 'player';
        } else {
          state.role = 'spectator';
        }
        console.log(`[Server] Client identified as ${state.role}`);
      }

      if (state.role === 'player' && (message.type === 'create_session' || message.type === 'game_state' || message.type === 'map_image' || message.type === 'map_tile' || message.type === 'map_tiles' || message.type === 'map_objects' || message.type === 'ability_manifest' || message.type === 'weapon_manifest' || message.type === 'route_layout' || message.type === 'session_status' || message.type === 'projectile_spawn' || message.type === 'projectile_destroy' || message.type === 'drop_spawn' || message.type === 'drop_destroy' || message.type === 'damage_dealt' || message.type === 'finish_game')) {
        const runPlayerMessage = () => handlePlayerMessage(ws, message, sessionManager).catch((error) => {
          console.warn(`[Server] Failed to handle player message "${message.type}": ${error?.message ?? error}`);
          ws.send(JSON.stringify({ type: 'error', message: 'Server failed to process player message.' }));
        });

        // High-priority control/gameplay messages must not sit behind large tile uploads.
        if (message.type === 'session_status' || message.type === 'route_layout' || message.type === 'map_objects' || message.type === 'ability_manifest' || message.type === 'weapon_manifest' || message.type === 'game_state' || message.type === 'finish_game') {
          void runPlayerMessage();
        } else {
          state.messageQueue = state.messageQueue
            .catch(() => undefined)
            .then(runPlayerMessage);
        }
      } else if (state.role === 'spectator') {
        if (
          message.type === 'join_session' ||
          message.type === 'leave_session' ||
          message.type === 'rename_spectator' ||
          message.type === 'list_sessions' ||
          message.type === 'action'
        ) {
          handleSpectatorMessage(ws, message, sessionManager, spectatorRateLimiter);
        }
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Unexpected message for your role.' }));
      }
    });

    ws.on('close', () => {
      if (state.role === 'player') {
        handlePlayerDisconnect(ws, sessionManager);
      } else if (state.role === 'spectator') {
        handleSpectatorDisconnect(ws, sessionManager);
      }
      clientStates.delete(ws);
      spectatorRateLimiter.removeClient(ws);
      console.log(`[Server] Client disconnected (${state.role})`);
    });

    ws.on('error', (err) => {
      console.error(`[Server] WebSocket error:`, err.message);
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[Server] LinkAttack WebSocket server running on ws://0.0.0.0:${port}`);
  });

  return { httpServer, wss };
}
