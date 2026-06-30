"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePlayerMessage = handlePlayerMessage;
exports.handlePlayerDisconnect = handlePlayerDisconnect;
async function handlePlayerMessage(ws, message, sessionManager) {
    switch (message.type) {
        case 'create_session': {
            const existing = sessionManager.getSessionByPlayer(ws);
            if (existing) {
                ws.send(JSON.stringify({ type: 'error', message: 'You already have an active session.' }));
                return;
            }
            const session = sessionManager.createSession(message.playerName, message.level, ws);
            ws.send(JSON.stringify({
                type: 'session_created',
                sessionId: session.sessionId,
            }));
            break;
        }
        case 'game_state': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                session.forwardGameState(message);
            }
            break;
        }
        case 'map_image': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                session.setMapImage(message);
            }
            break;
        }
        case 'map_tile': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                const tile = message;
                void session
                    .setMapTileAsset(String(tile.path), String(tile.mimeType ?? 'image/jpeg'), String(tile.data))
                    .then((accepted) => {
                    if (!accepted) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Runtime map tile cache limit exceeded for this session.' }));
                    }
                })
                    .catch((error) => {
                    console.warn(`[Player] Map tile upload failed for session "${session.sessionId}": ${error?.message ?? error}`);
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to store runtime map tile.' }));
                });
            }
            break;
        }
        case 'map_tiles': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                await session.setMapTiles(message);
                console.log(`[Player] Map tiles received for session "${session.sessionId}" (${message.lods?.length ?? 0} LODs)`);
            }
            break;
        }
        case 'map_objects': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                session.setMapObjects(message);
            }
            break;
        }
        case 'ability_manifest': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                session.setAbilityManifest(message);
            }
            break;
        }
        case 'weapon_manifest': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                session.setWeaponManifest(message);
            }
            break;
        }
        case 'route_layout': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                session.setRouteLayout(message);
            }
            break;
        }
        case 'session_status': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                const status = message;
                session.setSessionStatus(status.phase, status.message, Boolean(status.routeReady));
            }
            break;
        }
        case 'projectile_spawn': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session)
                session.sendToSpectators(message);
            break;
        }
        case 'projectile_destroy': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session)
                session.sendToSpectators(message);
            break;
        }
        case 'drop_spawn': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session)
                session.addDrop(message);
            break;
        }
        case 'drop_destroy': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session)
                session.removeDrop(message.id);
            break;
        }
        case 'damage_dealt': {
            const session = sessionManager.getSessionByPlayer(ws);
            const m = message;
            if (session && m.spectatorName && typeof m.damage === 'number') {
                session.recordDamage(String(m.spectatorName), Number(m.damage));
            }
            break;
        }
        case 'finish_game': {
            const session = sessionManager.getSessionByPlayer(ws);
            if (session) {
                session.finishGame(message.playerDeaths);
            }
            break;
        }
    }
}
function handlePlayerDisconnect(ws, sessionManager) {
    sessionManager.handlePlayerDisconnect(ws);
}
//# sourceMappingURL=playerHandler.js.map